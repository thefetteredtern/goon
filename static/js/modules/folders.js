/**
 * Goon - Folders Module
 * Handles custom content folders
 */

import { GoonApp, AppState } from './core.js';

/**
 * Folder Management Module - Handles custom content folders
 */
GoonApp.Folders = {
    /**
     * Fetch custom folders from the server
     * @param {boolean} forceRefresh - Whether to force a server-side refresh
     * @returns {Promise<Object>} Folder data
     */
    fetchCustomFolders: async function(forceRefresh = false) {
        try {
            console.log(`Fetching custom folders... ${forceRefresh ? '(forced refresh)' : ''}`);
            
            // Add refresh parameter to force server-side refresh
            const url = forceRefresh ? '/get_custom_folders?refresh=true' : '/get_custom_folders';
            
            // Show loading indicator in folder lists
            this._showLoadingIndicator('content');
            this._showLoadingIndicator('punishment');
            
            // Fetch folders from server
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch folders: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            console.log('Folders fetched successfully:', data);
            
            // Update state with fetched folders
            if (data.content_folders && Array.isArray(data.content_folders)) {
                // Convert the format from backend to what the frontend expects
                AppState.folders.content = data.content_folders.map(folder => folder.name);
                
                // Log folder details for debugging
                data.content_folders.forEach(folder => {
                    console.log(`Content folder: ${folder.name}, Files: ${folder.file_count || 0}`);
                });
            }
            
            if (data.punishment_folders && Array.isArray(data.punishment_folders)) {
                // Convert the format from backend to what the frontend expects
                AppState.folders.punishment = data.punishment_folders.map(folder => folder.name);
                
                // Log folder details for debugging
                data.punishment_folders.forEach(folder => {
                    console.log(`Punishment folder: ${folder.name}, Files: ${folder.file_count || 0}`);
                });
            }
            
            // Use settings values if available, otherwise use the data from the server
            if (AppState.settings.enabledContentFolders && Array.isArray(AppState.settings.enabledContentFolders)) {
                AppState.folders.enabledContentFolders = AppState.settings.enabledContentFolders;
            } else if (data.enabledContentFolders && Array.isArray(data.enabledContentFolders)) {
                AppState.folders.enabledContentFolders = data.enabledContentFolders;
                // Also update settings
                AppState.settings.enabledContentFolders = data.enabledContentFolders;
            }
            
            if (AppState.settings.enabledPunishmentFolders && Array.isArray(AppState.settings.enabledPunishmentFolders)) {
                AppState.folders.enabledPunishmentFolders = AppState.settings.enabledPunishmentFolders;
            } else if (data.enabledPunishmentFolders && Array.isArray(data.enabledPunishmentFolders)) {
                AppState.folders.enabledPunishmentFolders = data.enabledPunishmentFolders;
                // Also update settings
                AppState.settings.enabledPunishmentFolders = data.enabledPunishmentFolders;
            }
            
            // Render folder lists
            this.renderFolderList('content');
            this.renderFolderList('punishment');
            
            // Save to storage to persist enabled folders
            GoonApp.Storage.saveToStorage();
            
            return data;
        } catch (error) {
            console.error('Error fetching folders:', error);
            
            // Show error message
            if (GoonApp.UI.showError) {
                GoonApp.UI.showError(`Failed to fetch folders: ${error.message}`);
            } else {
                alert(`Failed to fetch folders: ${error.message}`);
            }
            
            // Clear loading indicators
            this._clearLoadingIndicator('content');
            this._clearLoadingIndicator('punishment');
            
            return null;
        }
    },
    
    /**
     * Refresh folders from server (force refresh)
     * @returns {Promise<Object>} Folder data
     */
    refreshFolders: async function() {
        // Show toast notification
        if (GoonApp.UI.showToast) {
            GoonApp.UI.showToast('Refreshing folders...', 'info');
        }
        
        // Force refresh from server
        const result = await this.fetchCustomFolders(true);
        
        if (result) {
            // Show success message
            if (GoonApp.UI.showToast) {
                GoonApp.UI.showToast('Folders refreshed successfully!', 'success');
            }
        }
        
        return result;
    },
    
    /**
     * Show loading indicator in folder list
     * @param {string} type - Type of folder list (content or punishment)
     * @private
     */
    _showLoadingIndicator: function(type) {
        const listElement = GoonApp.DOM.$(`${type}FoldersList`);
        if (!listElement) return;
        
        listElement.innerHTML = '<li class="list-group-item text-center"><div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div> Refreshing folders...</li>';
    },
    
    /**
     * Clear loading indicator in folder list
     * @param {string} type - Type of folder list (content or punishment)
     * @private
     */
    _clearLoadingIndicator: function(type) {
        const listElement = GoonApp.DOM.$(`${type}FoldersList`);
        if (!listElement) return;
        
        listElement.innerHTML = '<li class="list-group-item text-center text-muted">No folders found.</li>';
    },
    
    /**
     * Render folder list in the settings
     * @param {string} type - Type of folders to render (content or punishment)
     */
    renderFolderList: function(type) {
        const listElement = GoonApp.DOM.$(`${type}FoldersList`);
        if (!listElement) return;
        
        // Clear existing list
        listElement.innerHTML = '';
        
        // Get folders from state
        const folders = AppState.folders[type] || [];
        const enabledFolders = AppState.folders[`enabled${type.charAt(0).toUpperCase() + type.slice(1)}Folders`] || [];
        
        if (folders.length === 0) {
            // Show empty message
            const emptyMessage = document.createElement('li');
            emptyMessage.className = 'list-group-item text-center text-muted';
            emptyMessage.textContent = `No ${type} folders found.`;
            listElement.appendChild(emptyMessage);
            return;
        }
        
        // Sort folders alphabetically
        const sortedFolders = [...folders].sort((a, b) => {
            return a.toLowerCase().localeCompare(b.toLowerCase());
        });
        
        // Create list items
        sortedFolders.forEach(folder => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            
            // Check if folder is enabled
            const isEnabled = enabledFolders.includes(folder);
            
            // Create toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.className = `btn btn-sm ${isEnabled ? 'btn-success' : 'btn-secondary'}`;
            toggleBtn.innerHTML = isEnabled ? '<i class="bi bi-check"></i>' : '<i class="bi bi-x"></i>';
            toggleBtn.title = isEnabled ? 'Enabled' : 'Disabled';
            toggleBtn.onclick = () => this.toggleFolder(type, folder);
            
            // Create folder name
            const nameSpan = document.createElement('span');
            nameSpan.className = 'flex-grow-1 mx-2';
            nameSpan.textContent = folder;
            
            // Add elements to list item
            li.appendChild(toggleBtn);
            li.appendChild(nameSpan);
            
            // Add list item to list
            listElement.appendChild(li);
        });
    },
    
    /**
     * Toggle folder enabled/disabled status
     * @param {string} type - Type of folder (content or punishment)
     * @param {string} folderName - Name of the folder to toggle
     */
    toggleFolder: function(type, folderName) {
        // Get enabled folders array
        const enabledFoldersKey = `enabled${type.charAt(0).toUpperCase() + type.slice(1)}Folders`;
        const enabledFolders = AppState.folders[enabledFoldersKey] || [];
        
        // Check if folder is currently enabled
        const isEnabled = enabledFolders.includes(folderName);
        
        if (isEnabled) {
            // Remove from enabled folders
            AppState.folders[enabledFoldersKey] = enabledFolders.filter(name => name !== folderName);
        } else {
            // Add to enabled folders
            AppState.folders[enabledFoldersKey] = [...enabledFolders, folderName];
        }
        
        // Save to storage
        GoonApp.Storage.saveToStorage();
        
        // Update UI
        this.renderFolderList(type);
    },
    
    /**
     * Enable/disable all folders
     * @param {string} type - Type of folder (content or punishment)
     * @param {boolean} enabled - Whether to enable or disable all
     */
    setAllFolders: function(type, enabled) {
        // Get folders array
        const folders = AppState.folders[type] || [];
        
        // Get enabled folders key
        const enabledFoldersKey = `enabled${type.charAt(0).toUpperCase() + type.slice(1)}Folders`;
        
        if (enabled) {
            // Enable all folders
            AppState.folders[enabledFoldersKey] = [...folders];
        } else {
            // Disable all folders
            AppState.folders[enabledFoldersKey] = [];
        }
        
        // Save to storage
        GoonApp.Storage.saveToStorage();
        
        // Update UI
        this.renderFolderList(type);
    }
};

// Legacy functions for backward compatibility
function fetchCustomFolders() {
    return GoonApp.Folders.fetchCustomFolders();
}

function renderFolderList(type) {
    return GoonApp.Folders.renderFolderList(type);
}

function toggleFolder(type, folderName) {
    return GoonApp.Folders.toggleFolder(type, folderName);
}

function setAllFolders(type, enabled) {
    return GoonApp.Folders.setAllFolders(type, enabled);
}

export default GoonApp.Folders;
