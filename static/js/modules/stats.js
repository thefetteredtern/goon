/**
 * Goon - Stats Module
 * Handles statistics tracking
 */

import { GoonApp, AppState } from './core.js';

/**
 * Stats Module - Handles statistics tracking
 */
GoonApp.Stats = {
    /**
     * Handle content completion (user came)
     */
    finishContent: function() {
        // Pause timer and metronome
        GoonApp.Timer.pauseTimer();
        
        // Increment the appropriate counter
        if (AppState.content.isPunishment) {
            AppState.stats.punishmentsCompletedCount++;
        } else {
            AppState.stats.favoritesCompletedCount++;
        }
        
        // Save to storage
        GoonApp.Storage.saveToStorage();
        
        // Update the stats display
        GoonApp.UI.updateStatsDisplay();
        
        // Show a confirmation message
        alert('You came! Stats updated.');
    },
    
    /**
     * Reset statistics
     */
    resetStats: function() {
        if (confirm('Are you sure you want to reset all completion stats?')) {
            AppState.stats.favoritesCompletedCount = 0;
            AppState.stats.punishmentsCompletedCount = 0;
            GoonApp.Storage.saveToStorage();
            GoonApp.UI.updateStatsDisplay();
            alert('Stats have been reset.');
        }
    }
};

// Legacy functions for backward compatibility
function finishContent() {
    return GoonApp.Stats.finishContent();
}

function resetStats() {
    return GoonApp.Stats.resetStats();
}

export default GoonApp.Stats;
