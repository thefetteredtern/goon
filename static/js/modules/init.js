/**
 * Goon - Init Module
 * Handles application initialization and event binding
 */

import { GoonApp, AppState } from './core.js';

/**
 * Init Module - Handles application initialization and event binding
 */
GoonApp.Init = {
    /**
     * Initialize the application
     */
    initialize: async function() {
        console.log('Initializing application...');
        
        try {
            // Load saved settings from server
            const data = await GoonApp.Storage.loadFromStorage();
            console.log('Settings loaded from server:', data);
            
            // Ensure timer and metronome settings are properly initialized
            if (AppState.timer) {
                AppState.timer.minTime = parseInt(AppState.settings.timerMin) || 30;
                AppState.timer.maxTime = parseInt(AppState.settings.timerMax) || 120;
                console.log(`Timer initialized with min=${AppState.timer.minTime}, max=${AppState.timer.maxTime}`);
            }
            
            if (AppState.metronome) {
                AppState.metronome.speed = parseInt(AppState.settings.metronomeSpeed) || 60;
                console.log(`Metronome initialized with speed=${AppState.metronome.speed}`);
            }
            
            // Initialize sound settings
            localStorage.setItem('soundEnabled', AppState.settings.soundEnabled !== false);
            
            // Render initial lists
            GoonApp.UI.renderSubredditList('favorites');
            GoonApp.UI.renderSubredditList('punishments');
            
            // Load custom folders
            GoonApp.Folders.fetchCustomFolders();
            
            // Update stats display
            GoonApp.UI.updateStatsDisplay();
            
            // Apply saved theme
            GoonApp.Theme.applySavedTheme();
            document.documentElement.setAttribute('data-bs-theme', AppState.settings.theme || 'light');
            
            // Update UI based on loaded settings
            GoonApp.UI.updateContentSourceUI();
            GoonApp.UI.updatePunishmentsEnabledUI(AppState.settings.punishmentsEnabled);
            GoonApp.UI.updateAutoCycleUI();
            
            // Update timer settings UI
            if (GoonApp.UI.updateTimerSettingsUI) {
                GoonApp.UI.updateTimerSettingsUI();
            }
            
            // Bind all event handlers
            this.bindEventHandlers();
            
            console.log('Application initialized successfully with settings:', AppState.settings);
        } catch (error) {
            console.error('Error during initialization:', error);
        }
    },
    
    /**
     * Bind all event handlers
     */
    bindEventHandlers: function() {
        console.log('Binding event handlers...');
        
        // Reset timer button
        if (GoonApp.DOM.$('resetTimerBtn')) {
            GoonApp.DOM.$('resetTimerBtn').addEventListener('click', function() {
                // If there's an original timer value, give the user options
                if (AppState.timer.originalSeconds > 0) {
                    const choice = confirm('Reset timer with same duration? Click OK to use same time, or Cancel to pick a new random time.');
                    GoonApp.Timer.resetTimer(!choice); // If they click Cancel, use a new random time
                } else {
                    // If no original timer value, just confirm reset
                    if (confirm('Reset timer?')) {
                        GoonApp.Timer.resetTimer(true); // Use new random time since there's no original
                    }
                }
            });
        }
        
        // Auto-cycle enable/disable
        const autoCycleCheckbox = GoonApp.DOM.$('enableAutoCycle');
        if (autoCycleCheckbox) {
            autoCycleCheckbox.addEventListener('change', function() {
                AppState.settings.autoCycleEnabled = this.checked;
                console.log('Auto-cycle toggled:', this.checked);

                // If turned off, stop any timers immediately
                if (!this.checked && AppState.timer.interval) {
                    clearInterval(AppState.timer.interval);
                    AppState.timer.interval = null;
                    AppState.timer.seconds = 0;
                    GoonApp.Timer.updateTimerDisplay();
                }

                // If turned on and no timer is currently running, start one using saved interval
                if (this.checked && !AppState.timer.interval) {
                    const seconds = parseInt(AppState.settings.autoCycleInterval) || 60;
                    GoonApp.Timer.startTimer(seconds);
                }

                // Persist the change and update related UI elements
                GoonApp.UI.updateAutoCycleUI();
                GoonApp.Storage.saveToStorage();
            });
        }
        
        // Pause timer button
        if (GoonApp.DOM.$('pauseTimerBtn')) {
            GoonApp.DOM.$('pauseTimerBtn').addEventListener('click', function() {
                console.log('Pause button clicked');
                GoonApp.Timer.pauseTimer();
            });
        }
        
        // Finish button
        if (GoonApp.DOM.$('finishBtn')) {
            GoonApp.DOM.$('finishBtn').addEventListener('click', function() {
                GoonApp.Stats.finishContent();
            });
        }
        
        // Reset stats button
        if (GoonApp.DOM.$('resetStatsBtn')) {
            GoonApp.DOM.$('resetStatsBtn').addEventListener('click', function() {
                GoonApp.Stats.resetStats();
            });
        }
        
        // Content controls - Start/Skip button
        if (GoonApp.DOM.$('startButton')) {
            GoonApp.DOM.$('startButton').addEventListener('click', function() {
                // If button currently says 'Skip', update its appearance back to 'Start Browsing' after getting new content
                if (this.innerHTML === 'Skip') {
                    // Will be updated to 'Skip' again in startBrowsing() after content loads
                    this.innerHTML = 'Loading...';
                    this.disabled = true;
                }
                GoonApp.Content.startBrowsing();
            });
        }
        
        // Theme toggle
        if (GoonApp.DOM.$('themeToggle')) {
            GoonApp.DOM.$('themeToggle').addEventListener('click', GoonApp.Theme.toggleTheme.bind(GoonApp.Theme));
        }
        
        // Sound toggle button
        if (GoonApp.DOM.$('toggleMetronomeBtn')) {
            GoonApp.DOM.$('toggleMetronomeBtn').addEventListener('click', () => {
                const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
                localStorage.setItem('soundEnabled', !soundEnabled);
                if (typeof AppState !== 'undefined' && AppState.settings) {
                    AppState.settings.soundEnabled = !soundEnabled;
                }
                console.log('Sound toggled:', !soundEnabled ? 'ON' : 'OFF');
                
                // Update button text
                const btn = GoonApp.DOM.$('toggleMetronomeBtn');
                if (btn) {
                    btn.innerHTML = !soundEnabled ? 
                        '<i class="bi bi-volume-up"></i> Sound On' : 
                        '<i class="bi bi-volume-mute"></i> Sound Off';
                }
                
                // Restart metronome if it's running
                if (AppState.metronome.interval) {
                    const speed = parseInt(GoonApp.DOM.$('metronomeSpeed')?.value) || 60;
                    GoonApp.Timer.startMetronome(speed);
                }
            });
        }
        
        // Add event listeners for sidebar
        if (GoonApp.DOM.$('saveFavoriteBtn')) {
            GoonApp.DOM.$('saveFavoriteBtn').addEventListener('click', () => GoonApp.Content.addSubreddit('favorites'));
        }
        
        if (GoonApp.DOM.$('savePunishmentBtn')) {
            GoonApp.DOM.$('savePunishmentBtn').addEventListener('click', () => GoonApp.Content.addSubreddit('punishments'));
        }
        
        // Favorite input enter key
        if (GoonApp.DOM.$('favoriteInput')) {
            GoonApp.DOM.$('favoriteInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') GoonApp.Content.addSubreddit('favorites');
            });
        }
        
        // Punishment input enter key
        if (GoonApp.DOM.$('punishmentInput')) {
            GoonApp.DOM.$('punishmentInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') GoonApp.Content.addSubreddit('punishments');
            });
        }
        
        // Bulk actions for favorites
        if (GoonApp.DOM.$('enableAllFavoritesBtn')) {
            GoonApp.DOM.$('enableAllFavoritesBtn').addEventListener('click', () => GoonApp.Content.setAllSubreddits('favorites', true));
        }
        
        if (GoonApp.DOM.$('disableAllFavoritesBtn')) {
            GoonApp.DOM.$('disableAllFavoritesBtn').addEventListener('click', () => GoonApp.Content.setAllSubreddits('favorites', false));
        }
        
        if (GoonApp.DOM.$('removeAllFavoritesBtn')) {
            GoonApp.DOM.$('removeAllFavoritesBtn').addEventListener('click', () => GoonApp.Content.removeAllSubreddits('favorites'));
        }
        
        // Bulk actions for punishments
        if (GoonApp.DOM.$('enableAllPunishmentsBtn')) {
            GoonApp.DOM.$('enableAllPunishmentsBtn').addEventListener('click', () => GoonApp.Content.setAllSubreddits('punishments', true));
        }
        
        if (GoonApp.DOM.$('disableAllPunishmentsBtn')) {
            GoonApp.DOM.$('disableAllPunishmentsBtn').addEventListener('click', () => GoonApp.Content.setAllSubreddits('punishments', false));
        }
        
        if (GoonApp.DOM.$('removeAllPunishmentsBtn')) {
            GoonApp.DOM.$('removeAllPunishmentsBtn').addEventListener('click', () => GoonApp.Content.removeAllSubreddits('punishments'));
        }
        
        // Settings button and modal
        if (GoonApp.DOM.$('settingsButton')) {
            GoonApp.DOM.$('settingsButton').addEventListener('click', function() {
                console.log('Settings button clicked');
                // Initialize settings modal with current values
                GoonApp.Init.initializeSettingsModal();
                // Show settings modal
                const settingsModal = new bootstrap.Modal(GoonApp.DOM.$('settingsModal'));
                settingsModal.show();
            });
        }
        
        // Save settings button
        if (GoonApp.DOM.$('saveSettingsBtn')) {
            GoonApp.DOM.$('saveSettingsBtn').addEventListener('click', GoonApp.Settings.saveSettings);
        }
        
        // Import settings button
        if (GoonApp.DOM.$('importSettingsBtn')) {
            GoonApp.DOM.$('importSettingsBtn').addEventListener('click', GoonApp.Settings.importSettings);
        }
        
        // Browse button for settings import has been removed since there's no desktop version planned
        
        // Reset credentials button
        if (GoonApp.DOM.$('resetCredentialsBtn')) {
            GoonApp.DOM.$('resetCredentialsBtn').addEventListener('click', GoonApp.Settings.resetCredentials);
        }
        
        // Content source radio buttons
        const contentSourceRadios = document.querySelectorAll('input[name="defaultSource"]');
        contentSourceRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.checked) {
                    console.log(`Content source changed to: ${this.value}`);
                    AppState.settings.contentSource = this.value;
                    
                    // Save to storage immediately when content source is changed
                    GoonApp.Storage.saveToStorage().then(() => {
                        console.log(`Content source setting saved: ${this.value}`);
                    }).catch(error => {
                        console.error('Error saving content source setting:', error);
                    });
                    
                    // Update UI to reflect the change
                    GoonApp.UI.updateContentSourceUI();
                }
            });
        });
        
        // Custom content folder management
        if (GoonApp.DOM.$('refreshContentFoldersBtn')) {
            GoonApp.DOM.$('refreshContentFoldersBtn').addEventListener('click', () => {
                // Use the new refreshFolders function that forces a server-side refresh
                GoonApp.Folders.refreshFolders();
                
                // Show feedback to the user
                const btn = GoonApp.DOM.$('refreshContentFoldersBtn');
                if (btn) {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Refreshing...';
                    btn.disabled = true;
                    
                    // Re-enable after a short delay
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }, 2000);
                }
            });
        }
        
        if (GoonApp.DOM.$('enableAllContentFoldersBtn')) {
            GoonApp.DOM.$('enableAllContentFoldersBtn').addEventListener('click', () => GoonApp.Folders.setAllFolders('content', true));
        }
        
        if (GoonApp.DOM.$('disableAllContentFoldersBtn')) {
            GoonApp.DOM.$('disableAllContentFoldersBtn').addEventListener('click', () => GoonApp.Folders.setAllFolders('content', false));
        }
        
        // Custom punishment folder management
        if (GoonApp.DOM.$('refreshPunishmentFoldersBtn')) {
            GoonApp.DOM.$('refreshPunishmentFoldersBtn').addEventListener('click', () => {
                // Use the new refreshFolders function that forces a server-side refresh
                GoonApp.Folders.refreshFolders();
                
                // Show feedback to the user
                const btn = GoonApp.DOM.$('refreshPunishmentFoldersBtn');
                if (btn) {
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Refreshing...';
                    btn.disabled = true;
                    
                    // Re-enable after a short delay
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }, 2000);
                }
            });
        }
        
        if (GoonApp.DOM.$('enableAllPunishmentFoldersBtn')) {
            GoonApp.DOM.$('enableAllPunishmentFoldersBtn').addEventListener('click', () => GoonApp.Folders.setAllFolders('punishment', true));
        }
        
        if (GoonApp.DOM.$('disableAllPunishmentFoldersBtn')) {
            GoonApp.DOM.$('disableAllPunishmentFoldersBtn').addEventListener('click', () => GoonApp.Folders.setAllFolders('punishment', false));
        }
    },
    /**
     * Initialize the settings modal with current values
     */
    initializeSettingsModal: function() {
        console.log('Initializing settings modal with current values');
        
        // Initialize content source radio buttons
        const defaultSourceReddit = GoonApp.DOM.$('defaultSourceReddit');
        const defaultSourceCustom = GoonApp.DOM.$('defaultSourceCustom');
        const defaultSourceMixed = GoonApp.DOM.$('defaultSourceMixed');
        
        if (defaultSourceReddit && defaultSourceCustom && defaultSourceMixed) {
            // Get current content source from settings
            const contentSource = AppState.settings.contentSource || 'reddit';
            console.log(`Current content source: ${contentSource}`);
            
            // Set the appropriate radio button
            defaultSourceReddit.checked = contentSource === 'reddit';
            defaultSourceCustom.checked = contentSource === 'custom';
            defaultSourceMixed.checked = contentSource === 'mixed';
        }
        
        // Initialize Reddit API credentials
        const clientIdInput = GoonApp.DOM.$('clientId');
        const clientSecretInput = GoonApp.DOM.$('clientSecret');
        const userAgentInput = GoonApp.DOM.$('userAgent');
        
        if (clientIdInput && clientSecretInput && userAgentInput) {
            // Only set values if they exist in settings to avoid showing 'undefined'
            if (AppState.settings.redditCredentials) {
                if (AppState.settings.redditCredentials.client_id) {
                    clientIdInput.value = AppState.settings.redditCredentials.client_id;
                }
                
                if (AppState.settings.redditCredentials.client_secret) {
                    clientSecretInput.value = AppState.settings.redditCredentials.client_secret;
                }
                
                if (AppState.settings.redditCredentials.user_agent) {
                    userAgentInput.value = AppState.settings.redditCredentials.user_agent;
                }
                
                console.log('Loaded Reddit API credentials into settings form');
            } else {
                console.log('No Reddit API credentials found in settings');
            }
        }
        
        // Initialize AI teasing settings
        const aiEnabledCheckbox = GoonApp.DOM.$('enableAITeasing');
        if (aiEnabledCheckbox) {
            aiEnabledCheckbox.checked = !!AppState.settings.aiTeasingEnabled;
        }
        const penisSizeInput = GoonApp.DOM.$('penisSize');
        if (penisSizeInput) {
            penisSizeInput.value = AppState.settings.penisSize || '';
        }
        const ollamaModelInput = GoonApp.DOM.$('ollamaModel');
        if (ollamaModelInput) {
            ollamaModelInput.value = AppState.settings.ollamaModel || 'mistral:instruct';
        }
        const aiPromptTemplateInput = GoonApp.DOM.$('aiPromptTemplate');
        if (aiPromptTemplateInput) {
            aiPromptTemplateInput.value = AppState.settings.aiPromptTemplate || '';
        }

        // Initialize metronome sound settings
        const metronomeSoundSelect = GoonApp.DOM.$('metronomeSound');
        if (metronomeSoundSelect) {
            metronomeSoundSelect.value = AppState.settings.metronomeSound || 'default';
        }
        
        const metronomeVolumeSlider = GoonApp.DOM.$('metronomeVolume');
        const metronomeVolumeDisplay = GoonApp.DOM.$('metronomeVolumeDisplay');
        if (metronomeVolumeSlider) {
            const volume = parseFloat(AppState.settings.metronomeVolume) || 0.7;
            metronomeVolumeSlider.value = volume;
            
            if (metronomeVolumeDisplay) {
                metronomeVolumeDisplay.textContent = Math.round(volume * 100) + '%';
            }
        }
        
        // Update theme radio buttons to match current theme
        const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';
        const themeLight = GoonApp.DOM.$('themeLight');
        const themeDark = GoonApp.DOM.$('themeDark');
        
        if (themeLight && themeDark) {
            themeLight.checked = currentTheme === 'light';
            themeDark.checked = currentTheme === 'dark';
        }
        
        // Fetch latest folders before showing settings
        GoonApp.Folders.fetchCustomFolders().then(() => {
            console.log('Fetched custom folders for settings modal');
            
            // Show content tab if custom content is selected
            if (AppState.settings.contentSource === 'custom') {
                const contentTab = GoonApp.DOM.$('content-tab');
                if (contentTab) {
                    contentTab.click();
                }
            }
        });
    }
};

export default GoonApp.Init;
