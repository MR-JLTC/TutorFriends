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
                e.stopPropagation();
                return;
            }

            // Ctrl+Shift+I (Inspect)
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Ctrl+Shift+J (Console)
            if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Ctrl+Shift+C (Inspect Element)
            if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Ctrl+U (View Source)
            if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        };

        // Use capture phase to ensure we intercept before other handlers if necessary,
        // but let's try standard bubbling phase first to be less intrusive to UI components.
        // If standard phase caused issues, maybe we were preventing default on too many things?
        // Actually, the previous implementation was fine for standard events.
        // Let's ensure we are NOT blocking input fields or standard interactions.

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);
};
