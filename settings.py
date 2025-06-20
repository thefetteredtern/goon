"""
Settings management for the Goon application.
Handles loading, saving, migrating, and importing user settings.
"""
import os
import sys
import json
import logging
from datetime import datetime
from flask import jsonify, request

from utils import get_application_path
from credentials import load_credentials

# Get logger
logger = logging.getLogger(__name__)

# Application root path
APP_ROOT = get_application_path()

# Settings version for migration system
SETTINGS_VERSION = "1.1"

# Settings file paths
USER_SETTINGS_FILE = os.path.join(APP_ROOT, 'user_settings.json')
USER_SETTINGS_FALLBACK_FILE = None  # Will be set by launcher if needed

# Default user settings
default_user_settings = {
    "favorites": [],
    "punishments": [],
    "favoritesCompletedCount": 0,
    "punishmentsCompletedCount": 0,
    "timerMin": "30",
    "timerMax": "120",
    "metronomeSpeed": 60,
    "metronomeSound": "default",
    "metronomeVolume": 0.7,
    "soundEnabled": True,
    "contentSource": "reddit",
    "punishmentsEnabled": False,
    "autoCycleEnabled": True,
    "videoTimerSoftLimitEnabled": True,
    "enabledContentFolders": [],
    "enabledPunishmentFolders": [],
    "theme": "light",
    "version": SETTINGS_VERSION,
    "lastUpdated": datetime.now().isoformat()
}

def migrate_settings(settings, current_version=SETTINGS_VERSION):
    """
    Migrate settings from older versions to current format.
    Returns updated settings dictionary.
    """
    # Make a copy of the settings to avoid modifying the original
    migrated = settings.copy()
    
    # Add version if it doesn't exist
    if 'version' not in migrated:
        migrated['version'] = '0.1'  # Assume oldest version
        logger.info("Added version field to settings")
    
    # Add lastUpdated if it doesn't exist
    if 'lastUpdated' not in migrated:
        migrated['lastUpdated'] = datetime.now().isoformat()
        logger.info("Added lastUpdated field to settings")
    
    # Migrate from version 0.1 to 0.2
    if migrated.get('version') == '0.1':
        logger.info("Migrating settings from version 0.1 to 0.2")
        
        # Add new fields introduced in version 0.2
        if 'contentSource' not in migrated:
            migrated['contentSource'] = 'reddit'
        
        if 'punishmentsEnabled' not in migrated:
            migrated['punishmentsEnabled'] = False
        
        migrated['version'] = '0.2'
    
    # Migrate from version 0.2 to 0.3
    if migrated.get('version') == '0.2':
        logger.info("Migrating settings from version 0.2 to 0.3")
        
        # Add new fields introduced in version 0.3
        if 'autoCycleEnabled' not in migrated:
            migrated['autoCycleEnabled'] = True
        
        if 'videoTimerSoftLimitEnabled' not in migrated:
            migrated['videoTimerSoftLimitEnabled'] = True
        
        migrated['version'] = '0.3'
    
    # Migrate from version 0.3 to 1.0
    if migrated.get('version') == '0.3':
        logger.info("Migrating settings from version 0.3 to 1.0")
        
        # Add new fields introduced in version 1.0
        if 'enabledContentFolders' not in migrated:
            migrated['enabledContentFolders'] = []
        
        if 'enabledPunishmentFolders' not in migrated:
            migrated['enabledPunishmentFolders'] = []
        
        if 'theme' not in migrated:
            migrated['theme'] = 'light'
        
        # Rename any fields that changed
        # (None in this version, but this is where you'd handle it)
        
        migrated['version'] = '1.0'
    
    # Migrate from version 1.0 to 1.1 (adding metronome sound settings)
    if migrated.get('version') == '1.0':
        logger.info("Migrating settings from version 1.0 to 1.1 (adding metronome sound settings)")
        
        # Add new metronome sound settings
        if 'metronomeSound' not in migrated:
            migrated['metronomeSound'] = 'default'
            logger.info("Added default metronomeSound setting")
        
        if 'metronomeVolume' not in migrated:
            migrated['metronomeVolume'] = 0.7
            logger.info("Added default metronomeVolume setting")
        
        migrated['version'] = '1.1'
    
    # Update to current version
    migrated['version'] = current_version
    migrated['lastUpdated'] = datetime.now().isoformat()
    
    logger.info(f"Settings successfully migrated to version {current_version}")
    return migrated

def load_settings():
    """
    Load user settings from file.
    Returns a JSON response with settings and status.
    """
    try:
        logger.info("Loading user settings from file")
        
        # Determine if we're running as an executable
        is_frozen = getattr(sys, 'frozen', False)
        
        # When running as executable, look in the executable directory first
        # Otherwise, look in the application directory (USER_SETTINGS_FILE)
        if is_frozen:
            exe_dir = os.path.dirname(sys.executable)
            primary_settings_file = os.path.join(exe_dir, 'user_settings.json')
            logger.info(f"Running as executable, will look for settings in: {primary_settings_file}")
        else:
            primary_settings_file = USER_SETTINGS_FILE
            logger.info(f"Running in development mode, will look for settings in: {primary_settings_file}")
        
        # List of potential settings file locations to check
        settings_locations = [primary_settings_file]  # Start with the primary location
        
        # Check fallback file if specified (for backward compatibility)
        if USER_SETTINGS_FALLBACK_FILE and USER_SETTINGS_FALLBACK_FILE != primary_settings_file:
            settings_locations.append(USER_SETTINGS_FALLBACK_FILE)
            
        # For backward compatibility and settings import support, add some additional locations
        # but only if they're not already in the list
        if is_frozen:
            # Add the default location as a fallback if it's different from the primary
            if USER_SETTINGS_FILE != primary_settings_file and USER_SETTINGS_FILE not in settings_locations:
                settings_locations.append(USER_SETTINGS_FILE)
        else:
            # In development mode, check for a backup file
            backup_file = os.path.join(os.path.dirname(USER_SETTINGS_FILE), 'user_settings.backup.json')
            if backup_file not in settings_locations:
                settings_locations.append(backup_file)
            
            # Also check for import marker files
            for location in list(settings_locations):  # Use a copy of the list
                marker_path = os.path.join(os.path.dirname(location), '.settings_imported')
                if os.path.exists(marker_path):
                    # If a marker exists, prioritize this location
                    logger.info(f"Found import marker at {marker_path}, prioritizing {location}")
                    # Move this location to the front of the list
                    if location in settings_locations:  # Check if it's still in the list
                        settings_locations.remove(location)
                        settings_locations.insert(0, location)
        
        # Log all locations we're checking
        logger.info(f"Checking these locations for settings: {settings_locations}")
        
        # Check if we have a specific content source override file
        content_source_file = os.path.join(os.path.dirname(USER_SETTINGS_FILE), 'content_source.txt')
        content_source_override = None
        if os.path.exists(content_source_file):
            try:
                with open(content_source_file, 'r') as f:
                    content_source_override = f.read().strip()
                logger.info(f"Found content source override: {content_source_override}")
            except Exception as e:
                logger.warning(f"Error reading content source override: {str(e)}")
        
        # Try each location in order
        for settings_file in settings_locations:
            if os.path.exists(settings_file) and os.path.isfile(settings_file):
                try:
                    logger.info(f"Attempting to load settings from: {settings_file}")
                    with open(settings_file, 'r') as f:
                        settings = json.load(f)
                    
                    # Migrate settings if needed
                    settings = migrate_settings(settings)
                    
                    # Apply content source override if it exists
                    if content_source_override:
                        if settings.get('contentSource') != content_source_override:
                            logger.info(f"Applying content source override: {content_source_override}")
                            settings['contentSource'] = content_source_override
                    
                    logger.info(f"Successfully loaded settings from {settings_file}")
                    
                    # Store the current content source for future reference
                    try:
                        with open(content_source_file, 'w') as f:
                            f.write(settings.get('contentSource', 'reddit'))
                        logger.info(f"Saved current content source: {settings.get('contentSource', 'reddit')}")
                    except Exception as e:
                        logger.warning(f"Error saving content source: {str(e)}")
                    
                    # Copy these settings to the default location if they're not already there
                    if settings_file != USER_SETTINGS_FILE:
                        try:
                            logger.info(f"Copying settings from {settings_file} to {USER_SETTINGS_FILE}")
                            os.makedirs(os.path.dirname(USER_SETTINGS_FILE), exist_ok=True)
                            with open(USER_SETTINGS_FILE, 'w') as f:
                                json.dump(settings, f, indent=2)
                        except Exception as copy_e:
                            logger.warning(f"Could not copy settings to default location: {str(copy_e)}")
                    
                    return jsonify({'settings': settings})
                except Exception as e:
                    logger.error(f"Error loading settings from {settings_file}: {str(e)}")
                    # Continue to next location
        
        # If we get here, no valid settings file was found
        logger.info("Settings file not found at any location, returning defaults")
        logger.info(f"Default settings: {json.dumps(default_user_settings)[:200]}...")
        return jsonify({'settings': default_user_settings, 'isDefault': True})
    
    except Exception as e:
        logger.error(f"Error loading settings: {str(e)}")
        return jsonify({
            'settings': default_user_settings, 
            'isDefault': True, 
            'error': f'Error loading settings: {str(e)}'
        })
        try:
            logger.info(f"Reading settings from file: {settings_file_to_use}")
            with open(settings_file_to_use, 'r') as f:
                settings = json.load(f)
            
            logger.info(f"Successfully loaded settings: {json.dumps(settings)[:200]}...")
            
            # Check if settings need migration
            if 'version' not in settings or settings.get('version') != SETTINGS_VERSION:
                logger.info(f"Migrating settings from version {settings.get('version', 'unknown')} to {SETTINGS_VERSION}")
                # Migrate settings to current version
                settings = migrate_settings(settings)
                
                # Try to save the migrated settings
                try:
                    with open(settings_file_to_use, 'w') as f:
                        json.dump(settings, f, indent=2)
                    logger.info(f"Saved migrated settings to {settings_file_to_use}")
                except Exception as save_e:
                    logger.warning(f"Could not save migrated settings: {str(save_e)}")
                    # Continue with the migrated settings in memory
            
            # Load API credentials if available
            credentials = load_credentials()
            if credentials and credentials.get('client_id') and credentials.get('client_secret'):
                # Add credentials to the settings object
                settings['goonCredentials'] = {
                    'client_id': credentials.get('client_id', ''),
                    'client_secret': credentials.get('client_secret', ''),
                    'user_agent': credentials.get('user_agent', 'Goon/1.0')
                }
                logger.info("Added Goon API credentials to settings response")
                
            logger.info(f"User settings loaded from {settings_file_to_use}")
            return jsonify({'settings': settings, 'isDefault': False})
        except json.JSONDecodeError as je:
            logger.error(f"Invalid JSON in settings file: {str(je)}")
            return jsonify({
                'settings': default_user_settings, 
                'isDefault': True, 
                'error': f'Invalid JSON in settings file: {str(je)}'
            })
    except Exception as e:
        logger.error(f"Error loading user settings: {str(e)}")
        # Return default settings on error
        return jsonify({
            'settings': default_user_settings, 
            'isDefault': True, 
            'error': f'Error loading settings: {str(e)}'
        })

def save_settings():
    """
    Save user settings to file.
    Returns a JSON response indicating success or failure.
    """
    try:
        data = request.json
        if not data:
            logger.error("No data received in save_settings request")
            return jsonify({'error': 'Invalid request data'}), 400
            
        # Log received settings data
        logger.info(f"Received settings data: {json.dumps(data)[:200]}...")
        
        # Remove any sensitive data that shouldn't be stored
        # (Currently there's no sensitive data in user settings, but this is a good practice)
        settings_to_save = data.copy()
        
        # Ensure version and lastUpdated are set
        settings_to_save['version'] = SETTINGS_VERSION
        settings_to_save['lastUpdated'] = datetime.now().isoformat()
        
        # Save the content source to a separate file for persistence
        content_source = settings_to_save.get('contentSource')
        if content_source:
            content_source_file = os.path.join(os.path.dirname(USER_SETTINGS_FILE), 'content_source.txt')
            try:
                os.makedirs(os.path.dirname(content_source_file), exist_ok=True)
                with open(content_source_file, 'w') as f:
                    f.write(content_source)
                logger.info(f"Saved content source to separate file: {content_source}")
            except Exception as e:
                logger.warning(f"Error saving content source to separate file: {str(e)}")
        
        # Determine if we're running as an executable
        is_frozen = getattr(sys, 'frozen', False)
        
        # When running as executable, save to the executable directory
        # Otherwise, save to the application directory (USER_SETTINGS_FILE)
        if is_frozen:
            exe_dir = os.path.dirname(sys.executable)
            settings_file_to_use = os.path.join(exe_dir, 'user_settings.json')
            logger.info(f"Running as executable, will save settings to: {settings_file_to_use}")
        else:
            settings_file_to_use = USER_SETTINGS_FILE
            logger.info(f"Running in development mode, will save settings to: {settings_file_to_use}")
        
        # Create directory if it doesn't exist
        try:
            os.makedirs(os.path.dirname(settings_file_to_use), exist_ok=True)
        except Exception as dir_e:
            logger.warning(f"Could not create directory for settings: {str(dir_e)}")
            # Continue anyway, we'll handle the file creation error if it occurs
        
        # Try to save settings to the selected location
        try:
            logger.info(f"Saving settings to: {settings_file_to_use}")
            with open(settings_file_to_use, 'w') as f:
                json.dump(settings_to_save, f, indent=2)
            
            logger.info(f"User settings successfully saved to {settings_file_to_use}")
            
            # Create a backup in the same directory
            try:
                backup_file = os.path.join(os.path.dirname(settings_file_to_use), 'user_settings.backup.json')
                with open(backup_file, 'w') as f:
                    json.dump(settings_to_save, f, indent=2)
                logger.info(f"Created settings backup at {backup_file}")
            except Exception as backup_e:
                logger.warning(f"Could not create settings backup: {str(backup_e)}")
                # This is non-critical, so we continue
            
            return jsonify({'success': True, 'message': f'Settings saved successfully to {settings_file_to_use}'})
            
        except Exception as e:
            logger.error(f"Failed to save settings to {settings_file_to_use}: {str(e)}")
            
            # If we're in development mode and the primary location fails, try a backup location
            if not is_frozen:
                try:
                    temp_file = os.path.join(APP_ROOT, 'user_settings.temp.json')
                    with open(temp_file, 'w') as f:
                        json.dump(settings_to_save, f, indent=2)
                    logger.info(f"Saved settings to temporary file: {temp_file}")
                    return jsonify({'success': True, 'message': f'Settings saved to temporary file: {temp_file}'})
                except Exception as temp_e:
                    logger.error(f"Error saving to temporary file: {str(temp_e)}")
            
            # If we get here, all attempts failed
            return jsonify({'error': f'Failed to save settings: {str(e)}'}), 500
    except Exception as e:
        logger.error(f"Error saving user settings: {str(e)}")
        return jsonify({'error': f'Failed to save settings: {str(e)}'}), 500

def debug_import_process(settings_data, file_path, stage="unknown"):
    """Create a debug log file with detailed information about the import process"""
    try:
        # Create a debug log in a location that will definitely be accessible
        is_frozen = getattr(sys, 'frozen', False)
        log_dir = os.path.dirname(sys.executable) if is_frozen else os.path.abspath('.')
        log_file = os.path.join(log_dir, 'import_debug.log')
        
        with open(log_file, 'a') as f:
            f.write(f"\n\n===== IMPORT DEBUG LOG - {datetime.now().isoformat()} - STAGE: {stage} =====\n")
            f.write(f"File path: {file_path}\n")
            f.write(f"Is executable: {is_frozen}\n")
            f.write(f"USER_SETTINGS_FILE: {USER_SETTINGS_FILE}\n")
            f.write(f"APP_ROOT: {APP_ROOT}\n")
            f.write(f"Settings data type: {type(settings_data)}\n")
            
            if isinstance(settings_data, dict):
                f.write("\nSettings keys:\n")
                for key in settings_data.keys():
                    f.write(f"  - {key}: {type(settings_data[key])}")
                    # For certain keys, show their values
                    if key in ['contentSource', 'timerMin', 'timerMax', 'theme', 'version']:
                        f.write(f" = {settings_data[key]}")
                    f.write("\n")
                
                # Check for specific important keys
                for key in ['contentSource', 'timerMin', 'timerMax', 'theme']:
                    if key not in settings_data:
                        f.write(f"WARNING: Key '{key}' is missing!\n")
            else:
                f.write(f"Settings data: {settings_data}\n")
                
        logger.info(f"Created debug log at {log_file}")
        return True
    except Exception as e:
        logger.error(f"Error creating debug log: {str(e)}")
        return False

def import_settings_from_path(import_path, credentials_file=None):
    """
    Core function to import settings from a specified path.
    Returns a JSON response indicating success or failure.
    
    Args:
        import_path (str): Path to the settings file or directory
        credentials_file (str, optional): Path to the credentials file if known
        
    Returns:
        flask.Response: JSON response with import results
    """
    try:
        # Check if the path exists and is readable
        if not os.path.exists(import_path):
            return jsonify({'error': 'The specified path does not exist'}), 404
            
        if not os.access(import_path, os.R_OK):
            return jsonify({'error': 'Cannot read from the specified path'}), 403
            
        # If the path is a directory, look for user_settings.json and credentials.json in it
        if os.path.isdir(import_path):
            # Look for settings file
            potential_settings_files = [
                os.path.join(import_path, 'user_settings.json'),
                os.path.join(import_path, 'Goon', 'user_settings.json'),
                os.path.join(import_path, 'dist', 'user_settings.json')
            ]
            
            found_settings_file = None
            for file_path in potential_settings_files:
                if os.path.exists(file_path) and os.path.isfile(file_path):
                    found_settings_file = file_path
                    break
                    
            if found_settings_file:
                import_path = found_settings_file
                logger.info(f"Found settings file in directory: {import_path}")
                
                # Also look for credentials file in the same directory if not already provided
                if not credentials_file:
                    potential_credentials_files = [
                        os.path.join(os.path.dirname(found_settings_file), 'credentials.json'),
                        os.path.join(import_path, 'Goon', 'credentials.json'),
                        os.path.join(import_path, 'dist', 'credentials.json')
                    ]
                    
                    for cred_file in potential_credentials_files:
                        if os.path.exists(cred_file) and os.path.isfile(cred_file):
                            credentials_file = cred_file
                            logger.info(f"Found credentials file: {credentials_file}")
                            break
            else:
                return jsonify({'error': 'Could not find settings file in the specified directory'}), 404
        
        # Try to load the settings file
        try:
            # Create debug log for the start of import process
            debug_import_process("Starting import process", import_path, "start")
            
            with open(import_path, 'r') as f:
                file_content = f.read()
                # Create debug log with raw file content
                debug_import_process(file_content, import_path, "raw_content")
                # Reset file pointer to beginning
                f.seek(0)
                imported_settings = json.load(f)
            
            # Create debug log with parsed settings
            debug_import_process(imported_settings, import_path, "parsed_settings")
                
            # Validate that it's a proper settings file
            if not isinstance(imported_settings, dict) or 'contentSource' not in imported_settings:
                logger.error(f"Invalid settings file: not a dict or missing contentSource")
                debug_import_process("Invalid settings file", import_path, "validation_failed")
                return jsonify({'error': 'The file does not contain valid Goon settings'}), 400
                
            # Migrate the settings to the current version
            migrated_settings = migrate_settings(imported_settings)
            
            # Create debug log with migrated settings
            debug_import_process(migrated_settings, import_path, "migrated_settings")
            
            # Save the imported settings
            try:
                # Determine if we're running as an executable
                is_frozen = getattr(sys, 'frozen', False)
                
                # For executable version, ensure we're saving to a persistent location
                if is_frozen:
                    # Get the executable directory
                    exe_dir = os.path.dirname(sys.executable)
                    
                    # Save to multiple possible locations to ensure at least one works
                    locations_to_save = [
                        # Primary location - executable directory
                        os.path.join(exe_dir, 'user_settings.json'),
                        # Default location
                        USER_SETTINGS_FILE,
                        # Backup in user's documents folder
                        os.path.join(os.path.expanduser('~'), 'Documents', 'Goon', 'user_settings.json'),
                        # Backup in temp directory
                        os.path.join(os.environ.get('TEMP', os.path.expanduser('~')), 'goon_settings.json')
                    ]
                    
                    # Create debug log with save locations
                    debug_import_process(locations_to_save, import_path, "save_locations")
                    
                    # Try to save to all locations
                    for save_path in locations_to_save:
                        try:
                            # Ensure directory exists
                            os.makedirs(os.path.dirname(save_path), exist_ok=True)
                            
                            # Save the settings
                            with open(save_path, 'w') as f:
                                json.dump(migrated_settings, f, indent=2)
                            logger.info(f"Saved settings to: {save_path}")
                            
                            # Create a marker file to indicate successful import
                            marker_path = os.path.join(os.path.dirname(save_path), '.settings_imported')
                            with open(marker_path, 'w') as f:
                                f.write(datetime.now().isoformat())
                            logger.info(f"Created import marker at: {marker_path}")
                        except Exception as e:
                            logger.warning(f"Failed to save settings to {save_path}: {str(e)}")
                    
                    # Create a special debug file with the complete settings
                    debug_file = os.path.join(exe_dir, 'imported_settings_debug.json')
                    try:
                        with open(debug_file, 'w') as f:
                            json.dump(migrated_settings, f, indent=2)
                        logger.info(f"Created debug settings file at: {debug_file}")
                    except Exception as e:
                        logger.warning(f"Failed to create debug file: {str(e)}")
                else:
                    # Standard save for development version
                    with open(USER_SETTINGS_FILE, 'w') as f:
                        json.dump(migrated_settings, f, indent=2)
                    logger.info(f"Successfully imported and saved settings from {import_path}")
                
                # Create a backup in a location that will definitely be accessible
                try:
                    # For executable, use the executable directory
                    if is_frozen:
                        backup_dir = exe_dir
                    else:
                        backup_dir = APP_ROOT
                        
                    backup_file = os.path.join(backup_dir, 'user_settings.imported.backup.json')
                    with open(backup_file, 'w') as f:
                        json.dump(migrated_settings, f, indent=2)
                    logger.info(f"Created backup of imported settings at {backup_file}")
                except Exception as backup_e:
                    logger.warning(f"Could not create backup of imported settings: {str(backup_e)}")
                    # Non-critical, continue
                
                # Import credentials if found
                credentials_imported = False
                credentials_message = ""
                
                # First check if credentials are embedded in the settings file
                from credentials import save_credentials, CREDENTIALS_FILE
                
                # Check for credentials in different formats
                credentials_found = False
                extracted_credentials = None
                
                # Check for direct properties (older format)
                if migrated_settings.get('redditClientId') and migrated_settings.get('redditClientSecret'):
                    extracted_credentials = {
                        'client_id': migrated_settings.get('redditClientId', '').strip(),
                        'client_secret': migrated_settings.get('redditClientSecret', '').strip(),
                        'user_agent': migrated_settings.get('redditUserAgent', 'Goon/1.0').strip()
                    }
                    credentials_found = True
                    logger.info("Found Reddit credentials in settings (direct properties)")
                
                # Check for nested redditCredentials object (newer format)
                elif migrated_settings.get('redditCredentials') and \
                     migrated_settings['redditCredentials'].get('client_id') and \
                     migrated_settings['redditCredentials'].get('client_secret'):
                    extracted_credentials = {
                        'client_id': migrated_settings['redditCredentials'].get('client_id', '').strip(),
                        'client_secret': migrated_settings['redditCredentials'].get('client_secret', '').strip(),
                        'user_agent': migrated_settings['redditCredentials'].get('user_agent', 'Goon/1.0').strip()
                    }
                    credentials_found = True
                    logger.info("Found Reddit credentials in settings (redditCredentials object)")
                
                # If credentials were found in the settings file
                if credentials_found and extracted_credentials:
                    try:
                        # Create debug log with extracted credentials (without showing actual values)
                        debug_import_process(
                            f"Extracted Reddit credentials from settings - client_id present: {bool(extracted_credentials['client_id'])}, "
                            f"client_secret present: {bool(extracted_credentials['client_secret'])}", 
                            import_path, 
                            "extracted_credentials"
                        )
                        
                        # Add credentials to settings in both formats for compatibility
                        # This ensures they're saved when the settings are saved
                        migrated_settings['redditClientId'] = extracted_credentials['client_id']
                        migrated_settings['redditClientSecret'] = extracted_credentials['client_secret']
                        migrated_settings['redditUserAgent'] = extracted_credentials['user_agent']
                        
                        migrated_settings['redditCredentials'] = {
                            'client_id': extracted_credentials['client_id'],
                            'client_secret': extracted_credentials['client_secret'],
                            'user_agent': extracted_credentials['user_agent']
                        }
                        
                        # Save the credentials separately to ensure they're available to the Reddit API
                        if save_credentials(extracted_credentials):
                            logger.info(f"Successfully extracted and saved credentials from settings file")
                            credentials_imported = True
                            credentials_message = "API credentials successfully extracted from settings"
                        else:
                            logger.warning(f"Failed to save extracted credentials")
                            credentials_message = "Failed to save extracted API credentials"
                    except Exception as extract_e:
                        logger.error(f"Error extracting credentials from settings: {str(extract_e)}")
                        credentials_message = f"Error extracting API credentials: {str(extract_e)}"
                # If no credentials in settings, try separate credentials file
                elif credentials_file:
                    try:
                        # Read the credentials file
                        with open(credentials_file, 'r') as f:
                            imported_credentials = json.load(f)
                        
                        # Save the credentials
                        if save_credentials(imported_credentials):
                            logger.info(f"Successfully imported and saved credentials from {credentials_file}")
                            credentials_imported = True
                            credentials_message = "API credentials successfully imported"
                        else:
                            logger.warning(f"Failed to save imported credentials")
                            credentials_message = "Failed to import API credentials"
                    except Exception as cred_e:
                        logger.error(f"Error importing credentials: {str(cred_e)}")
                        credentials_message = f"Error importing API credentials: {str(cred_e)}"
                else:
                    credentials_message = "No API credentials found to import"
                
                return jsonify({
                    'success': True, 
                    'message': f'Settings successfully imported. {credentials_message}',
                    'settings': migrated_settings,
                    'credentials_imported': credentials_imported
                })
            except Exception as save_e:
                logger.error(f"Error saving imported settings: {str(save_e)}")
                return jsonify({'error': f'Could not save imported settings: {str(save_e)}'}), 500
                
        except json.JSONDecodeError:
            return jsonify({'error': 'The file does not contain valid JSON data'}), 400
        except Exception as e:
            logger.error(f"Error importing settings: {str(e)}")
            return jsonify({'error': f'Error importing settings: {str(e)}'}), 500
            
    except Exception as e:
        logger.error(f"Error in import_settings_from_path: {str(e)}")
        return jsonify({'error': f'Error importing settings: {str(e)}'}), 500

def import_settings():
    """
    Import settings from a user-specified path.
    Returns a JSON response indicating success or failure.
    """
    try:
        data = request.json
        if not data or 'path' not in data:
            return jsonify({'error': 'No path specified'}), 400
            
        import_path = data['path']
        logger.info(f"Attempting to import settings from: {import_path}")
        
        # Look for credentials file if specified
        credentials_file = data.get('credentials_file')
        
        # Call the core import function
        return import_settings_from_path(import_path, credentials_file)
            
    except Exception as e:
        logger.error(f"Error in import_settings: {str(e)}")
        return jsonify({'error': f'Error importing settings: {str(e)}'}), 500
