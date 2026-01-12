import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import FileUpload from "./FileUpload.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState, useEffect } from "react";
import {SyncLoader} from "react-spinners";

import { API_URL } from "./config.js";

function ChatWindow() {
    const {prompt, setPrompt, reply, setReply, currThreadId, setPrevChats, setNewChat, isSidebarOpen, setIsSidebarOpen} = useContext(MyContext);
    const [loading, setLoading] = useState(false);
    const [showFileUpload, setShowFileUpload] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [listening, setListening] = useState(false);

    const getReply = async () => {
        if (!prompt.trim()) return;

        setLoading(true);
        setNewChat(false);

        // Backend now handles file context automatic injection based on thread history
        // matches user request: "No need to send fileIds - backend retrieves all thread files automatically"
        // But we still send fileIds to track references for the specific message in the DB
        
        const options = {
            method: "POST",
            credentials: 'include',
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: prompt,
                threadId: currThreadId,
                fileIds: uploadedFiles.map(f => f.id)
            })
        };

        try {
            const response = await fetch(`${API_URL}/api/chat`, options);
            const res = await response.json();
            
            // Console log as requested for debugging context
            console.log(`Message sent. Context length: ${res.contextLength || 'N/A'} chars, Files processed: ${res.filesProcessed || 0}`);

            setReply(res.reply || res.message); // Handle both response formats
            setUploadedFiles([]);
        } catch(err) {
            console.log(err);
            setReply("Sorry, I encountered an error. Please try again.");
        }
        setLoading(false);
    }

    const handleUploadComplete = (file) => {
        setUploadedFiles(prev => [...prev, file]);
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
                {!isSidebarOpen && (
                    <button className="open-sidebar-btn" onClick={() => setIsSidebarOpen(true)} title="Open Sidebar">
                       <img src="https://cdn-icons-png.flaticon.com/128/2989/2989988.png" alt="Open" style={{width: '20px', filter: 'invert(1)', transform: 'rotate(180deg)'}}/>
                    </button>
                )}
                <span className="navbar-logo-text">Plexus</span>
            </div>

            <Chat></Chat>

            {loading && (
                <div className="loading-container">
                    <SyncLoader color="#fff" loading={loading} size={8} />
                </div>
            )}

            <div className="chatInput">
                {showFileUpload && (
                     <div className="inline-file-upload">
                        <FileUpload onFileUploaded={handleUploadComplete} />
                     </div>
                )}
                
                {/* Previous uploaded files preview not needed here as FileUpload handles it, 
                    but we need to track them for the message context. 
                    Actually, ChatWindow needs to know about files to send them.
                    The FileUpload component shows its own "Attached Files" list.
                    ChatWindow just collects them.
                */}
                
                {uploadedFiles.length > 0 && (
                     /* We hide this duplication if FileUpload shows it, BUT FileUpload clears its state on unmount?
                        No, FileUpload maintains local state. 
                        However, if we close showFileUpload, we lose the visual. 
                        Let's keep a small badge list for the ChatWindow context so user knows what will be sent. 
                      */
                    <div className="uploaded-files-preview">
                        {uploadedFiles.map((file, idx) => (
                            <div key={idx} className="file-badge">
                                <span>{file.originalName}</span>
                                <button onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== idx))}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="inputBox">
                    <button
                        className={`attach-button ${showFileUpload ? 'active' : ''}`}
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
                        className={`mic-button ${listening ? 'listening' : ''}`}
                        title="Voice Input (Coming Soon)"
                        onClick={() => console.log("Voice feature pending implementation")} // Placeholder
                    >
                        <i className="fa-solid fa-microphone"></i>
                    </button>

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