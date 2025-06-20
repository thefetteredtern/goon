/**
 * Goon - Theme Module
 * Handles theme management (light/dark)
 */

import { GoonApp, AppState } from './core.js';

/**
 * Theme Module - Handles theme management
 */
GoonApp.Theme = {
    /**
     * Toggle between light and dark theme
     */
    toggleTheme: function() {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        console.log('Toggling theme from', currentTheme, 'to', newTheme);
        
        // Apply the new theme
        this.applyTheme(newTheme);
        
        // Save theme preference to state
        AppState.settings.theme = newTheme;
        
        // Save to localStorage for backup
        localStorage.setItem('theme', newTheme);
        
        // Save to server
        GoonApp.Storage.saveToStorage()
            .then(() => {
                console.log('Theme preference saved to server successfully');
            })
            .catch(error => {
                console.error('Error saving theme preference to server:', error);
            });
    },
    
    /**
     * Apply a specific theme
     * @param {string} theme - 'light' or 'dark'
     */
    applyTheme: function(theme) {
        if (theme !== 'light' && theme !== 'dark') {
            console.error('Invalid theme:', theme);
            return;
        }
        
        console.log('Applying theme:', theme);
        
        // Apply theme to document
        document.documentElement.setAttribute('data-bs-theme', theme);
        
        // Update theme toggle button
        const themeToggle = GoonApp.DOM.$('themeToggle');
        if (themeToggle) {
            if (theme === 'dark') {
                themeToggle.innerHTML = '<i class="bi bi-sun"></i>';
                themeToggle.title = 'Switch to Light Mode';
            } else {
                themeToggle.innerHTML = '<i class="bi bi-moon"></i>';
                themeToggle.title = 'Switch to Dark Mode';
            }
        }
        
        // Update theme radio buttons in settings
        const themeLightRadio = GoonApp.DOM.$('themeLight');
        const themeDarkRadio = GoonApp.DOM.$('themeDark');
        
        if (themeLightRadio && themeDarkRadio) {
            themeLightRadio.checked = theme === 'light';
            themeDarkRadio.checked = theme === 'dark';
        }
        
        // Update sidebar background
        this.updateSidebarTheme(theme);
        
        // Update theme radio buttons in settings
        const themeLight = GoonApp.DOM.$('themeLight');
        const themeDark = GoonApp.DOM.$('themeDark');
        
        if (themeLight && themeDark) {
            themeLight.checked = theme === 'light';
            themeDark.checked = theme === 'dark';
        }
        
        console.log('Theme applied:', theme);
    },
    
    /**
     * Apply saved theme
     */
    applySavedTheme: function() {
        // First try to get theme from AppState settings
        let savedTheme = AppState.settings.theme;
        console.log('Theme from AppState:', savedTheme);
        
        // If not in AppState, try localStorage
        if (!savedTheme) {
            savedTheme = localStorage.getItem('theme');
            console.log('Theme from localStorage:', savedTheme);
        }
        
        // If still no saved theme, check system preference
        if (!savedTheme) {
            // Check if system prefers dark mode
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                savedTheme = 'dark';
            } else {
                savedTheme = 'light';
            }
            console.log('Theme from system preference:', savedTheme);
        }
        
        // Ensure theme is valid
        if (savedTheme !== 'light' && savedTheme !== 'dark') {
            savedTheme = 'light';
        }
        
        // Apply theme
        this.applyTheme(savedTheme);
        
        // Save to state and localStorage
        AppState.settings.theme = savedTheme;
        localStorage.setItem('theme', savedTheme);
        
        // Save to server
        GoonApp.Storage.saveToStorage();
    },
    
    /**
     * Helper function to update sidebar background based on theme
     * @param {string} theme - 'light' or 'dark'
     */
    updateSidebarTheme: function(theme) {
        const sidebar = GoonApp.DOM.$('sidebar');
        if (!sidebar) return;
        
        if (theme === 'dark') {
            sidebar.classList.remove('bg-light');
            sidebar.classList.add('bg-dark');
        } else {
            sidebar.classList.remove('bg-dark');
            sidebar.classList.add('bg-light');
        }
    }
};

// Legacy functions for backward compatibility
function toggleTheme() {
    return GoonApp.Theme.toggleTheme();
}

function applyTheme(theme) {
    return GoonApp.Theme.applyTheme(theme);
}

function applySavedTheme() {
    return GoonApp.Theme.applySavedTheme();
}

export default GoonApp.Theme;
