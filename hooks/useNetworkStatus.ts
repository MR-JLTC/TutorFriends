import { useEffect, useRef } from 'react';
import { useToast } from '../components/ui/Toast';

export const useNetworkStatus = () => {
    const { notify } = useToast();
    const isOnlineRef = useRef(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            // Avoid duplicate notifications if already online
            if (isOnlineRef.current) return;

            isOnlineRef.current = true;

            // Check for connection quality if available (Chrome/Edge only)
            const connection = (navigator as any).connection;
            if (connection) {
                if (connection.effectiveType === '4g' && connection.rtt < 100) {
                    notify('Excellent Internet Connectivity', 'success');
                } else {
                    notify('Internet Connection Restored', 'success');
                }
            } else {
                notify('Internet Connection Restored', 'success');
            }
        };

        const handleOffline = () => {
            if (!isOnlineRef.current) return;
            isOnlineRef.current = false;
            notify('You are currently offline', 'error');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check (optional, but maybe too noisy on reload)
        // if (navigator.onLine) handleOnline();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [notify]);
};
