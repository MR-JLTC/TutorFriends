import React, { createContext, useContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client'; // Explicit import
// Force CI rebuild
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

        // Initialize socket
        const newSocket = io('http://localhost:3000', { // Ensure API URL matches config
            auth: { token },
            autoConnect: true,
            transports: ['websocket'], // Force WebSocket to avoid polling issues
        });

        newSocket.on('connect', () => {
            console.log('SocketContext - Connected:', newSocket.id);
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('SocketContext - Disconnected');
            setIsConnected(false);
        });

        newSocket.on('connect_error', (err) => {
            console.error('SocketContext - Connection Error:', err.message);
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
