const Joi = require('joi');
const path = require('path');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = require('../config/upload');

/**
 * Validate uploaded file
 */
const validateFile = (req, res, next) => {
    if (!req.file && !req.files) {
        return res.status(400).json({ 
            error: 'No file uploaded',
            message: 'Please select a file to upload'
        });
    }
    
    const files = req.files || [req.file];
    
    // Validate each file
    for (const file of files) {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return res.status(400).json({ 
                error: 'File too large',
                message: `File ${file.originalname} exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
                maxSize: MAX_FILE_SIZE
            });
        }
        
        // Check MIME type
        if (!ALLOWED_MIME_TYPES[file.mimetype]) {
            return res.status(400).json({ 
                error: 'Invalid file type',
                message: `File type ${file.mimetype} is not supported`,
                allowedTypes: Object.keys(ALLOWED_MIME_TYPES)
            });
        }
        
        // Validate file extension matches MIME type
        const ext = path.extname(file.originalname).toLowerCase();
        const expectedExt = ALLOWED_MIME_TYPES[file.mimetype];
        
        if (ext !== expectedExt && !(ext === '.jpeg' && expectedExt === '.jpg')) {
            return res.status(400).json({ 
                error: 'File extension mismatch',
                message: `File extension ${ext} does not match MIME type ${file.mimetype}`,
                expected: expectedExt
            });
        }
        
        // Sanitize filename to prevent path traversal
        const sanitizedName = path.basename(file.originalname);
        if (sanitizedName !== file.originalname) {
            return res.status(400).json({ 
                error: 'Invalid filename',
                message: 'Filename contains invalid characters or path components'
            });
        }
        
        // Check for null bytes (security)
        if (file.originalname.includes('\0')) {
            return res.status(400).json({ 
                error: 'Invalid filename',
                message: 'Filename contains null bytes'
            });
        }
    }
    
    next();
};

/**
 * Validate upload request body
 */
const validateUploadRequest = (req, res, next) => {
    const schema = Joi.object({
        threadId: Joi.string().required().messages({
            'string.empty': 'Thread ID is required',
            'any.required': 'Thread ID is required'
        }),
        message: Joi.string().optional().allow('').max(10000).messages({
            'string.max': 'Message cannot exceed 10000 characters'
        })
    });
    
    const { error, value } = schema.validate(req.body);
    
    if (error) {
        return res.status(400).json({ 
            error: 'Validation error',
            message: error.details[0].message,
            details: error.details
        });
    }
    
    req.validatedBody = value;
    next();
};

/**
 * Validate file ID parameter
 */
const validateFileId = (req, res, next) => {
    const schema = Joi.object({
        id: Joi.string().required().hex().length(24).messages({
            'string.hex': 'Invalid file ID format',
            'string.length': 'Invalid file ID length',
            'any.required': 'File ID is required'
        })
    });
    
    const { error } = schema.validate({ id: req.params.id });
    
    if (error) {
        return res.status(400).json({ 
            error: 'Validation error',
            message: error.details[0].message
        });
    }
    
    next();
};

/**
 * Check file ownership
 */
const checkFileOwnership = async (req, res, next) => {
    try {
        const Upload = require('../models/Upload');
        const fileId = req.params.id;
        
        const upload = await Upload.findById(fileId);
        
        if (!upload) {
            return res.status(404).json({ 
                error: 'File not found',
                message: 'The requested file does not exist'
            });
        }
        
        // Check if user owns the file
        if (req.user && upload.userId && upload.userId.toString() !== req.user.id) {
            return res.status(403).json({ 
                error: 'Access denied',
                message: 'You do not have permission to access this file'
            });
        }
        
        req.upload = upload;
        next();
    } catch (error) {
        console.error('Error checking file ownership:', error);
        return res.status(500).json({ 
            error: 'Server error',
            message: 'Failed to verify file ownership'
        });
    }
};

/**
 * Sanitize filename to prevent security issues
 */
const sanitizeFilename = (filename) => {
    return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.{2,}/g, '.')
        .replace(/_{2,}/g, '_')
        .substring(0, 255);
};

module.exports = {
    validateFile,
    validateUploadRequest,
    validateFileId,
    checkFileOwnership,
    sanitizeFilename
};

