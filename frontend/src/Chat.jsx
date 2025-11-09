import "./Chat.css";
import { useContext, useState, useEffect } from "react";
import { MyContext } from "./MyContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

function Chat() {
    const {newChat, prevChats, reply} = useContext(MyContext);
    const [latestReply, setLatestReply] = useState(null);

    useEffect(() => {
        if(reply === null) {
            setLatestReply(null); //prevchat load
            return;
        }

        if(!prevChats?.length) return;

        const content = reply.split(" "); //individual words

        let idx = 0;
        const interval = setInterval(() => {
            setLatestReply(content.slice(0, idx+1).join(" "));

            idx++;
            if(idx >= content.length) clearInterval(interval);
        }, 40);

        return () => clearInterval(interval);

    }, [prevChats, reply])

    return (
        <div className="chats">
            {newChat && <h1>How can I help you today?</h1>}

            {
                prevChats?.slice(0, -1).map((chat, idx) =>
                    <div className={chat.role === "user" ? "userDiv" : "gptDiv"} key={idx}>
                        {
                            chat.role === "user" ?
                            <p className="userMessage">{chat.content}</p> :
                            <div>
                                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                                    {chat.content}
                                </ReactMarkdown>
                            </div>
                        }
                    </div>
                )
            }

            {
                prevChats.length > 0 && (
                    <>
                        {
                            latestReply === null ? (
                                <div className="gptDiv" key={"non-typing"}>
                                    <div>
                                        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                                            {prevChats[prevChats.length-1].content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ) : (
                                <div className="gptDiv" key={"typing"}>
                                    <div>
                                        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                                            {latestReply}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            )
                        }
                    </>
                )
            }
        </div>
    )
}

export default Chat;