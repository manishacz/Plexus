const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Allowed file types
const ALLOWED_MIME_TYPES = {
    // Images
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    // Documents
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt',
    'text/csv': '.csv'
};

// File size limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB for chunked uploads

// Storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create directory structure: uploads/{userId}/{YYYY-MM-DD}/
        const userId = req.user?.id || 'anonymous';
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        const uploadDir = path.join(__dirname, '..', 'uploads', userId, dateStr);
        
        // Create directory if it doesn't exist
        fs.mkdirSync(uploadDir, { recursive: true });
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename: uuid-timestamp-originalname
        const uniqueId = uuidv4();
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const sanitizedName = file.originalname
            .replace(ext, '')
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 50);
        
        const filename = `${uniqueId}-${timestamp}-${sanitizedName}${ext}`;
        cb(null, filename);
    }
});

// File filter for validation
const fileFilter = (req, file, cb) => {
    // Check if MIME type is allowed
    if (ALLOWED_MIME_TYPES[file.mimetype]) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} is not supported. Allowed types: PNG, JPG, JPEG, WebP, PDF, DOCX, TXT, CSV`), false);
    }
};

// Multer configuration
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 5 // Maximum 5 files per request
    }
});

// Helper function to validate file extension matches MIME type
const validateFileType = (file) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const expectedExt = ALLOWED_MIME_TYPES[file.mimetype];
    
    if (!expectedExt) {
        return { valid: false, error: 'Unsupported file type' };
    }
    
    // Check if extension matches MIME type
    if (ext !== expectedExt && !(ext === '.jpeg' && expectedExt === '.jpg')) {
        return { 
            valid: false, 
            error: `File extension ${ext} does not match MIME type ${file.mimetype}` 
        };
    }
    
    return { valid: true };
};

// Helper function to sanitize filename
const sanitizeFilename = (filename) => {
    return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_{2,}/g, '_')
        .substring(0, 255);
};

// Helper function to get file category
const getFileCategory = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
    if (mimeType === 'text/plain') return 'text';
    if (mimeType === 'text/csv') return 'csv';
    return 'unknown';
};

module.exports = {
    upload,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE,
    CHUNK_SIZE,
    validateFileType,
    sanitizeFilename,
    getFileCategory
};

