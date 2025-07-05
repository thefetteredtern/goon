/**
 * Goon - Main Script
 * Imports all modules and initializes the application
 */

// Import modules
import { GoonApp, AppState } from './modules/core.js';
import Storage from './modules/storage.js';
import Content from './modules/content.js';
import UI from './modules/ui.js';
import Theme from './modules/theme.js';
import Timer from './modules/timer.js';
import Stats from './modules/stats.js';
import Folders from './modules/folders.js';
import Settings from './modules/settings.js';
import Init from './modules/init.js';

// Initialize modules
GoonApp.Storage = Storage;
GoonApp.Content = Content;
GoonApp.UI = UI;
GoonApp.Theme = Theme;
GoonApp.Timer = Timer;
GoonApp.Stats = Stats;
GoonApp.Folders = Folders;
GoonApp.Settings = Settings;
GoonApp.Init = Init;

// Initialize app on DOM content loaded
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM fully loaded');
    
    // Initialize the application
    await GoonApp.Init.initialize();

    // ----- Dynamic layout adjustments -----
    try {
        // 1. Work with the sidebar (if present)
        const sidebar = document.querySelector('aside.sidebar');
        if (sidebar) {
            // 1a. Relocate the Start/Skip button so it's still accessible
            let startBtn = sidebar.querySelector('#startButton');
            if (!startBtn) {
                // fallback in case it was already moved
                startBtn = document.getElementById('startButton');
            }
            if (startBtn) {
                let header = document.querySelector('h2.mb-2');
                if (header) {
                    let container = document.getElementById('startButtonContainer');
                    if (!container) {
                        container = document.createElement('div');
                        container.id = 'startButtonContainer';
                        container.className = 'mb-3';
                        header.parentNode.insertBefore(container, header.nextSibling);
                    }
                    container.appendChild(startBtn);
                    startBtn.classList.remove('w-100');
                    startBtn.classList.add('btn-sm', 'ms-2');
                }
            }

            // 1b. Move the subreddit manager (Favorites & Punishments) into Settings ▸ Content tab
            const contentSettingsTab = document.getElementById('content-settings');
            if (contentSettingsTab) {
                const managerWrapper = document.createElement('div');
                managerWrapper.id = 'subredditManagerContainer';
                managerWrapper.className = 'mt-3';
                contentSettingsTab.appendChild(managerWrapper);

                Array.from(sidebar.children).forEach(child => {
                    if (child.contains(startBtn)) return; // skip element holding the start button
                    managerWrapper.appendChild(child);
                });
            }

            // 1c. Finally, remove the sidebar from the DOM entirely
            if (sidebar.parentNode) {
                sidebar.parentNode.removeChild(sidebar);
            }
        }

        // 4. Pin the timer & metronome row to the bottom of the viewport
        const footerRow = document.querySelector('.row.gx-2.mt-0');
        if (footerRow) {
            footerRow.style.position = 'fixed';
            footerRow.style.bottom = '0';
            footerRow.style.left = '0';
            footerRow.style.width = '100%';
            footerRow.style.zIndex = '1050';
            // Give it a matching background so it looks like a footer bar
            footerRow.style.backgroundColor = getComputedStyle(document.body).backgroundColor;
        }

        // 5. Add bottom padding to the content container so it doesn't hide behind the fixed footer
        const contentContainer = document.getElementById('content-container');
        if (contentContainer) {
            contentContainer.style.paddingBottom = '140px'; // slightly more than footer height
        }

        // 6. Small CSS helper to make sure the main column can stretch
        const helperStyle = document.createElement('style');
        helperStyle.innerHTML = `
            main.col {
                flex: 1 1 auto !important;
            }
        `;
        document.head.appendChild(helperStyle);
    } catch (layoutErr) {
        console.error('Layout adjustment error:', layoutErr);
    }
});

console.log('Script loaded and ready');

// Export the namespaces and state for debugging
export { GoonApp, AppState };
