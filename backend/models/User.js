import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
    sessionToken: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    expires: {
        type: Date,
        required: true,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const UserSchema = new mongoose.Schema({
    googleId: {
        type: String,
        unique: true,
        sparse: true, // Allows null/undefined values to exist multiple times (for mobile-only users)
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    phoneNumber: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    phoneCountryCode: String,
    phoneVerified: {
        type: Boolean,
        default: false
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    authMethod: {
        type: String,
        enum: ['mobile', 'google', 'email'],
        default: 'email'
    },
    name: {
        type: String,
        trim: true
    },
    image: {
        type: String,
        default: null
    },
    sessions: [SessionSchema],
    security: {
        lastLogin: Date,
        loginHistory: [{
            ip: String,
            userAgent: String,
            timestamp: Date,
            location: String
        }],
        failedLoginAttempts: {
            type: Number,
            default: 0
        },
        accountLockedUntil: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for session token lookup
UserSchema.index({ 'sessions.sessionToken': 1 });

// Method to clean expired sessions
UserSchema.methods.cleanExpiredSessions = function () {
    const now = new Date();
    this.sessions = this.sessions.filter(session => session.expires > now);
    return this.save();
};

// Static method to find user by session token
UserSchema.statics.findBySessionToken = async function (sessionToken) {
    return this.findOne({
        'sessions.sessionToken': sessionToken,
        'sessions.expires': { $gt: new Date() }
    });
};

export default mongoose.model("User", UserSchema);

