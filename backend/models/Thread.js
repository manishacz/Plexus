import mongoose from "mongoose";    
const MessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ["user", "assistant"],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timeStamp: {
        type: Date,
        default: Date.now
    }, 
});

const ThreadSchema = new mongoose.Schema({
    threadId: {
        type: String,
        required: true,
        unique: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // Optional to maintain backward compatibility
        index: true
    },
    title: {
        type: String,
        default: "New Thread"
    },
    messages: [MessageSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }

});

// Compound index for efficient user-specific thread queries
ThreadSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model("Thread", ThreadSchema);
