"""
Reddit API wrapper for the Goon application.
Provides a custom Reddit class and functions for interacting with Reddit's API.
"""
import random
import logging
import time
import praw as praw_module
# Don't import Reddit class directly to avoid any import-time issues
from flask import jsonify

from utils import clean_subreddit_name
from credentials import load_credentials, save_credentials

# Get logger
logger = logging.getLogger(__name__)

# Initialize global Reddit instance
reddit = None

# Track when the Reddit client was last initialized
LAST_REDDIT_INIT = 0  # timestamp

# Cache for Reddit content
reddit_cache = {
    # Structure: subreddit_name -> {
    #   'submissions': [submission1, submission2, ...],
    #   'last_updated': timestamp,
    #   'type': 'hot'/'new'/'top'
    # }
}

# Cache expiration times
CACHE_EXPIRATION = 1800  # 30 minutes for normal cache
CACHE_EXPIRATION_EMPTY = 300  # 5 minutes for empty/error results

# Maximum number of subreddits to cache
MAX_CACHE_ENTRIES = 50

# Minimum number of submissions needed before trying additional API calls
MIN_SUBMISSIONS_THRESHOLD = 10

def create_reddit_instance(credentials):
    """
    Create a PRAW Reddit instance using credentials dictionary.
    Uses a direct approach that bypasses PRAW's normal initialization process.
    
    Args:
        credentials (dict): Dictionary containing Reddit API credentials
        
    Returns:
        praw.Reddit or None: Reddit instance or None if initialization fails
    """
    try:
        # Extract and validate credentials
        if not credentials or not isinstance(credentials, dict):
            logger.error("Invalid credentials format")
            return None
            
        # Extract values with defaults
        client_id = credentials.get('client_id', '')
        client_secret = credentials.get('client_secret', '')
        
        # Convert to strings and strip whitespace
        if client_id is not None:
            client_id = str(client_id).strip()
        else:
            client_id = ''
            
        if client_secret is not None:
            client_secret = str(client_secret).strip()
        else:
            client_secret = ''
        
        # Use a descriptive user agent that follows Reddit's API guidelines
        user_agent = "Goon/1.0 (Windows; standalone app using user-supplied credentials)"
        
        # Check for empty values
        if not client_id or not client_secret:
            logger.warning("Empty client_id or client_secret")
            return None
            
        # Log what we're doing (without showing actual values)
        logger.info(f"Creating Reddit instance with client_id length: {len(client_id)}, "
                   f"client_secret length: {len(client_secret)}, "
                   f"user_agent: {user_agent}")
        
        # Check if we're running as an executable
        import sys
        is_frozen = getattr(sys, 'frozen', False)
        
        # If running as an executable, use a custom approach that works around PRAW issues
        if is_frozen:
            try:
                logger.info("Running as executable, using custom Reddit wrapper implementation")
                
                # Create a custom Reddit client that doesn't rely on PRAW's internals
                # This is a simplified version that only supports the features we need
                class CustomRedditClient:
                    def __init__(self, client_id, client_secret, user_agent):
                        self.client_id = client_id
                        self.client_secret = client_secret
                        self.user_agent = user_agent
                        self._read_only = True
                        
                        # Import requests directly to avoid PRAW's request handling
                        import requests
                        from base64 import b64encode
                        
                        # Set up the session
                        self.session = requests.Session()
                        self.session.headers['User-Agent'] = user_agent
                        
                        # Get the access token
                        auth = b64encode(f"{client_id}:{client_secret}".encode()).decode()
                        headers = {
                            'Authorization': f'Basic {auth}',
                            'User-Agent': user_agent
                        }
                        data = {'grant_type': 'client_credentials'}
                        
                        try:
                            response = self.session.post(
                                'https://www.reddit.com/api/v1/access_token',
                                headers=headers,
                                data=data
                            )
                            response.raise_for_status()
                            self.token_data = response.json()
                            self.session.headers['Authorization'] = f"Bearer {self.token_data['access_token']}"
                            logger.info("Successfully obtained Reddit API token")
                        except Exception as e:
                            logger.error(f"Failed to get Reddit API token: {str(e)}")
                            raise
                    
                    @property
                    def read_only(self):
                        return self._read_only
                    
                    def subreddit(self, display_name):
                        # Create a simple subreddit object
                        class CustomSubreddit:
                            def __init__(self, reddit, display_name):
                                self.reddit = reddit
                                self.display_name = display_name
                            
                            def _get_listings(self, endpoint, limit=25):
                                url = f"https://oauth.reddit.com/r/{self.display_name}/{endpoint}"
                                params = {'limit': limit}
                                
                                try:
                                    response = self.reddit.session.get(url, params=params)
                                    response.raise_for_status()
                                    data = response.json()
                                    
                                    # Convert raw API data to submission-like objects
                                    submissions = []
                                    for post in data['data']['children']:
                                        post_data = post['data']
                                        
                                        # Create a submission-like object with all the attributes
                                        # that the get_reddit_content function expects
                                        class SubmissionProxy:
                                            def __init__(self, data):
                                                self.id = data.get('id', '')
                                                self.title = data.get('title', '')
                                                self.url = data.get('url', '')
                                                self.permalink = data.get('permalink', '')
                                                self.stickied = data.get('stickied', False)
                                                self.over_18 = data.get('over_18', False)
                                                self.is_video = data.get('is_video', False)
                                                self.is_self = data.get('is_self', False)
                                                self.selftext = data.get('selftext', '')
                                                self.created_utc = data.get('created_utc', 0)
                                                self.score = data.get('score', 0)
                                                self.num_comments = data.get('num_comments', 0)
                                                self.author = data.get('author', '')
                                                self.subreddit = data.get('subreddit', '')
                                                self.domain = data.get('domain', '')
                                                self.name = data.get('name', '')
                                                self.preview = data.get('preview', {})
                                                self.media = data.get('media', {})
                                                self.secure_media = data.get('secure_media', {})
                                                self.post_hint = data.get('post_hint', '')
                                                
                                                # Handle media metadata for gallery posts
                                                self.is_gallery = data.get('is_gallery', False)
                                                self.media_metadata = data.get('media_metadata', {})
                                                self.gallery_data = data.get('gallery_data', {})
                                                
                                                # Add any additional attributes needed
                                                self._data = data  # Store the original data for reference
                                        
                                        submissions.append(SubmissionProxy(post_data))
                                    
                                    return submissions
                                except Exception as e:
                                    logger.error(f"Error fetching {endpoint} for r/{self.display_name}: {str(e)}")
                                    return []
                            
                            def hot(self, limit=25):
                                return self._get_listings('hot', limit)
                            
                            def new(self, limit=25):
                                return self._get_listings('new', limit)
                            
                            def top(self, time_filter='day', limit=25):
                                return self._get_listings(f'top?t={time_filter}', limit)
                        
                        return CustomSubreddit(self, display_name)
                
                # Create and return our custom Reddit client
                reddit_instance = CustomRedditClient(client_id, client_secret, user_agent)
                logger.info("Successfully created custom Reddit client for executable environment")
                return reddit_instance
            except Exception as e:
                logger.error(f"Custom Reddit implementation failed: {str(e)}")
                
                # If our custom implementation fails, try the standard PRAW approach
                # but with additional error handling
                try:
                    import praw
                    logger.info("Falling back to standard PRAW with additional error handling")
                    
                    # We need to create a custom Config class to avoid the '_NotSet' error
                    class CustomConfig:
                        def __init__(self, **settings):
                            self._settings = settings
                            
                        def __getitem__(self, key):
                            return self._settings.get(key, '')
                    
                    # Create a custom configuration
                    custom_config = CustomConfig(
                        client_id=client_id,
                        client_secret=client_secret,
                        user_agent=user_agent,
                        check_for_updates='False',
                        comment_kind='t1',
                        message_kind='t4',
                        redditor_kind='t2',
                        submission_kind='t3',
                        subreddit_kind='t5',
                        trophy_kind='t6',
                        oauth_url='https://oauth.reddit.com',
                        reddit_url='https://www.reddit.com',
                        short_url='https://redd.it',
                        timeout='16'
                    )
                    
                    # Monkey patch PRAW if needed
                    if not hasattr(praw.Reddit, '_prepare_objector'):
                        praw.Reddit._prepare_objector = lambda self: None
                    
                    # Create a Reddit instance with minimal arguments
                    reddit_instance = praw.Reddit(
                        client_id=client_id,
                        client_secret=client_secret,
                        user_agent=user_agent
                    )
                    
                    # Force read-only mode
                    reddit_instance._read_only = True
                    
                    logger.info("Successfully created PRAW Reddit instance with error handling")
                    return reddit_instance
                except Exception as praw_e:
                    logger.error(f"All Reddit initialization methods failed: {str(praw_e)}")
                    return None
        
        # Standard approach for non-executable environments
        # Import PRAW directly
        import praw
        from praw.config import Config
        
        try:
            from praw.util.token_manager import TokenManager
        except ImportError as e:
            logger.warning(f"Could not import TokenManager: {str(e)}. Creating fallback implementation.")
            
            # Create a minimal fallback implementation of TokenManager
            class TokenManager:
                def __init__(self, authorizer):
                    self._authorizer = authorizer
                    self._access_token = None
                    self._expiration = 0
                
                def authorized_client(self):
                    # Return a simple object that can be used as a placeholder
                    class DummyClient:
                        def request(self, *args, **kwargs):
                            return {"data": {}}
                    return DummyClient()
        
        # Create a minimal config object
        config = {
            'client_id': client_id,
            'client_secret': client_secret,
            'user_agent': user_agent,
            'check_for_updates': False,
            'comment_kind': 't1',
            'message_kind': 't4',
            'redditor_kind': 't2',
            'submission_kind': 't3',
            'subreddit_kind': 't5',
            'trophy_kind': 't6',
            'oauth_url': 'https://oauth.reddit.com',
            'reddit_url': 'https://www.reddit.com',
            'short_url': 'https://redd.it',
            'timeout': 16
        }
        
        # Create the Reddit instance with minimal configuration
        try:
            # Create a Config object directly - convert dict to a hashable format
            praw_config = Config({str(k): str(v) if isinstance(v, (str, bool, int, float)) else str(v) 
                                 for k, v in config.items()})
            
            # Create a Reddit instance with this config
            reddit_instance = praw.Reddit(config=praw_config)
            
            # Verify it works by accessing a property
            _ = reddit_instance.read_only
            
            logger.info("Successfully created Reddit instance")
            return reddit_instance
        except Exception as e:
            logger.error(f"Failed to create Reddit instance with config: {str(e)}")
            
            # Last resort: try the most basic approach
            try:
                logger.info("Trying most basic Reddit initialization")
                reddit_instance = praw.Reddit(
                    client_id=client_id,
                    client_secret=client_secret,
                    user_agent=user_agent
                )
                logger.info("Successfully created Reddit instance with basic approach")
                return reddit_instance
            except Exception as basic_e:
                logger.error(f"Basic initialization also failed: {str(basic_e)}")
                return None
    except Exception as e:
        logger.error(f"Unexpected error in create_reddit_instance: {str(e)}")
        return None

def get_reddit_instance():
    """
    Initialize or return the global Reddit instance.
    Returns None if initialization fails.
    """
    global reddit, LAST_REDDIT_INIT
    import sys
    
    try:
        # Determine if we're running as an executable
        is_frozen = getattr(sys, 'frozen', False)
        
        # If running as executable or if it's been a while since last init, always reinitialize
        current_time = time.time()
        time_since_last_init = current_time - LAST_REDDIT_INIT if LAST_REDDIT_INIT > 0 else float('inf')
        
        if reddit is None or is_frozen or time_since_last_init > 300:  # 5 minutes
            logger.info("Initializing new Reddit instance")
            
            # Load credentials from the credentials file
            credentials = load_credentials()
            
            # Log credentials state (without actual values)
            logger.info(f"Credentials loaded from file: client_id present: {bool(credentials.get('client_id'))}, "
                       f"client_secret present: {bool(credentials.get('client_secret'))}")
            
            # If credentials are missing, try to get them from the settings file
            if not credentials or not credentials.get('client_id') or not credentials.get('client_secret'):
                logger.info("Credentials not found in credentials file, checking settings file")
                try:
                    # Import settings module
                    from settings import load_settings
                    
                    # Get settings from the settings file
                    settings_response = load_settings()
                    settings_data = settings_response.json
                    
                    if settings_data and 'settings' in settings_data:
                        settings = settings_data['settings']
                        
                        # Check for credentials in different formats
                        if settings.get('redditClientId') and settings.get('redditClientSecret'):
                            # Direct properties format
                            credentials = {
                                'client_id': settings.get('redditClientId', '').strip(),
                                'client_secret': settings.get('redditClientSecret', '').strip(),
                                'user_agent': 'Goon/1.0'  # Always use hardcoded user agent
                            }
                            logger.info("Found Reddit credentials in settings file (direct properties)")
                        elif settings.get('redditCredentials') and \
                             isinstance(settings.get('redditCredentials'), dict) and \
                             settings['redditCredentials'].get('client_id') and \
                             settings['redditCredentials'].get('client_secret'):
                            # Nested object format
                            credentials = {
                                'client_id': settings['redditCredentials'].get('client_id', '').strip(),
                                'client_secret': settings['redditCredentials'].get('client_secret', '').strip(),
                                'user_agent': 'Goon/1.0'  # Always use hardcoded user agent
                            }
                            logger.info("Found Reddit credentials in settings file (redditCredentials object)")
                        
                        # If credentials were found in settings, save them to the credentials file
                        if credentials and credentials.get('client_id') and credentials.get('client_secret'):
                            from credentials import save_credentials
                            save_credentials(credentials)
                            logger.info("Saved Reddit credentials from settings file to credentials file")
                except Exception as settings_e:
                    logger.error(f"Error getting credentials from settings: {str(settings_e)}")
            
            # Check if credentials are valid
            if not credentials or not credentials.get('client_id') or not credentials.get('client_secret'):
                logger.warning("Missing or invalid Reddit API credentials after checking all sources")
                return None
            
            # Create a new Reddit instance using our helper function
            # Pass the entire credentials dictionary to the create_reddit_instance function
            reddit = create_reddit_instance(credentials)
            
            if reddit:
                # Update the last initialization timestamp
                LAST_REDDIT_INIT = current_time
                logger.info("Reddit API client successfully initialized")
                return reddit
            else:
                logger.error("Failed to create Reddit instance")
                return None
        else:
            logger.info("Using existing Reddit instance")
            return reddit
    
    except Exception as e:
        logger.error(f"Unexpected error in get_reddit_instance: {str(e)}")
        return None

def get_reddit_content(favorites, punishments, timer_seconds, metronome_speed, use_punishment=False, punishments_enabled=True):
    """
    Get content from Reddit based on user preferences.
    Returns a JSON response with content information.
    """
    global reddit
    
    try:
        # Log the request parameters (without sensitive info)
        logger.info(f"Getting Reddit content. Favorites count: {len(favorites) if favorites else 0}, "
                   f"Punishments count: {len(punishments) if punishments else 0}, "
                   f"Timer: {timer_seconds}s, Use punishment: {use_punishment}")
        
        # Always reinitialize Reddit instance to ensure fresh credentials
        reddit = get_reddit_instance()
        
        # Log the Reddit instance state
        if reddit is None:
            logger.error("Failed to initialize Reddit client - check credentials")
            # Try to load credentials directly for debugging
            credentials = load_credentials()
            
            # Check if credentials exist but might be invalid
            has_credentials = bool(credentials)
            has_client_id = bool(credentials.get('client_id'))
            has_client_secret = bool(credentials.get('client_secret'))
            
            logger.info(f"Debug - Credentials present: {has_credentials}, "
                       f"client_id present: {has_client_id}, "
                       f"client_secret present: {has_client_secret}")
            
            # Provide a more helpful error message based on the state of credentials
            error_message = "Failed to initialize Reddit client"
            
            if not has_credentials:
                error_message += " - No credentials found"
            elif not has_client_id or not has_client_secret:
                error_message += " - Incomplete credentials (missing client ID or secret)"
            else:
                error_message += " - Credentials may be invalid"
                
            # Add instructions for the user
            error_message += ". Please check your Reddit API credentials in Settings."
            
            return jsonify({
                'error': error_message,
                'status': 'error',
                'debug_info': {
                    'has_credentials': has_credentials,
                    'has_client_id': has_client_id,
                    'has_client_secret': has_client_secret
                }
            }), 500
        
        # Handle string inputs (convert to list of dictionaries)
        if isinstance(favorites, str):
            favorites = [{'name': favorites, 'enabled': True}]
        if isinstance(punishments, str):
            punishments = [{'name': punishments, 'enabled': True}]
            
        # Ensure favorites and punishments are lists
        if not isinstance(favorites, list):
            favorites = []
        if not isinstance(punishments, list):
            punishments = []
        
        # Determine which list to use based on use_punishment flag
        if use_punishment and punishments_enabled and punishments:
            # Use punishments list
            subreddits_list = punishments
            logger.info(f"Using punishments list with {len(punishments)} items")
        else:
            # Use favorites list
            subreddits_list = favorites
            logger.info(f"Using favorites list with {len(favorites)} items")
        
        # Filter out disabled subreddits (handle both dictionary and string items)
        enabled_subreddits = []
        for s in subreddits_list:
            if isinstance(s, dict) and s.get('enabled', True):
                enabled_subreddits.append(s)
            elif isinstance(s, str):
                enabled_subreddits.append({'name': s, 'enabled': True})
        logger.info(f"Found {len(enabled_subreddits)} enabled subreddits")
        
        if not enabled_subreddits:
            return jsonify({
                'error': 'No enabled subreddits available. Please enable some subreddits.'
            }), 400
        
        # Select a random subreddit from the enabled ones
        selected = random.choice(enabled_subreddits)
        selected_sub = selected.get('name', '').strip()
        logger.info(f"Selected subreddit: {selected_sub}")
        
        if not selected_sub:
            return jsonify({
                'error': 'Invalid subreddit selected. Please check your subreddits list.'
            }), 400
        
        # Clean the subreddit name (remove r/ prefix if present)
        clean_sub = clean_subreddit_name(selected_sub)
        logger.info(f"Cleaned subreddit name: {clean_sub}")
        
        if not clean_sub:
            return jsonify({
                'error': f'Invalid subreddit name: {selected_sub}. Please check your subreddits list.'
            }), 400
        
        # Get the subreddit and submissions (with caching)
        submissions = []
        try:
            # Check if we have cached content for this subreddit
            current_time = time.time()
            cache_hit = False
            
            if clean_sub in reddit_cache:
                cache_entry = reddit_cache[clean_sub]
                cache_age = current_time - cache_entry['last_updated']
                cache_expiration = cache_entry.get('expiration', CACHE_EXPIRATION)
                
                # Use cache if it's not expired
                if cache_age < cache_expiration and cache_entry['submissions']:
                    submissions = cache_entry['submissions']
                    logger.info(f"Using cached {len(submissions)} submissions for r/{clean_sub}, age: {cache_age:.1f} seconds, expires in {(cache_expiration-cache_age)/60:.1f} minutes")
                    cache_hit = True
                    
                    # Refresh cache in the background if it's getting old (over 75% of expiration time)
                    if cache_age > (cache_expiration * 0.75):
                        logger.info(f"Cache for r/{clean_sub} is getting old, will refresh on next request")
                        # We don't actually refresh here to avoid API call on this request
                        # Just mark it as expired so next request will refresh
            
            # If no cache hit, fetch from Reddit API
            if not cache_hit:
                logger.info(f"Cache miss for r/{clean_sub}, fetching from Reddit API")
                subreddit = reddit.subreddit(clean_sub)
                logger.info(f"Successfully accessed subreddit: r/{clean_sub}")
                
                # Use a smarter approach to fetching submissions
                # First try hot submissions (most efficient API call)
                submissions = list(subreddit.hot(limit=30))
                submission_type = 'hot'
                logger.info(f"Got {len(submissions)} hot submissions from r/{clean_sub}")
                
                # Only make additional API calls if we really need to
                if len(submissions) < MIN_SUBMISSIONS_THRESHOLD:
                    # Decide randomly between new and top to add variety while reducing API calls
                    if random.random() < 0.5:
                        logger.info(f"Not enough hot submissions for r/{clean_sub}, trying new")
                        new_submissions = list(subreddit.new(limit=20))  # Reduced limit to save API calls
                        submissions.extend(new_submissions)
                        submission_type = 'hot+new'
                        logger.info(f"Added {len(new_submissions)} new submissions")
                    else:
                        logger.info(f"Not enough hot submissions for r/{clean_sub}, trying top")
                        top_submissions = list(subreddit.top(limit=20))  # Reduced limit to save API calls
                        submissions.extend(top_submissions)
                        submission_type = 'hot+top'
                        logger.info(f"Added {len(top_submissions)} top submissions")
                
                # Update the cache with appropriate expiration based on result quality
                cache_expiration = CACHE_EXPIRATION if len(submissions) >= MIN_SUBMISSIONS_THRESHOLD else CACHE_EXPIRATION_EMPTY
                
                # Manage cache size - remove oldest entry if we're at the limit
                if len(reddit_cache) >= MAX_CACHE_ENTRIES:
                    oldest_sub = None
                    oldest_time = float('inf')
                    for sub, data in reddit_cache.items():
                        if data['last_updated'] < oldest_time:
                            oldest_time = data['last_updated']
                            oldest_sub = sub
                    if oldest_sub:
                        logger.info(f"Removing oldest cache entry for r/{oldest_sub}")
                        del reddit_cache[oldest_sub]
                
                # Store in cache
                reddit_cache[clean_sub] = {
                    'submissions': submissions,
                    'last_updated': current_time,
                    'type': submission_type,
                    'expiration': cache_expiration
                }
                logger.info(f"Updated cache for r/{clean_sub} with {len(submissions)} submissions, expires in {cache_expiration/60:.1f} minutes")
        except Exception as e:
            logger.error(f"Error accessing subreddit r/{clean_sub}: {str(e)}")
            return jsonify({
                'error': f'Error accessing subreddit r/{clean_sub}: {str(e)}'
            }), 500
        
        # Filter out stickied posts and self posts
        filtered_submissions = [s for s in submissions if not s.stickied and not s.is_self]
        logger.info(f"Filtered to {len(filtered_submissions)} suitable submissions")
        
        if not filtered_submissions:
            logger.warning(f"No suitable submissions found for r/{clean_sub}")
            return jsonify({
                'error': f'No suitable content found in r/{clean_sub}. Please try again or select a different subreddit.'
            }), 404
        
        # Select a random submission
        random_post = random.choice(filtered_submissions)
        logger.info(f"Selected random post: {random_post.title[:50]}...")
        
        # Handle gallery posts
        gallery_images = []
        post_url = ""
        try:
            if hasattr(random_post, 'is_gallery') and random_post.is_gallery:
                logger.info(f"Post is a gallery, extracting images")
                # Extract images from gallery
                if hasattr(random_post, 'media_metadata'):
                    for media_id, media_item in random_post.media_metadata.items():
                        if media_item['e'] == 'Image':
                            if 's' in media_item and 'u' in media_item['s']:
                                gallery_images.append(media_item['s']['u'])
                
                logger.info(f"Extracted {len(gallery_images)} images from gallery")
                
                # For gallery posts with images, we'll send all images to the frontend
                # but still set post_url to the first image or original URL for backward compatibility
                if gallery_images:
                    post_url = gallery_images[0]  # Use first image as main post_url for backward compatibility
                    logger.info(f"Using first gallery image as main URL: {post_url}")
                else:
                    # Fallback to the post URL if we couldn't extract gallery images
                    post_url = random_post.url
                    logger.info(f"Couldn't extract gallery images, using post URL: {post_url}")
            else:
                # Not a gallery, use the post URL directly
                post_url = random_post.url
                logger.info(f"Using direct post URL: {post_url}")
                
            # Handle special cases for certain domains
            if 'imgur.com' in post_url and not any(post_url.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm']):
                # Add .jpg extension to Imgur URLs without an extension
                if not post_url.endswith('/'):
                    post_url += '.jpg'
                    logger.info(f"Added .jpg extension to Imgur URL: {post_url}")
            
            # Determine if this is a punishment based on the subreddit
            # First check if the selected subreddit is in the punishments list
            is_punishment = False
            
            # Check if the selected subreddit is in the punishments list
            # This handles both object format and string format
            if isinstance(punishments, list):
                # If punishments is a list of objects with 'name' property
                if punishments and isinstance(punishments[0], dict) and 'name' in punishments[0]:
                    is_punishment = any(p.get('name') == selected_sub for p in punishments)
                # If punishments is a list of strings
                else:
                    is_punishment = selected_sub in punishments
        
            # Handle the punishment flag correctly
            # If use_punishment is true (we're in punishment mode) but there are no punishment subreddits,
            # we should not mark content as punishment even if use_punishment is true
            if use_punishment:
                # Only mark as punishment if we actually selected a punishment subreddit
                # or if we have no punishment subreddits at all (in which case, don't override)
                if len(punishments) > 0:
                    is_punishment = is_punishment  # Keep the original determination based on the selected subreddit
                else:
                    # If there are no punishment subreddits, don't mark as punishment
                    is_punishment = False
            
            logger.info(f"Returning Reddit content, is_punishment={is_punishment}")
            
            # Log gallery information for debugging
            is_gallery = hasattr(random_post, 'is_gallery') and random_post.is_gallery
            logger.info(f"Is gallery post: {is_gallery}")
            logger.info(f"Gallery images count: {len(gallery_images) if gallery_images else 0}")
            logger.info(f"Gallery images: {gallery_images[:3]}{'...' if len(gallery_images) > 3 else ''}")
            
            # Prepare response data
            response_data = {
                'source': 'reddit',
                'post_url': post_url,  # Use the first image URL for backward compatibility
                'post_title': random_post.title if hasattr(random_post, 'title') else '',
                'is_gallery': is_gallery,
                'gallery_image_count': len(gallery_images) if gallery_images else 0,
                'gallery_images': gallery_images if gallery_images else [],  # Send all gallery images to frontend
                'subreddit': selected_sub,
                'timer_seconds': timer_seconds,
                'metronome_speed': metronome_speed,
                'isPunishment': is_punishment
            }
            
            logger.info(f"Sending response with keys: {list(response_data.keys())}")
            return jsonify(response_data)
        except Exception as e:
            logger.error(f'Error processing Reddit content: {str(e)}')
            return jsonify({
                'error': 'Error processing Reddit content', 
                'message': str(e),
                'details': 'Error occurred while processing the selected post.'
            }), 500
    except Exception as e:
        logger.error(f"Unexpected error in get_reddit_content: {str(e)}")
        return jsonify({
            'error': f'Unexpected error: {str(e)}'
        }), 500

def update_credentials(request):
    """
    Update Reddit API credentials.
    Returns a JSON response indicating success or failure.
    """
    global reddit
    
    data = request.json
    if not data:
        return jsonify({'error': 'Invalid request data'}), 400
    
    # Validate credentials
    client_id = data.get('client_id', '').strip()
    client_secret = data.get('client_secret', '').strip()
    user_agent = data.get('user_agent', 'Goon/1.0').strip()
    
    # Check if this is a reset request (both fields empty)
    is_reset = not client_id and not client_secret
    
    # Only validate non-reset requests
    if not is_reset and (not client_id or not client_secret):
        return jsonify({'error': 'Client ID and Client Secret are required'}), 400
    
    # Save credentials
    credentials = {
        'client_id': client_id,
        'client_secret': client_secret,
        'user_agent': user_agent
    }
    
    # Log the credential update attempt (without showing the actual values)
    logger.info(f"Updating Reddit credentials - client_id present: {bool(client_id)}, "
               f"client_secret present: {bool(client_secret)}")
    
    # Save credentials to all possible locations
    success = save_credentials(credentials)
    
    # Force the global Reddit instance to be reinitialized on next use
    global LAST_REDDIT_INIT
    LAST_REDDIT_INIT = 0  # Reset the timestamp to force reinitialization
    
    if success:
        # For reset case, just set reddit to None
        if is_reset:
            reddit = None
            logger.info("Reddit API credentials reset successfully")
            return jsonify({'success': True, 'message': 'Credentials reset successfully'})
        
        # For normal case, reinitialize the Reddit API client with the new credentials
        try:
            # Validate and prepare credentials
            default_user_agent = 'Goon/1.0'
            
            # Clean and validate credentials
            client_id = str(client_id).strip()
            client_secret = str(client_secret).strip()
            user_agent = str(user_agent).strip() if user_agent else default_user_agent
            
            # Check for empty credentials
            if not client_id or not client_secret:
                return jsonify({'error': 'Invalid credentials provided'}), 400
                
            # Ensure user_agent is never empty
            if not user_agent:
                user_agent = default_user_agent
            
            # Create Reddit instance using our wrapper class that handles _NotSet errors
            try:
                # Use a safer approach for PyInstaller environment
                # Create a minimal set of parameters to avoid _NotSet issues
                reddit_params = {
                    'client_id': client_id,
                    'client_secret': client_secret,
                    'user_agent': user_agent
                }
                
                # Initialize with our custom wrapper class
                reddit = Reddit(**reddit_params)
                
                # Test the connection to ensure it works
                # This is a simple test that doesn't require authentication
                # but will fail if the Reddit instance isn't properly initialized
                try:
                    # Just access a property to test if the instance is valid
                    # This won't make any API calls but will verify the instance is working
                    _ = reddit.read_only
                    logger.info("Reddit API client successfully initialized and tested")
                except Exception as test_e:
                    logger.warning(f"Reddit instance created but failed validation test: {test_e}")
                    # Continue anyway since the instance was created
                
            except Exception as e:
                logger.error(f"Error creating Reddit instance: {e}")
                # Try one more time with absolute minimal parameters
                try:
                    reddit = Reddit(client_id=client_id, client_secret=client_secret, user_agent='Goon/1.0')
                    logger.info("Reddit API client initialized with minimal parameters")
                except Exception as retry_e:
                    logger.error(f"Final attempt to create Reddit instance failed: {retry_e}")
                    return jsonify({'error': f'Failed to initialize Reddit API: {str(e)}'}), 500
                
            logger.info("Reddit API client reinitialized with new credentials")
            return jsonify({'success': True, 'message': 'Credentials updated successfully'})
        except Exception as e:
            logger.error(f"Error initializing Reddit API with new credentials: {str(e)}")
            return jsonify({'error': f'Credentials saved but failed to initialize Reddit API: {str(e)}'}), 500
    else:
        return jsonify({'error': 'Failed to save credentials'}), 500
