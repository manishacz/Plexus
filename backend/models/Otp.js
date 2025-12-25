import mongoose from 'mongoose';

const OtpSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        index: true
    },
    otpHash: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    attempts: {
        type: Number,
        default: 0,
        max: 3
    },
    verified: {
        type: Boolean,
        default: false
    },
    requestIp: String,
    requestUserAgent: String,
    verifiedAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// TTL Index for automatic cleanup (expires after expiresAt)
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Otp', OtpSchema);
