import { put, del, list } from '@vercel/blob';

/**
 * Upload file to Vercel Blob
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} filename - Original filename
 * @param {string} userId - User ID for organization
 * @param {string} mimetype - File MIME type
 * @returns {Object} - { url, downloadUrl, pathname }
 */
export const uploadToVercel = async (fileBuffer, filename, userId, mimetype) => {
    try {
        const timestamp = Date.now();
        const pathname = `${userId}/${timestamp}-${filename}`;

        const blob = await put(pathname, fileBuffer, {
            access: 'public', // Files are publicly accessible via URL
            contentType: mimetype,
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        console.log(`File uploaded to Vercel Blob: ${blob.url}`);

        return {
            url: blob.url,           // Direct URL to file
            downloadUrl: blob.downloadUrl, // Download URL
            pathname: blob.pathname, // Path for deletion
            size: blob.size,
        };
    } catch (error) {
        console.error('Vercel Blob upload error:', error);
        throw new Error(`Failed to upload to Vercel Blob: ${error.message}`);
    }
};

/**
 * Delete file from Vercel Blob
 * @param {string} url - Full URL of the blob to delete
 */
export const deleteFromVercel = async (url) => {
    try {
        await del(url, {
            token: process.env.BLOB_READ_WRITE_TOKEN
        });

        console.log(`File deleted from Vercel Blob: ${url}`);
        return true;
    } catch (error) {
        console.error('Vercel Blob delete error:', error);
        throw new Error(`Failed to delete from Vercel Blob: ${error.message}`);
    }
};

/**
 * List all files for a user
 * @param {string} userId - User ID
 */
export const listUserFiles = async (userId) => {
    try {
        const { blobs } = await list({
            prefix: `${userId}/`,
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        return blobs;
    } catch (error) {
        console.error('Vercel Blob list error:', error);
        throw new Error(`Failed to list files: ${error.message}`);
    }
};

export default { uploadToVercel, deleteFromVercel, listUserFiles };
