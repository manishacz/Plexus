import mongoose from 'mongoose';

const UploadSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // Optional for backward compatibility
        index: true
    },
    threadId: {
        type: String,
        required: true,
        index: true
    },
    filename: {
        type: String,
        required: true,
        unique: true
    },
    originalName: {
        type: String,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    storageUrl: {
        type: String,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    extractedText: {
        type: String,
        default: ''
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound indexes for efficient queries
UploadSchema.index({ userId: 1, uploadedAt: -1 });
UploadSchema.index({ threadId: 1, uploadedAt: -1 });

// Static method to find uploads by thread
UploadSchema.statics.findByThread = function(threadId) {
    return this.find({ threadId }).sort({ uploadedAt: -1 });
};

// Static method to find uploads by user
UploadSchema.statics.findByUser = function(userId) {
    return this.find({ userId }).sort({ uploadedAt: -1 });
};

// Instance method to check if file is an image
UploadSchema.methods.isImage = function() {
    return this.mimeType.startsWith('image/');
};

// Instance method to check if file is a document
UploadSchema.methods.isDocument = function() {
    const docTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/csv'
    ];
    return docTypes.includes(this.mimeType);
};

export default mongoose.model('Upload', UploadSchema);

