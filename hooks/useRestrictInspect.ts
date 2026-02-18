import { useEffect } from 'react';

/**
 * Hook to restrict inspect mode (Developer Tools) and context menu.
 * Disables:
 * - Right-click context menu
 * - F12
 * - Ctrl+Shift+I
 * - Ctrl+Shift+J
 * - Ctrl+Shift+C
 * - Ctrl+U
 */
export const useRestrictInspect = () => {
    useEffect(() => {
        // Disable right-click context menu
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
        };

        // Disable keyboard shortcuts for developer tools
        const handleKeyDown = (e: KeyboardEvent) => {
            // F12
            if (e.key === 'F12') {
                e.preventDefault();
            }

            // Ctrl+Shift+I (Inspect)
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
                e.preventDefault();
            }

            // Ctrl+Shift+J (Console)
            if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
                e.preventDefault();
            }

            // Ctrl+Shift+C (Inspect Element)
            if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
                e.preventDefault();
            }

            // Ctrl+U (View Source)
            if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
                e.preventDefault();
            }
        };

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);
};
