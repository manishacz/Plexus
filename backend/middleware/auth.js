import { verifyToken, extractToken } from '../utils/jwt.js';
import User from '../models/User.js';

/**
 * Middleware to authenticate requests using JWT
 * Attaches user object to req.user if authentication is successful
 */
export const authenticate = async (req, res, next) => {
    try {
        // Extract token from request
        const token = extractToken(req);

        if (!token) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'No authentication token provided'
            });
        }

        // Verify token
        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (error) {
            return res.status(401).json({
                error: 'Invalid token',
                message: error.message
            });
        }

        // Find user by ID
        const user = await User.findById(decoded.id).select('-sessions');

        if (!user) {
            return res.status(401).json({
                error: 'User not found',
                message: 'The user associated with this token no longer exists'
            });
        }

        // Attach user to request
        req.user = {
            id: user._id,
            email: user.email,
            name: user.name,
            image: user.image
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({
            error: 'Authentication failed',
            message: 'An error occurred during authentication'
        });
    }
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't block if no token
 */
export const optionalAuthenticate = async (req, res, next) => {
    try {
        const token = extractToken(req);

        if (!token) {
            return next();
        }

        const decoded = verifyToken(token);
        const user = await User.findById(decoded.id).select('-sessions');

        if (user) {
            req.user = {
                id: user._id,
                email: user.email,
                name: user.name,
                image: user.image
            };
        }

        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};

/**
 * Middleware to check if user is authenticated
 * Returns 401 if not authenticated
 */
export const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'You must be logged in to access this resource'
        });
    }
    next();
};

