import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../services/api';
import { ChatList, MessageList, Input, SystemMessage } from 'react-chat-elements';
import 'react-chat-elements/dist/main.css';
import { format } from 'date-fns';

const ChatPage: React.FC = () => {
    const { socket, isConnected, joinConversation } = useSocket();
    const { user } = useAuth();
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeConversation, setActiveConversation] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch conversations on mount
    useEffect(() => {
        fetchConversations();
    }, [user]);

    // Listen for real-time messages
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (message: any) => {
            if (activeConversation && message.conversation_id === activeConversation.conversation_id) {
                setMessages((prev) => [...prev, formatMessageForUI(message)]);
                scrollToBottom();
            }
            // Refresh list to update last message preview
            fetchConversations();
        };

        socket.on('newMessage', handleNewMessage);

        return () => {
            socket.off('newMessage', handleNewMessage);
        };
    }, [socket, activeConversation]);

    const fetchConversations = async () => {
        try {
            const res = await apiClient.get('/chat/conversations');
            setConversations(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load conversations', err);
            setLoading(false);
        }
    };

    const loadMessages = async (conversationId: string) => {
        try {
            const res = await apiClient.get(`/chat/conversations/${conversationId}/messages`);
            setMessages(res.data.map(formatMessageForUI));
            scrollToBottom();
        } catch (err) {
            console.error('Failed to load messages', err);
        }
    };

    const handleSelectConversation = (conv: any) => {
        setActiveConversation(conv);
        joinConversation(conv.conversation_id);
        loadMessages(conv.conversation_id);
    };

    const handleSendMessage = () => {
        if (!inputValue.trim() || !activeConversation || !socket) return;

        socket.emit('sendMessage', {
            conversationId: activeConversation.conversation_id,
            content: inputValue
        });
        setInputValue('');
    };

    const formatMessageForUI = (msg: any) => {
        const isMine = msg.sender_id === user?.user_id;
        return {
            position: isMine ? 'right' : 'left',
            type: 'text',
            text: msg.content,
            date: new Date(msg.created_at),
            title: isMine ? 'Me' : (msg.sender?.name || 'User'),
        };
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            if (scrollRef.current) {
                // react-chat-elements message list container
                const list = scrollRef.current.querySelector('.rce-mlist');
                if (list) list.scrollTop = list.scrollHeight;
            }
        }, 100);
    };

    // Helper to get other user name/avatar
    const getPartner = (conv: any) => {
        if (!user) return {};
        return conv.tutor_id === user.user_id ? conv.tutee : conv.tutor;
    };

    return (
        <div className="flex h-[calc(100vh-6rem)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Sidebar */}
            <div className={`w-full md:w-80 border-r border-slate-200 flex flex-col ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h2 className="font-bold text-lg text-slate-800">Messages</h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-slate-500">Loading...</div>
                    ) : conversations.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <p>No conversations yet.</p>
                            <p className="text-sm mt-2">Book a session or find a tutor/tutee to start chatting!</p>
                        </div>
                    ) : (
                        <ChatList
                            className="chat-list"
                            dataSource={conversations.map(c => {
                                const partner = getPartner(c);
                                return {
                                    avatar: partner?.profile_image_url || 'https://ui-avatars.com/api/?name=' + (partner?.name || 'User'),
                                    alt: partner?.name,
                                    title: partner?.name || 'Unknown User',
                                    subtitle: c.last_message_content || 'Start a conversation',
                                    date: new Date(c.last_message_at || c.created_at),
                                    unread: 0,
                                    id: c.conversation_id,
                                    className: activeConversation?.conversation_id === c.conversation_id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                                };
                            })}
                            onClick={(c) => handleSelectConversation(conversations.find(conv => conv.conversation_id === c.id))}
                        />
                    )}
                </div>
            </div>

            {/* Chat Window */}
            <div className={`flex-1 flex flex-col bg-slate-50 ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
                {activeConversation ? (
                    <>
                        {/* Header */}
                        <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setActiveConversation(null)} className="md:hidden p-2 text-slate-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <div className="h-10 w-10 rounded-full overflow-hidden">
                                    <img src={getPartner(activeConversation)?.profile_image_url || `https://ui-avatars.com/api/?name=${getPartner(activeConversation)?.name}`} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{getPartner(activeConversation)?.name}</h3>
                                    <p className="text-xs text-green-500 font-medium">Online</p>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
                            <MessageList
                                className="message-list"
                                lockable={true}
                                toBottomHeight={'100%'}
                                dataSource={messages}
                            />
                        </div>

                        {/* Input */}
                        <div className="p-3 bg-white border-t border-slate-200">
                            <Input
                                placeholder="Type a message..."
                                multiline={true}
                                value={inputValue}
                                onChange={(e: any) => setInputValue(e.target.value)}
                                rightButtons={
                                    <button
                                        className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 transition-colors"
                                        onClick={handleSendMessage}
                                    >
                                        <svg className="w-5 h-5 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                    </button>
                                }
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <svg className="w-20 h-20 mb-4 opacity-20" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" /></svg>
                        <p className="text-lg font-medium">Select a conversation to start chatting</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatPage;
