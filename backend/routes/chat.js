import express from "express"; 
import Thread from "../models/Thread.js";
import getOpenAIResponse from "../utils/openai.js";

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
        res.status(500).send({error: "Failed to save in Db"});
    }
});
// get all threads
router.get("/thread", async (req, res) => {
    try {
        const threads = await Thread.find({}).sort({updatedAt: -1});
        res.json(threads);
    } catch (error) {
        console.log(error);
        res.status(500).send({error: "Failed to retrieve threads"});
    }
});
// get a thread by id
router.get("/thread/:threadId", async (req, res) => {
    const {threadId} = req.params;
    try{
        const thread = await Thread.findOne({threadId: threadId});
        if(!thread){
            res.status(404).send("Thread not found");
        }
        res.json(thread.messages);
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
});

// delete a thread
router.delete("/thread/:threadId", async (req, res) => {
    const {threadId} = req.params;
    try{
        const deletedThread = await Thread.findOneAndDelete({threadId: threadId});
        if(!deletedThread){
            res.status(404).json({"error": "Thread not found"});
        }
        res.status(200).json({"message": "Thread deleted successfully"});
    } catch (error) {
        console.log(error);
        res.status(500).send("Failed to delete thread");
    }
});
// chat route
router.post("/chat", async (req, res) => {
    const {threadId, message} = req.body;
    if(!threadId || !message){
        res.status(400).json({"error": "Thread ID and message are required"});
    }
    try{
        let thread = await Thread.findOne({threadId: threadId});
        if(!thread){
            thread = new Thread({
                threadId,
                title: message,
                messages: [{role:"user",content:message}]
            });
        } else {
            thread.messages.push({role:"user",content:message});
        }
        const assistReply = await getOpenAIResponse(message);
        thread.messages.push({role:"assistant",content:assistReply}); 
        thread.updatedAt = Date.now();
        await thread.save();
        res.json({reply: assistReply,threadId});
    } catch (error) {
        console.log(error);
        res.status(500).send({error: "Failed to send message"});
    }

})

export default router;