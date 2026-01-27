import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    threadId: {
        type: String, // Changed to String to match the UUID used in frontend/Thread.js
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    fileReferences: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Upload'
    }],
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

export default mongoose.model('Message', messageSchema);
