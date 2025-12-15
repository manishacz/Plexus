import express from "express";
import Thread from "../models/Thread.js";
import Upload from "../models/Upload.js";
import getOpenAIResponse from "../utils/openai.js";
import { authenticate, optionalAuthenticate } from "../middleware/auth.js";
import { apiRateLimiter } from "../middleware/rateLimiter.js";


const router = express.Router();

router.post("/test", async (req, res) => {
    try {
        const thread = await Thread.create({
            threadId: "123",
            title: "Testing New Thread",
        });
        const response = await thread.save();
        res.send(response);
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Failed to save in Db" });
    }
});
// get all threads (with optional authentication)
router.get("/thread", optionalAuthenticate, async (req, res) => {
    try {
        // If user is authenticated, return only their threads
        // Otherwise, return threads without userId (backward compatibility)
        const query = req.user ? { userId: req.user.id } : { userId: { $exists: false } };
        const threads = await Thread.find(query).sort({ updatedAt: -1 });
        res.json(threads);
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Failed to retrieve threads" });
    }
});
// get a thread by id (with optional authentication)
router.get("/thread/:threadId", optionalAuthenticate, async (req, res) => {
    const { threadId } = req.params;
    try {
        // Build query based on authentication
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
        res.json(thread.messages);
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
});

// delete a thread (with optional authentication)
router.delete("/thread/:threadId", optionalAuthenticate, async (req, res) => {
    const { threadId } = req.params;
    try {
        // Build query based on authentication
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
        res.status(200).json({ "message": "Thread deleted successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).send("Failed to delete thread");
    }
});
// chat route (with optional authentication and rate limiting)
router.post("/chat", apiRateLimiter, optionalAuthenticate, async (req, res) => {
    const { threadId, message, fileIds } = req.body;
    if (!threadId || !message) {
        return res.status(400).json({ "error": "Thread ID and message are required" });
    }
    try {
        const query = { threadId: threadId };
        if (req.user) {
            query.userId = req.user.id;
        } else {
            query.userId = { $exists: false };
        }

        let thread = await Thread.findOne(query);
        if (!thread) {
            thread = new Thread({
                threadId,
                userId: req.user ? req.user.id : undefined,
                title: message.substring(0, 100),
                messages: [{ role: "user", content: message }]
            });
        } else {
            thread.messages.push({ role: "user", content: message });
        }

        // Build context with file content
        let contextMessage = message;
        let images = [];

        if (fileIds && fileIds.length > 0) {
            // Fetch uploads including fileData for images
            const uploads = await Upload.find({ _id: { $in: fileIds } }).select('+fileData');
            let fileContext = "\n\n--- Attached Files ---\n";

            for (const upload of uploads) {
                if (upload.mimeType.startsWith('image/')) {
                    // Encode image for GPT-4 Vision
                    try {
                        if (upload.fileData) {
                            const base64 = upload.fileData.toString('base64');
                            images.push({ base64, mimeType: upload.mimeType });
                            fileContext += `\nImage: ${upload.originalName}\n`;
                        } else {
                            console.warn(`Image ${upload.originalName} has no file data.`);
                        }
                    } catch (err) {
                        console.error('Error encoding image:', err);
                    }
                } else {
                    fileContext += `\nFile: ${upload.originalName}\n`;
                    if (upload.extractedText) {
                        const textLength = upload.extractedText.length;
                        const maxLength = 15000;
                        fileContext += `Content (${textLength} chars): ${upload.extractedText.substring(0, maxLength)}${textLength > maxLength ? '... [truncated]' : ''}\n`;
                        console.log(`Including ${Math.min(textLength, maxLength)} chars from ${upload.originalName}`);
                    } else {
                        console.warn(`No extracted text for ${upload.originalName}`);
                    }
                }
            }
            contextMessage = message + fileContext;
        }

        const assistReply = await getOpenAIResponse(contextMessage, images);
        thread.messages.push({ role: "assistant", content: assistReply });
        thread.updatedAt = Date.now();
        await thread.save();
        res.json({ reply: assistReply, threadId });
    } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Failed to send message" });
    }

})

export default router;