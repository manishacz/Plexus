import sharp from 'sharp';
import mammoth from 'mammoth';
import { createRequire } from 'module';
import { Readable } from 'stream';
import csv from 'csv-parser';

const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');
const pdfParse = pdfParseModule.default || pdfParseModule;

/**
 * Process image file - extract metadata and optimize
 */
const processImage = async (fileBuffer) => {
    try {
        const image = sharp(fileBuffer);
        const metadata = await image.metadata();

        // We no longer create thumbnails on disk

        return {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            size: metadata.size,
            hasAlpha: metadata.hasAlpha,
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
const processPDF = async (fileBuffer) => {
    try {
        const data = await pdfParse(fileBuffer);

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
const processDOCX = async (fileBuffer) => {
    try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });

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
const processText = async (fileBuffer) => {
    try {
        const text = fileBuffer.toString('utf-8');

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
const processCSV = async (fileBuffer) => {
    try {
        const rows = [];
        const stream = Readable.from(fileBuffer.toString());

        return new Promise((resolve, reject) => {
            stream
                .pipe(csv())
                .on('data', (row) => rows.push(row))
                .on('end', () => {
                    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

                    // Convert to text representation (limit to ~500 rows to avoid context overflow)
                    let text = headers.join(', ') + '\n';
                    const maxRows = 500;
                    rows.slice(0, maxRows).forEach(row => {
                        text += Object.values(row).join(', ') + '\n';
                    });

                    if (rows.length > maxRows) {
                        text += `\n... ${rows.length - maxRows} more rows ...`;
                    }

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
    const { buffer, mimetype } = file;

    if (!buffer) {
        throw new Error('File buffer is missing');
    }

    try {
        let result;

        if (mimetype.startsWith('image/')) {
            result = await processImage(buffer);
        } else if (mimetype === 'application/pdf') {
            result = await processPDF(buffer);
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            result = await processDOCX(buffer);
        } else if (mimetype === 'text/plain') {
            result = await processText(buffer);
        } else if (mimetype === 'text/csv') {
            result = await processCSV(buffer);
        } else {
            console.warn(`Unsupported file type for processing: ${mimetype}`);
            return { text: '', type: 'unknown' };
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
const encodeImageToBase64 = async (fileBuffer) => {
    try {
        if (Buffer.isBuffer(fileBuffer)) {
            return fileBuffer.toString('base64');
        }
        throw new Error('Invalid input: Expected Buffer');
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

// Removed deleteFile as we are using memory storage now

export {
    processFile,
    processImage,
    processPDF,
    processDOCX,
    processText,
    processCSV,
    encodeImageToBase64,
    chunkText
};

