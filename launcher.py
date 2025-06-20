import os
import sys
import webbrowser
import threading
import time
import shutil
import json
import logging
from pathlib import Path
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import app after setting up environment
import app as app_module
from app import app

def resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

def open_browser():
    """Open browser after a short delay"""
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5000')

def find_previous_settings():
    """Find settings files from previous installations"""
    potential_locations = []
    
    # Check if we're running as executable or script
    is_frozen = getattr(sys, 'frozen', False)
    
    # Current directory or executable directory
    base_dir = os.path.dirname(sys.executable) if is_frozen else os.path.abspath('.')
    potential_locations.append(os.path.join(base_dir, 'user_settings.json'))
    
    # Parent directory (in case the app was updated to a new folder)
    parent_dir = os.path.dirname(base_dir)
    potential_locations.append(os.path.join(parent_dir, 'user_settings.json'))
    
    # Common application directories
    if is_frozen:
        # Windows: Check AppData folders
        if os.name == 'nt':
            appdata = os.environ.get('APPDATA')
            if appdata:
                potential_locations.append(os.path.join(appdata, 'Goon', 'user_settings.json'))
                potential_locations.append(os.path.join(appdata, 'Goon', 'user_settings.json'))
        
        # Check user's home directory
        home_dir = os.path.expanduser('~')
        potential_locations.append(os.path.join(home_dir, '.goon_settings.json'))
        potential_locations.append(os.path.join(home_dir, 'Goon', 'user_settings.json'))
    
    # Look for settings in all potential locations
    found_settings = []
    for location in potential_locations:
        if os.path.exists(location) and os.path.isfile(location):
            try:
                with open(location, 'r') as f:
                    settings = json.load(f)
                    # Verify it's a valid settings file by checking for essential keys
                    if isinstance(settings, dict) and 'contentSource' in settings:
                        found_settings.append({
                            'path': location,
                            'settings': settings,
                            'modified': os.path.getmtime(location)
                        })
                        logger.info(f"Found settings file: {location}")
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Error reading potential settings file {location}: {e}")
    
    # Sort by modification time (newest first)
    found_settings.sort(key=lambda x: x['modified'], reverse=True)
    return found_settings

def migrate_settings(settings, current_version="1.0"):
    """Migrate settings from older versions to current format"""
    # Make a copy to avoid modifying the original
    migrated = settings.copy()
    
    # Add version if not present
    if 'version' not in migrated:
        migrated['version'] = current_version
    
    # Add lastUpdated if not present
    if 'lastUpdated' not in migrated:
        migrated['lastUpdated'] = datetime.now().isoformat()
    
    # Default required keys with their default values
    required_keys = {
        "favorites": [],
        "punishments": [],
        "favoritesCompletedCount": 0,
        "punishmentsCompletedCount": 0,
        "timerMin": "30",
        "timerMax": "120",
        "metronomeSpeed": 60,
        "metronomeSound": "default",
        "metronomeVolume": 0.7,
        "contentSource": "reddit",
        "punishmentsEnabled": False,
        "autoCycleEnabled": True,
        "enabledContentFolders": [],
        "enabledPunishmentFolders": []
    }
    
    for key, default_value in required_keys.items():
        if key not in migrated:
            migrated[key] = default_value
    
    # Update version and lastUpdated
    migrated['version'] = current_version
    migrated['lastUpdated'] = datetime.now().isoformat()
    
    return migrated

def ensure_user_content_folders():
    """Create user content folders if they don't exist"""
    # Determine base directory (executable dir if frozen, current dir if not)
    base_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.abspath('.')
    
    # Create a user_content directory next to the executable
    user_content_dir = os.path.join(base_dir, 'user_content')
    os.makedirs(user_content_dir, exist_ok=True)
    
    # Create subdirectories for custom content and punishment
    custom_content_dir = os.path.join(user_content_dir, 'custom_content')
    custom_punishment_dir = os.path.join(user_content_dir, 'custom_punishment')
    os.makedirs(custom_content_dir, exist_ok=True)
    os.makedirs(custom_punishment_dir, exist_ok=True)
    
    # Create a README file explaining how to use these folders
    readme_path = os.path.join(user_content_dir, 'README.txt')
    if not os.path.exists(readme_path):
        with open(readme_path, 'w') as f:
            f.write("""Goon Custom Content

Place your custom content in these folders:

1. custom_content - For regular content
2. custom_punishment - For punishment content

Supported file types: jpg, jpeg, png, gif, mp4, webm

The app will automatically detect new content when you refresh the folders in settings.
""")
    
    return user_content_dir

def ensure_sound_files():
    """Ensure metronome sound files are available at runtime"""
    logger.info("Checking metronome sound files...")
    
    # Determine base directory for static files
    if getattr(sys, 'frozen', False):
        # If running as executable, use the _MEIPASS directory
        try:
            base_path = sys._MEIPASS
        except Exception:
            base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.abspath('.')
    
    # Define paths for sound files
    static_dir = os.path.join(base_path, 'static')
    sounds_dir = os.path.join(static_dir, 'sounds')
    
    # Create sounds directory if it doesn't exist
    os.makedirs(sounds_dir, exist_ok=True)
    
    # Check if default metronome sound exists in the static root directory
    # This is the original location referenced in timer.js (/static/metronome.wav)
    default_sound = os.path.join(static_dir, 'metronome.wav')
    if not os.path.exists(default_sound):
        logger.warning(f"Default metronome sound not found at {default_sound}")
    else:
        logger.info(f"Found default metronome sound at {default_sound}")
    
    # List of additional metronome sounds in the sounds directory
    sound_files = [
        'metronome-click.mp3',
        'metronome-beep.mp3',
        'metronome-soft.mp3',
        'metronome-wood.mp3'
    ]
    
    # Check if each sound file exists
    for sound_file in sound_files:
        sound_path = os.path.join(sounds_dir, sound_file)
        if os.path.exists(sound_path):
            logger.info(f"Found metronome sound: {sound_file}")
        else:
            logger.warning(f"Metronome sound not found: {sound_file}")
    
    return sounds_dir

if __name__ == '__main__':
    # Set the working directory to the executable's directory
    if getattr(sys, 'frozen', False):
        os.chdir(os.path.dirname(sys.executable))
    
    # Create user content folders
    user_content_dir = ensure_user_content_folders()
    
    # Ensure sound files are available
    sounds_dir = ensure_sound_files()
    
    # Update app configuration to use these folders
    app_module.APP_ROOT = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.abspath('.')
    app_module.USER_CONTENT_DIR = user_content_dir
    
    # Set up settings file path
    settings_file = os.path.join(app_module.APP_ROOT, 'user_settings.json')
    
    # Look for previous settings before creating a new one
    previous_settings = find_previous_settings()
    
    # If settings file doesn't exist in current location but we found previous settings
    if not os.path.exists(settings_file) and previous_settings:
        logger.info(f"Found {len(previous_settings)} previous settings files. Using most recent from: {previous_settings[0]['path']}")
        
        # Migrate the settings to the current version
        migrated_settings = migrate_settings(previous_settings[0]['settings'])
        
        # Try to save the migrated settings to the current location
        try:
            with open(settings_file, 'w') as f:
                json.dump(migrated_settings, f, indent=2)
            print(f"Migrated settings from previous installation to {settings_file}")
            logger.info(f"Successfully migrated settings from {previous_settings[0]['path']} to {settings_file}")
        except Exception as e:
            logger.error(f"Error saving migrated settings to {settings_file}: {str(e)}")
            # If we can't write to the executable directory, try user_content_dir instead
            alternative_settings_file = os.path.join(user_content_dir, 'user_settings.json')
            try:
                with open(alternative_settings_file, 'w') as f:
                    json.dump(migrated_settings, f, indent=2)
                # Update the app to use this location
                app_module.USER_SETTINGS_FILE = alternative_settings_file
                print(f"Migrated settings saved to user content directory: {alternative_settings_file}")
                logger.info(f"Migrated settings saved to alternative location: {alternative_settings_file}")
            except Exception as e2:
                logger.error(f"Error saving migrated settings to alternative location: {str(e2)}")
    
    # If no settings file exists and no previous settings were found, create default
    elif not os.path.exists(settings_file) and not previous_settings:
        # Create default settings file
        try:
            with open(settings_file, 'w') as f:
                json.dump(app_module.default_user_settings, f, indent=2)
            print(f"Created default settings file at {settings_file}")
            logger.info(f"Created default settings file at {settings_file}")
        except Exception as e:
            logger.error(f"Error creating settings file: {str(e)}")
            # If we can't write to the executable directory, try user_content_dir instead
            alternative_settings_file = os.path.join(user_content_dir, 'user_settings.json')
            try:
                with open(alternative_settings_file, 'w') as f:
                    json.dump(app_module.default_user_settings, f, indent=2)
                # Update the app to use this location
                app_module.USER_SETTINGS_FILE = alternative_settings_file
                print(f"Created default settings file in user content directory: {alternative_settings_file}")
                logger.info(f"Created default settings file in alternative location: {alternative_settings_file}")
            except Exception as e2:
                logger.error(f"Error creating alternative settings file: {str(e2)}")
    else:
        logger.info(f"Using existing settings file at {settings_file}")
        
        # Check if the existing settings need migration (version check)
        try:
            with open(settings_file, 'r') as f:
                current_settings = json.load(f)
            
            # Check if settings need migration (missing keys or old version)
            if 'version' not in current_settings or current_settings.get('version') != app_module.SETTINGS_VERSION:
                logger.info(f"Migrating existing settings file to current version")
                migrated_settings = migrate_settings(current_settings, app_module.SETTINGS_VERSION)
                
                # Save the migrated settings
                with open(settings_file, 'w') as f:
                    json.dump(migrated_settings, f, indent=2)
                logger.info(f"Successfully migrated existing settings to version {app_module.SETTINGS_VERSION}")
        except Exception as e:
            logger.error(f"Error checking/migrating existing settings: {str(e)}")
            # Continue with the existing file even if migration failed
    
    # Ensure the templates and static folders are found
    if getattr(sys, 'frozen', False):
        template_folder = resource_path('templates')
        static_folder = resource_path('static')
        app.template_folder = template_folder
        app.static_folder = static_folder
    
    # Open browser automatically
    threading.Thread(target=open_browser).start()
    
    # Start the Flask app
    print("Starting Goon...")
    print("Opening browser automatically. If it doesn't open, go to: http://127.0.0.1:5000")
    # Use 127.0.0.1 instead of localhost for consistency
    app.run(host='127.0.0.1', debug=False)
