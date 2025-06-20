/**
 * Goon - Core Module
 * Contains the main application structure and state management
 */

// Application Namespaces
const GoonApp = {
    // DOM utilities
    DOM: {
        // Get element by ID - shorthand utility function
        $: function(id) { return document.getElementById(id); },
        
        // Cache for frequently accessed DOM elements
        cache: {}
    },
    
    // Settings management
    Settings: {},
    
    // Storage operations
    Storage: {},
    
    // Content management
    Content: {},
    
    // UI operations
    UI: {},
    
    // Timer functionality
    Timer: {},
    
    // Theme management
    Theme: {},
    
    // Stats tracking
    Stats: {},
    
    // Folder management
    Folders: {},
    
    // Initialization
    Init: {}
};

/**
 * Application State
 * Centralized state management to reduce global variables
 */
const AppState = {
    // Timer state
    timer: {
        interval: null,
        seconds: 0,
        originalSeconds: 0,
        isPaused: false,
        minTime: 30,  // Minimum timer duration in seconds
        maxTime: 300  // Maximum timer duration in seconds
    },
    
    // Metronome state
    metronome: {
        interval: null,
        audioContext: null,
        oscillator: null,
        gainNode: null,
        speed: 60,    // Default speed in BPM
        isPlaying: false
    },
    
    // Content state
    content: {
        currentContent: null,
        isPunishment: false,
        source: 'reddit',  // Default source: 'reddit', 'custom'
        isLoading: false,
        redditWindow: null, // Reference to the opened Reddit content window
        history: [], // Track recently viewed content to avoid repeats
        historyMaxSize: 20 // Maximum number of items to keep in history
    },
    
    // Subreddit lists
    subreddits: {
        favorites: [],
        punishments: []
    },
    
    // Custom folders
    folders: {
        content: [],
        punishment: [],
        enabledContentFolders: [],
        enabledPunishmentFolders: []
    },
    
    // User statistics
    stats: {
        favoritesCompletedCount: 0,
        punishmentsCompletedCount: 0
    },
    
    // User settings
    settings: {
        // contentSource will be set during initialization from storage
        // Don't set a default here as it will override the loaded value
        punishmentsEnabled: true,
        autoCycleEnabled: true,
        videoTimerSoftLimitEnabled: true,
        timerMin: '30',
        timerMax: '120',
        soundEnabled: true,
        metronomeSound: 'default', // Options: 'default', 'click', 'beep', 'soft', 'wood'
        metronomeVolume: 0.7,    // Volume level from 0.0 to 1.0
        theme: 'light',
        enabledContentFolders: [],
        enabledPunishmentFolders: [],
        redditCredentials: {
            client_id: '',
            client_secret: '',
            user_agent: 'Goon/1.0'
        }
    }
};

// Legacy utility function for easier element selection (for backward compatibility)
function $(id) { return GoonApp.DOM.$(id); }

// Export the namespaces and state
export { GoonApp, AppState };
