import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import FileUpload from "./FileUpload.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState, useEffect } from "react";
import {SyncLoader} from "react-spinners";

const API_URL = import.meta.env.VITE_API_URL || 'https://backend-plexus-cicd.onrender.com';

function ChatWindow() {
    const {prompt, setPrompt, reply, setReply, currThreadId, setPrevChats, setNewChat} = useContext(MyContext);
    const [loading, setLoading] = useState(false);
    const [showFileUpload, setShowFileUpload] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);

    const getReply = async () => {
        if (!prompt.trim()) return;

        setLoading(true);
        setNewChat(false);

        let messageContent = prompt;
        
        // Add file context if files are uploaded
        if (uploadedFiles.length > 0) {
            const fileContext = uploadedFiles.map(f => `[File: ${f.originalName}]`).join(' ');
            messageContent = `${fileContext}\n\n${prompt}`;
        }

        const options = {
            method: "POST",
            credentials: 'include',
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: messageContent,
                threadId: currThreadId,
                fileIds: uploadedFiles.map(f => f.id)
            })
        };

        try {
            const response = await fetch(`${API_URL}/api/chat`, options);
            const res = await response.json();
            setReply(res.reply);
            setUploadedFiles([]);
        } catch(err) {
            console.log(err);
            setReply("Sorry, I encountered an error. Please try again.");
        }
        setLoading(false);
    }

    const handleUploadComplete = (files) => {
        setUploadedFiles(files);
        setShowFileUpload(false);
    };

    //Append new chat to prevChats
    useEffect(() => {
        if(prompt && reply) {
            setPrevChats(prevChats => (
                [...prevChats, {
                    role: "user",
                    content: prompt
                },{
                    role: "assistant",
                    content: reply
                }]
            ));
        }

        setPrompt("");
    }, [reply]);

    return (
        <div className="chatWindow">
            <div className="navbar">
                <span>Plexus</span>
            </div>

            <Chat></Chat>

            {loading && (
                <div className="loading-container">
                    <SyncLoader color="#fff" loading={loading} size={8} />
                </div>
            )}

            <div className="chatInput">
                {showFileUpload && (
                    <div className="file-upload-modal">
                        <FileUpload onUploadComplete={handleUploadComplete} />
                        <button 
                            className="close-upload"
                            onClick={() => setShowFileUpload(false)}
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {uploadedFiles.length > 0 && (
                    <div className="uploaded-files-preview">
                        {uploadedFiles.map((file, idx) => (
                            <div key={idx} className="file-badge">
                                <i className="fa-solid fa-paperclip"></i>
                                {file.originalName}
                                <button onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="inputBox">
                    <button
                        className="attach-button"
                        onClick={() => setShowFileUpload(!showFileUpload)}
                        disabled={loading}
                        title="Attach files"
                    >
                        <i className="fa-solid fa-paperclip"></i>
                    </button>
                    <input
                        placeholder="Message Plexus..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                getReply();
                            }
                        }}
                        disabled={loading}
                    />
                    <button
                        id="submit"
                        onClick={getReply}
                        disabled={loading || !prompt.trim()}
                        style={{
                            opacity: loading || !prompt.trim() ? 0.5 : 1,
                            cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <i className="fa-solid fa-arrow-up"></i>
                    </button>
                </div>
                <p className="info">
                    Plexus can make mistakes. Check important info.
                </p>
            </div>
        </div>
    )
}

export default ChatWindow;