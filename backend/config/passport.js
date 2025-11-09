import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import validator from 'validator';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8080/api/auth/google/callback';

// Validate environment variables
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('ERROR: Google OAuth credentials are not configured in environment variables');
}

/**
 * Configure Passport with Google OAuth 2.0 Strategy
 */
const configurePassport = () => {
    passport.use(
        new GoogleStrategy(
            {
                clientID: GOOGLE_CLIENT_ID,
                clientSecret: GOOGLE_CLIENT_SECRET,
                callbackURL: CALLBACK_URL,
                proxy: true
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // Validate profile data
                    if (!profile.id || !profile.emails || !profile.emails[0]) {
                        return done(new Error('Invalid profile data from Google'), null);
                    }

                    const email = profile.emails[0].value;
                    
                    // Validate email format
                    if (!validator.isEmail(email)) {
                        return done(new Error('Invalid email format'), null);
                    }

                    // Sanitize user data
                    const googleId = validator.escape(profile.id);
                    const name = validator.escape(profile.displayName || 'User');
                    const image = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

                    // Find or create user
                    let user = await User.findOne({ googleId });

                    if (user) {
                        // Update existing user
                        user.lastLogin = new Date();
                        user.name = name;
                        user.image = image;
                        
                        // Clean expired sessions
                        await user.cleanExpiredSessions();
                        await user.save();
                        
                        return done(null, user);
                    } else {
                        // Check if email already exists with different googleId
                        const existingUser = await User.findOne({ email });
                        if (existingUser) {
                            return done(new Error('Email already registered with different account'), null);
                        }

                        // Create new user
                        user = new User({
                            googleId,
                            email,
                            name,
                            image,
                            sessions: []
                        });

                        await user.save();
                        return done(null, user);
                    }
                } catch (error) {
                    console.error('Error in Google OAuth strategy:', error);
                    return done(error, null);
                }
            }
        )
    );

    // Serialize user for session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user from session
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });
};

export default configurePassport;

