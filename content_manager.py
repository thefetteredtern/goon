"""
Content management for the Goon application.
Handles fetching content from various sources and managing content folders.
"""
import os
import random
import time
import logging
from flask import jsonify, request

from utils import get_application_path
from reddit_wrapper import get_reddit_content

# Get logger
logger = logging.getLogger(__name__)

# Application root path
APP_ROOT = get_application_path()

# This will be overridden by launcher.py when running as an executable
USER_CONTENT_DIR = None

# Cache for folder data
folder_cache = {
    'content_folders': [],
    'punishment_folders': [],
    'last_updated': 0
}

def get_content():
    """
    Get content based on user preferences.
    Returns content from either Reddit or custom folders.
    """
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Invalid request data'}), 400
        
        # Extract parameters
        content_source = data.get('contentSource', 'reddit')
        subreddits = data.get('subreddits', {'favorites': [], 'punishments': []})
        enabled_folders = data.get('enabledFolders', {'content': [], 'punishment': []})
        timer_min = int(data.get('timerMin', 30))
        timer_max = int(data.get('timerMax', 120))
        
        # Get content history to avoid repeats
        content_history = data.get('contentHistory', [])
        
        # Check if punishments are enabled
        punishments_enabled = data.get('punishmentsEnabled', True)
        logger.info(f"Punishments enabled: {punishments_enabled}")
        
        # Generate random timer duration
        timer_seconds = random.randint(timer_min, timer_max)
        
        # Generate random metronome speed (BPM)
        metronome_speed = random.randint(40, 120)
        
        # Get content based on source
        favorites = subreddits.get('favorites', [])
        punishments = subreddits.get('punishments', [])
        
        logger.info(f"Content request: source={content_source}, favorites={len(favorites)}, punishments={len(punishments)}")
        logger.info(f"Enabled folders: content={enabled_folders.get('content', [])}, punishment={enabled_folders.get('punishment', [])}")
        
        # Only initialize the Reddit instance if it's not already initialized
        # or if it's been more than 30 minutes since the last initialization
        if content_source == 'reddit' or content_source == 'mixed':
            # Import here to avoid circular imports
            from reddit_wrapper import get_reddit_instance, reddit, LAST_REDDIT_INIT
            
            current_time = time.time()
            # Check if we need to reinitialize (only do this every 30 minutes)
            if reddit is None or (current_time - LAST_REDDIT_INIT) > 1800:  # 30 minutes
                # Reinitialize Reddit instance
                reddit = get_reddit_instance()
                logger.info("Reinitialized Reddit API client")
            else:
                logger.info("Using existing Reddit API client")
        
        if content_source == 'reddit':
            # Only use punishment if enabled in settings
            if punishments_enabled:
                # Randomly choose between favorites and punishments with 80/20 weighting
                use_punishment = random.random() < 0.2  # 20% chance for punishment
            else:
                # Punishments disabled, always use favorites
                use_punishment = False
                
            logger.info(f"Reddit content selected, use_punishment={use_punishment}")
            # Import here to avoid circular imports
            from reddit_wrapper import get_reddit_content
            return get_reddit_content(favorites, punishments, timer_seconds, metronome_speed, use_punishment=use_punishment, punishments_enabled=punishments_enabled)
        elif content_source == 'custom':
            # Only use punishment if enabled in settings
            if punishments_enabled:
                # Randomly choose between content and punishment with 80/20 weighting
                use_punishment = random.random() < 0.2  # 20% chance for punishment
            else:
                # Punishments disabled, always use regular content
                use_punishment = False
                
            logger.info(f"Custom content selected, use_punishment={use_punishment}")
            return get_custom_content(timer_seconds, metronome_speed, 
                                    is_punishment=use_punishment, 
                                    enabled_folders=enabled_folders,
                                    content_history=content_history)
        elif content_source == 'mixed':
            # Randomly select between reddit and custom
            use_reddit = random.choice([True, False])
            
            # Only use punishment if enabled in settings
            if punishments_enabled:
                # Use weighted selection for punishment (80% regular, 20% punishment)
                use_punishment = random.random() < 0.2  # 20% chance for punishment
            else:
                # Punishments disabled, always use regular content
                use_punishment = False
                
            logger.info(f"Mixed content selected, use_reddit={use_reddit}, use_punishment={use_punishment}")
            
            if use_reddit:
                # Import here to avoid circular imports
                from reddit_wrapper import get_reddit_content
                return get_reddit_content(favorites, punishments, timer_seconds, metronome_speed, use_punishment=use_punishment, punishments_enabled=punishments_enabled)
            else:
                return get_custom_content(timer_seconds, metronome_speed, 
                                        is_punishment=use_punishment, 
                                        enabled_folders=enabled_folders,
                                        content_history=content_history)
        else:
            return jsonify({'error': f'Invalid content source: {content_source}'}), 400
    except Exception as e:
        logger.error(f"Error in get_content: {str(e)}")
        return jsonify({'error': f'Error getting content: {str(e)}'}), 500

def get_custom_content(timer_seconds, metronome_speed, is_punishment=False, enabled_folders=None, content_history=None):
    """
    Get content from custom folders.
    Returns a JSON response with content information.
    """
    if enabled_folders is None:
        enabled_folders = []
        
    if content_history is None:
        content_history = []
    
    # If enabled_folders is a dictionary, extract the appropriate list
    if isinstance(enabled_folders, dict):
        if is_punishment:
            enabled_folders = enabled_folders.get('punishment', [])
        else:
            enabled_folders = enabled_folders.get('content', [])
    
    logger.info(f"Using enabled folders: {enabled_folders}")
    
    try:
        # Check if we're running as an executable
        import sys
        is_frozen = getattr(sys, 'frozen', False)
        
        # Determine which content directories to use
        content_dirs = []
        
        # When running as an executable, first check the user_content directory next to the executable
        if is_frozen:
            # Get the executable directory
            exe_dir = os.path.dirname(sys.executable)
            exe_user_content_dir = os.path.join(exe_dir, 'user_content')
            
            # Add the directory next to the executable
            if os.path.exists(exe_user_content_dir):
                content_dirs.append(os.path.join(
                    exe_user_content_dir,
                    'custom_punishment' if is_punishment else 'custom_content'
                ))
                logger.info(f"Added content directory next to executable: {exe_user_content_dir}")
        
        # Check the USER_CONTENT_DIR set by the launcher
        if USER_CONTENT_DIR and os.path.exists(USER_CONTENT_DIR):
            # When running as an executable, use the user_content directory
            content_dirs.append(os.path.join(
                USER_CONTENT_DIR, 
                'custom_punishment' if is_punishment else 'custom_content'
            ))
            logger.info(f"Added user content directory: {USER_CONTENT_DIR}")
        
        # Always check the static directory as a fallback
        static_dir = os.path.join(
            APP_ROOT, 
            'static', 
            'custom_punishment' if is_punishment else 'custom_content'
        )
        content_dirs.append(static_dir)
        logger.info(f"Added static directory: {static_dir}")
        
        # Log all directories we're checking
        logger.info(f"Checking these content directories: {content_dirs}")
        
        # Find the first directory that exists
        base_dir = None
        for dir_path in content_dirs:
            if os.path.exists(dir_path):
                base_dir = dir_path
                logger.info(f"Using content directory: {base_dir}")
                break
        
        # If no directory exists, use the first one and try to create it
        if base_dir is None and content_dirs:
            base_dir = content_dirs[0]
            try:
                os.makedirs(base_dir, exist_ok=True)
                logger.info(f"Created content directory: {base_dir}")
            except Exception as e:
                logger.error(f"Failed to create content directory {base_dir}: {str(e)}")
                # Try the next directory
                if len(content_dirs) > 1:
                    base_dir = content_dirs[1]
                    try:
                        os.makedirs(base_dir, exist_ok=True)
                        logger.info(f"Created fallback content directory: {base_dir}")
                    except Exception as e2:
                        logger.error(f"Failed to create fallback directory {base_dir}: {str(e2)}")
                        return jsonify({
                            'error': f"Could not create any content directories"
                        }), 500
        
        # Check if directory exists
        if not os.path.exists(base_dir):
            logger.error(f"Content directory does not exist: {base_dir}")
            return jsonify({
                'error': f'{"Punishment" if is_punishment else "Content"} directory does not exist'
            }), 404
        
        # Get all folders in the directory
        folders = []
        try:
            for item in os.listdir(base_dir):
                item_path = os.path.join(base_dir, item)
                if os.path.isdir(item_path):
                    folders.append(item)
        except Exception as e:
            logger.error(f"Error listing folders in {base_dir}: {str(e)}")
            return jsonify({
                'error': f'Error listing folders: {str(e)}'
            }), 500
        
        # Filter to enabled folders if specified
        if enabled_folders:
            logger.info(f"Filtering folders {folders} to enabled folders {enabled_folders}")
            folders = [f for f in folders if f in enabled_folders]
            logger.info(f"Filtered folders: {folders}")
        
        if not folders:
            logger.error(f"No {'enabled ' if enabled_folders else ''}folders found in {base_dir}")
            return jsonify({
                'error': f'No {"enabled " if enabled_folders else ""}{"punishment" if is_punishment else "content"} folders found'
            }), 404
        
        # Select a random folder
        folder = random.choice(folders)
        folder_path = os.path.join(base_dir, folder)
        logger.info(f"Selected folder: {folder}")
        
        # Get all files in the folder
        files = []
        try:
            for item in os.listdir(folder_path):
                item_path = os.path.join(folder_path, item)
                if os.path.isfile(item_path) and item.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm')):
                    files.append(item_path)
        except Exception as e:
            logger.error(f"Error listing files in {folder_path}: {str(e)}")
            return jsonify({
                'error': f'Error listing files in {folder}: {str(e)}'
            }), 500
        
        if not files:
            logger.error(f"No suitable files found in {folder_path}")
            return jsonify({
                'error': f'No suitable files found in {folder}'
            }), 404
        
        # Filter out recently viewed files
        filtered_files = []
        recently_viewed_files = []
        
        # Extract recently viewed files from history
        for history_item in content_history:
            if history_item.get('source') == 'custom' and history_item.get('folder') == folder:
                recently_viewed_files.append(history_item.get('file'))
        
        logger.info(f"Found {len(recently_viewed_files)} recently viewed files in folder {folder}")
        
        # Filter files that haven't been viewed recently
        for file_path in files:
            file_name = os.path.basename(file_path)
            if file_name not in recently_viewed_files:
                filtered_files.append(file_path)
        
        # If we've filtered out all files, use the original list
        # This happens when all files have been viewed recently
        if not filtered_files and files:
            logger.info(f"All files in folder {folder} have been viewed recently, using original list")
            filtered_files = files
        
        logger.info(f"Found {len(filtered_files)} files that haven't been viewed recently in folder {folder}")
        
        # Select a random file from filtered list
        random_file = random.choice(filtered_files)
        logger.info(f"Selected file: {random_file}")
        
        # Determine content type
        is_video = random_file.lower().endswith(('.mp4', '.webm'))
        
        # Get folder info for display
        if folder:
            folder_info = f' from folder "{folder}"'
        else:
            folder = ''
            folder_info = ''
        logger.info(f"Folder: {folder}, Folder info: {folder_info}")
        
        # Get relative path for URL
        # When running as executable, we need to handle paths differently
        if is_frozen:
            if USER_CONTENT_DIR and random_file.startswith(USER_CONTENT_DIR):
                # For files in USER_CONTENT_DIR, use the user_content route
                # This ensures they're served correctly from the user_content directory
                rel_path = os.path.relpath(random_file, start=USER_CONTENT_DIR)
                content_url = '/user_content/' + rel_path.replace('\\', '/')
                logger.info(f"Using user_content route for file: {rel_path}")
            elif exe_user_content_dir and random_file.startswith(exe_user_content_dir):
                # For files in the exe_user_content_dir, use the user_content route as well
                rel_path = os.path.relpath(random_file, start=exe_user_content_dir)
                content_url = '/user_content/' + rel_path.replace('\\', '/')
                logger.info(f"Using user_content route for file next to executable: {rel_path}")
            else:
                # For files in the static directory, use the standard approach
                content_url = '/' + os.path.relpath(random_file, start=APP_ROOT).replace('\\', '/')
        else:
            # When not running as executable, use the standard approach
            content_url = '/' + os.path.relpath(random_file, start=APP_ROOT).replace('\\', '/')
        
        logger.info(f"Content URL: {content_url}")
        logger.info(f"APP_ROOT: {APP_ROOT}")
        logger.info(f"USER_CONTENT_DIR: {USER_CONTENT_DIR}")
        
        # Return content info
        response_data = {
            'source': 'custom',
            'content_url': content_url,
            'folder': folder,
            'file_name': os.path.basename(random_file),
            'info': f'{"Punishment" if is_punishment else "Custom content"}{folder_info}',
            'timer_seconds': timer_seconds,
            'metronome_speed': metronome_speed,
            'isPunishment': is_punishment
        }
        logger.info(f"Returning response: {response_data}")
        return jsonify(response_data)
    except Exception as e:
        logger.error(f"Error processing selected file {random_file if 'random_file' in locals() else 'unknown'}: {str(e)}")
        return jsonify({
            'error': f'Error processing selected file: {str(e)}'
        }), 500

def get_custom_folders():
    """
    Get list of custom content and punishment folders.
    Returns a JSON response with folder information.
    """
    global folder_cache
    
    # Check if we should use the cache (cache is less than 60 seconds old)
    current_time = time.time()
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    if not force_refresh and folder_cache['last_updated'] > 0 and current_time - folder_cache['last_updated'] < 60:
        logger.info(f"Using cached folder data, age: {current_time - folder_cache['last_updated']:.1f} seconds")
        return jsonify({
            'content_folders': folder_cache['content_folders'],
            'punishment_folders': folder_cache['punishment_folders'],
            'cached': True,
            'cache_age': current_time - folder_cache['last_updated']
        })
    
    # Check if we're running as an executable
    import sys
    is_frozen = getattr(sys, 'frozen', False)
    
    # Initialize lists to store potential directory paths
    content_dirs = []
    punishment_dirs = []
    
    # When running as an executable, first check the user_content directory next to the executable
    if is_frozen:
        # Get the executable directory
        exe_dir = os.path.dirname(sys.executable)
        exe_user_content_dir = os.path.join(exe_dir, 'user_content')
        
        # Add the directories next to the executable
        if os.path.exists(exe_user_content_dir):
            content_dirs.append(os.path.join(exe_user_content_dir, 'custom_content'))
            punishment_dirs.append(os.path.join(exe_user_content_dir, 'custom_punishment'))
            logger.info(f"Added content directories next to executable: {exe_user_content_dir}")
    
    # Check the USER_CONTENT_DIR set by the launcher
    if USER_CONTENT_DIR and os.path.exists(USER_CONTENT_DIR):
        # When running as an executable, use the user_content directory
        content_dirs.append(os.path.join(USER_CONTENT_DIR, 'custom_content'))
        punishment_dirs.append(os.path.join(USER_CONTENT_DIR, 'custom_punishment'))
        logger.info(f"Added user content directory: {USER_CONTENT_DIR}")
    
    # Always check the static directory as a fallback
    static_content_dir = os.path.join(APP_ROOT, 'static', 'custom_content')
    static_punishment_dir = os.path.join(APP_ROOT, 'static', 'custom_punishment')
    content_dirs.append(static_content_dir)
    punishment_dirs.append(static_punishment_dir)
    logger.info(f"Added static directories: {static_content_dir} and {static_punishment_dir}")
    
    # Log all directories we're checking
    logger.info(f"Checking these content directories: {content_dirs}")
    logger.info(f"Checking these punishment directories: {punishment_dirs}")
    
    # Find the first content directory that exists or create one
    custom_content_dir = None
    for dir_path in content_dirs:
        if os.path.exists(dir_path):
            custom_content_dir = dir_path
            logger.info(f"Using content directory: {custom_content_dir}")
            break
    
    # If no content directory exists, try to create the first one
    if custom_content_dir is None and content_dirs:
        custom_content_dir = content_dirs[0]
        try:
            os.makedirs(custom_content_dir, exist_ok=True)
            logger.info(f"Created content directory: {custom_content_dir}")
        except Exception as e:
            logger.error(f"Failed to create content directory {custom_content_dir}: {str(e)}")
            # Try the next directory
            if len(content_dirs) > 1:
                custom_content_dir = content_dirs[1]
                try:
                    os.makedirs(custom_content_dir, exist_ok=True)
                    logger.info(f"Created fallback content directory: {custom_content_dir}")
                except Exception as e2:
                    logger.error(f"Failed to create fallback content directory: {str(e2)}")
    
    # Find the first punishment directory that exists or create one
    custom_punishment_dir = None
    for dir_path in punishment_dirs:
        if os.path.exists(dir_path):
            custom_punishment_dir = dir_path
            logger.info(f"Using punishment directory: {custom_punishment_dir}")
            break
    
    # If no punishment directory exists, try to create the first one
    if custom_punishment_dir is None and punishment_dirs:
        custom_punishment_dir = punishment_dirs[0]
        try:
            os.makedirs(custom_punishment_dir, exist_ok=True)
            logger.info(f"Created punishment directory: {custom_punishment_dir}")
        except Exception as e:
            logger.error(f"Failed to create punishment directory {custom_punishment_dir}: {str(e)}")
            # Try the next directory
            if len(punishment_dirs) > 1:
                custom_punishment_dir = punishment_dirs[1]
                try:
                    os.makedirs(custom_punishment_dir, exist_ok=True)
                    logger.info(f"Created fallback punishment directory: {custom_punishment_dir}")
                except Exception as e2:
                    logger.error(f"Failed to create fallback punishment directory: {str(e2)}")
    
    # Debug: Check if directories exist
    if custom_content_dir and os.path.exists(custom_content_dir):
        logger.info(f"Content directory exists: {custom_content_dir}")
    else:
        logger.warning(f"Content directory does NOT exist or is None")
        
    if custom_punishment_dir and os.path.exists(custom_punishment_dir):
        logger.info(f"Punishment directory exists: {custom_punishment_dir}")
    else:
        logger.warning(f"Punishment directory does NOT exist or is None")

    # Get content folders
    content_folders = []
    try:
        if os.path.exists(custom_content_dir):
            for item in os.listdir(custom_content_dir):
                item_path = os.path.join(custom_content_dir, item)
                if os.path.isdir(item_path):
                    try:
                        # Count files in the folder
                        file_count = sum(1 for f in os.listdir(item_path) 
                                      if os.path.isfile(os.path.join(item_path, f)) and 
                                      f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm')))
                        
                        content_folders.append({
                            'name': item,
                            'file_count': file_count
                        })
                    except Exception as folder_e:
                        logger.error(f"Error processing content folder {item}: {str(folder_e)}")
    except Exception as e:
        logger.error(f"Error listing content folders: {str(e)}")
    
    # Get punishment folders
    punishment_folders = []
    try:
        if os.path.exists(custom_punishment_dir):
            for item in os.listdir(custom_punishment_dir):
                item_path = os.path.join(custom_punishment_dir, item)
                if os.path.isdir(item_path):
                    try:
                        # Count files in the folder
                        file_count = sum(1 for f in os.listdir(item_path) 
                                      if os.path.isfile(os.path.join(item_path, f)) and 
                                      f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm')))
                        
                        punishment_folders.append({
                            'name': item,
                            'file_count': file_count
                        })
                    except Exception as folder_e:
                        logger.error(f"Error processing punishment folder {item}: {str(folder_e)}")
    except Exception as e:
        logger.error(f"Error listing punishment folders: {str(e)}")
    
    # Update cache
    folder_cache = {
        'content_folders': content_folders,
        'punishment_folders': punishment_folders,
        'last_updated': current_time
    }
    
    # Return folder data
    return jsonify({
        'content_folders': content_folders,
        'punishment_folders': punishment_folders,
        'cached': False
    })
