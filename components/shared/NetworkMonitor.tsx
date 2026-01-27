import React, { useEffect, useRef } from 'react';
import { useToast } from '../ui/Toast';

// Extend Navigator interface for Network Information API
interface NetworkInformation extends EventTarget {
    downlink: number;
    effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
    rtt: number;
    saveData: boolean;
    onchange: EventListener;
}

interface NavigatorWithConnection extends Navigator {
    connection?: NetworkInformation;
}

const NetworkMonitor: React.FC = () => {
    const { notify } = useToast();
    const isOfflineRef = useRef(!navigator.onLine);
    const lowSpeedNotifiedRef = useRef(false);

    useEffect(() => {
        const handleOnline = () => {
            if (isOfflineRef.current) {
                notify('You are back online.', 'success');
                isOfflineRef.current = false;
            }
        };

        const handleOffline = () => {
            if (!isOfflineRef.current) {
                notify('You are offline. Please check your internet connection.', 'error');
                isOfflineRef.current = true;
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check
        if (!navigator.onLine) {
            handleOffline();
        }

        // Network Information API (Chrome/Edge/Opera/Android Webview)
        const nav = navigator as NavigatorWithConnection;
        const connection = nav.connection;

        const handleConnectionChange = () => {
            if (connection) {
                // downlink is in megabits per second
                // Notify if speed is very low (e.g., < 0.5 Mbps) and we haven't notified recently
                // or effectiveType is 2g/slow-2g
                const isSlow = connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || (connection.downlink && connection.downlink < 1);

                if (isSlow && !lowSpeedNotifiedRef.current && navigator.onLine) {
                    notify('Your internet connection appears to be slow.', 'info');
                    lowSpeedNotifiedRef.current = true;

                    // Reset notification flag after a while so we don't spam, but remind if it persists long term?
                    // Or just notify once per session/period.
                    setTimeout(() => {
                        lowSpeedNotifiedRef.current = false;
                    }, 60000); // Cooldown 1 min
                }
            }
        };

        if (connection) {
            connection.addEventListener('change', handleConnectionChange);
            // Check immediately
            handleConnectionChange();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (connection) {
                connection.removeEventListener('change', handleConnectionChange);
            }
        };
    }, [notify]);

    return null; // Headless component
};

export default NetworkMonitor;
