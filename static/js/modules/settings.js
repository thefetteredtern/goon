/**
 * Goon - Settings Module
 * Handles application settings
 */

import { GoonApp, AppState } from './core.js';

/**
 * Settings Module - Handles application settings
 */
GoonApp.Settings = {
    /**
     * Save settings from the settings modal
     */
    saveSettings: function() {
        try {
            console.log('Saving settings...');
            
            // Get content source
            const redditRadio = GoonApp.DOM.$('defaultSourceReddit');
            const customRadio = GoonApp.DOM.$('defaultSourceCustom');
            const mixedRadio = GoonApp.DOM.$('defaultSourceMixed');
            
            let contentSource = 'reddit'; // Default fallback
            
            if (redditRadio && redditRadio.checked) {
                contentSource = 'reddit';
            } else if (customRadio && customRadio.checked) {
                contentSource = 'custom';
            } else if (mixedRadio && mixedRadio.checked) {
                contentSource = 'mixed';
            }
            
            // Set the content source in AppState
            AppState.settings.contentSource = contentSource;
            console.log(`Setting content source to: ${contentSource}`);
            
            // Also store in session storage as a backup
            try {
                sessionStorage.setItem('contentSource', contentSource);
                console.log(`Stored content source in session storage: ${contentSource}`);
            } catch (e) {
                console.warn('Failed to store content source in session storage:', e);
            }
            
            // Get punishments enabled setting
            const punishmentsEnabledCheckbox = GoonApp.DOM.$('enablePunishments');
            if (punishmentsEnabledCheckbox) {
                AppState.settings.punishmentsEnabled = punishmentsEnabledCheckbox.checked;
            }
            
            // Get auto cycle settings
            const autoCycleCheckbox = GoonApp.DOM.$('enableAutoCycle');
            if (autoCycleCheckbox) {
                AppState.settings.autoCycleEnabled = autoCycleCheckbox.checked;
                console.log('Saving autoCycleEnabled:', autoCycleCheckbox.checked);
                
                // If autocycle is disabled, make sure we don't start timers
                if (!autoCycleCheckbox.checked) {
                    // Clear any existing timer
                    if (AppState.timer.interval) {
                        clearInterval(AppState.timer.interval);
                        AppState.timer.interval = null;
                        console.log('Cleared existing timer because autocycle is disabled');
                    }
                }
            }
            
            // Get video timer soft limit setting
            const videoTimerSoftLimitCheckbox = GoonApp.DOM.$('enableVideoTimerSoftLimit');
            if (videoTimerSoftLimitCheckbox) {
                AppState.settings.videoTimerSoftLimitEnabled = videoTimerSoftLimitCheckbox.checked;
            }
            
            // Get timer settings
            const timerMinInput = GoonApp.DOM.$('timerMin');
            const timerMaxInput = GoonApp.DOM.$('timerMax');
            
            if (timerMinInput) {
                AppState.settings.timerMin = timerMinInput.value;
                console.log('Saving timerMin:', timerMinInput.value);
            }
            
            if (timerMaxInput) {
                AppState.settings.timerMax = timerMaxInput.value;
                console.log('Saving timerMax:', timerMaxInput.value);
            }
            
            // Set autocycle interval based on timer min/max
            if (timerMinInput && timerMaxInput) {
                const minVal = parseInt(timerMinInput.value) || 30;
                const maxVal = parseInt(timerMaxInput.value) || 120;
                // Use average of min and max as the interval
                AppState.settings.autoCycleInterval = Math.floor((minVal + maxVal) / 2);
                console.log('Setting autoCycleInterval to average of min/max:', AppState.settings.autoCycleInterval);
            }
            
            // Get metronome sound settings
            const metronomeSoundSelect = GoonApp.DOM.$('metronomeSound');
            if (metronomeSoundSelect) {
                AppState.settings.metronomeSound = metronomeSoundSelect.value || 'default';
                console.log('Saving metronomeSound:', metronomeSoundSelect.value);
            }
            
            // Get metronome volume setting
            const metronomeVolumeSlider = GoonApp.DOM.$('metronomeVolume');
            if (metronomeVolumeSlider) {
                AppState.settings.metronomeVolume = parseFloat(metronomeVolumeSlider.value) || 0.7;
                console.log('Saving metronomeVolume:', metronomeVolumeSlider.value);
            }
            
            // Get sound enabled setting
            const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
            AppState.settings.soundEnabled = soundEnabled;
            console.log('Saving soundEnabled:', soundEnabled);
            
            // Get theme setting
            const themeLightRadio = GoonApp.DOM.$('themeLight');
            const themeDarkRadio = GoonApp.DOM.$('themeDark');
            
            if (themeLightRadio && themeLightRadio.checked) {
                AppState.settings.theme = 'light';
            } else if (themeDarkRadio && themeDarkRadio.checked) {
                AppState.settings.theme = 'dark';
            }
            
            // Get Reddit credentials
            const clientIdInput = GoonApp.DOM.$('clientId');
            const clientSecretInput = GoonApp.DOM.$('clientSecret');
            const userAgentInput = GoonApp.DOM.$('userAgent');
            
            if (clientIdInput && clientSecretInput && userAgentInput) {
                const clientId = clientIdInput.value.trim();
                const clientSecret = clientSecretInput.value.trim();
                const userAgent = userAgentInput.value.trim() || 'Goon/1.0';
                
                // Store in both formats for compatibility
                // 1. As nested object (newer format)
                AppState.settings.redditCredentials = {
                    client_id: clientId,
                    client_secret: clientSecret,
                    user_agent: userAgent
                };
                
                // 2. As direct properties (older format)
                AppState.settings.redditClientId = clientId;
                AppState.settings.redditClientSecret = clientSecret;
                AppState.settings.redditUserAgent = userAgent;
                
                console.log('Saved Reddit credentials in both formats');
            }
            
            // Save to storage
            GoonApp.Storage.saveToStorage();
            
            // Update UI
            GoonApp.UI.updateContentSourceUI();
            GoonApp.UI.updatePunishmentsEnabledUI(AppState.settings.punishmentsEnabled);
            GoonApp.UI.updateAutoCycleUI();
            
            // Update timer and metronome settings UI
            if (GoonApp.UI.updateTimerSettingsUI) {
                GoonApp.UI.updateTimerSettingsUI();
            }
            
            // Apply theme
            GoonApp.Theme.applyTheme(AppState.settings.theme);
            document.documentElement.setAttribute('data-bs-theme', AppState.settings.theme || 'light');
            localStorage.setItem('theme', AppState.settings.theme || 'light');
            
            // Update timer and metronome in app state
            if (AppState.timer) {
                AppState.timer.minTime = parseInt(AppState.settings.timerMin) || 30;
                AppState.timer.maxTime = parseInt(AppState.settings.timerMax) || 120;
                console.log(`Updated timer state: min=${AppState.timer.minTime}, max=${AppState.timer.maxTime}`);
            }
            
            if (AppState.metronome) {
                AppState.metronome.speed = parseInt(AppState.settings.metronomeSpeed) || 60;
                console.log(`Updated metronome state: speed=${AppState.metronome.speed}`);
            }
            
            // Log all settings being saved
            console.log('All settings being saved:', JSON.stringify(AppState.settings));
            
            // Hide settings modal
            const settingsModal = bootstrap.Modal.getInstance(GoonApp.DOM.$('settingsModal'));
            if (settingsModal) {
                settingsModal.hide();
            }
            
            console.log('Settings saved successfully', AppState.settings);
        } catch (error) {
            console.error('Error saving settings:', error);
            GoonApp.UI.showError(`Failed to save settings: ${error.message}`);
        }
    },
    
    /**
     * Import settings from a previous installation
     */
    importSettings: function() {
        try {
            console.log('Importing settings...');
            
            // Check if we have a file upload or a path
            const fileUploadInput = GoonApp.DOM.$('settingsFileUpload');
            const importPathInput = GoonApp.DOM.$('importSettingsPath');
            
            // Show loading message
            GoonApp.UI.showImportResult('Importing settings...', 'info');
            
            // If a file was selected, use that
            if (fileUploadInput && fileUploadInput.files && fileUploadInput.files.length > 0) {
                const settingsFile = fileUploadInput.files[0];
                console.log('Importing settings from file:', settingsFile.name);
                
                // Create FormData object to send the file
                const formData = new FormData();
                formData.append('settingsFile', settingsFile);
                
                // Send import request to server with the file
                fetch('/import_settings_file', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(this.handleImportResponse)
                .catch(error => {
                    console.error('Error importing settings:', error);
                    GoonApp.UI.showImportResult('Error importing settings: ' + error.message, 'danger');
                });
                
                return;
            }
            
            // Otherwise use the path input
            if (!importPathInput || !importPathInput.value.trim()) {
                GoonApp.UI.showImportResult('Please either select a file or enter a valid import path.', 'danger');
                return;
            }
            
            const importPath = importPathInput.value.trim();
            console.log('Importing settings from path:', importPath);
            
            // Send import request to server with the path
            fetch('/import_settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: importPath })
            })
            .then(response => response.json())
            .then(this.handleImportResponse)
            .catch(error => {
                console.error('Error importing settings:', error);
                GoonApp.UI.showImportResult('Error importing settings: ' + error.message, 'danger');
            });
        } catch (error) {
            console.error('Error importing settings:', error);
            GoonApp.UI.showImportResult(`Failed to import settings: ${error.message}`, 'danger');
        }
    },
    
    /**
     * Handle the response from the import settings request
     * @param {Object} data - The response data
     */
    handleImportResponse: function(data) {
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Update state with imported settings
        if (data.settings) {
            // Update subreddits
            if (data.settings.favorites) {
                AppState.subreddits.favorites = data.settings.favorites;
            }
            
            if (data.settings.punishments) {
                AppState.subreddits.punishments = data.settings.punishments;
            }
            
            // Update timer settings
            if (data.settings.timerMin) {
                AppState.settings.timerMin = data.settings.timerMin;
                GoonApp.DOM.$('timerMin').value = data.settings.timerMin;
            }
            
            if (data.settings.timerMax) {
                AppState.settings.timerMax = data.settings.timerMax;
                GoonApp.DOM.$('timerMax').value = data.settings.timerMax;
            }
            
            // Update content source
            if (data.settings.contentSource) {
                AppState.settings.contentSource = data.settings.contentSource;
                
                // Update radio buttons
                const contentSourceRadios = document.querySelectorAll('input[name="contentSource"]');
                contentSourceRadios.forEach(radio => {
                    radio.checked = (radio.value === data.settings.contentSource);
                });
            }
            
            // Update punishment settings
            if (data.settings.punishmentsEnabled !== undefined) {
                AppState.settings.punishmentsEnabled = data.settings.punishmentsEnabled;
                GoonApp.DOM.$('punishmentsEnabled').checked = data.settings.punishmentsEnabled;
            }
            
            // Update auto cycle settings
            if (data.settings.autoCycleEnabled !== undefined) {
                AppState.settings.autoCycleEnabled = data.settings.autoCycleEnabled;
                GoonApp.DOM.$('autoCycleEnabled').checked = data.settings.autoCycleEnabled;
            }
            
            if (data.settings.autoCycleInterval) {
                AppState.settings.autoCycleInterval = data.settings.autoCycleInterval;
                GoonApp.DOM.$('autoCycleInterval').value = data.settings.autoCycleInterval;
            }
            
            // Update video timer settings
            if (data.settings.videoTimerSoftLimitEnabled !== undefined) {
                AppState.settings.videoTimerSoftLimitEnabled = data.settings.videoTimerSoftLimitEnabled;
                GoonApp.DOM.$('videoTimerSoftLimitEnabled').checked = data.settings.videoTimerSoftLimitEnabled;
            }
            
            // Update theme
            if (data.settings.theme) {
                AppState.settings.theme = data.settings.theme;
                GoonApp.DOM.$('theme-' + data.settings.theme).checked = true;
                GoonApp.UI.applyTheme(data.settings.theme);
            }
            
            // Update Reddit credentials
            if (data.settings.redditCredentials) {
                AppState.settings.redditCredentials = data.settings.redditCredentials;
                
                // Update the credential fields in the UI
                const clientIdInput = GoonApp.DOM.$('clientId');
                const clientSecretInput = GoonApp.DOM.$('clientSecret');
                const userAgentInput = GoonApp.DOM.$('userAgent');
                
                if (clientIdInput && data.settings.redditCredentials.client_id) {
                    clientIdInput.value = data.settings.redditCredentials.client_id;
                }
                
                if (clientSecretInput && data.settings.redditCredentials.client_secret) {
                    clientSecretInput.value = data.settings.redditCredentials.client_secret;
                }
                
                if (userAgentInput && data.settings.redditCredentials.user_agent) {
                    userAgentInput.value = data.settings.redditCredentials.user_agent;
                }
            }
            
            // If credentials were imported separately, show a special success message
            if (data.credentials_imported) {
                console.log('API credentials were successfully imported');
            }
            
            // Update stats
            if (data.settings.stats) {
                if (data.settings.stats.favoritesCompletedCount !== undefined) {
                    AppState.stats.favoritesCompletedCount = data.settings.stats.favoritesCompletedCount;
                }
                
                if (data.settings.stats.punishmentsCompletedCount !== undefined) {
                    AppState.stats.punishmentsCompletedCount = data.settings.stats.punishmentsCompletedCount;
                }
            }
            
            // Update enabled folders
            if (data.settings.enabledContentFolders) {
                AppState.folders.enabledContentFolders = data.settings.enabledContentFolders;
                AppState.settings.enabledContentFolders = data.settings.enabledContentFolders;
            }
            
            if (data.settings.enabledPunishmentFolders) {
                AppState.folders.enabledPunishmentFolders = data.settings.enabledPunishmentFolders;
                AppState.settings.enabledPunishmentFolders = data.settings.enabledPunishmentFolders;
            }
            
            // Save the imported settings to local storage
            GoonApp.Storage.saveToStorage();
            
            // Create a special flag to indicate settings were just imported
            localStorage.setItem('settingsJustImported', 'true');
            localStorage.setItem('importedSettingsTimestamp', Date.now().toString());
            
            // If Reddit credentials are present in the imported settings, save them separately
            // Check for both formats: direct properties or nested in redditCredentials object
            let hasCredentials = false;
            let clientId = '';
            let clientSecret = '';
            let userAgent = 'Goon/1.0';
            
            // Check for direct properties first (older format)
            if (data.settings.redditClientId && data.settings.redditClientSecret) {
                clientId = data.settings.redditClientId;
                clientSecret = data.settings.redditClientSecret;
                userAgent = data.settings.redditUserAgent || 'Goon/1.0';
                hasCredentials = true;
                console.log('Reddit API credentials found in imported settings (direct properties)');
            }
            // Then check for nested redditCredentials object (newer format)
            else if (data.settings.redditCredentials && 
                     data.settings.redditCredentials.client_id && 
                     data.settings.redditCredentials.client_secret) {
                clientId = data.settings.redditCredentials.client_id;
                clientSecret = data.settings.redditCredentials.client_secret;
                userAgent = data.settings.redditCredentials.user_agent || 'Goon/1.0';
                hasCredentials = true;
                console.log('Reddit API credentials found in imported settings (redditCredentials object)');
            }
            
            if (hasCredentials) {
                // Store credentials in both formats for compatibility
                AppState.settings.redditClientId = clientId;
                AppState.settings.redditClientSecret = clientSecret;
                AppState.settings.redditUserAgent = userAgent;
                
                AppState.settings.redditCredentials = {
                    client_id: clientId,
                    client_secret: clientSecret,
                    user_agent: userAgent
                };
                
                // Save to storage immediately
                GoonApp.Storage.saveToStorage();
                
                // Make API call to save credentials
                console.log('Saving Reddit credentials to server...');
                
                // First, try a direct save to a file in the executable directory
                // This is a more reliable approach for the executable version
                fetch('/direct_save_credentials', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        client_id: clientId,
                        client_secret: clientSecret,
                        user_agent: userAgent,
                        debug_info: true  // Request additional debug info
                    })
                })
                .then(response => response.json())
                .then(directResult => {
                    console.log('Direct credentials save result:', directResult);
                    
                    // Also try the regular update endpoint as a backup
                    return fetch('/update_credentials', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            client_id: clientId,
                            client_secret: clientSecret,
                            user_agent: userAgent
                        })
                    });
                })
                .then(response => response.json())
                .then(credResult => {
                    console.log('Reddit credentials update result:', credResult);
                })
                .catch(error => {
                    console.error('Error updating Reddit credentials:', error);
                });
            }
            
            // For executable version, show special instructions
            const isExecutable = window.location.protocol === 'file:' || 
                              navigator.userAgent.includes('Electron') ||
                              document.title.includes('Goon App');
            
            if (isExecutable) {
                // Create a more detailed message with clear instructions
                let message = '<div class="alert alert-success mb-3">';
                message += '<h4><i class="bi bi-check-circle me-2"></i>Settings Successfully Imported!</h4>';
                message += '<p><strong>Important:</strong> For imported settings to take full effect, please:</p>';
                message += '<ol>';
                message += '<li><strong>Close this application completely</strong> (including from the system tray if present)</li>';
                message += '<li><strong>Restart the Goon application</strong> to load your imported settings</li>';
                message += '</ol>';
                message += '<p>This is required because the executable version needs a full restart to apply all settings.</p>';
                message += '</div>';
                
                // Save settings to localStorage as a backup
                try {
                    localStorage.setItem('goonAppSettings', JSON.stringify(data.settings));
                    console.log('Imported settings saved to localStorage as backup');
                } catch (e) {
                    console.warn('Could not save settings to localStorage:', e);
                }
                
                // Show the detailed message
                document.getElementById('importSettingsResult').classList.remove('d-none');
                document.getElementById('importSettingsResult').classList.add('alert-success');
                document.getElementById('importSettingsResult').innerHTML = message;
                
                // Disable the Save Settings button to prevent overwriting imported settings
                const saveSettingsBtn = document.getElementById('saveSettingsBtn');
                if (saveSettingsBtn) {
                    saveSettingsBtn.disabled = true;
                    saveSettingsBtn.title = 'Please refresh the application before saving settings';
                    saveSettingsBtn.classList.add('disabled');
                }
                
                // Add a refresh button that will reload the page
                const refreshBtn = document.createElement('button');
                refreshBtn.className = 'btn btn-primary mt-3';
                refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise me-2"></i>Refresh Now';
                refreshBtn.onclick = function() { window.location.reload(); };
                document.getElementById('importSettingsResult').appendChild(refreshBtn);
                
                // Log success
                console.log('Settings successfully imported to executable version - manual restart required');
            } else {
                // For web/development version
                GoonApp.UI.showImportResult('Settings successfully imported! Reloading...', 'success');
                console.log('Settings successfully imported, reloading application...');
                
                // Disable the Save Settings button to prevent overwriting imported settings
                const saveSettingsBtn = document.getElementById('saveSettingsBtn');
                if (saveSettingsBtn) {
                    saveSettingsBtn.disabled = true;
                    saveSettingsBtn.title = 'Please wait for the application to refresh';
                    saveSettingsBtn.classList.add('disabled');
                }
                
                // For development version, reload after short delay
                setTimeout(() => window.location.reload(), 1500);
            }
        }
    },
    
    /**
     * Reset Reddit credentials
     */
    resetCredentials: function() {
        if (confirm('Are you sure you want to reset your Reddit credentials?')) {
            // Clear credentials in state
            AppState.settings.redditCredentials = {
                clientId: '',
                clientSecret: '',
                username: '',
                password: ''
            };
            
            // Clear input fields
            const clientIdInput = GoonApp.DOM.$('redditClientId');
            const clientSecretInput = GoonApp.DOM.$('redditClientSecret');
            const usernameInput = GoonApp.DOM.$('redditUsername');
            const passwordInput = GoonApp.DOM.$('redditPassword');
            
            if (clientIdInput) clientIdInput.value = '';
            if (clientSecretInput) clientSecretInput.value = '';
            if (usernameInput) usernameInput.value = '';
            if (passwordInput) passwordInput.value = '';
            
            // Save to storage
            GoonApp.Storage.saveToStorage();
            
            alert('Reddit credentials have been reset.');
        }
    }
};

// Legacy functions for backward compatibility
function saveSettings() {
    return GoonApp.Settings.saveSettings();
}

function importSettings() {
    return GoonApp.Settings.importSettings();
}

function resetCredentials() {
    return GoonApp.Settings.resetCredentials();
}

export default GoonApp.Settings;
