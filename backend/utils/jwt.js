import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days
const SESSION_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object with id, email, name
 * @returns {string} JWT token
 */
export const generateToken = (user) => {
    try {
        const payload = {
            id: user._id || user.id,
            email: user.email,
            name: user.name
        };

        return jwt.sign(payload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
            issuer: 'plexus-app',
            audience: 'plexus-users'
        });
    } catch (error) {
        console.error('Error generating token:', error);
        throw new Error('Failed to generate authentication token');
    }
};

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET, {
            issuer: 'plexus-app',
            audience: 'plexus-users'
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token has expired');
        } else if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        } else {
            throw new Error('Token verification failed');
        }
    }
};

/**
 * Generate a secure session token
 * @returns {string} Random session token
 */
export const generateSessionToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Calculate session expiration date
 * @returns {Date} Expiration date
 */
export const getSessionExpiration = () => {
    return new Date(Date.now() + SESSION_EXPIRES_IN);
};

/**
 * Extract token from request headers or cookies
 * @param {Object} req - Express request object
 * @returns {string|null} Token or null
 */
export const extractToken = (req) => {
    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        return req.headers.authorization.substring(7);
    }
    
    // Check cookies
    if (req.cookies && req.cookies.token) {
        return req.cookies.token;
    }
    
    return null;
};

