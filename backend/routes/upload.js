import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { optionalAuthenticate } from '../middleware/auth.js';
import Upload from '../models/Upload.js';
import { processFile, encodeImageToBase64 } from '../utils/fileProcessor.js';

const router = express.Router();

const ALLOWED_MIME_TYPES = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt',
    'text/csv': '.csv'
};

// Max file size 16MB (Mongo document limit is 16MB, keeping it safe)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Use Memory Storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES[file.mimetype]) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} is not supported`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 5
    }
});

const uploadSchema = Joi.object({
    threadId: Joi.string().required(),
    message: Joi.string().optional().allow('').max(10000)
});

const uploadRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: {
        error: 'Too many uploads',
        message: 'Maximum 10 uploads per hour. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip
});

const validateFileId = (req, res, next) => {
    const schema = Joi.object({
        id: Joi.string().required().hex().length(24)
    });
    const { error } = schema.validate({ id: req.params.id });
    if (error) {
        return res.status(400).json({ error: 'Validation error', message: 'Invalid file ID' });
    }
    next();
};

const checkFileOwnership = async (req, res, next) => {
    try {
        const upload = await Upload.findById(req.params.id);
        if (!upload) {
            return res.status(404).json({ error: 'File not found', message: 'The requested file does not exist' });
        }
        if (req.user && upload.userId && upload.userId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Access denied', message: 'You do not have permission to access this file' });
        }
        req.upload = upload;
        next();
    } catch (error) {
        console.error('Error checking file ownership:', error);
        return res.status(500).json({ error: 'Server error', message: 'Failed to verify file ownership' });
    }
};

/**
 * POST /api/upload
 * Upload single or multiple files
 */
router.post('/',
    optionalAuthenticate,
    uploadRateLimiter,
    (req, res, next) => {
        upload.array('files', 5)(req, res, (err) => {
            if (err) {
                console.error('Multer error:', err);
                return res.status(400).json({
                    error: 'Upload failed',
                    message: err.message
                });
            }
            next();
        });
    },
    async (req, res) => {
        try {
            const files = req.files;
            const { error, value } = uploadSchema.validate(req.body);

            if (error) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: error.details[0].message
                });
            }

            const { threadId } = value;
            const userId = req.user?.id || null;

            if (!files || files.length === 0) {
                return res.status(400).json({
                    error: 'No files uploaded',
                    message: 'Please select at least one file'
                });
            }

            const uploadedFiles = [];

            for (const file of files) {
                // Process file to extract text/metadata
                let processedData = {};
                try {
                    processedData = await processFile(file);
                    console.log(`File processed: ${file.originalname}, extracted ${processedData.text?.length || 0} characters`);
                } catch (procError) {
                    console.error(`File processing error for ${file.originalname}:`, procError);
                    processedData = { error: procError.message, text: '' };
                }

                const uniqueFilename = `${uuidv4()}-${file.originalname}`;

                const uploadRecord = new Upload({
                    userId: userId,
                    threadId: threadId,
                    filename: uniqueFilename,
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    fileData: file.buffer, // Store buffer directly
                    // storageUrl removed or handled gracefully
                    metadata: processedData,
                    extractedText: processedData.text || ''
                });

                await uploadRecord.save();

                uploadedFiles.push({
                    id: uploadRecord._id,
                    filename: uploadRecord.filename,
                    originalName: uploadRecord.originalName,
                    mimeType: uploadRecord.mimeType,
                    size: uploadRecord.size,
                    uploadedAt: uploadRecord.uploadedAt
                });
            }

            res.status(201).json({
                success: true,
                message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
                files: uploadedFiles
            });

        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({
                error: 'Upload failed',
                message: error.message
            });
        }
    }
);

/**
 * GET /api/upload/:id
 * Get file metadata
 */
router.get('/:id',
    optionalAuthenticate,
    validateFileId,
    checkFileOwnership,
    async (req, res) => {
        try {
            const upload = req.upload;

            res.json({
                id: upload._id,
                filename: upload.filename,
                originalName: upload.originalName,
                mimeType: upload.mimeType,
                size: upload.size,
                metadata: upload.metadata,
                extractedText: upload.extractedText,
                uploadedAt: upload.uploadedAt,
                threadId: upload.threadId
            });

        } catch (error) {
            console.error('Error fetching file metadata:', error);
            res.status(500).json({
                error: 'Server error',
                message: 'Failed to fetch file metadata'
            });
        }
    }
);

/**
 * GET /api/upload/:id/download
 * Download file (served from DB buffer)
 */
router.get('/:id/download',
    optionalAuthenticate,
    validateFileId,
    checkFileOwnership,
    async (req, res) => {
        try {
            // Need to fetch buffer (it's not selected by default)
            const upload = await Upload.findById(req.params.id).select('+fileData');

            if (!upload || !upload.fileData) {
                return res.status(404).json({
                    error: 'File not found',
                    message: 'The file data could not be retrieved'
                });
            }

            res.setHeader('Content-Type', upload.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${upload.originalName}"`);

            res.send(upload.fileData);

        } catch (error) {
            console.error('Error downloading file:', error);
            res.status(500).json({
                error: 'Download failed',
                message: 'Failed to download file'
            });
        }
    }
);

/**
 * GET /api/upload/:id/base64
 * Get image as base64 (for GPT-4 Vision)
 */
router.get('/:id/base64',
    optionalAuthenticate,
    validateFileId,
    checkFileOwnership,
    async (req, res) => {
        try {
            // Need to fetch buffer
            const upload = await Upload.findById(req.params.id).select('+fileData');

            if (!upload.isImage()) {
                return res.status(400).json({
                    error: 'Invalid file type',
                    message: 'Only images can be encoded to base64'
                });
            }

            // Encode buffer directly
            const base64 = upload.fileData.toString('base64');

            res.json({
                id: upload._id,
                base64: base64,
                mimeType: upload.mimeType
            });

        } catch (error) {
            console.error('Error encoding image:', error);
            res.status(500).json({
                error: 'Encoding failed',
                message: 'Failed to encode image to base64'
            });
        }
    }
);

/**
 * DELETE /api/upload/:id
 * Delete file
 */
router.delete('/:id',
    optionalAuthenticate,
    validateFileId,
    checkFileOwnership,
    async (req, res) => {
        try {
            const upload = req.upload;
            await Upload.findByIdAndDelete(upload._id);

            res.json({
                success: true,
                message: 'File deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting file:', error);
            res.status(500).json({
                error: 'Delete failed',
                message: 'Failed to delete file'
            });
        }
    }
);

/**
 * GET /api/upload/:id/test-extraction
 * Test file text extraction (for debugging)
 */
router.get('/:id/test-extraction',
    optionalAuthenticate,
    validateFileId,
    checkFileOwnership,
    async (req, res) => {
        try {
            const upload = req.upload;

            res.json({
                id: upload._id,
                originalName: upload.originalName,
                mimeType: upload.mimeType,
                extractedTextLength: upload.extractedText?.length || 0,
                extractedTextPreview: upload.extractedText?.substring(0, 500) || 'No text extracted',
                metadata: upload.metadata,
                hasText: !!upload.extractedText && upload.extractedText.length > 0
            });

        } catch (error) {
            console.error('Error testing extraction:', error);
            res.status(500).json({
                error: 'Server error',
                message: 'Failed to test extraction'
            });
        }
    }
);

/**
 * GET /api/upload/thread/:threadId
 * Get all files for a thread
 */
router.get('/thread/:threadId',
    optionalAuthenticate,
    async (req, res) => {
        try {
            const { threadId } = req.params;
            const userId = req.user?.id;

            const query = { threadId };
            if (userId) {
                query.userId = userId;
            } else {
                query.userId = { $exists: false };
            }

            const uploads = await Upload.find(query).sort({ uploadedAt: -1 });

            res.json({
                threadId: threadId,
                count: uploads.length,
                files: uploads.map(upload => ({
                    id: upload._id,
                    filename: upload.filename,
                    originalName: upload.originalName,
                    mimeType: upload.mimeType,
                    size: upload.size,
                    uploadedAt: upload.uploadedAt,
                    metadata: upload.metadata
                }))
            });

        } catch (error) {
            console.error('Error fetching thread files:', error);
            res.status(500).json({
                error: 'Server error',
                message: 'Failed to fetch thread files'
            });
        }
    }
);


export default router;

