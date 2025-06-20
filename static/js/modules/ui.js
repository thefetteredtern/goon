/**
 * Goon - UI Module
 * Handles UI rendering and updates
 */

import { GoonApp, AppState } from './core.js';

/**
 * UI Module - Handles UI rendering and updates
 */
GoonApp.UI = {
    /**
     * Update stats display in the UI
     */
    updateStatsDisplay: function() {
        const favoritesCountElement = GoonApp.DOM.$('favorites-completed-count');
        const punishmentsCountElement = GoonApp.DOM.$('punishments-completed-count');
        const totalCountElement = GoonApp.DOM.$('total-completed-count');
        
        if (favoritesCountElement) {
            favoritesCountElement.textContent = AppState.stats.favoritesCompletedCount;
        }
        
        if (punishmentsCountElement) {
            punishmentsCountElement.textContent = AppState.stats.punishmentsCompletedCount;
        }
        
        if (totalCountElement) {
            const totalCount = AppState.stats.favoritesCompletedCount + AppState.stats.punishmentsCompletedCount;
            totalCountElement.textContent = totalCount;
        }
    },
    
    /**
     * Render subreddit lists in the sidebar
     * @param {string} type - 'favorites' or 'punishments'
     */
    renderSubredditList: function(type) {
        const listElement = GoonApp.DOM.$(type + 'List');
        if (!listElement) return;
        
        // Clear existing list
        listElement.innerHTML = '';
        
        // Get subreddits from state
        const subreddits = AppState.subreddits[type] || [];
        
        if (subreddits.length === 0) {
            // Show empty message
            const emptyMessage = document.createElement('li');
            emptyMessage.className = 'list-group-item text-center text-muted';
            emptyMessage.textContent = `No ${type} added yet.`;
            listElement.appendChild(emptyMessage);
            return;
        }
        
        // Sort subreddits alphabetically
        const sortedSubreddits = [...subreddits].sort((a, b) => {
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        
        // Create list items
        sortedSubreddits.forEach((subreddit) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            
            // Find the original index of this subreddit in the unsorted array
            const originalIndex = subreddits.findIndex(s => s.name === subreddit.name);
            
            // Create toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.className = `btn btn-sm ${subreddit.enabled ? 'btn-success' : 'btn-secondary'}`;
            toggleBtn.innerHTML = subreddit.enabled ? '<i class="bi bi-check"></i>' : '<i class="bi bi-x"></i>';
            toggleBtn.title = subreddit.enabled ? 'Enabled' : 'Disabled';
            toggleBtn.onclick = () => GoonApp.Content.toggleSubreddit(type, originalIndex);
            
            // Create subreddit name
            const nameSpan = document.createElement('span');
            nameSpan.className = 'flex-grow-1 mx-2';
            nameSpan.textContent = subreddit.name;
            
            // Create remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn btn-sm btn-danger';
            removeBtn.innerHTML = '<i class="bi bi-trash"></i>';
            removeBtn.title = 'Remove';
            removeBtn.onclick = () => GoonApp.Content.removeSubreddit(type, originalIndex);
            
            // Add elements to list item
            li.appendChild(toggleBtn);
            li.appendChild(nameSpan);
            li.appendChild(removeBtn);
            
            // Add list item to list
            listElement.appendChild(li);
        });
    },
    
    /**
     * Update content source UI
     */
    updateContentSourceUI: function() {
        const source = AppState.settings.contentSource || 'reddit';
        console.log('Updating content source UI with source:', source);
        
        // Update radio buttons for content display
        const redditRadio = GoonApp.DOM.$('sourceReddit');
        const customRadio = GoonApp.DOM.$('sourceCustom');
        
        if (redditRadio) redditRadio.checked = source === 'reddit';
        if (customRadio) customRadio.checked = source === 'custom';
        
        // Update default source radio buttons in settings modal
        const defaultRedditRadio = GoonApp.DOM.$('defaultSourceReddit');
        const defaultCustomRadio = GoonApp.DOM.$('defaultSourceCustom');
        const defaultMixedRadio = GoonApp.DOM.$('defaultSourceMixed');
        
        if (defaultRedditRadio) defaultRedditRadio.checked = source === 'reddit';
        if (defaultCustomRadio) defaultCustomRadio.checked = source === 'custom';
        if (defaultMixedRadio) defaultMixedRadio.checked = source === 'mixed';
        
        // Update source-specific UI elements
        const redditUI = GoonApp.DOM.$('redditSourceUI');
        const customUI = GoonApp.DOM.$('customSourceUI');
        
        if (redditUI) redditUI.style.display = source === 'reddit' ? 'block' : 'none';
        if (customUI) customUI.style.display = source === 'custom' ? 'block' : 'none';
        
        console.log('Content source UI updated to:', source);
    },
    
    /**
     * Update punishments enabled UI
     * @param {boolean} enabled - Whether punishments are enabled
     */
    updatePunishmentsEnabledUI: function(enabled) {
        console.log('Updating punishments enabled UI with value:', enabled);
        
        // Update checkbox in main UI
        const punishmentsEnabledCheckbox = GoonApp.DOM.$('punishmentsEnabled');
        if (punishmentsEnabledCheckbox) {
            punishmentsEnabledCheckbox.checked = enabled;
        }
        
        // Update checkbox in settings modal
        const settingsPunishmentsEnabledCheckbox = GoonApp.DOM.$('enablePunishments');
        if (settingsPunishmentsEnabledCheckbox) {
            settingsPunishmentsEnabledCheckbox.checked = enabled;
        }
        
        // Update UI elements
        const punishmentsUI = GoonApp.DOM.$('punishmentsUI');
        if (punishmentsUI) {
            punishmentsUI.style.display = enabled ? 'block' : 'none';
        }
        
        // Update button text
        const togglePunishmentsBtn = GoonApp.DOM.$('togglePunishmentsBtn');
        if (togglePunishmentsBtn) {
            togglePunishmentsBtn.textContent = enabled ? 'Disable Punishments' : 'Enable Punishments';
        }
        
        console.log('Punishments enabled UI updated to:', enabled);
    },
    
    /**
     * Update auto cycle UI
     */
    updateAutoCycleUI: function() {
        // Use the correct element ID from the HTML (enableAutoCycle instead of autoCycleEnabled)
        const autoCycleCheckbox = GoonApp.DOM.$('enableAutoCycle');
        
        if (autoCycleCheckbox) {
            autoCycleCheckbox.checked = AppState.settings.autoCycleEnabled;
            console.log('Updated autocycle checkbox state:', AppState.settings.autoCycleEnabled);
            
            // If autocycle is disabled, make sure we don't have any active timers
            if (!AppState.settings.autoCycleEnabled && AppState.timer.interval) {
                clearInterval(AppState.timer.interval);
                AppState.timer.interval = null;
                console.log('Cleared timer because autocycle is disabled');
            }
        }
    },
    
    /**
     * Update timer and metronome settings UI
     */
    updateTimerSettingsUI: function() {
        console.log('Updating timer settings UI with values:', 
            'timerMin:', AppState.settings.timerMin,
            'timerMax:', AppState.settings.timerMax,
            'metronomeSound:', AppState.settings.metronomeSound,
            'metronomeVolume:', AppState.settings.metronomeVolume);
        
        // Update timer min/max inputs
        const timerMinInput = GoonApp.DOM.$('timerMin');
        const timerMaxInput = GoonApp.DOM.$('timerMax');
        
        if (timerMinInput && AppState.settings.timerMin !== undefined) {
            timerMinInput.value = AppState.settings.timerMin;
        }
        
        if (timerMaxInput && AppState.settings.timerMax !== undefined) {
            timerMaxInput.value = AppState.settings.timerMax;
        }
        
        // Metronome sound selector has been removed - we only use the default sound now
        
        // Update metronome volume slider
        const metronomeVolumeSlider = GoonApp.DOM.$('metronomeVolume');
        if (metronomeVolumeSlider) {
            const volume = parseFloat(AppState.settings.metronomeVolume) || 0.7;
            metronomeVolumeSlider.value = volume;
            
            // Add change event listener if not already added
            if (!metronomeVolumeSlider.hasAttribute('data-initialized')) {
                metronomeVolumeSlider.setAttribute('data-initialized', 'true');
                metronomeVolumeSlider.addEventListener('input', function() {
                    AppState.settings.metronomeVolume = parseFloat(this.value);
                    // Update volume display
                    const volumeDisplay = GoonApp.DOM.$('metronomeVolumeDisplay');
                    if (volumeDisplay) {
                        volumeDisplay.textContent = Math.round(AppState.settings.metronomeVolume * 100) + '%';
                    }
                });
                metronomeVolumeSlider.addEventListener('change', function() {
                    // Save when the user stops dragging
                    GoonApp.Storage.saveToStorage();
                    // Update audio element volume if it exists
                    if (AppState.metronome.audio) {
                        AppState.metronome.audio.volume = parseFloat(this.value);
                        // Play a sample of the sound at the new volume
                        AppState.metronome.audio.play().catch(e => console.error('Error playing sample:', e));
                    }
                });
            }
            
            // Update volume display
            const volumeDisplay = GoonApp.DOM.$('metronomeVolumeDisplay');
            if (volumeDisplay) {
                volumeDisplay.textContent = Math.round(volume * 100) + '%';
            }
        }
        
        // Update auto cycle checkbox
        const autoCycleCheckbox = GoonApp.DOM.$('enableAutoCycle');
        if (autoCycleCheckbox) {
            autoCycleCheckbox.checked = AppState.settings.autoCycleEnabled !== false;
        }
        
        // Update video timer soft limit checkbox
        const videoTimerSoftLimitCheckbox = GoonApp.DOM.$('enableVideoTimerSoftLimit');
        if (videoTimerSoftLimitCheckbox) {
            videoTimerSoftLimitCheckbox.checked = AppState.settings.videoTimerSoftLimitEnabled !== false;
        }
        
        // Update timer and metronome in app state
        if (AppState.timer) {
            AppState.timer.minTime = parseInt(AppState.settings.timerMin) || 30;
            AppState.timer.maxTime = parseInt(AppState.settings.timerMax) || 120;
            console.log(`Updated timer state: min=${AppState.timer.minTime}, max=${AppState.timer.maxTime}`);
        }
        
        // Note: We no longer update the metronome speed from settings since it's auto-determined
        
        console.log('Timer settings UI updated successfully');
    },
    
    /**
     * Show loading indicator
     */
    showLoading: function() {
        const contentContainer = GoonApp.DOM.$('content-container');
        const loadingIndicator = GoonApp.DOM.$('loading-indicator');
        
        if (contentContainer) {
            contentContainer.classList.add('d-none');
        }
        
        if (loadingIndicator) {
            loadingIndicator.classList.remove('d-none');
        }
        
        // Update state
        AppState.content.isLoading = true;
    },
    
    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError: function(message) {
        console.error('Error:', message);
        
        // Hide loading indicator
        const loadingIndicator = GoonApp.DOM.$('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('d-none');
        }
        
        // Reset start button if it's in loading state
        const startButton = GoonApp.DOM.$('startButton');
        if (startButton && startButton.innerHTML === 'Loading...') {
            startButton.innerHTML = 'Start Browsing';
            startButton.disabled = false;
        }
        
        // Show error toast
        const errorToastElement = GoonApp.DOM.$('errorToast');
        const errorMessageElement = GoonApp.DOM.$('errorMessage');
        
        if (errorToastElement && errorMessageElement) {
            errorMessageElement.textContent = message;
            
            // Use Bootstrap's toast API if available
            if (window.bootstrap && bootstrap.Toast) {
                const errorToast = new bootstrap.Toast(errorToastElement);
                errorToast.show();
            } else {
                // Fallback if Bootstrap JS is not loaded
                errorToastElement.classList.add('show');
                setTimeout(() => {
                    errorToastElement.classList.remove('show');
                }, 5000);
            }
        } else {
            // Fallback to alert if toast elements not found
            alert('Error: ' + message);
        }
        
        // Update state
        AppState.content.isLoading = false;
    },
    
    /**
     * Show import result messages
     * @param {string} message - Message to display
     * @param {string} type - Alert type (success, danger, etc.)
     */
    showImportResult: function(message, type = 'success') {
        const resultDiv = GoonApp.DOM.$('importResult');
        if (!resultDiv) return;
        
        resultDiv.innerHTML = '';
        resultDiv.className = `alert alert-${type} mt-3`;
        resultDiv.textContent = message;
        resultDiv.classList.remove('d-none');
    }
};

// Legacy functions for backward compatibility
function renderSubredditList(type) {
    return GoonApp.UI.renderSubredditList(type);
}

function updateContentSourceUI() {
    return GoonApp.UI.updateContentSourceUI();
}

function updatePunishmentsEnabledUI(enabled) {
    return GoonApp.UI.updatePunishmentsEnabledUI(enabled);
}

function updateAutoCycleUI() {
    return GoonApp.UI.updateAutoCycleUI();
}

function showLoading() {
    return GoonApp.UI.showLoading();
}

function showError(message) {
    return GoonApp.UI.showError(message);
}

function updateStatsDisplay() {
    return GoonApp.UI.updateStatsDisplay();
}

function updateTimerSettingsUI() {
    return GoonApp.UI.updateTimerSettingsUI();
}

function showImportResult(message, type) {
    return GoonApp.UI.showImportResult(message, type);
}

export default GoonApp.UI;
