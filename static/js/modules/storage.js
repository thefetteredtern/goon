/**
 * Goon - Storage Module
 * Handles loading and saving settings to server storage
 */

import { GoonApp, AppState } from './core.js';

/**
 * Storage Module - Handles loading and saving settings
 */
const Storage = {
    /**
     * Load settings from server-side storage
     * @returns {Promise} Promise that resolves when settings are loaded
     */
    loadFromStorage: async function() {
        try {
            console.log('Loading settings from server...');
            
            // Don't show loading indicator on initial app load
            // Only show loading indicator when explicitly fetching content
            // This allows the welcome message to be visible on first load
            
            // Try to load from localStorage first as a fallback
            let parsedLocalSettings = null;
            const localSettings = localStorage.getItem('goonAppSettings');
            if (localSettings) {
                try {
                    parsedLocalSettings = JSON.parse(localSettings);
                    console.log('Found settings in localStorage:', parsedLocalSettings);
                    // We'll apply these if server fetch fails
                }
                catch (e) {
                    console.warn('Failed to parse localStorage settings:', e);
                }
            }
            
            let settings;
            
            try {
                // Fetch settings from server
                const response = await fetch('/load_settings');
                
                if (!response.ok) {
                    throw new Error(`Failed to load settings: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                console.log('Settings loaded successfully from server');
                
                // Check if we have settings in the response
                settings = data.settings || data;
                console.log('Parsed settings from response:', settings);
                
                // Save server settings to localStorage for future use
                localStorage.setItem('goonAppSettings', JSON.stringify(settings));
                console.log('Server settings saved to localStorage');
            } catch (serverError) {
                console.warn('Failed to load settings from server:', serverError);
                
                // If server fetch fails but we have localStorage settings, use those
                if (parsedLocalSettings) {
                    console.log('Using localStorage settings as fallback');
                    settings = parsedLocalSettings;
                } else {
                    console.warn('No settings available from server or localStorage, using defaults');
                    settings = {};
                }
            }
            
            // Update AppState with loaded settings
            if (settings.favorites && Array.isArray(settings.favorites)) {
                AppState.subreddits.favorites = settings.favorites;
            }
            
            if (settings.punishments && Array.isArray(settings.punishments)) {
                AppState.subreddits.punishments = settings.punishments;
            }
            
            // CRITICAL: Load content source with proper priority
            // 1. First check URL parameters (highest priority)
            const urlParams = new URLSearchParams(window.location.search);
            const urlContentSource = urlParams.get('contentSource');
            
            // 2. Then check session storage (second priority)
            const sessionContentSource = sessionStorage.getItem('contentSource');
            
            // 3. Then check settings from server (third priority)
            const settingsContentSource = settings.contentSource;
            
            // 4. Default to 'reddit' if nothing else is available
            let finalContentSource;
            
            if (urlContentSource && ['reddit', 'custom', 'mixed'].includes(urlContentSource)) {
                finalContentSource = urlContentSource;
                console.log(`Using content source from URL parameter: ${finalContentSource}`);
            } else if (sessionContentSource) {
                finalContentSource = sessionContentSource;
                console.log(`Using content source from session storage: ${finalContentSource}`);
            } else if (settingsContentSource) {
                finalContentSource = settingsContentSource;
                console.log(`Using content source from settings: ${finalContentSource}`);
            } else {
                finalContentSource = 'reddit';
                console.log(`No content source found, using default: ${finalContentSource}`);
            }
            
            // Set the content source in AppState
            AppState.settings.contentSource = finalContentSource;
            
            // Store in session storage for persistence
            try {
                sessionStorage.setItem('contentSource', finalContentSource);
                localStorage.setItem('contentSource', finalContentSource); // Also store in localStorage for longer persistence
                console.log(`Stored content source in storage: ${finalContentSource}`);
            } catch (e) {
                console.warn('Failed to store content source in storage:', e);
            }
            
            // Add content source to URL if not already there (helps with page refreshes)
            if (!urlContentSource && window.history && window.history.replaceState) {
                try {
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('contentSource', finalContentSource);
                    window.history.replaceState({}, '', newUrl.toString());
                    console.log(`Added content source to URL: ${finalContentSource}`);
                } catch (e) {
                    console.warn('Failed to update URL with content source:', e);
                }
            }
            
            // Load punishments enabled setting
            if (settings.punishmentsEnabled !== undefined) {
                AppState.settings.punishmentsEnabled = settings.punishmentsEnabled;
            }
            
            // Load auto cycle settings
            if (settings.autoCycleEnabled !== undefined) {
                AppState.settings.autoCycleEnabled = settings.autoCycleEnabled;
            }
            
            if (settings.autoCycleInterval) {
                AppState.settings.autoCycleInterval = settings.autoCycleInterval;
            }
            
            // Load video timer soft limit setting
            if (settings.videoTimerSoftLimitEnabled !== undefined) {
                AppState.settings.videoTimerSoftLimitEnabled = settings.videoTimerSoftLimitEnabled;
            }
            
            // Load theme
            if (settings.theme) {
                AppState.settings.theme = settings.theme;
                // Apply theme to document
                document.documentElement.setAttribute('data-bs-theme', settings.theme);
            }
            
            // Load timer settings
            if (settings.timerMin !== undefined) {
                AppState.settings.timerMin = settings.timerMin;
                console.log('Loaded timerMin:', settings.timerMin);
            }
            
            if (settings.timerMax !== undefined) {
                AppState.settings.timerMax = settings.timerMax;
                console.log('Loaded timerMax:', settings.timerMax);
            }
            
            if (settings.metronomeSpeed !== undefined) {
                AppState.settings.metronomeSpeed = settings.metronomeSpeed;
                console.log('Loaded metronomeSpeed:', settings.metronomeSpeed);
            }
            
            // Load sound settings
            if (settings.soundEnabled !== undefined) {
                AppState.settings.soundEnabled = settings.soundEnabled;
                localStorage.setItem('soundEnabled', settings.soundEnabled);
                console.log('Loaded soundEnabled:', settings.soundEnabled);
            }
            
            // Load metronome sound settings
            if (settings.metronomeSound !== undefined) {
                AppState.settings.metronomeSound = settings.metronomeSound;
                console.log('Loaded metronomeSound:', settings.metronomeSound);
            }
            
            if (settings.metronomeVolume !== undefined) {
                AppState.settings.metronomeVolume = settings.metronomeVolume;
                console.log('Loaded metronomeVolume:', settings.metronomeVolume);
            }
            
            // Load enabled folders
            if (settings.enabledContentFolders && Array.isArray(settings.enabledContentFolders)) {
                AppState.settings.enabledContentFolders = settings.enabledContentFolders;
                // Also update folders state
                AppState.folders.enabledContentFolders = settings.enabledContentFolders;
            }
            
            if (settings.enabledPunishmentFolders && Array.isArray(settings.enabledPunishmentFolders)) {
                AppState.settings.enabledPunishmentFolders = settings.enabledPunishmentFolders;
                // Also update folders state
                AppState.folders.enabledPunishmentFolders = settings.enabledPunishmentFolders;
            }
            
            // Load Reddit credentials
            if (settings.redditCredentials) {
                AppState.settings.redditCredentials = settings.redditCredentials;
            }
            
            // Load stats
            if (settings.stats) {
                if (settings.stats.favoritesCompletedCount !== undefined) {
                    AppState.stats.favoritesCompletedCount = settings.stats.favoritesCompletedCount;
                }
                
                if (settings.stats.punishmentsCompletedCount !== undefined) {
                    AppState.stats.punishmentsCompletedCount = settings.stats.punishmentsCompletedCount;
                }
            } else {
                // Handle case where stats are directly in the settings object
                if (settings.favoritesCompletedCount !== undefined) {
                    AppState.stats.favoritesCompletedCount = settings.favoritesCompletedCount;
                }
                
                if (settings.punishmentsCompletedCount !== undefined) {
                    AppState.stats.punishmentsCompletedCount = settings.punishmentsCompletedCount;
                }
            }
            
            // Update UI based on loaded settings
            if (GoonApp.UI.updateContentSourceUI) {
                GoonApp.UI.updateContentSourceUI();
            }
            
            if (GoonApp.UI.updatePunishmentsEnabledUI) {
                GoonApp.UI.updatePunishmentsEnabledUI(AppState.settings.punishmentsEnabled);
            }
            
            if (GoonApp.UI.updateAutoCycleUI) {
                GoonApp.UI.updateAutoCycleUI();
            }
            
            // Update timer and metronome settings UI
            if (GoonApp.UI.updateTimerSettingsUI) {
                GoonApp.UI.updateTimerSettingsUI();
            }
            
            // Apply theme to document
            if (AppState.settings.theme) {
                document.documentElement.setAttribute('data-bs-theme', AppState.settings.theme);
            }
            
            // Make sure all settings are properly applied to the UI
            console.log('Ensuring all settings are applied to UI elements');
            
            // Force UI update with loaded settings
            setTimeout(() => {
                // Update UI based on loaded settings again after a short delay
                if (GoonApp.UI.updateContentSourceUI) {
                    GoonApp.UI.updateContentSourceUI();
                }
                
                if (GoonApp.UI.updatePunishmentsEnabledUI) {
                    GoonApp.UI.updatePunishmentsEnabledUI(AppState.settings.punishmentsEnabled);
                }
                
                if (GoonApp.UI.updateAutoCycleUI) {
                    GoonApp.UI.updateAutoCycleUI();
                }
                
                // Update timer and metronome settings UI
                if (GoonApp.UI.updateTimerSettingsUI) {
                    GoonApp.UI.updateTimerSettingsUI();
                }
                
                console.log('UI elements updated with loaded settings');
                
                // Ensure the content container is visible and loading indicator is hidden
                const contentContainer = GoonApp.DOM.$('content-container');
                const loadingIndicator = GoonApp.DOM.$('loading-indicator');
                
                if (contentContainer) {
                    contentContainer.classList.remove('d-none');
                }
                
                if (loadingIndicator) {
                    loadingIndicator.classList.add('d-none');
                }
                
                console.log('Content container shown with welcome message');
            }, 100);
            
            return data || {};
        } catch (error) {
            console.error('Error loading settings from server:', error);
            
            // Try to load from localStorage as a fallback
            const localSettings = localStorage.getItem('goonAppSettings');
            if (localSettings) {
                try {
                    const parsedSettings = JSON.parse(localSettings);
                    console.log('Loading settings from localStorage as fallback');
                    // Create a data object similar to what the server would return
                    const fallbackData = { settings: parsedSettings };
                    
                    // Update AppState with localStorage settings
                    if (parsedSettings.favorites && Array.isArray(parsedSettings.favorites)) {
                        AppState.subreddits.favorites = parsedSettings.favorites;
                    }
                    
                    if (parsedSettings.punishments && Array.isArray(parsedSettings.punishments)) {
                        AppState.subreddits.punishments = parsedSettings.punishments;
                    }
                    
                    // Load content source
                    if (parsedSettings.contentSource) {
                        AppState.settings.contentSource = parsedSettings.contentSource;
                    }
                    
                    // Load punishments enabled setting
                    if (parsedSettings.punishmentsEnabled !== undefined) {
                        AppState.settings.punishmentsEnabled = parsedSettings.punishmentsEnabled;
                    }
                    
                    // Load auto cycle settings
                    if (parsedSettings.autoCycleEnabled !== undefined) {
                        AppState.settings.autoCycleEnabled = parsedSettings.autoCycleEnabled;
                    }
                    
                    if (parsedSettings.autoCycleInterval) {
                        AppState.settings.autoCycleInterval = parsedSettings.autoCycleInterval;
                    }
                    
                    // Load theme
                    if (parsedSettings.theme) {
                        AppState.settings.theme = parsedSettings.theme;
                        document.documentElement.setAttribute('data-bs-theme', parsedSettings.theme);
                    }
                    
                    // Load timer settings
                    if (parsedSettings.timerMin !== undefined) {
                        AppState.settings.timerMin = parsedSettings.timerMin;
                    }
                    
                    if (parsedSettings.timerMax !== undefined) {
                        AppState.settings.timerMax = parsedSettings.timerMax;
                    }
                    
                    if (parsedSettings.metronomeSpeed !== undefined) {
                        AppState.settings.metronomeSpeed = parsedSettings.metronomeSpeed;
                    }
                    
                    // Load sound settings
                    if (parsedSettings.soundEnabled !== undefined) {
                        AppState.settings.soundEnabled = parsedSettings.soundEnabled;
                        localStorage.setItem('soundEnabled', parsedSettings.soundEnabled);
                    }
                    
                    // Load enabled folders
                    if (parsedSettings.enabledContentFolders && Array.isArray(parsedSettings.enabledContentFolders)) {
                        AppState.settings.enabledContentFolders = parsedSettings.enabledContentFolders;
                    }
                    
                    if (parsedSettings.enabledPunishmentFolders && Array.isArray(parsedSettings.enabledPunishmentFolders)) {
                        AppState.settings.enabledPunishmentFolders = parsedSettings.enabledPunishmentFolders;
                    }
                    
                    // Load Reddit credentials
                    if (parsedSettings.redditCredentials) {
                        AppState.settings.redditCredentials = parsedSettings.redditCredentials;
                    }
                    
                    console.log('Successfully loaded settings from localStorage');
                    return fallbackData;
                }
                catch (e) {
                    console.error('Failed to load settings from localStorage:', e);
                }
            }
            
            // Show error message if UI module is loaded
            if (GoonApp.UI.showError) {
                GoonApp.UI.showError(`Failed to load settings: ${error.message}`);
            } else {
                alert(`Failed to load settings: ${error.message}`);
            }
            
            return null;
        }
    },
    
    /**
     * Save settings to server-side storage
     * @returns {Promise} Promise that resolves with success status
     */
    saveToStorage: async function() {
        try {
            console.log('Saving settings to server...');
            
            // Get the current content source, with fallbacks
            const currentContentSource = AppState.settings.contentSource || sessionStorage.getItem('contentSource') || 'reddit';
            console.log(`Current content source for saving: ${currentContentSource}`);
            
            // Prepare settings object
            const settings = {
                favorites: AppState.subreddits.favorites,
                punishments: AppState.subreddits.punishments,
                contentSource: currentContentSource,
                punishmentsEnabled: AppState.settings.punishmentsEnabled,
                autoCycleEnabled: AppState.settings.autoCycleEnabled,
                autoCycleInterval: AppState.settings.autoCycleInterval,
                videoTimerSoftLimitEnabled: AppState.settings.videoTimerSoftLimitEnabled,
                theme: AppState.settings.theme,
                redditCredentials: AppState.settings.redditCredentials,
                
                // Timer and metronome settings
                timerMin: AppState.settings.timerMin || 30,
                timerMax: AppState.settings.timerMax || 120,
                
                // Sound settings
                soundEnabled: localStorage.getItem('soundEnabled') !== 'false',
                metronomeSound: AppState.settings.metronomeSound || 'default',
                metronomeVolume: parseFloat(AppState.settings.metronomeVolume) || 0.7,
                
                // Stats
                stats: {
                    favoritesCompletedCount: AppState.stats.favoritesCompletedCount,
                    punishmentsCompletedCount: AppState.stats.punishmentsCompletedCount
                },
                
                // Enabled folders - make sure we're getting the latest values from both possible sources
                enabledContentFolders: AppState.folders.enabledContentFolders || AppState.settings.enabledContentFolders || [],
                enabledPunishmentFolders: AppState.folders.enabledPunishmentFolders || AppState.settings.enabledPunishmentFolders || []
            };
            
            // Make sure the settings object is also updated with the latest values
            AppState.settings.enabledContentFolders = settings.enabledContentFolders;
            AppState.settings.enabledPunishmentFolders = settings.enabledPunishmentFolders;
            
            // Always save to localStorage first, regardless of server success
            try {
                localStorage.setItem('goonAppSettings', JSON.stringify(settings));
                console.log('Settings saved to localStorage');
            } catch (localStorageError) {
                console.warn('Failed to save to localStorage:', localStorageError);
            }
            
            // Try to send settings to server
            try {
                const response = await fetch('/save_settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(settings)
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to save settings: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                console.log('Settings saved successfully to server');
            } catch (serverError) {
                console.warn('Failed to save settings to server:', serverError);
                // We continue because we already saved to localStorage
            }
            
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            
            // Show error message if UI module is loaded
            if (GoonApp.UI.showError) {
                GoonApp.UI.showError(`Failed to save settings: ${error.message}`);
            } else {
                alert(`Failed to save settings: ${error.message}`);
            }
            
            return false;
        }
    },
/**
 * Helper function to save settings to localStorage
 * @param {Object} settings - Settings object to save
 */
saveToLocalStorage: function(settings) {
    try {
        localStorage.setItem('goonAppSettings', JSON.stringify(settings));
        console.log('Settings saved to localStorage');
    } catch (error) {
        console.error('Error saving settings to localStorage:', error);
    }
}
}

// Export the storage module
export default Storage;
