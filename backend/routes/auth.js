import express from 'express';
import passport from 'passport';
import User from '../models/User.js';
import { generateToken, generateSessionToken, getSessionExpiration } from '../utils/jwt.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import validator from 'validator';
import { parsePhoneNumber } from 'libphonenumber-js';
import otpGenerator from 'otp-generator';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import Otp from '../models/Otp.js';

const router = express.Router();

// Security configuration for cookies
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
                    return res.redirect(`${process.env.FRONTEND_URL || 'https://plexus-bay.vercel.app'}/login?error=${errorMessage}`);
                }

                if (!user) {
                    console.error('No user returned from OAuth');
                    return res.redirect(`${process.env.FRONTEND_URL || 'https://plexus-bay.vercel.app'}/login?error=authentication_failed`);
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
                res.redirect(`${process.env.FRONTEND_URL || 'https://plexus-bay.vercel.app/chat'}?auth=success`);
            } catch (error) {
                console.error('Error in OAuth callback:', error);
                res.redirect(`${process.env.FRONTEND_URL || 'https://plexus-bay.vercel.app'}/login?error=server_error`);
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
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
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
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
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


// Resend client setup
const resend = new Resend(process.env.RESEND_API_KEY);

// Helper to mask email
const maskEmail = (email) => {
    const [name, domain] = email.split('@');
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
};

/**
 * @route   POST /api/auth/send-otp
 * @desc    Send OTP to registered email or provided email for new users
 * @access  Public
 */
router.post('/send-otp', authRateLimiter, async (req, res) => {
    try {
        const { phoneNumber, email } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        const phoneNumberParsed = parsePhoneNumber(phoneNumber);
        if (!phoneNumberParsed || !phoneNumberParsed.isValid()) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }

        const formattedPhoneNumber = phoneNumberParsed.number;

        let user = await User.findOne({ phoneNumber: formattedPhoneNumber });
        let targetEmail;

        if (user) {
            targetEmail = user.email;
        } else {
            if (!email) {
                return res.status(404).json({
                    error: 'EMAIL_REQUIRED',
                    message: 'Phone number not registered. Please provide email.'
                });
            }

            if (!validator.isEmail(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            const existingEmailUser = await User.findOne({ email });
            if (existingEmailUser) {
                return res.status(400).json({
                    error: 'Email already registered',
                    message: 'Please log in using email.'
                });
            }

            targetEmail = email;
        }

        const otp = otpGenerator.generate(6, {
            digits: true,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false
        });

        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await Otp.findOneAndUpdate(
            { phoneNumber: formattedPhoneNumber },
            {
                otpHash,
                email: targetEmail,
                expiresAt,
                attempts: 0,
                verified: false,
                requestIp: req.ip,
                requestUserAgent: req.get('User-Agent')
            },
            { upsert: true, new: true }
        );

        const isDev = process.env.NODE_ENV !== 'production';

        if (isDev) {
            return res.json({
                success: true,
                message: 'OTP generated (development mode)',
                otp,
                expiresIn: 600,
                email: maskEmail(targetEmail)
            });
        }

        const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM || 'Plexus <onboarding@resend.dev>',
            to: [targetEmail],
            subject: 'Your Plexus Login OTP',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Plexus Verification</h2>
                    <p>Your One-Time Password (OTP) is:</p>
                    <h1 style="letter-spacing: 5px;">${otp}</h1>
                    <p>This code will expire in 10 minutes.</p>
                </div>
            `
        });

        if (error) {
            return res.status(500).json({
                error: 'Email sending failed',
                message: error.message
            });
        }

        res.json({
            success: true,
            message: 'OTP sent successfully',
            expiresIn: 600,
            email: maskEmail(targetEmail)
        });

    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({
            error: 'Failed to send OTP',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP and login/register user
 * @access  Public
 */
router.post('/verify-otp', authRateLimiter, async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        if (!phoneNumber || !otp) {
            return res.status(400).json({ error: 'Phone number and OTP are required' });
        }

        const phoneNumberParsed = parsePhoneNumber(phoneNumber);
        const formattedPhoneNumber = phoneNumberParsed ? phoneNumberParsed.number : phoneNumber;

        // 1. Find OTP Record
        const otpRecord = await Otp.findOne({
            phoneNumber: formattedPhoneNumber,
            expiresAt: { $gt: new Date() }
        });

        if (!otpRecord) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // 2. Verify OTP
        const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);
        if (!isMatch) {
            // Increment attempts
            otpRecord.attempts += 1;
            await otpRecord.save();

            if (otpRecord.attempts >= 3) {
                await Otp.deleteOne({ _id: otpRecord._id }); // Invalidate
                return res.status(401).json({ error: 'Maximum attempts exceeded. Please request a new OTP.' });
            }
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        // 3. Mark OTP as verified (or delete it)
        otpRecord.verified = true;
        otpRecord.verifiedAt = new Date();
        await otpRecord.save();

        // 4. Find or Create User
        let user = await User.findOne({ phoneNumber: formattedPhoneNumber });

        if (!user) {
            // Check if email was provided during send-otp (stored in Otp record implicitly or we used passed email?)
            // We stored `email` in the Otp record.
            const email = otpRecord.email;

            // final check if email exists (race condition)
            user = await User.findOne({ email });

            if (user) {
                // Link phone to existing email user
                user.phoneNumber = formattedPhoneNumber;
                user.phoneCountryCode = phoneNumberParsed.country;
                user.phoneVerified = true;
                await user.save();
            } else {
                // Create new user
                user = new User({
                    email,
                    phoneNumber: formattedPhoneNumber,
                    phoneCountryCode: phoneNumberParsed.country,
                    phoneVerified: true,
                    emailVerified: true, // Verified via OTP sent to email
                    authMethod: 'mobile',
                    name: 'User', // Default name
                    image: null
                });
                await user.save();
            }
        } else {
            // Existing user login
            // Update verification status just in case
            if (!user.phoneVerified) {
                user.phoneVerified = true;
                await user.save();
            }
        }

        // Clear OTP record after successful use
        await Otp.deleteOne({ _id: otpRecord._id });

        // 5. Generate Tokens
        const token = generateToken(user);
        const sessionToken = generateSessionToken();
        const sessionExpires = getSessionExpiration();

        user.sessions.push({ sessionToken, expires: sessionExpires });
        user.lastLogin = new Date();

        // Access security object safely
        if (!user.security) user.security = {};
        user.security.lastLogin = new Date();
        user.security.loginHistory = user.security.loginHistory || [];
        user.security.loginHistory.push({
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date()
        });

        await user.save();

        res.cookie('token', token, COOKIE_OPTIONS);

        res.json({
            success: true,
            message: 'Phone verified successfully',
            token,
            user: {
                id: user._id,
                phoneNumber: user.phoneNumber,
                email: user.email,
                name: user.name,
                image: user.image
            }
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Verification failed', message: error.message });
    }
});

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP
 * @access  Public
 */
router.post('/resend-otp', authRateLimiter, async (req, res) => {
    // Reuse send-otp logic or similar. 
    // For simplicity, we can forward to send-otp handler internally or just return 200 if frontend calls send-otp again.
    // But let's follow the spec.
    try {
        const { phoneNumber } = req.body;
        // In a real app, logic is same as send-otp.
        // We just need to ensure rate limiting.
        // For now, let's just claim success to satisfy the endpoint, 
        // the Frontend likely re-calls send-otp or we can call the logic.

        // Let's redirect logic to send-otp handler logic (by calling it? Validation is tricky with req/res).
        // Best: Copy paste key logic or Refactor.
        // Given constraints, I'll just copy the "Sending" logic or assume Client calls send-otp.
        // But spec says "resend-otp" endpoint. 
        // We'll leave it as a placeholder that tells client "Use send-otp" or just implement it.

        // Let's implement minimal resend:
        // Client calls this, we generate new OTP and send it.
        res.status(307).redirect('/api/auth/send-otp');
        // 307 preserves Method (POST) and Body.

    } catch (error) {
        res.status(500).json({ error: 'Failed to resend' });
    }
});

export default router;

