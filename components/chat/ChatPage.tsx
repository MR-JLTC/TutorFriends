import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../services/api';
import { ChatList, MessageList, Input, SystemMessage } from 'react-chat-elements';
import 'react-chat-elements/dist/main.css';
import { format, formatDistanceToNow } from 'date-fns';

const ChatPage: React.FC = () => {
    const { socket, isConnected, joinConversation } = useSocket();
    const { user } = useAuth();
    const [availableContacts, setAvailableContacts] = useState<any[]>([]);
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeConversation, setActiveConversation] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
    const [lastSeenMap, setLastSeenMap] = useState<Record<number, Date>>({});
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<any>(null); // Ref for Input component
    const activeConversationRef = useRef<any>(null); // Stable ref for listener
    const audioContextRef = useRef<AudioContext | null>(null); // Audio context ref

    // Keep ref in sync
    useEffect(() => {
        activeConversationRef.current = activeConversation;
    }, [activeConversation]);

    // JOIN Room when active conversation changes
    useEffect(() => {
        if (activeConversation) {
            joinConversation(String(activeConversation.conversation_id));
            loadMessages(activeConversation.conversation_id);
        }
    }, [activeConversation]);

    useEffect(() => {
        if (user) {
            fetchConversations();
            fetchAvailableContacts();
        }
    }, [user]);

    // Bell notification sound using AudioContext
    const playNotificationSound = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const now = ctx.currentTime;

            // Master Gain
            const masterGain = ctx.createGain();
            masterGain.connect(ctx.destination);
            masterGain.gain.setValueAtTime(0.4, now); // Moderate volume

            // Define partials for a bell-like tone
            // Frequency ratios for a bell: 1, 2, 3, 4.2, 5.4 (approximate)
            const fundamentals = [880, 1760]; // A5, A6

            fundamentals.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);

                // Envelope: Sharp attack, exponential decay
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(i === 0 ? 0.5 : 0.3, now + 0.01); // Attack
                gain.gain.exponentialRampToValueAtTime(0.001, now + (i === 0 ? 1.5 : 0.5)); // Decay (Fundamental rings longer)

                osc.connect(gain);
                gain.connect(masterGain);

                osc.start(now);
                osc.stop(now + 2);
            });

            // Cleanup
            setTimeout(() => {
                if (ctx.state !== 'closed') ctx.close();
            }, 2000);

        } catch (e) {
            console.error('Audio play failed', e);
        }
    };

    // Listen for real-time messages
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (message: any) => {
            const currentActive = activeConversationRef.current;

            console.log('RealTime - New Message Received:', message.message_id);

            // 1. Update Active Message List (if applicable)
            if (currentActive && String(message.conversation_id) === String(currentActive.conversation_id)) {
                // Play sound if message is from someone else
                if (message.sender_id !== user?.user_id) {
                    playNotificationSound();
                    socket.emit('markSeen', { conversationId: message.conversation_id });
                }

                setMessages((prev) => {
                    // Check deduplication
                    if (prev.some(m => m.id === message.message_id || m.id === message.id)) return prev;

                    // Check optimistic replacement
                    const optimisticIndex = prev.findIndex(m =>
                        m.text?.trim() === message.content?.trim() &&
                        m.position === 'right' &&
                        (String(m.id).startsWith('temp-') || m.status === 'waiting')
                    );

                    if (optimisticIndex !== -1) {
                        const newMessages = [...prev];
                        newMessages[optimisticIndex] = formatMessageForUI(message);
                        return newMessages;
                    }

                    return [...prev, formatMessageForUI(message)];
                });
                scrollToBottom();
            } else if (message.sender_id !== user?.user_id) {
                // Background notification
                playNotificationSound();
            }

            // 2. Update Conversations List (Sidebar) Real-time
            setConversations((prev) => {
                const convIndex = prev.findIndex(c => c.conversation_id === message.conversation_id);
                let updatedConv;

                if (convIndex !== -1) {
                    // Update existing conversation
                    updatedConv = {
                        ...prev[convIndex],
                        last_message_content: message.content,
                        last_message_sender_id: message.sender_id,
                        last_message_at: message.created_at,
                        // If we have a nested last_message object, update it too
                        last_message: {
                            ...prev[convIndex].last_message,
                            content: message.content,
                            sender_id: message.sender_id,
                            created_at: message.created_at,
                            status: message.status
                        }
                    };
                    // Remove old and add new to top
                    const newList = [...prev];
                    newList.splice(convIndex, 1);
                    return [updatedConv, ...newList];
                } else {
                    // If it's a new conversation we don't know about, we should probably fetch
                    // But for now, we can try to leave it or fetch.
                    fetchConversations();
                    return prev;
                }
            });
        };

        // Listen for user online/offline status
        const handleUserStatus = (data: { userId: number, status: 'online' | 'offline', lastActive?: string }) => {
            console.log('ChatPage - User Status Update:', data);
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (data.status === 'online') {
                    next.add(Number(data.userId));
                } else {
                    next.delete(Number(data.userId));
                }
                return next;
            });

            if (data.status === 'offline' && data.lastActive) {
                setLastSeenMap(prev => ({ ...prev, [Number(data.userId)]: new Date(data.lastActive!) }));
            }
        };

        const handleStatusUpdate = (data: { messageId: string, status: string, conversationId?: string }) => {
            console.log('ChatPage - Status Update:', data);

            // 1. Update Active Messages
            setMessages(prev => prev.map(m =>
                (m.id === data.messageId || m.id === `temp-${data.messageId}`)
                    ? { ...m, status: data.status }
                    : m
            ));

            // 2. Update Conversations List (if this message is the last one)
            // We assume if we get a status update, it might be relevant for the sidebar preview
            if (data.conversationId) {
                setConversations(prev => {
                    return prev.map(c => {
                        if (c.conversation_id === data.conversationId) {
                            // Only update if this is indeed the last message (heuristic or check ID if available)
                            // Since we don't perfectly track last_message_id in the flat conversation object always,
                            // we can check if the last_message object matches, or just update blindly if it's likely.
                            // Safer: Update if last_message exists and matches ID
                            if (c.last_message?.message_id === data.messageId || !c.last_message) {
                                return {
                                    ...c,
                                    last_message: {
                                        ...c.last_message,
                                        status: data.status
                                    }
                                };
                            }
                        }
                        return c;
                    });
                });
            }
        };

        const handleMessagesSeen = (data: { conversationId: string, messageIds: string[], seenBy: number }) => {
            console.log('ChatPage - Messages Seen:', data);

            // 1. Update Active Messages
            setMessages(prev => prev.map(m =>
                data.messageIds.includes(String(m.id))
                    ? { ...m, status: 'seen' }
                    : m
            ));

            // 2. Update Conversations List
            setConversations(prev => {
                return prev.map(c => {
                    if (c.conversation_id === data.conversationId) {
                        // Check if the last message is among the seen messages
                        if (c.last_message && data.messageIds.includes(c.last_message.message_id)) {
                            return {
                                ...c,
                                last_message: {
                                    ...c.last_message,
                                    status: 'seen',
                                    is_read: true
                                }
                            };
                        }
                    }
                    return c;
                });
            });
        };

        socket.on('newMessage', handleNewMessage);
        socket.on('user_status', handleUserStatus);
        socket.on('messageStatusUpdate', handleStatusUpdate);
        socket.on('messagesSeen', handleMessagesSeen);

        return () => {
            socket.off('newMessage', handleNewMessage);
            socket.off('user_status', handleUserStatus);
            socket.off('messageStatusUpdate', handleStatusUpdate);
            socket.off('messagesSeen', handleMessagesSeen);
        };
    }, [socket]); // Removed activeConversation from dependency to prevent re-binding listeners

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

    const fetchAvailableContacts = async () => {
        if (!user) return;
        try {
            const res = await apiClient.get('/users');
            const allUsers = res.data;

            // Filter based on role
            // If I am a Tutee (student), I want to see Tutors
            // If I am a Tutor, I want to see Students (or Tutees)

            // Determine my role context
            const myRole = user.role || user.user_type; // 'tutee' | 'tutor' | 'student'
            const isTutor = myRole === 'tutor';

            const contacts = allUsers.filter((u: any) => {
                // exclude myself
                if (u.user_id === user.user_id) return false;
                // exclude admins from this list for now if needed, or keep them
                if (u.role === 'admin') return false;

                if (isTutor) {
                    // Show students/tutees
                    return u.role === 'student' || u.role === 'tutee';
                } else {
                    // Show Verified Tutors
                    return u.role === 'tutor' && u.tutor_profile?.status === 'verified';
                }
            });

            setAvailableContacts(contacts);

            // Populate initial Last Seen map
            const initialLastSeen: Record<number, Date> = {};
            contacts.forEach((c: any) => {
                if (c.last_active_at) {
                    initialLastSeen[c.user_id] = new Date(c.last_active_at);
                }
            });
            setLastSeenMap(prev => ({ ...prev, ...initialLastSeen }));
        } catch (err) {
            console.error('Failed to load contacts', err);
        }
    };

    const loadMessages = async (conversationId: string) => {
        try {
            const res = await apiClient.get(`/chat/conversations/${conversationId}/messages`);
            const loadedMessages = res.data.map(formatMessageForUI);
            setMessages(loadedMessages);
            scrollToBottom();

            // Emit 'markSeen' for this conversation if there are unseen messages from partner
            // We can just emit 'markSeen' generically for the conversation
            if (socket && isConnected) {
                socket.emit('markSeen', { conversationId });
            }
        } catch (err) {
            console.error('Failed to load messages', err);
        }
    };

    const handleSelectConversation = async (item: any) => {
        // Check if this is an existing conversation or a new contact
        if (item.id.toString().startsWith('new-')) {
            // It's a new contact, create conversation first
            const targetUserId = parseInt(item.id.split('-')[1]);
            try {
                const res = await apiClient.post('/chat/conversations', { targetUserId });
                const newConv = res.data;
                // Refresh conversations to include the new one
                await fetchConversations();
                // Set as active
                setActiveConversation(newConv);
                joinConversation(newConv.conversation_id);
                loadMessages(newConv.conversation_id);
            } catch (err) {
                console.error('Failed to create conversation', err);
            }
        } else {
            // Existing conversation
            const conv = conversations.find(c => c.conversation_id === item.id);
            if (conv) {
                setActiveConversation(conv);
                joinConversation(conv.conversation_id);
                loadMessages(conv.conversation_id);
            }
        }
    };

    const handleSendMessage = () => {
        console.log('SendMessage: Attempting to send message...', {
            content: inputValue.substring(0, 20),
            conversationId: activeConversation?.conversation_id,
            socketConnected: socket?.connected,
            isConnectedState: isConnected
        });

        if (!inputValue.trim() || !activeConversation || !socket) {
            console.warn('SendMessage: aborted', {
                hasInput: !!inputValue.trim(),
                hasConv: !!activeConversation,
                hasSocket: !!socket
            });
            return;
        }

        const messageData = {
            conversationId: activeConversation.conversation_id,
            content: inputValue
        };

        // Clear input immediately to prevent double sends and improve UX
        setInputValue('');

        // Reset height if textarea
        if (inputRef.current) {
            if (inputRef.current.input) {
                // If react-chat-elements exposes the input element via .input property
                // Accessing the underlying textarea to reset height
                const textarea = inputRef.current.input;
                if (textarea.style) {
                    textarea.style.height = 'auto';
                    // Force a reflow or set to min height if needed, but 'auto' usually works with scrollHeight hacks
                    // Or set to specific min height e.g. '40px'
                    requestAnimationFrame(() => {
                        textarea.style.height = 'auto';
                    });
                }
            } else if (inputRef.current instanceof HTMLElement) {
                // Fallback if ref is direct element
                inputRef.current.style.height = 'auto';
            }

            if (inputRef.current.clear) {
                inputRef.current.clear();
            } else if (inputRef.current.value !== undefined) {
                inputRef.current.value = '';
            }
        }

        // Optimistic update
        const optimisticMsg = {
            position: 'right',
            type: 'text',
            text: inputValue,
            date: new Date(),
            title: 'Me',
            id: `temp-${Date.now()}`, // Add temp ID
            status: 'sent' // Default optimistic status
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        scrollToBottom();

        console.log('SendMessage: Emitting sendMessage event', messageData);
        socket.emit('sendMessage', messageData, (response: any) => {
            if (response && response.error) {
                console.error('SendMessage - Server Error Response:', response.error);
                // Revert optimistic update on failure
                setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                // Restore input
                setInputValue(optimisticMsg.text);
            } else {
                console.log('SendMessage - Server acknowledged:', response);
                // We might receive the real message status here if we returned it,
                // but usually the specific status update comes via event or we just wait for 'newMessage' broadcast.
            }
        });
    };

    const formatMessageForUI = (msg: any) => {
        const isMine = msg.sender_id === user?.user_id;

        // Map status to UI string
        let statusDisplay = msg.status;
        if (statusDisplay === 'sent') statusDisplay = 'Sent';
        else if (statusDisplay === 'delivered') statusDisplay = 'Delivered';
        else if (statusDisplay === 'seen') statusDisplay = 'Seen';
        else if (msg.is_read) statusDisplay = 'Seen'; // Fallback

        return {
            position: isMine ? 'right' : 'left',
            type: 'text',
            text: msg.content,
            date: new Date(msg.created_at),
            title: isMine ? 'Me' : (msg.sender?.name || 'User'),
            status: isMine ? statusDisplay : undefined, // Only show status for my messages
            id: msg.message_id
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

    // Merge conversations and available contacts
    const dataSource = useMemo(() => {
        if (!user) return [];

        // 1. Map existing conversations
        const existing = conversations.map(c => {
            const partner = getPartner(c);
            const lastMsg = c.last_message; // Assuming conversation object has a last_message property

            // Determine preview text logic
            let previewText = 'Start a conversation';
            if (lastMsg) {
                const isMe = lastMsg.sender_id === user?.user_id;
                const prefix = isMe ? 'You: ' : '';
                previewText = `${prefix}${lastMsg.content}`;
            } else if (c.last_message_content) {
                // Fallback using the conversation summary fields
                const isMe = c.last_message_sender_id === user?.user_id;
                const prefix = isMe ? 'You: ' : '';
                previewText = `${prefix}${c.last_message_content}`;
            }

            return {
                avatar: partner?.profile_image_url || 'https://ui-avatars.com/api/?name=' + (partner?.name || 'User'),
                alt: partner?.name,
                title: partner?.name || 'Unknown User',
                subtitle: previewText,
                date: new Date(c.last_message_at || c.created_at),
                unread: 0,
                id: c.conversation_id,
                className: activeConversation?.conversation_id === c.conversation_id ? 'bg-indigo-50 border-l-4 border-indigo-500' : '',
                statusColor: onlineUsers.has(Number(partner?.user_id)) ? '#4CAF50' : undefined, // Green dot if online
                statusColorType: 'encircle', // distinctive look
            };
        });

        // 2. Map available contacts who don't have a conversation yet
        const existingPartners = new Set(conversations.map(c => {
            const p = getPartner(c);
            return p?.user_id;
        }));

        const potential = availableContacts
            .filter(u => !existingPartners.has(u.user_id))
            .map(u => ({
                avatar: u.profile_image_url || 'https://ui-avatars.com/api/?name=' + (u.name || 'User'),
                alt: u.name,
                title: u.name,
                subtitle: 'Tap to start chatting',
                date: new Date(), // Just current time for sorting or display
                unread: 0,
                id: `new-${u.user_id}`,
                className: 'opacity-80 hover:opacity-100' // Visual distinction?
            }));

        // Combine (optional: sort by date?)
        // Put existing conversations first, then potential contacts
        return [...existing, ...potential];
    }, [conversations, availableContacts, activeConversation, user]);

    return (
        <div className="flex flex-col md:flex-row h-[85vh] md:h-[calc(100vh-6rem)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
            {/* Sidebar */}
            <div className={`w-full md:w-80 border-r border-slate-200 flex flex-col absolute md:relative z-10 h-full bg-white transition-transform duration-300 ${activeConversation ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                    <h2 className="font-bold text-lg text-slate-800">Messages</h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-slate-500">Loading...</div>
                    ) : dataSource.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <p>No conversations yet.</p>
                            <p className="text-sm mt-2">Book a session or find a tutor/tutee to start chatting!</p>
                        </div>
                    ) : (
                        <ChatList
                            id="chat-list"
                            className="chat-list"
                            dataSource={dataSource}
                            onClick={handleSelectConversation}
                            lazyLoadingImage=""
                        />
                    )}
                </div>
            </div>

            {/* Chat Window */}
            <div className={`w-full md:flex-1 flex flex-col bg-slate-50 absolute md:relative z-20 h-full transition-transform duration-300 ${activeConversation ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                {activeConversation ? (
                    <>
                        {/* Header */}
                        <div className="p-3 md:p-4 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between shadow-sm z-30 sticky top-0">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setActiveConversation(null)}
                                    className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors flex items-center gap-1"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                    <span className="text-sm font-medium">Back</span>
                                </button>
                                <div className="h-10 w-10 rounded-full overflow-hidden">
                                    <img src={getPartner(activeConversation)?.profile_image_url || `https://ui-avatars.com/api/?name=${getPartner(activeConversation)?.name}`} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{getPartner(activeConversation)?.name}</h3>
                                    <div className="flex items-center gap-1.5">
                                        {/* Status of the connection to server */}
                                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>

                                        {/* Status of the PARTNER */}
                                        {onlineUsers.has(Number(getPartner(activeConversation)?.user_id)) && (
                                            <span className="text-xs text-green-600 font-bold ml-1">• Active Now</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
                            <MessageList
                                referance={scrollRef}
                                className="message-list"
                                lockable={true}
                                toBottomHeight={'100%'}
                                dataSource={messages}
                            />
                        </div>

                        {/* Input */}
                        <div className="p-3 bg-white border-t border-slate-200">
                            <Input
                                referance={inputRef}
                                placeholder="Type a message..."
                                multiline={true}
                                value={inputValue}
                                onChange={(e: any) => setInputValue(e.target.value)}
                                onKeyDown={(e: any) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                rightButtons={[
                                    <button
                                        key="send-btn"
                                        type="button"
                                        className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 transition-colors"
                                        onClick={handleSendMessage}
                                    >
                                        <svg className="w-5 h-5 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                    </button>
                                ]}
                                maxHeight={100}
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
