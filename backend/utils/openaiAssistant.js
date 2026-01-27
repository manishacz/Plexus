import OpenAI from 'openai';
import fetch from 'node-fetch';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Upload file from Vercel Blob to OpenAI Files API
 * @param {string} blobUrl - URL of file in Vercel Blob storage
 * @param {string} filename - Original filename
 * @returns {Object} OpenAI file object
 */
export const uploadFileToOpenAI = async (blobUrl, filename) => {
    try {
        console.log(`[OpenAI] Fetching file from Vercel Blob: ${blobUrl}`);

        // Fetch file from Vercel Blob as stream
        const response = await fetch(blobUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch file from Vercel Blob: ${response.statusText}`);
        }

        // Get file as buffer
        const buffer = await response.buffer();
        console.log(`[OpenAI] Uploading to OpenAI Files API: ${filename} (${buffer.length} bytes)`);

        // Create File object compatible with OpenAI SDK
        const file = new File([buffer], filename, {
            type: response.headers.get('content-type') || 'application/octet-stream'
        });

        // Upload to OpenAI
        const openaiFile = await openai.files.create({
            file: file,
            purpose: 'assistants', // Critical: must be 'assistants' for Assistant API
        });

        console.log(`[OpenAI] File uploaded successfully: ${openaiFile.id}`);
        return openaiFile;
    } catch (error) {
        console.error('[OpenAI] File upload error:', error);
        throw new Error(`Failed to upload file to OpenAI: ${error.message}`);
    }
};

/**
 * Create or retrieve Vector Store for a thread
 * @param {string} threadId - Your application's thread ID
 * @param {string} name - Human-readable name for the store
 * @returns {Object} Vector store object
 */
export const getOrCreateVectorStore = async (threadId, name = null) => {
    try {
        // Create new vector store for this thread
        const vectorStore = await openai.beta.vectorStores.create({
            name: name || `Thread ${threadId} Files`,
            expires_after: {
                anchor: 'last_active_at',
                days: 7 // Auto-delete after 7 days of inactivity (cost optimization)
            }
        });

        console.log(`[OpenAI] Vector Store created: ${vectorStore.id}`);
        return vectorStore;
    } catch (error) {
        console.error('[OpenAI] Vector Store creation error:', error);
        throw new Error(`Failed to create Vector Store: ${error.message}`);
    }
};

/**
 * Add file to Vector Store
 * @param {string} vectorStoreId - Vector Store ID
 * @param {string} fileId - OpenAI File ID
 */
export const addFileToVectorStore = async (vectorStoreId, fileId) => {
    try {
        console.log(`[OpenAI] Adding file ${fileId} to Vector Store ${vectorStoreId}`);

        const vectorStoreFile = await openai.beta.vectorStores.files.create(
            vectorStoreId,
            {
                file_id: fileId,
            }
        );

        console.log(`[OpenAI] File added to Vector Store: ${vectorStoreFile.id}`);

        // Poll until file is processed (chunked and embedded)
        let status = vectorStoreFile.status;
        let attempts = 0;
        const maxAttempts = 60; // 60 seconds timeout

        while (status === 'in_progress' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const updatedFile = await openai.beta.vectorStores.files.retrieve(
                vectorStoreId,
                fileId
            );
            status = updatedFile.status;
            attempts++;
            console.log(`[OpenAI] File processing status: ${status} (${attempts}s)`);
        }

        if (status === 'completed') {
            console.log(`[OpenAI] ✓ File processed and ready for search`);
            return vectorStoreFile;
        } else if (status === 'failed') {
            throw new Error('OpenAI failed to process file');
        } else {
            throw new Error('File processing timeout');
        }
    } catch (error) {
        console.error('[OpenAI] Add file to Vector Store error:', error);
        throw new Error(`Failed to add file to Vector Store: ${error.message}`);
    }
};

/**
 * Create or retrieve Assistant with File Search capability
 * @param {string} vectorStoreId - Vector Store ID to attach
 * @returns {Object} Assistant object
 */
export const getOrCreateAssistant = async (vectorStoreId) => {
    try {
        // For production, you'd want to store this assistant ID in your database
        // and reuse it across requests. For now, we'll create one per request.
        const assistant = await openai.beta.assistants.create({
            name: 'Plexus Document Assistant',
            instructions: `You are a helpful assistant that can read and analyze documents.
When users ask questions about uploaded files, search through the documents and provide accurate, detailed answers with specific references.
Always cite the source when quoting from documents.
If you cannot find relevant information in the documents, clearly state that.`,
            model: 'gpt-4o-mini',
            tools: [
                {
                    type: 'file_search', // Enable File Search tool
                }
            ],
            tool_resources: {
                file_search: {
                    vector_store_ids: [vectorStoreId]
                }
            },
            temperature: 0.7,
        });

        console.log(`[OpenAI] Assistant created: ${assistant.id}`);
        return assistant;
    } catch (error) {
        console.error('[OpenAI] Assistant creation error:', error);
        throw new Error(`Failed to create Assistant: ${error.message}`);
    }
};

/**
 * Send message to Assistant and get response
 * @param {string} assistantId - Assistant ID
 * @param {string} openaiThreadId - OpenAI Thread ID (not your app's thread ID)
 * @param {string} message - User's message
 * @returns {Object} Assistant's response with citations
 */
export const sendMessageToAssistant = async (assistantId, openaiThreadId, message) => {
    try {
        // Add user message to thread
        await openai.beta.threads.messages.create(openaiThreadId, {
            role: 'user',
            content: message,
        });

        console.log(`[OpenAI] Message sent to thread ${openaiThreadId}`);

        // Create and poll run
        const run = await openai.beta.threads.runs.createAndPoll(openaiThreadId, {
            assistant_id: assistantId,
        });

        console.log(`[OpenAI] Run completed with status: ${run.status}`);

        if (run.status === 'completed') {
            // Retrieve messages
            const messages = await openai.beta.threads.messages.list(openaiThreadId);

            // Get the latest assistant message
            const assistantMessage = messages.data.find(msg => msg.role === 'assistant');

            if (!assistantMessage) {
                throw new Error('No assistant response found');
            }

            // Extract text and citations
            const textContent = assistantMessage.content.find(c => c.type === 'text');

            return {
                text: textContent.text.value,
                annotations: textContent.text.annotations || [], // Contains file citations
                messageId: assistantMessage.id,
            };
        } else {
            throw new Error(`Run failed with status: ${run.status}`);
        }
    } catch (error) {
        console.error('[OpenAI] Send message error:', error);
        throw new Error(`Failed to get Assistant response: ${error.message}`);
    }
};

/**
 * Create OpenAI Thread (separate from your app's thread concept)
 */
export const createOpenAIThread = async () => {
    try {
        const thread = await openai.beta.threads.create();
        console.log(`[OpenAI] Thread created: ${thread.id}`);
        return thread;
    } catch (error) {
        console.error('[OpenAI] Thread creation error:', error);
        throw new Error(`Failed to create OpenAI thread: ${error.message}`);
    }
};

export default {
    uploadFileToOpenAI,
    getOrCreateVectorStore,
    addFileToVectorStore,
    getOrCreateAssistant,
    sendMessageToAssistant,
    createOpenAIThread,
};
