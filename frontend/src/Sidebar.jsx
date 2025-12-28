import "./Sidebar.css";
import { useContext, useEffect, useState } from "react";
import { MyContext } from "./MyContext.jsx";
import {v1 as uuidv1} from "uuid";
import UserProfile from "./UserProfile.jsx";

import { API_URL } from "./config.js";

function Sidebar() {
    const {allThreads, setAllThreads, currThreadId, setNewChat, setPrompt, setReply, setCurrThreadId, setPrevChats, setIsSidebarOpen} = useContext(MyContext);
    const [searchTerm, setSearchTerm] = useState("");

    const getAllThreads = async () => {
        try {
            const response = await fetch(`${API_URL}/api/thread`, {
                credentials: 'include'
            });
            const res = await response.json();
            const filteredData = res.map(thread => ({threadId: thread.threadId, title: thread.title}));
            //console.log(filteredData);
            setAllThreads(filteredData);
        } catch(err) {
            console.log(err);
        }
    };

    useEffect(() => {
        getAllThreads();
    }, [currThreadId])


    const createNewChat = () => {
        setNewChat(true);
        setPrompt("");
        setReply(null);
        setCurrThreadId(uuidv1());
        setPrevChats([]);
    }

    const changeThread = async (newThreadId) => {
        setCurrThreadId(newThreadId);

        try {
            const response = await fetch(`${API_URL}/api/thread/${newThreadId}`, {
                credentials: 'include'
            });
            const res = await response.json();
            console.log(res);
            setPrevChats(res);
            setNewChat(false);
            setReply(null);
        } catch(err) {
            console.log(err);
        }
    }

    const deleteThread = async (threadId) => {
        try {
            const response = await fetch(`${API_URL}/api/thread/${threadId}`, {
                method: "DELETE",
                credentials: 'include'
            });
            const res = await response.json();
            console.log(res);

            //updated threads re-render
            setAllThreads(prev => prev.filter(thread => thread.threadId !== threadId));

            if(threadId === currThreadId) {
                createNewChat();
            }

        } catch(err) {
            console.log(err);
        }
    }

    const filteredThreads = allThreads.filter(thread => 
        thread.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <section className="sidebar">
            <div className="sidebar-header">
                <div className="header-top">
                    {/* Placeholder for Logo or Brand if needed, or simplifed New Chat row */}
                    <button className="close-sidebar-btn" onClick={() => setIsSidebarOpen(false)} title="Close Sidebar">
                       <img src="https://cdn-icons-png.flaticon.com/128/2989/2989988.png" alt="Close" style={{width: '20px', filter: 'invert(1)'}}/>
                    </button>
                    <button className="new-chat-icon-btn" onClick={createNewChat} title="New Chat">
                        <i className="fa-regular fa-pen-to-square"></i>
                    </button>
                </div>
            </div>

            <div className="search-container">
                <div className="search-wrapper">
                     <i className="fa-solid fa-magnifying-glass search-icon"></i>
                     <input 
                        type="text" 
                        placeholder="Search chats..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                     />
                </div>
            </div>

            <div className="history-label">
                <span>Your chats</span>
            </div>

            <ul className="history">
                {
                    filteredThreads?.map((thread, idx) => (
                        <li key={idx}
                            onClick={() => changeThread(thread.threadId)}
                            className={thread.threadId === currThreadId ? "highlighted": " "}
                        >
                            <span className="thread-title">{thread.title}</span>
                            <i className="fa-solid fa-trash delete-icon"
                                onClick={(e) => {
                                    e.stopPropagation(); //stop event bubbling
                                    deleteThread(thread.threadId);
                                }}
                            ></i>
                        </li>
                    ))
                }
            </ul>

            <UserProfile />
        </section>
    )
}

export default Sidebar;