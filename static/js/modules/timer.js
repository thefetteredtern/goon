/**
 * Goon - Timer Module
 * Handles timer and metronome functionality
 */

import { GoonApp, AppState } from './core.js';

/**
 * Timer Module - Handles timer and metronome functionality
 */
GoonApp.Timer = {
    /**
     * Start timer
     * @param {number} seconds - Duration in seconds
     */
    startTimer: function(seconds) {
        // Clear existing timer if any
        if (AppState.timer.interval) {
            clearInterval(AppState.timer.interval);
            AppState.timer.interval = null;
        }
        
        // Validate seconds
        if (!seconds || isNaN(seconds) || seconds <= 0) {
            // Get min and max from settings
            const minTime = parseInt(AppState.settings.timerMin) || 30;
            const maxTime = parseInt(AppState.settings.timerMax) || 120;
            
            // Generate random time within range
            seconds = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
            console.log(`Generated random timer duration: ${seconds}s (range: ${minTime}-${maxTime})`);
        }
        
        // Set timer values
        AppState.timer.seconds = seconds;
        AppState.timer.originalSeconds = seconds;
        AppState.timer.isPaused = false;
        
        // Update UI
        this.updateTimerDisplay();
        
        // Update pause button text to ensure it shows 'Pause' when timer starts
        const pauseBtn = GoonApp.DOM.$('pauseTimerBtn');
        if (pauseBtn) {
            pauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
        }
        
        // Start countdown
        AppState.timer.interval = setInterval(() => {
            if (AppState.timer.isPaused) return;
            
            AppState.timer.seconds--;
            this.updateTimerDisplay();
            
            // Check if timer is complete
            if (AppState.timer.seconds <= 0) {
                clearInterval(AppState.timer.interval);
                AppState.timer.interval = null;
                
                // Play sound if enabled
                if (localStorage.getItem('soundEnabled') !== 'false') {
                    try {
                        const audio = new Audio('/static/sounds/timer-complete.mp3');
                        audio.play();
                    } catch (error) {
                        console.error('Error playing timer complete sound:', error);
                    }
                }
                
                // Close any open content window
                if (AppState.content.redditWindow && !AppState.content.redditWindow.closed) {
                    try {
                        console.log('Closing external content window');
                        AppState.content.redditWindow.close();
                        AppState.content.redditWindow = null;
                    } catch (error) {
                        console.error('Error closing content window:', error);
                    }
                }
                
                // Log timer completion and get new content
                console.log('Timer complete, getting new content');
                
                // Get new content
                GoonApp.Content.startBrowsing();
            }
        }, 1000);
        
        // Start metronome if sound is enabled
        if (localStorage.getItem('soundEnabled') !== 'false') {
            // Calculate metronome speed based on timer duration
            // Shorter timer = faster metronome
            const minBPM = 40;
            const maxBPM = 120;
            const bpmRange = maxBPM - minBPM;
            const timeRange = AppState.timer.maxTime - AppState.timer.minTime;
            
            // Invert the relationship: shorter time = faster metronome
            const normalizedTime = 1 - ((seconds - AppState.timer.minTime) / timeRange);
            const speed = Math.floor(minBPM + (normalizedTime * bpmRange));
            
            // Start metronome
            this.startMetronome(speed);
        }
    },
    
    /**
     * Pause/resume timer
     */
    pauseTimer: function() {
        // Toggle pause state
        AppState.timer.isPaused = !AppState.timer.isPaused;
        
        // Update pause button text
        const pauseBtn = GoonApp.DOM.$('pauseTimerBtn');
        if (pauseBtn) {
            pauseBtn.innerHTML = AppState.timer.isPaused ? 
                '<i class="bi bi-play"></i> Resume' : 
                '<i class="bi bi-pause"></i> Pause';
        }
        
        // Get metronome dot element
        const metronomeDot = document.querySelector('.metronome-dot');
        
        // Pause/resume metronome
        if (AppState.timer.isPaused) {
            // Pause metronome - stop the animation
            if (metronomeDot) {
                metronomeDot.style.animation = 'none';
            }
            console.log('Metronome paused');
        } else {
            // Resume metronome
            if (AppState.metronome.speed) {
                // Calculate interval in milliseconds
                const interval = Math.floor(60000 / AppState.metronome.speed);
                
                // Resume animation
                if (metronomeDot) {
                    metronomeDot.style.animation = `pulse ${interval/1000}s infinite`;
                }
                
                // If no interval is running, restart it
                if (!AppState.metronome.interval) {
                    this.startMetronome(AppState.metronome.speed);
                }
                
                console.log('Metronome resumed at', AppState.metronome.speed, 'BPM');
            }
        }
        
        console.log('Timer paused:', AppState.timer.isPaused);
    },
    
    /**
     * Reset timer and metronome without getting new content
     * @param {boolean} useNewTime - Whether to use a new random time
     */
    resetTimer: function(useNewTime = false) {
        // Clear existing timer
        if (AppState.timer.interval) {
            clearInterval(AppState.timer.interval);
            AppState.timer.interval = null;
        }
        
        // Get the min and max time from settings
        const minTime = parseInt(AppState.settings.timerMin) || 30;
        const maxTime = parseInt(AppState.settings.timerMax) || 120;
        
        // Determine new time
        let newSeconds;
        if (useNewTime || AppState.timer.originalSeconds <= 0) {
            // Use random time within min/max range from settings
            newSeconds = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
            console.log(`Generating new time between ${minTime} and ${maxTime} seconds: ${newSeconds}`);
        } else {
            // Use original time
            newSeconds = AppState.timer.originalSeconds;
            console.log(`Using original time: ${newSeconds} seconds`);
        }
        
        // Reset timer values
        AppState.timer.seconds = newSeconds;
        AppState.timer.originalSeconds = newSeconds;
        AppState.timer.isPaused = false;
        
        // Update UI
        this.updateTimerDisplay();
        
        // Update pause button
        const pauseBtn = GoonApp.DOM.$('pauseTimerBtn');
        if (pauseBtn) {
            pauseBtn.innerHTML = '<i class="bi bi-pause"></i> Pause';
        }
        
        // Restart timer
        this.startTimer(newSeconds);
        
        console.log('Timer reset with', newSeconds, 'seconds');
    },
    
    /**
     * Update timer display
     */
    updateTimerDisplay: function() {
        const timerElement = GoonApp.DOM.$('timer-display');
        if (!timerElement) {
            console.warn('Timer display element not found with ID "timer-display"');
            return;
        }
        
        // Format time as MM:SS
        const minutes = Math.floor(AppState.timer.seconds / 60);
        const seconds = AppState.timer.seconds % 60;
        
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        console.log('Timer display updated:', timerElement.textContent);
    },
    
    /**
     * Start metronome
     * @param {number} speed - Beats per minute (automatically determined)
     */
    startMetronome: function(speed) {
        // Validate speed - this is now determined automatically by the backend
        // or randomly generated, not manually set by the user
        if (!speed || isNaN(speed) || speed <= 0) {
            // Generate a random speed between 40-120 BPM
            speed = Math.floor(Math.random() * 80) + 40; // 40-120 BPM range
            console.log(`Generated random metronome speed: ${speed} BPM`);
        }
        
        // Store speed in state
        AppState.metronome.speed = speed;
        // Note: We no longer update settings.metronomeSpeed since it's auto-determined
        
        // Clear existing metronome interval
        if (AppState.metronome.interval) {
            clearInterval(AppState.metronome.interval);
            AppState.metronome.interval = null;
        }
        
        // Get metronome dot element
        const metronomeDot = document.querySelector('.metronome-dot');
        if (!metronomeDot) {
            console.error('Metronome dot element not found');
            return;
        }
        
        // Set up audio for metronome based on selected sound type
        this.setupMetronomeAudio();
        
        // Calculate interval in milliseconds
        const interval = Math.floor(60000 / speed);
        
        // Add pulsing animation to metronome dot
        metronomeDot.style.animation = 'none';
        metronomeDot.offsetHeight; // Trigger reflow to restart animation
        metronomeDot.style.animation = `pulse ${interval/1000}s infinite`;
        
        // Start metronome interval
        AppState.metronome.interval = setInterval(() => {
            // Don't play sound if paused or sound is disabled
            if (AppState.timer.isPaused) {
                // Stop the animation when paused
                metronomeDot.style.animation = 'none';
                return;
            } else {
                // Make sure animation is running when not paused
                if (metronomeDot.style.animation === 'none') {
                    metronomeDot.style.animation = `pulse ${interval/1000}s infinite`;
                }
            }
            
            // Check both global sound setting and metronome's individual setting
            const globalSoundEnabled = localStorage.getItem('soundEnabled') !== 'false';
            const metronomeEnabled = AppState.settings.soundEnabled !== false;
            
            // Only play if both global sound is on AND metronome sound is enabled
            // If global sound is off, metronome will never play regardless of its own setting
            if (globalSoundEnabled && metronomeEnabled && AppState.metronome.audio && !AppState.timer.isPaused) {
                try {
                    // Reset and play the audio with the configured volume
                    const volume = parseFloat(AppState.settings.metronomeVolume) || 0.7;
                    AppState.metronome.audio.volume = volume;
                    AppState.metronome.audio.currentTime = 0;
                    AppState.metronome.audio.play().catch(error => {
                        console.error('Error playing metronome sound:', error);
                    });
                } catch (error) {
                    console.error('Error playing metronome sound:', error);
                }
            }
        }, interval);
        
        console.log('Metronome started at', speed, 'BPM with sound type:', AppState.settings.metronomeSound);
    },
    
    /**
     * Set up the metronome audio based on the selected sound type
     */
    setupMetronomeAudio: function() {
        // Get or create the audio element
        let audioElement = document.getElementById('metronomeAudio');
        if (!audioElement) {
            audioElement = document.createElement('audio');
            audioElement.id = 'metronomeAudio';
            document.body.appendChild(audioElement);
        }
        
        // Always use the default metronome.wav sound
        audioElement.src = '/static/metronome.wav';
        
        // Set volume from settings
        const volume = parseFloat(AppState.settings.metronomeVolume) || 0.7;
        audioElement.volume = volume;
        
        // Store the audio element in the state
        AppState.metronome.audio = audioElement;
    }
};

// Legacy functions for backward compatibility
function startTimer(seconds) {
    return GoonApp.Timer.startTimer(seconds);
}

function pauseTimer() {
    return GoonApp.Timer.pauseTimer();
}

function resetTimer(useNewTime) {
    return GoonApp.Timer.resetTimer(useNewTime);
}

function updateTimerDisplay() {
    return GoonApp.Timer.updateTimerDisplay();
}

function startMetronome(speed) {
    return GoonApp.Timer.startMetronome(speed);
}

export default GoonApp.Timer;
