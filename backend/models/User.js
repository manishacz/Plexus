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
        required: true,
        unique: true,
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
    name: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,
        default: null
    },
    sessions: [SessionSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: Date.now
    }
});

// Index for session token lookup
UserSchema.index({ 'sessions.sessionToken': 1 });

// Method to clean expired sessions
UserSchema.methods.cleanExpiredSessions = function() {
    const now = new Date();
    this.sessions = this.sessions.filter(session => session.expires > now);
    return this.save();
};

// Static method to find user by session token
UserSchema.statics.findBySessionToken = async function(sessionToken) {
    return this.findOne({
        'sessions.sessionToken': sessionToken,
        'sessions.expires': { $gt: new Date() }
    });
};

export default mongoose.model("User", UserSchema);

