/**
 * userManager.js — Content script for the User Management System
 *
 * Runs on http://localhost:5173/* to extract the "userId" from
 * localStorage and save it to chrome.storage.local for the extension.
 */
(function () {
    'use strict';

    function captureUserId() {
        const userId = localStorage.getItem('userId');
        if (userId) {
            chrome.storage.local.set({ userId: userId }, () => {
                console.log('[AI Chat Logger] Captured userId from User Management System:', userId);
            });
        }
    }

    // Try capturing immediately
    captureUserId();

    // Also listen for storage events in case the user logs in after the page loads
    window.addEventListener('storage', (event) => {
        if (event.key === 'userId') {
            captureUserId();
        }
    });
})();
