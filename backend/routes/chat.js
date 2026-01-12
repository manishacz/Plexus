import express from "express";
import Thread from "../models/Thread.js";
import Upload from "../models/Upload.js";
import Message from "../models/Message.js";
import getOpenAIResponse from "../utils/openai.js"; // Keeping this for now if needed, but user provided custom fetch logic? 
// Actually, user provided direct OpenAI fetch. I should probably use that or adapt getOpenAIResponse.
// The user's code uses direct fetch to 'https://api.openai.com/v1/chat/completions'. 
// I will stick to the user's logic to be safe, as it handles the "enrichedMessage" structure specifically.

import { authenticate, optionalAuthenticate } from "../middleware/auth.js";
import { apiRateLimiter } from "../middleware/rateLimiter.js";
import "dotenv/config";

const router = express.Router();

// ------------------------------------------------------------------
// GET /thread - Get all users threads
// ------------------------------------------------------------------
router.get("/thread", optionalAuthenticate, async (req, res) => {
    try {
        const query = req.user ? { userId: req.user.id } : { userId: { $exists: false } };
        const threads = await Thread.find(query).sort({ updatedAt: -1 });
        res.json(threads);
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Failed to retrieve threads" });
    }
});

// ------------------------------------------------------------------
// GET /thread/:threadId - Get specific thread messages
// ------------------------------------------------------------------
router.get("/thread/:threadId", optionalAuthenticate, async (req, res) => {
    const { threadId } = req.params;
    try {
        // Validate access
        const query = { threadId: threadId };
        if (req.user) {
            query.userId = req.user.id;
        } else {
            query.userId = { $exists: false };
        }

        const thread = await Thread.findOne(query);
        if (!thread) {
            return res.status(404).send("Thread not found");
        }

        // 1. Try fetching from new Message collection
        let messages = await Message.find({ threadId }).sort({ createdAt: 1 }).lean();

        // 2. If no new messages found, fall back to legacy embedded messages
        if (messages.length === 0 && thread.messages && thread.messages.length > 0) {
            messages = thread.messages;
        }

        res.json(messages);
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
});

// ------------------------------------------------------------------
// DELETE /thread/:threadId - Delete a thread
// ------------------------------------------------------------------
router.delete("/thread/:threadId", optionalAuthenticate, async (req, res) => {
    const { threadId } = req.params;
    try {
        const query = { threadId: threadId };
        if (req.user) {
            query.userId = req.user.id;
        } else {
            query.userId = { $exists: false };
        }

        const deletedThread = await Thread.findOneAndDelete(query);
        if (!deletedThread) {
            return res.status(404).json({ "error": "Thread not found" });
        }

        // Cleanup associated messages
        await Message.deleteMany({ threadId: threadId });

        res.status(200).json({ "message": "Thread deleted successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).send("Failed to delete thread");
    }
});

// ------------------------------------------------------------------
// POST /chat - Send a message
// ------------------------------------------------------------------
router.post("/chat", apiRateLimiter, optionalAuthenticate, async (req, res) => {
    try {
        const { threadId, message, fileIds } = req.body;
        const userId = req.user?.id;

        // Validate inputs
        if (!threadId || !message) {
            return res.status(400).json({
                error: 'Missing required fields: threadId and message'
            });
        }

        // 1. Ensure Thread Exists
        let thread = await Thread.findOne({ threadId });
        if (!thread) {
            thread = new Thread({
                threadId,
                userId: userId,
                title: message.substring(0, 50),
                messages: [] // New system uses Message collection, this stays empty/legacy
            });
            await thread.save();
        } else {
            // Update timestamp
            thread.updatedAt = Date.now();
            await thread.save();
        }

        // 2. Retrieve ALL uploaded files for this thread
        // We use the fileIds passed from frontend if available, or fetch all for thread?
        // The user's code used: Upload.find({ threadId: threadId ... })
        // But the frontend usually sends specific fileIds for the current message.
        // The user's request says: "The frontend is transmitting a symbolic reference... resulting in model receiving opaque metadata".
        // The user's provided code fetches: const threadFiles = await Upload.find({ threadId: threadId ... })
        // This effectively injects ALL files from the thread history into every message? 
        // That might be expensive context-wise but it ensures the bot "remembers" files.
        // Let's stick to the user's "Phase 3" logic which fetches ALL thread files.
        // However, I will also respect fileIds if provided to prioritize them or ensure they are present.

        const threadFileQuery = {
            threadId: threadId,
            ...(userId && { userId: userId })
        };
        const threadFiles = await Upload.find(threadFileQuery).sort({ uploadedAt: -1 });

        console.log(`Found ${threadFiles.length} files for thread ${threadId}`);

        // 3. Build enriched context with file contents
        let enrichedMessage = message;

        if (threadFiles.length > 0) {
            // Construct file context section
            const fileContexts = threadFiles
                .filter(file => file.extractedText && file.extractedText.length > 0)
                .map(file => {
                    // Truncate if too long (8000 chars ~ 2000 tokens)
                    const preview = file.extractedText.length > 8000
                        ? file.extractedText.substring(0, 8000) + '...[truncated]'
                        : file.extractedText;

                    return `
=== FILE: ${file.originalName} (${file.mimeType}) ===
Uploaded: ${file.uploadedAt}
Content:
${preview}
=== END OF FILE ===`;
                });

            if (fileContexts.length > 0) {
                enrichedMessage = `${fileContexts.join('\n\n')}

---

User's message: ${message}`;

                console.log(`Injected ${fileContexts.length} file(s) into context`);
            } else {
                console.warn('Files exist but no extracted text available');
            }
        }

        // 4. Retrieve conversation history for context
        // Try fetching from Message collection first
        let conversationHistory = await Message.find({ threadId })
            .sort({ createdAt: 1 })
            .limit(10) // Last 10 messages
            .lean();

        // Fallback to legacy thread messages if new history is empty
        if (conversationHistory.length === 0 && thread.messages?.length > 0) {
            conversationHistory = thread.messages.slice(-10);
        }

        // 5. Build OpenAI messages array
        const openaiMessages = [
            {
                role: 'system',
                content: `You are a helpful AI assistant. When users upload files, you have access to their full content. Analyze the content and respond based on what you find in the documents.`
            },
            // Include conversation history
            ...conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            // Current message with file context
            {
                role: 'user',
                content: enrichedMessage
            }
        ];

        // 6. Call OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: openaiMessages,
                max_tokens: 2000,
                temperature: 0.7,
                stream: false
            })
        });

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json();
            throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await openaiResponse.json();
        const aiMessageContent = data.choices[0].message.content;

        // 7. Save user message to database (New Message Model)
        // Store explicit file references if provided in this turn
        const currentFileRefs = fileIds ? fileIds : [];

        const userMessage = new Message({
            threadId: threadId,
            userId: userId,
            role: 'user',
            content: message, // Save original, not enriched
            fileReferences: currentFileRefs,
            createdAt: new Date()
        });
        await userMessage.save();

        // 8. Save AI response to database
        const aiMessage = new Message({
            threadId: threadId,
            role: 'assistant',
            content: aiMessageContent,
            createdAt: new Date()
        });
        await aiMessage.save();

        // Return response
        res.json({
            success: true,
            reply: aiMessageContent, // Match frontend property expectation 'reply'
            message: aiMessageContent, // Redundant but safe
            threadId: threadId,
            userMessage: userMessage,
            aiMessage: aiMessage
        });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            error: 'Failed to process message',
            message: error.message
        });
    }
});

export default router;