/**
 * Goon - Content Module
 * Handles subreddit and content management
 */

import { GoonApp, AppState } from './core.js';

// Helper function to detect if we're running in the executable environment
const isExecutableEnvironment = () => {
    // Check for specific characteristics of the executable environment
    // In the executable, window.navigator.userAgent often contains 'Electron'
    // or we can check for a specific URL pattern used in the packaged app
    return window.location.protocol === 'file:' || 
           (window.navigator && window.navigator.userAgent && 
            (window.navigator.userAgent.indexOf('Electron') >= 0 ||
             window.navigator.userAgent.indexOf('MSIE') >= 0));
};

/**
 * Content Module - Handles subreddit and content management
 */
GoonApp.Content = {
    /**
     * Clean up subreddit names in a list
     * @param {Array} list - List of subreddit objects
     */
    cleanupSubredditNames: function(list) {
        if (!list || !Array.isArray(list)) return [];
        
        return list.map(item => {
            if (typeof item === 'string') {
                return {
                    name: this.extractSubredditName(item),
                    enabled: true
                };
            } else if (typeof item === 'object') {
                return {
                    name: this.extractSubredditName(item.name || ''),
                    enabled: item.enabled !== false
                };
            }
            return null;
        }).filter(item => item && item.name);
    },
    
    /**
     * Extract subreddit name from URL or text
     * @param {string} input - URL or text containing subreddit name
     * @returns {string} - Clean subreddit name
     */
    extractSubredditName: function(input) {
        if (!input) return '';
        
        // Remove leading/trailing whitespace
        let name = input.trim();
        
        // Remove 'r/' prefix if present
        if (name.startsWith('r/')) {
            name = name.substring(2);
        }
        
        // Extract from URL if it's a Reddit URL
        const redditUrlMatch = name.match(/reddit\.com\/r\/([^\/\?]+)/i);
        if (redditUrlMatch && redditUrlMatch[1]) {
            name = redditUrlMatch[1];
        }
        
        // Remove any remaining slashes, spaces, or special characters
        name = name.replace(/[^a-z0-9_]/gi, '');
        
        return name;
    },
    
    /**
     * Add a subreddit to favorites or punishments
     * @param {string} type - 'favorites' or 'punishments'
     */
    addSubreddit: function(type) {
        if (type !== 'favorites' && type !== 'punishments') {
            console.error('Invalid subreddit type:', type);
            return;
        }
        
        // Get input element and value
        const inputElement = GoonApp.DOM.$(`${type.slice(0, -1)}Input`);
        if (!inputElement) return;
        
        const inputValue = inputElement.value.trim();
        if (!inputValue) return;
        
        // Extract subreddit name
        const subredditName = this.extractSubredditName(inputValue);
        if (!subredditName) {
            GoonApp.UI.showError('Invalid subreddit name. Please enter a valid subreddit name or URL.');
            return;
        }
        
        // Check if already exists
        const existingIndex = AppState.subreddits[type].findIndex(item => 
            item.name.toLowerCase() === subredditName.toLowerCase()
        );
        
        if (existingIndex >= 0) {
            GoonApp.UI.showError(`Subreddit r/${subredditName} is already in your ${type} list.`);
            return;
        }
        
        // Add to list
        AppState.subreddits[type].push({
            name: subredditName,
            enabled: true
        });
        
        // Save to storage
        GoonApp.Storage.saveToStorage();
        
        // Clear input
        inputElement.value = '';
        
        // Update UI
        GoonApp.UI.renderSubredditList(type);
    },
    
    /**
     * Toggle a subreddit's enabled status
     * @param {string} type - 'favorites' or 'punishments'
     * @param {number} index - Index of the subreddit in the list
     */
    toggleSubreddit: function(type, index) {
        if (!AppState.subreddits[type] || !AppState.subreddits[type][index]) return;
        
        AppState.subreddits[type][index].enabled = !AppState.subreddits[type][index].enabled;
        GoonApp.Storage.saveToStorage();
        GoonApp.UI.renderSubredditList(type);
    },
    
    /**
     * Remove a subreddit
     * @param {string} type - 'favorites' or 'punishments'
     * @param {number} index - Index of the subreddit in the list
     */
    removeSubreddit: function(type, index) {
        if (!AppState.subreddits[type] || !AppState.subreddits[type][index]) return;
        
        AppState.subreddits[type].splice(index, 1);
        GoonApp.Storage.saveToStorage();
        GoonApp.UI.renderSubredditList(type);
    },
    
    /**
     * Enable/disable all subreddits
     * @param {string} type - 'favorites' or 'punishments'
     * @param {boolean} enabled - Whether to enable or disable all
     */
    setAllSubreddits: function(type, enabled) {
        if (!AppState.subreddits[type]) return;
        
        AppState.subreddits[type].forEach(item => {
            item.enabled = enabled;
        });
        
        GoonApp.Storage.saveToStorage();
        GoonApp.UI.renderSubredditList(type);
    },
    
    /**
     * Remove all subreddits
     * @param {string} type - 'favorites' or 'punishments'
     */
    removeAllSubreddits: function(type) {
        if (!AppState.subreddits[type]) return;
        
        if (confirm(`Are you sure you want to remove all ${type}? This cannot be undone.`)) {
            AppState.subreddits[type] = [];
            GoonApp.Storage.saveToStorage();
            GoonApp.UI.renderSubredditList(type);
        }
    },
    
    /**
     * Start browsing - fetch content from API
     */
    startBrowsing: async function() {
        try {
            // Show loading indicator
            GoonApp.UI.showLoading();
            
            // Get content source
            const source = AppState.settings.contentSource || 'reddit';
            console.log('Content source:', source);
            
            // Determine if we should include punishments
            const includePunishments = AppState.settings.punishmentsEnabled !== false;
            console.log('Include punishments:', includePunishments);
            
            // For Reddit content, check if we have any enabled subreddits
            if (source === 'reddit') {
                const enabledFavorites = AppState.subreddits.favorites.filter(item => item.enabled);
                const enabledPunishments = includePunishments ? 
                    AppState.subreddits.punishments.filter(item => item.enabled) : [];
                
                if (enabledFavorites.length === 0 && enabledPunishments.length === 0) {
                    GoonApp.UI.showError('Please add and enable at least one subreddit to browse.');
                    return;
                }
            }
            
            // For custom content, check if we have any enabled folders
            if (source === 'custom') {
                const enabledContentFolders = AppState.folders.enabledContentFolders;
                const enabledPunishmentFolders = includePunishments ? 
                    AppState.folders.enabledPunishmentFolders : [];
                
                if (enabledContentFolders.length === 0 && enabledPunishmentFolders.length === 0) {
                    GoonApp.UI.showError('Please enable at least one content folder in settings.');
                    return;
                }
            }
            
            // Update start button to show 'Skip' while content is displayed
            const startButton = GoonApp.DOM.$('startButton');
            if (startButton) {
                startButton.innerHTML = 'Skip';
                startButton.disabled = false;
            }
            
            // Fetch content from API
            console.log('Fetching content from API...');
            const response = await fetch('/get_content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contentSource: source,
                    punishmentsEnabled: includePunishments,
                    subreddits: {
                        favorites: AppState.subreddits.favorites,
                        punishments: AppState.subreddits.punishments
                    },
                    enabledFolders: {
                        content: AppState.folders.enabledContentFolders || [],
                        punishment: AppState.folders.enabledPunishmentFolders || []
                    },
                    timerMin: AppState.settings.timerMin || 30,
                    timerMax: AppState.settings.timerMax || 120,
                    // Send content history to avoid repeats
                    contentHistory: AppState.content.history.map(item => ({
                        id: item.id,
                        folder: item.folder,
                        file: item.file,
                        source: item.source
                    }))
                })
            });
            
            console.log('API response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                // Special handling for non-existent subreddits
                if (data.error === 'subreddit_not_found' && data.subreddit) {
                    const deletedSub = data.subreddit;
                    console.log(`Removing non-existent subreddit: ${deletedSub}`);
                    
                    // Remove from favorites
                    AppState.subreddits.favorites = AppState.subreddits.favorites.filter(
                        item => item.name.toLowerCase() !== deletedSub.toLowerCase()
                    );
                    
                    // Remove from punishments
                    AppState.subreddits.punishments = AppState.subreddits.punishments.filter(
                        item => item.name.toLowerCase() !== deletedSub.toLowerCase()
                    );
                    
                    // Save to storage
                    await GoonApp.Storage.saveToStorage();
                    
                    // Update UI
                    GoonApp.UI.renderSubredditList('favorites');
                    GoonApp.UI.renderSubredditList('punishments');
                    
                    // Show error message
                    GoonApp.UI.showError(`Subreddit r/${deletedSub} has been removed from your lists because it doesn't exist, is banned, or is private.`);
                    
                    // Try again with updated lists after a short delay
                    setTimeout(() => {
                        GoonApp.Content.startBrowsing();
                    }, 2000);
                    return;
                } else {
                    // Handle other errors
                    GoonApp.UI.showError(data.error + (data.message ? ': ' + data.message : ''));
                    return;
                }
            }
            
            // Display content
            this.displayContent(data);
            
            // Only start timer if autocycle is enabled
            if (AppState.settings.autoCycleEnabled) {
                // First try to use the value from the backend response
                if (data.timer_seconds && !isNaN(data.timer_seconds)) {
                    console.log('Starting timer with', data.timer_seconds, 'seconds from backend');
                    GoonApp.Timer.startTimer(parseInt(data.timer_seconds));
                } else if (AppState.settings.autoCycleInterval > 0) {
                    // Fallback to auto-cycle settings if no timer value in response
                    const seconds = parseInt(AppState.settings.autoCycleInterval) || 60;
                    console.log('Starting timer with', seconds, 'seconds from auto-cycle settings');
                    GoonApp.Timer.startTimer(seconds);
                } else {
                    // Use default timer values from settings if no specific interval
                    const minTime = parseInt(AppState.settings.timerMin) || 30;
                    const maxTime = parseInt(AppState.settings.timerMax) || 120;
                    const seconds = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
                    console.log('Starting timer with random duration:', seconds, 'seconds (range:', minTime, '-', maxTime, ')');
                    GoonApp.Timer.startTimer(seconds);
                }
            } else {
                console.log('Autocycle is disabled, not starting timer');
            }
            
            // Start metronome with the value from the backend if available
            if (data.metronome_speed && !isNaN(data.metronome_speed)) {
                console.log('Starting metronome with', data.metronome_speed, 'BPM from backend');
                GoonApp.Timer.startMetronome(parseInt(data.metronome_speed));
            }
            
        } catch (error) {
            console.error('Error starting browsing:', error);
            GoonApp.UI.showError(`Failed to start browsing: ${error.message}`);
        }
    },
    
    /**
     * Display content in the main area
     * @param {Object} data - Content data from API
     */
    displayContent: function(data) {
        // Legacy function for backward compatibility
        window.displayContent = function(data) {
            return GoonApp.Content.displayContent(data);
        };
        
        const contentContainer = GoonApp.DOM.$('content-container');
        if (!contentContainer) return;
        
        // Close any previously opened external Reddit window before rendering new content
        if (AppState.content.redditWindow && !AppState.content.redditWindow.closed) {
            try {
                console.log('Closing previous external content window');
                AppState.content.redditWindow.close();
            } catch (error) {
                console.warn('Unable to close previous external content window:', error);
            }
            AppState.content.redditWindow = null;
        }

        // Clear existing content
        contentContainer.innerHTML = '';
        
        // Hide loading indicator
        const loadingIndicator = GoonApp.DOM.$('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('d-none');
        }
        
        // Show content container
        contentContainer.classList.remove('d-none');
        
        // Store content data in state
        AppState.content.currentContent = data;
        AppState.content.isPunishment = data.isPunishment || false;
        
        // Track content in history to avoid repeats
        if (data.content_url || data.post_url || data.url) {
            // Create a unique identifier for this content
            const contentId = data.content_url || data.post_url || data.url;
            const folderInfo = data.folder || '';
            const fileInfo = data.file_name || '';
            
            // Create a history entry with all relevant info
            const historyEntry = {
                id: contentId,
                folder: folderInfo,
                file: fileInfo,
                timestamp: Date.now(),
                isPunishment: data.isPunishment || false,
                source: data.source || 'unknown'
            };
            
            // Add to history (at the beginning)
            AppState.content.history.unshift(historyEntry);
            
            // Trim history if it exceeds the maximum size
            if (AppState.content.history.length > AppState.content.historyMaxSize) {
                AppState.content.history = AppState.content.history.slice(0, AppState.content.historyMaxSize);
            }
            
            console.log(`Added content to history. History size: ${AppState.content.history.length}`);
        }
        
        // Create a content type indicator if it doesn't exist
        let contentTypeIndicator = document.querySelector('.content-type-indicator');
        if (!contentTypeIndicator) {
            contentTypeIndicator = document.createElement('div');
            contentTypeIndicator.className = 'content-type-indicator';
            contentContainer.appendChild(contentTypeIndicator);
        } else {
            // Clear existing content
            contentTypeIndicator.innerHTML = '';
        }
        
        // Set the indicator text and style based on content type
        if (data.isPunishment) {
            contentTypeIndicator.textContent = 'Punishment!';
            contentTypeIndicator.className = 'content-type-indicator punishment';
        } else {
            contentTypeIndicator.textContent = 'Fap!';
            contentTypeIndicator.className = 'content-type-indicator regular';
        }
        
        // Make sure it's visible
        contentTypeIndicator.style.display = 'block';
        
        // Add source info in a subtle way if it's custom content
        if (data.source === 'custom' || data.isCustom) {
            // Remove any existing source badge
            const existingBadge = document.querySelector('.source-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            
            // Create a small badge for the source info
            const sourceBadge = document.createElement('div');
            sourceBadge.className = 'source-badge';
            sourceBadge.textContent = 'Custom';
            contentContainer.appendChild(sourceBadge);
        }
        
        // Show finish button
        const finishButtonContainer = GoonApp.DOM.$('finish-button-container');
        if (finishButtonContainer) {
            finishButtonContainer.style.display = 'block';
        }
        
        // Determine content type based on file extension or URL
        let contentType = 'unknown';
        let contentUrl = '';
        
        // First check if this is a gallery post with multiple images
        // If so, we'll treat it as an image type regardless of URL format
        if (Array.isArray(data.gallery_images) && data.gallery_images.length > 1) {
            console.log('Detected gallery post with multiple images, setting content type to image');
            contentType = 'image';
            contentUrl = data.post_url || data.gallery_images[0] || '';
        }
        // Otherwise, determine content type based on URL format
        else if (data.content_url) {
            // Custom content format (from local files)
            contentUrl = data.content_url;
            const fileExt = data.file_name ? data.file_name.split('.').pop().toLowerCase() : '';
            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
                contentType = 'image';
            } else if (['mp4', 'webm', 'mov'].includes(fileExt)) {
                contentType = 'video';
            }
        } else if (data.post_url) {
            // Reddit content format
            contentUrl = data.post_url;
            
            // Determine content type based on URL
            if (contentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                contentType = 'image';
            } else if (contentUrl.match(/\.(mp4|webm|mov)$/i)) {
                contentType = 'video';
            } else {
                // For other URLs (like redgifs, imgur, etc.), treat as external content
                contentType = 'external';
            }
        } else if (data.url) {
            // Fallback for any other format that provides a URL
            contentUrl = data.url;
            
            // Try to determine content type from URL
            if (contentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                contentType = 'image';
            } else if (contentUrl.match(/\.(mp4|webm|mov)$/i)) {
                contentType = 'video';
            } else {
                contentType = data.type || 'external';
            }
        }
        
        console.log('Determined content type:', contentType, 'for URL:', contentUrl);
        
        // Check if this is a gallery post with multiple images
        console.log('Gallery data check:', {
            is_gallery: data.is_gallery,
            has_gallery_images: !!data.gallery_images,
            gallery_images_length: data.gallery_images ? data.gallery_images.length : 0,
            gallery_images: data.gallery_images,
            data_keys: Object.keys(data)
        });
        
        // More flexible gallery detection - check if we have gallery_images array with multiple images
        // even if is_gallery flag might not be set correctly
        const isGallery = Array.isArray(data.gallery_images) && data.gallery_images.length > 1;
        console.log('Is gallery post?', isGallery);
        
        // Display content based on type
        if (contentType === 'image') {
            // Check if this is a gallery post
            const isGalleryPost = Array.isArray(data.gallery_images) && data.gallery_images.length > 1;
            
            // Intentionally skip adding a title for inline image/gif content to maximise viewing area
            // Previously we displayed the post title here, but it often obstructs or pushes the media
            // making it hard to view. Titles are still shown when content opens in its own window.
            
            
            // Only add source for non-gallery posts
            if (!isGalleryPost && (data.source || data.subreddit)) {
                const source = document.createElement('p');
                source.className = 'content-source';
                
                const sourceText = data.source || (data.subreddit ? `r/${data.subreddit}` : '');
                
                if (sourceText.startsWith('r/')) {
                    // Create link for subreddit
                    const link = document.createElement('a');
                    link.href = `https://reddit.com/${sourceText}`;
                    link.textContent = sourceText;
                    link.target = '_blank';
                    source.appendChild(link);
                } else {
                    source.textContent = sourceText;
                }
                
                contentContainer.appendChild(source);
            }
            
            // If this is a gallery post with multiple images, create a gallery viewer
            if (isGallery) {
                console.log(`Creating gallery viewer for ${data.gallery_images.length} images`);
                
                // Create a gallery container
                const galleryContainer = document.createElement('div');
                galleryContainer.className = 'gallery-container';
                galleryContainer.style.position = 'relative';
                galleryContainer.style.width = '100%';
                galleryContainer.style.maxWidth = '100%';
                
                // Create an image container that will hold all images
                const imageContainer = document.createElement('div');
                imageContainer.className = 'gallery-image-container';
                imageContainer.style.display = 'flex';
                imageContainer.style.justifyContent = 'center';
                imageContainer.style.alignItems = 'center';
                imageContainer.style.minHeight = '300px';
                
                // Add a counter for gallery images
                const counter = document.createElement('div');
                counter.className = 'gallery-counter';
                counter.style.position = 'absolute';
                counter.style.top = '10px';
                counter.style.right = '10px';
                counter.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                counter.style.color = 'white';
                counter.style.padding = '5px 10px';
                counter.style.borderRadius = '15px';
                counter.style.zIndex = '10';
                counter.style.fontSize = '14px';
                
                // Add navigation buttons
                const prevButton = document.createElement('button');
                prevButton.innerHTML = '&#10094;'; // Left arrow
                prevButton.className = 'gallery-nav-button gallery-prev';
                prevButton.style.position = 'absolute';
                prevButton.style.top = '50%';
                prevButton.style.left = '10px';
                prevButton.style.transform = 'translateY(-50%)';
                prevButton.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                prevButton.style.color = 'white';
                prevButton.style.border = 'none';
                prevButton.style.borderRadius = '50%';
                prevButton.style.width = '40px';
                prevButton.style.height = '40px';
                prevButton.style.fontSize = '18px';
                prevButton.style.cursor = 'pointer';
                prevButton.style.zIndex = '10';
                
                const nextButton = document.createElement('button');
                nextButton.innerHTML = '&#10095;'; // Right arrow
                nextButton.className = 'gallery-nav-button gallery-next';
                nextButton.style.position = 'absolute';
                nextButton.style.top = '50%';
                nextButton.style.right = '10px';
                nextButton.style.transform = 'translateY(-50%)';
                nextButton.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                nextButton.style.color = 'white';
                nextButton.style.border = 'none';
                nextButton.style.borderRadius = '50%';
                nextButton.style.width = '40px';
                nextButton.style.height = '40px';
                nextButton.style.fontSize = '18px';
                nextButton.style.cursor = 'pointer';
                nextButton.style.zIndex = '10';
                
                // Add elements to gallery container
                galleryContainer.appendChild(imageContainer);
                galleryContainer.appendChild(counter);
                galleryContainer.appendChild(prevButton);
                galleryContainer.appendChild(nextButton);
                
                // Add gallery container to content container
                contentContainer.appendChild(galleryContainer);
                
                // Generate AI teasing caption if enabled
                (async () => {
                    try {
                        if (AppState.settings.aiTeasingEnabled && data.post_url) {
                            // Simple cache on AppState
                            AppState.aiCaptionCache = AppState.aiCaptionCache || {};
                            if (!AppState.aiCaptionCache[data.post_url]) {
                                    console.log('Fetching AI caption for', data.post_url);
                                const resp = await fetch('/generate_caption', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        penis_size: AppState.settings.penisSize || '',
                                        prompt_template: AppState.settings.aiPromptTemplate || '',
                                        model: AppState.settings.ollamaModel || 'mistral:instruct'
                                    })
                                });
                                if(!resp.ok){
                                        console.warn('AI caption fetch failed', resp.status);
                                    }
                                    const j = await resp.json();
                                AppState.aiCaptionCache[data.post_url] = j.caption || '';
                            }
                            const captionText = AppState.aiCaptionCache[data.post_url];
                            if (captionText) {
                                const captionEl = document.createElement('p');
                                captionEl.className = 'ai-caption text-center fw-semibold my-2';
                                captionEl.textContent = captionText;
                                contentContainer.insertBefore(captionEl, contentContainer.firstChild);
                            }
                        }
                    } catch (e) { console.error('AI caption error', e); }
                })();

                // Keep track of current image index
                let currentIndex = 0;
                
                // Function to display the current image
                const displayGalleryImage = (index) => {
                    // Clear the image container
                    imageContainer.innerHTML = '';
                    
                    // Get the current image URL
                    let imgUrl = data.gallery_images[index];
                    console.log(`Loading gallery image ${index + 1}/${data.gallery_images.length}:`, imgUrl);
                    
                    // Process the URL (similar to what we do for single images)
                    if (imgUrl && (imgUrl.includes('i.redd.it') || imgUrl.includes('preview.redd.it'))) {
                        console.log('Reddit gallery image detected:', imgUrl);
                        
                        // Decode HTML entities in the URL
                        if (imgUrl.includes('&amp;')) {
                            imgUrl = imgUrl.replace(/&amp;/g, '&');
                            console.log('Decoded HTML entities in URL:', imgUrl);
                        }
                        
                        // Special handling for preview.redd.it URLs
                        if (imgUrl.includes('preview.redd.it')) {
                            console.log('Detected preview.redd.it URL, extracting direct image URL');
                            
                            const urlParts = imgUrl.split('?');
                            if (urlParts.length > 0) {
                                let baseUrl = urlParts[0];
                                
                                // Make sure it has the correct extension
                                if (baseUrl.endsWith('.webp')) {
                                    baseUrl = baseUrl.replace(/\.webp$/i, '.jpg');
                                }
                                
                                // Use the direct i.redd.it URL instead of preview.redd.it
                                imgUrl = baseUrl.replace('preview.redd.it', 'i.redd.it');
                                console.log('Converted to direct image URL:', imgUrl);
                            }
                        }
                        // For other webp images, try to use JPG format
                        else if (imgUrl.endsWith('.webp') || imgUrl.includes('format=pjpg') || imgUrl.includes('format=webp')) {
                            console.log('Detected Reddit CDN webp URL, trying JPG format');
                            imgUrl = imgUrl.replace('.webp', '.jpg')
                                         .replace('format=pjpg', 'format=jpg')
                                         .replace('format=webp', 'format=jpg');
                            console.log('Using alternative URL:', imgUrl);
                        }
                        
                        // Add proxy parameter if needed
                        if (!imgUrl.includes('?')) {
                            imgUrl = imgUrl + '?bypass=cors';
                        }
                        
                        console.log('Final Reddit gallery image URL:', imgUrl);
                    }
                    
                    // Create the image element
                    const img = document.createElement('img');
                    img.src = imgUrl;
                    img.className = 'gallery-image';
                    img.style.maxWidth = '100%';
                    img.style.maxHeight = '70vh';
                    img.style.objectFit = 'contain';
                    img.style.display = 'block';
                    img.style.margin = '0 auto';
                    img.dataset.isRedditContent = 'true';
                    img.dataset.originalSrc = imgUrl;
                    
                    // Add error handling for images
                    img.onerror = function() {
                        console.error('Error loading gallery image:', imgUrl);
                        this.onerror = null; // Prevent infinite error loop
                        this.src = '/static/img/error.png'; // Fallback image
                        
                        const errorMsg = document.createElement('p');
                        errorMsg.className = 'text-danger mt-2';
                        errorMsg.textContent = `Error loading image ${index + 1}/${data.gallery_images.length}`;
                        imageContainer.appendChild(errorMsg);
                    };
                    
                    // Add image to container
                    imageContainer.appendChild(img);
                    
                    // Update counter
                    counter.textContent = `${index + 1} / ${data.gallery_images.length}`;
                };
                
                // Event listeners for navigation buttons
                prevButton.addEventListener('click', () => {
                    currentIndex = (currentIndex === 0) ? data.gallery_images.length - 1 : currentIndex - 1;
                    displayGalleryImage(currentIndex);
                });
                
                nextButton.addEventListener('click', () => {
                    currentIndex = (currentIndex === data.gallery_images.length - 1) ? 0 : currentIndex + 1;
                    displayGalleryImage(currentIndex);
                });
                
                // Keyboard navigation
                const handleKeyDown = (event) => {
                    if (event.key === 'ArrowLeft') {
                        prevButton.click();
                    } else if (event.key === 'ArrowRight') {
                        nextButton.click();
                    }
                };
                document.addEventListener('keydown', handleKeyDown);
                
                // Store the event listener in AppState so we can remove it later
                AppState.content.galleryKeyboardListener = handleKeyDown;
                
                // Clean up previous gallery keyboard listener if it exists
                if (AppState.content.previousGalleryKeyboardListener) {
                    console.log('Removing previous gallery keyboard listener');
                    document.removeEventListener('keydown', AppState.content.previousGalleryKeyboardListener);
                }
                
                // Store current listener as previous for next cleanup
                AppState.content.previousGalleryKeyboardListener = handleKeyDown;
                
                // Display the first image
                displayGalleryImage(currentIndex);
                
            } else {
                // Regular single image handling
                const img = document.createElement('img');
            
            // Ensure the URL is properly formatted
            // For custom content, make sure we're using the correct URL format
            if (data.source === 'custom' || data.isCustom) {
                // Log the content URL for debugging
                console.log('Custom content URL:', contentUrl);
                
                // Make sure the URL starts with a slash
                if (!contentUrl.startsWith('/')) {
                    contentUrl = '/' + contentUrl;
                }
                
                // Fix any double slashes (except after protocol)
                contentUrl = contentUrl.replace(/([^:])\/+/g, '$1/');
            }
            
            // Handle Reddit CDN URLs for all environments
            if (contentUrl.includes('i.redd.it') || contentUrl.includes('preview.redd.it')) {
                console.log('Reddit content detected:', contentUrl);
                
                // Decode HTML entities in the URL (like &amp; to &)
                if (contentUrl.includes('&amp;')) {
                    contentUrl = contentUrl.replace(/&amp;/g, '&');
                    console.log('Decoded HTML entities in URL:', contentUrl);
                }
                
                // Set a flag for all Reddit content to enable fallback handling
                img.dataset.isRedditContent = 'true';
                img.dataset.originalSrc = contentUrl;
                
                // Special handling for preview.redd.it URLs
                if (contentUrl.includes('preview.redd.it')) {
                    console.log('Detected preview.redd.it URL, extracting direct image URL');
                    
                    // Extract the base image URL without the query parameters
                    const urlParts = contentUrl.split('?');
                    if (urlParts.length > 0) {
                        // Get just the base URL part (without query parameters)
                        let baseUrl = urlParts[0];
                        
                        // Make sure it has the correct extension
                        if (baseUrl.endsWith('.webp')) {
                            baseUrl = baseUrl.replace(/\.webp$/i, '.jpg');
                        }
                        
                        // Use the direct i.redd.it URL instead of preview.redd.it
                        contentUrl = baseUrl.replace('preview.redd.it', 'i.redd.it');
                        console.log('Converted to direct image URL:', contentUrl);
                        
                        // Update the original source for fallback handling
                        img.dataset.originalSrc = contentUrl;
                    }
                }
                // For other webp images, try to use JPG format instead
                else if (contentUrl.endsWith('.webp') || contentUrl.includes('format=pjpg') || contentUrl.includes('format=webp')) {
                    console.log('Detected Reddit CDN webp URL, trying JPG format');
                    const alternativeUrl = contentUrl.replace('.webp', '.jpg').replace('format=pjpg', 'format=jpg').replace('format=webp', 'format=jpg');
                    console.log('Using alternative URL:', alternativeUrl);
                    contentUrl = alternativeUrl;
                }
                
                // Add a proxy for Reddit content to bypass potential CORS issues
                // This helps with cross-origin restrictions that might be causing the display problems
                if (!contentUrl.includes('?')) {
                    contentUrl = contentUrl + '?bypass=cors';
                }
                
                console.log('Final Reddit content URL:', contentUrl);
            }
            
            // Set the image source - this was missing for Reddit content!
            img.src = contentUrl;
            img.className = 'content-image';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '70vh';
            img.style.objectFit = 'contain';
            img.style.display = 'block';
            img.style.margin = '0 auto';
            
            // Add error handling for images
            img.onerror = function() {
                console.error('Error loading image:', contentUrl);
                this.onerror = null; // Prevent infinite error loop
                
                // Special handling for Reddit content that fails to load
                if (this.dataset.isRedditContent === 'true' && this.dataset.originalSrc) {
                    console.log('Reddit content failed to load, attempting alternative display method');
                    
                    // Create a message explaining what will happen
                    const gifMsg = document.createElement('p');
                    gifMsg.className = 'alert alert-info mt-2';
                    gifMsg.textContent = 'This Reddit content will open in a new window for better compatibility.';
                    contentContainer.appendChild(gifMsg);
                    
                    // Open the GIF in a new window
                    setTimeout(() => {
                        // Get screen dimensions
                        const screenWidth = window.screen.width;
                        const screenHeight = window.screen.height;
                        
                        // Calculate optimal window size (90% of screen size)
                        const windowWidth = Math.floor(screenWidth * 0.9);
                        const windowHeight = Math.floor(screenHeight * 0.9);
                        
                        // Calculate position to center the window
                        const left = Math.floor((screenWidth - windowWidth) / 2);
                        const top = Math.floor((screenHeight - windowHeight) / 2);
                        
                        // Open the window with optimal size and position
                        AppState.content.redditWindow = window.open(
                            this.dataset.originalSrc, 
                            'externalContent', 
                            `width=${windowWidth},height=${windowHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
                        );
                        
                        // Focus the window
                        if (AppState.content.redditWindow) {
                            AppState.content.redditWindow.focus();
                        }
                    }, 500);
                    
                    // Show a placeholder image
                    this.src = '/static/img/error.png'; // Fallback image
                } else {
                    // Standard error handling for other images
                    this.src = '/static/img/error.png'; // Fallback image
                    
                    // Show error message
                    const errorMsg = document.createElement('p');
                    errorMsg.className = 'text-danger mt-2';
                    errorMsg.textContent = `Error loading image. URL: ${contentUrl}`;
                    contentContainer.appendChild(errorMsg);
                }
            }
            
            // Add image to container
            contentContainer.appendChild(img);
            }
            
        } else if (contentType === 'video') {
            // Create video element
            const video = document.createElement('video');
            
            // Ensure the URL is properly formatted for custom content
            if (data.source === 'custom' || data.isCustom) {
                // Log the content URL for debugging
                console.log('Custom video URL:', contentUrl);
                
                // Make sure the URL starts with a slash
                if (!contentUrl.startsWith('/')) {
                    contentUrl = '/' + contentUrl;
                }
                
                // Fix any double slashes (except after protocol)
                contentUrl = contentUrl.replace(/(https?:\/\/[^\/]+)?\/+/g, '$1/');
            }
            
            video.src = contentUrl;
            video.controls = true;
            video.autoplay = true;
            video.loop = true;
            video.className = 'content-video';
            video.style.maxWidth = '100%';
            video.style.maxHeight = '70vh';
            
            // Add event listener for metadata loaded to get video duration
            video.addEventListener('loadedmetadata', function() {
                // Check if video timer soft limit is enabled
                if (AppState.settings.videoTimerSoftLimitEnabled) {
                    const videoDuration = Math.floor(video.duration);
                    console.log(`Video duration detected: ${videoDuration} seconds`);
                    
                    // Only adjust timer if video duration is valid and timer is active
                    if (videoDuration > 0 && AppState.timer && AppState.timer.seconds) {
                        const currentTimerDuration = AppState.timer.seconds;
                        
                        // If video is longer than current timer, extend timer to match video length
                        if (videoDuration > currentTimerDuration) {
                            console.log(`Extending timer from ${currentTimerDuration}s to match video length: ${videoDuration}s`);
                            AppState.timer.seconds = videoDuration;
                            AppState.timer.originalSeconds = videoDuration;
                            
                            // Update the timer display
                            GoonApp.Timer.updateTimerDisplay();
                        }
                    }
                } else {
                    console.log('Video timer soft limit is disabled, keeping original timer duration');
                }
            });
            
            // Add error handling for videos
            video.onerror = function() {
                console.error('Error loading video:', contentUrl);
                
                // Show error message
                const errorMsg = document.createElement('p');
                errorMsg.className = 'text-danger mt-2';
                errorMsg.textContent = `Error loading video. URL: ${contentUrl}`;
                contentContainer.appendChild(errorMsg);
            }
            
            // Skip adding a title for inline video/gif content for the same reason as images.
            
            
            // Add source if available
            if (data.source) {
                const source = document.createElement('p');
                source.className = 'content-source';
                source.textContent = data.source;
                contentContainer.appendChild(source);
            }
            
            // Add video to container
            contentContainer.appendChild(video);
            
        } else if (contentType === 'external') {
            // Skip external content handling for gallery posts
            if (Array.isArray(data.gallery_images) && data.gallery_images.length > 1) {
                console.log('Skipping external content handler for gallery post');
                // Force content type to image and reprocess
                contentType = 'image';
                // Call displayContent again with updated contentType
                this.displayContent(data);
                return;
            }
            
            // For external content (redgifs, imgur, etc.), open in a new window
            
            // Add title if available
            if (data.post_title) {
                const title = document.createElement('h3');
                title.textContent = data.post_title;
                title.className = 'content-title mt-2';
                contentContainer.appendChild(title);
            }
            
            // Check if this is a Reddit CDN URL that might have compatibility issues
            const isRedditCdnUrl = contentUrl.includes('i.redd.it') || contentUrl.includes('preview.redd.it');
            const isWebpImage = contentUrl.toLowerCase().endsWith('.webp') || contentUrl.includes('format=pjpg') || contentUrl.includes('format=webp');
            
            // Add source if available
            if (data.subreddit) {
                const source = document.createElement('p');
                source.className = 'content-source';
                
                // Create link for subreddit
                const link = document.createElement('a');
                link.href = `https://reddit.com/r/${data.subreddit}`;
                link.textContent = `r/${data.subreddit}`;
                link.target = '_blank';
                source.appendChild(link);
                
                contentContainer.appendChild(source);
            }
            
            // Create a preview container
            const previewContainer = document.createElement('div');
            previewContainer.className = 'content-preview-container';
            previewContainer.style.textAlign = 'center';
            previewContainer.style.margin = '20px 0';
            
            // Add a message explaining what will happen
            const previewMessage = document.createElement('p');
            previewMessage.className = 'preview-message';
            previewMessage.innerHTML = 'External content will open in a new window.<br>The window will automatically close when the timer ends.';
            previewContainer.appendChild(previewMessage);
            
            // Add URL display
            const urlDisplay = document.createElement('div');
            urlDisplay.className = 'url-display';
            urlDisplay.style.padding = '10px';
            urlDisplay.style.margin = '10px 0';
            urlDisplay.style.backgroundColor = '#f8f9fa';
            urlDisplay.style.borderRadius = '5px';
            urlDisplay.style.wordBreak = 'break-all';
            urlDisplay.textContent = contentUrl;
            previewContainer.appendChild(urlDisplay);
            
            // Add open button
            const openButton = document.createElement('button');
            openButton.textContent = 'Open Content';
            openButton.className = 'btn btn-primary btn-lg mb-3';
            openButton.onclick = () => {
                // Open content in new window that fits the screen
                openContentInOptimalWindow(contentUrl);
            };
            previewContainer.appendChild(openButton);
            
            contentContainer.appendChild(previewContainer);
            
            // Auto-open the content
            setTimeout(() => {
                // Open content in new window that fits the screen
                openContentInOptimalWindow(contentUrl);
            }, 500);
            
            // Helper function to open content in an optimally sized window
            function openContentInOptimalWindow(url) {
                // Get screen dimensions
                const screenWidth = window.screen.width;
                const screenHeight = window.screen.height;
                
                // Calculate optimal window size (90% of screen size)
                const windowWidth = Math.floor(screenWidth * 0.9);
                const windowHeight = Math.floor(screenHeight * 0.9);
                
                // Calculate position to center the window
                const left = Math.floor((screenWidth - windowWidth) / 2);
                const top = Math.floor((screenHeight - windowHeight) / 2);
                
                // Handle Reddit CDN URLs that might have compatibility issues
                let finalUrl = url;
                
                // Decode HTML entities in the URL (like &amp; to &)
                if (finalUrl.includes('&amp;')) {
                    finalUrl = finalUrl.replace(/&amp;/g, '&');
                    console.log('Decoded HTML entities in URL:', finalUrl);
                }
                
                // Special handling for preview.redd.it URLs
                if (finalUrl.includes('preview.redd.it')) {
                    console.log('Detected preview.redd.it URL, extracting direct image URL');
                    
                    // Extract the base image URL without the query parameters
                    const urlParts = finalUrl.split('?');
                    if (urlParts.length > 0) {
                        // Get just the base URL part (without query parameters)
                        let baseUrl = urlParts[0];
                        
                        // Make sure it has the correct extension
                        if (baseUrl.endsWith('.webp')) {
                            baseUrl = baseUrl.replace(/\.webp$/i, '.jpg');
                        }
                        
                        // Use the direct i.redd.it URL instead of preview.redd.it
                        // This is more likely to work in a new tab
                        finalUrl = baseUrl.replace('preview.redd.it', 'i.redd.it');
                        console.log('Converted to direct image URL:', finalUrl);
                    }
                }
                // Handle other Reddit CDN URLs
                else if (isRedditCdnUrl && isWebpImage) {
                    console.log('Detected Reddit CDN webp URL in browser, attempting alternative format');
                    // Try to use a different format by replacing .webp with .jpg
                    finalUrl = finalUrl.replace(/\.webp$/i, '.jpg')
                                        .replace('format=pjpg', 'format=jpg')
                                        .replace('format=webp', 'format=jpg');
                    console.log('Using alternative URL:', finalUrl);
                }
                
                // Open the window with optimal size and position
                AppState.content.redditWindow = window.open(
                    finalUrl, 
                    'externalContent', 
                    `width=${windowWidth},height=${windowHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
                );
                
                // Focus the window
                if (AppState.content.redditWindow) {
                    AppState.content.redditWindow.focus();
                }
            }
            

        } else {
            // For other content types, just show the data as JSON
            const pre = document.createElement('pre');
            pre.className = 'content-json';
            pre.textContent = JSON.stringify(data, null, 2);
            contentContainer.appendChild(pre);
        }
    }
};

// Legacy functions for backward compatibility
function cleanupSubredditNames(list) {
    return GoonApp.Content.cleanupSubredditNames(list);
}

function extractSubredditName(input) {
    return GoonApp.Content.extractSubredditName(input);
}

function addSubreddit(type) {
    return GoonApp.Content.addSubreddit(type);
}

function toggleSubreddit(type, index) {
    return GoonApp.Content.toggleSubreddit(type, index);
}

function removeSubreddit(type, index) {
    return GoonApp.Content.removeSubreddit(type, index);
}

function setAllSubreddits(type, enabled) {
    return GoonApp.Content.setAllSubreddits(type, enabled);
}

function startBrowsing() {
    return GoonApp.Content.startBrowsing();
}

export default GoonApp.Content;
