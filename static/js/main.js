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
});

console.log('Script loaded and ready');

// Export the namespaces and state for debugging
export { GoonApp, AppState };
