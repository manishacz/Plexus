import sharp from 'sharp';
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule.default || pdfParseModule;
const { promises: fsPromises, createReadStream } = fs;

/**
 * Process image file - extract metadata and optimize
 */
const processImage = async (filePath) => {
    try {
        const image = sharp(filePath);
        const metadata = await image.metadata();
        
        // Create thumbnail
        const thumbnailPath = filePath.replace(path.extname(filePath), '_thumb.jpg');
        await image
            .resize(200, 200, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);
        
        return {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            size: metadata.size,
            hasAlpha: metadata.hasAlpha,
            thumbnailPath: thumbnailPath,
            type: 'image'
        };
    } catch (error) {
        console.error('Error processing image:', error);
        throw new Error('Failed to process image: ' + error.message);
    }
};

/**
 * Process PDF file - extract text and metadata
 */
const processPDF = async (filePath) => {
    try {
        const dataBuffer = await fsPromises.readFile(filePath);
        const data = await pdfParse(dataBuffer);
        
        console.log(`PDF processed: ${data.numpages} pages, ${data.text?.length || 0} characters extracted`);
        
        return {
            pages: data.numpages,
            text: data.text,
            info: data.info,
            metadata: data.metadata,
            type: 'pdf'
        };
    } catch (error) {
        console.error('Error processing PDF:', error);
        throw new Error('Failed to process PDF: ' + error.message);
    }
};

/**
 * Process DOCX file - extract text
 */
const processDOCX = async (filePath) => {
    try {
        const result = await mammoth.extractRawText({ path: filePath });
        
        console.log(`DOCX processed: ${result.value?.length || 0} characters extracted`);
        
        return {
            text: result.value,
            messages: result.messages,
            type: 'docx'
        };
    } catch (error) {
        console.error('Error processing DOCX:', error);
        throw new Error('Failed to process DOCX: ' + error.message);
    }
};

/**
 * Process text file - read content
 */
const processText = async (filePath) => {
    try {
        const text = await fsPromises.readFile(filePath, 'utf-8');
        
        return {
            text: text,
            lines: text.split('\n').length,
            characters: text.length,
            type: 'text'
        };
    } catch (error) {
        console.error('Error processing text file:', error);
        throw new Error('Failed to process text file: ' + error.message);
    }
};

/**
 * Process CSV file - parse and extract data
 */
const processCSV = async (filePath) => {
    try {
        const rows = [];
        
        return new Promise((resolve, reject) => {
            createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => rows.push(row))
                .on('end', () => {
                    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
                    
                    // Convert to text representation
                    let text = headers.join(', ') + '\n';
                    rows.forEach(row => {
                        text += Object.values(row).join(', ') + '\n';
                    });
                    
                    resolve({
                        rows: rows.length,
                        columns: headers.length,
                        headers: headers,
                        text: text,
                        preview: rows.slice(0, 10), // First 10 rows
                        type: 'csv'
                    });
                })
                .on('error', (error) => reject(error));
        });
    } catch (error) {
        console.error('Error processing CSV:', error);
        throw new Error('Failed to process CSV: ' + error.message);
    }
};

/**
 * Main file processor - routes to appropriate handler
 */
const processFile = async (file) => {
    const { path: filePath, mimetype } = file;
    
    try {
        let result;
        
        if (mimetype.startsWith('image/')) {
            result = await processImage(filePath);
        } else if (mimetype === 'application/pdf') {
            result = await processPDF(filePath);
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            result = await processDOCX(filePath);
        } else if (mimetype === 'text/plain') {
            result = await processText(filePath);
        } else if (mimetype === 'text/csv') {
            result = await processCSV(filePath);
        } else {
            throw new Error('Unsupported file type');
        }
        
        return result;
    } catch (error) {
        console.error('Error in processFile:', error);
        throw error;
    }
};

/**
 * Encode image to base64 for GPT-4 Vision API
 */
const encodeImageToBase64 = async (filePath) => {
    try {
        const buffer = await fsPromises.readFile(filePath);
        return buffer.toString('base64');
    } catch (error) {
        console.error('Error encoding image:', error);
        throw new Error('Failed to encode image: ' + error.message);
    }
};

/**
 * Chunk text for LLM processing (max 4096 tokens ≈ 16000 characters)
 */
const chunkText = (text, maxChunkSize = 15000) => {
    const chunks = [];
    let currentChunk = '';
    
    const sentences = text.split(/[.!?]+/);
    
    for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxChunkSize) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            
            // If single sentence is too long, split by words
            if (sentence.length > maxChunkSize) {
                const words = sentence.split(' ');
                for (const word of words) {
                    if ((currentChunk + word).length > maxChunkSize) {
                        chunks.push(currentChunk.trim());
                        currentChunk = word + ' ';
                    } else {
                        currentChunk += word + ' ';
                    }
                }
            } else {
                currentChunk = sentence + '. ';
            }
        } else {
            currentChunk += sentence + '. ';
        }
    }
    
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks;
};

/**
 * Delete file and its associated files (thumbnails, etc.)
 */
const deleteFile = async (filePath) => {
    try {
        // Delete main file
        await fsPromises.unlink(filePath);
        
        // Delete thumbnail if exists
        const thumbnailPath = filePath.replace(path.extname(filePath), '_thumb.jpg');
        try {
            await fsPromises.unlink(thumbnailPath);
        } catch (err) {
            // Thumbnail might not exist, ignore error
        }
        
        return true;
    } catch (error) {
        console.error('Error deleting file:', error);
        throw new Error('Failed to delete file: ' + error.message);
    }
};

export {
    processFile,
    processImage,
    processPDF,
    processDOCX,
    processText,
    processCSV,
    encodeImageToBase64,
    chunkText,
    deleteFile
};

