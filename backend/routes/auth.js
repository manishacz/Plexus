import express from 'express';
import passport from 'passport';
import User from '../models/User.js';
import { generateToken, generateSessionToken, getSessionExpiration } from '../utils/jwt.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import validator from 'validator';

const router = express.Router();

// Security configuration for cookies
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth flow
 * @access  Public
 */
router.get(
    '/google',
    authRateLimiter,
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })
);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get(
    '/google/callback',
    authRateLimiter,
    (req, res, next) => {
        passport.authenticate('google', { session: false }, async (err, user, info) => {
            try {
                // Handle authentication errors
                if (err) {
                    console.error('OAuth callback error:', err);
                    const errorMessage = encodeURIComponent(err.message || 'Authentication failed');
                    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=${errorMessage}`);
                }

                if (!user) {
                    console.error('No user returned from OAuth');
                    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=authentication_failed`);
                }

                // Generate JWT token
                const token = generateToken(user);

                // Create session token
                const sessionToken = generateSessionToken();
                const sessionExpires = getSessionExpiration();

                // Add session to user
                user.sessions.push({
                    sessionToken,
                    expires: sessionExpires
                });

                await user.save();

                // Set cookie with JWT token
                res.cookie('token', token, COOKIE_OPTIONS);

                // Log successful authentication
                console.log(`User authenticated successfully: ${user.email}`);

                // Redirect to frontend with success
                res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?auth=success`);
            } catch (error) {
                console.error('Error in OAuth callback:', error);
                res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=server_error`);
            }
        })(req, res, next);
    }
);

/**
 * @route   GET /api/auth/user
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/user', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-sessions -__v');
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'User account no longer exists'
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                image: user.image,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            }
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            error: 'Server error',
            message: 'Failed to fetch user information'
        });
    }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and clear session
 * @access  Private
 */
router.post('/logout', authenticate, async (req, res) => {
    try {
        // Clear the token cookie
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
        });

        // Clean up user sessions
        const user = await User.findById(req.user.id);
        if (user) {
            await user.cleanExpiredSessions();
        }

        console.log(`User logged out: ${req.user.email}`);

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Logout failed',
            message: 'An error occurred during logout'
        });
    }
});

/**
 * @route   GET /api/auth/status
 * @desc    Check authentication status
 * @access  Public
 */
router.get('/status', (req, res) => {
    res.json({
        authenticated: false,
        message: 'Not authenticated'
    });
});

/**
 * @route   DELETE /api/auth/account
 * @desc    Delete user account (optional - for GDPR compliance)
 * @access  Private
 */
router.delete('/account', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        // Delete user account
        await User.findByIdAndDelete(userId);

        // Clear cookie
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
        });

        console.log(`User account deleted: ${req.user.email}`);

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({
            error: 'Deletion failed',
            message: 'Failed to delete account'
        });
    }
});

// Error handler for authentication routes
router.use((err, req, res, next) => {
    console.error('Auth route error:', err);
    
    res.status(err.status || 500).json({
        error: err.message || 'Authentication error',
        message: 'An error occurred during authentication'
    });
});

export default router;

