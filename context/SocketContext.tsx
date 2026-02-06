import React, { createContext, useContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client'; // Explicit import
import { useAuth } from './AuthContext';
import apiClient from '../services/api';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    joinConversation: (conversationId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { token, user } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!token || !user) {
            if (socket) {
                console.log('SocketContext - No token, disconnecting');
                socket.disconnect();
                setSocket(null);
                setIsConnected(false);
            }
            return;
        }

        // Determine socket URL
        const BACKEND_URL = import.meta.env.VITE_BACKEND_SERVER_URL || 'localhost';
        const isFullUrl = BACKEND_URL.startsWith('http://') || BACKEND_URL.startsWith('https://');
        const SOCKET_URL = isFullUrl ? BACKEND_URL : `http://${BACKEND_URL}:3000`;

        console.log('SocketContext - Connecting to:', SOCKET_URL);

        // Initialize socket
        const newSocket = io(SOCKET_URL, {
            auth: { token },
            autoConnect: true,
            // Remove restricted transports to allow polling fallback if websocket is blocked
            // transports: ['websocket'], 
        });

        newSocket.on('connect', () => {
            console.log('✅ SocketContext - Connected successfully! ID:', newSocket.id);
            setIsConnected(true);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('❌ SocketContext - Disconnected. Reason:', reason);
            setIsConnected(false);
        });

        newSocket.on('connect_error', (err) => {
            console.error('⚠️ SocketContext - Connection Error:', err.message);
            // If it's a transport error, it might be due to restricted transports (handled by removing the restriction above)
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [token, user?.user_id]); // Re-connect if token or user changes

    const joinConversation = (conversationId: string) => {
        if (socket && isConnected) {
            socket.emit('joinConversation', { conversationId });
        }
    };

    return (
        <SocketContext.Provider value={{ socket, isConnected, joinConversation }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};
