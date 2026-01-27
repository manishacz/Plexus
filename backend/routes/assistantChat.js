import express from 'express';
import Thread from '../models/Thread.js';
import Message from '../models/Message.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import {
    getOrCreateAssistant,
    sendMessageToAssistant,
    createOpenAIThread,
} from '../utils/openaiAssistant.js';

const router = express.Router();

/**
 * POST /api/assistant/chat
 * Send message using OpenAI Assistants API with file search
 */
router.post('/chat', optionalAuthenticate, async (req, res) => {
    try {
        const { threadId, message } = req.body;
        const userId = req.user?.id;

        if (!threadId || !message) {
            return res.status(400).json({
                error: 'Missing required fields: threadId and message'
            });
        }

        // ==================================================
        // 1. Get thread with OpenAI metadata
        // ==================================================
        const thread = await Thread.findOne({ threadId: threadId });
        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        // ==================================================
        // 2. Create OpenAI thread if doesn't exist
        // ==================================================
        if (!thread.openaiThreadId) {
            const openaiThread = await createOpenAIThread();
            thread.openaiThreadId = openaiThread.id;
            await thread.save();
            console.log(`[Chat] Created OpenAI Thread: ${openaiThread.id}`);
        }

        // ==================================================
        // 3. Create or get Assistant with Vector Store attached
        // ==================================================
        if (!thread.openaiVectorStoreId) {
            return res.status(400).json({
                error: 'No files uploaded',
                message: 'Please upload a file before asking questions'
            });
        }

        let assistantId = thread.openaiAssistantId;
        if (!assistantId) {
            const assistant = await getOrCreateAssistant(thread.openaiVectorStoreId);
            assistantId = assistant.id;
            thread.openaiAssistantId = assistantId;
            await thread.save();
            console.log(`[Chat] Created Assistant: ${assistantId}`);
        }

        // ==================================================
        // 4. Send message and get response
        // ==================================================
        console.log(`[Chat] Sending message to Assistant...`);
        const response = await sendMessageToAssistant(
            assistantId,
            thread.openaiThreadId,
            message
        );
        console.log(`[Chat] ✓ Response received: ${response.text.length} characters`);

        // ==================================================
        // 5. Save messages to database
        // ==================================================
        const userMessage = new Message({
            threadId: threadId,
            userId: userId,
            role: 'user',
            content: message,
            createdAt: new Date()
        });
        await userMessage.save();

        const assistantMessage = new Message({
            threadId: threadId,
            role: 'assistant',
            content: response.text,
            metadata: {
                openaiMessageId: response.messageId,
                annotations: response.annotations,
                hasCitations: response.annotations.length > 0
            },
            createdAt: new Date()
        });
        await assistantMessage.save();

        // Update thread timestamp
        thread.updatedAt = new Date();
        await thread.save();

        // ==================================================
        // 6. Process citations for frontend display
        // ==================================================
        const citations = response.annotations
            .filter(a => a.type === 'file_citation')
            .map(a => ({
                text: a.text,
                fileId: a.file_citation.file_id,
                quote: a.file_citation.quote || null
            }));

        res.json({
            success: true,
            message: response.text,
            userMessage: userMessage,
            assistantMessage: assistantMessage,
            citations: citations,
            hasCitations: citations.length > 0
        });

    } catch (error) {
        console.error('[Chat] Error:', error);
        res.status(500).json({
            error: 'Failed to process message',
            message: error.message
        });
    }
});

export default router;
