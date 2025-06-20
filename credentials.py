"""
Credential management for the Goon application.
Handles loading, saving, and updating Reddit API credentials.
"""
import os
import json
import logging
import sys
from datetime import datetime

from utils import get_application_path

# Get logger
logger = logging.getLogger(__name__)

# Application root path
APP_ROOT = get_application_path()

# Credentials file paths
CREDENTIALS_FILE = os.path.join(APP_ROOT, 'credentials.json')
CREDENTIALS_TEMPLATE_FILE = os.path.join(APP_ROOT, 'credentials_template.json')

def create_credentials_template():
    """Create a template credentials file if it doesn't exist."""
    if not os.path.exists(CREDENTIALS_TEMPLATE_FILE):
        try:
            template = {
                'client_id': 'YOUR_REDDIT_CLIENT_ID_HERE',
                'client_secret': 'YOUR_REDDIT_CLIENT_SECRET_HERE',
                'user_agent': 'Goon/1.0'
            }
            with open(CREDENTIALS_TEMPLATE_FILE, 'w') as f:
                json.dump(template, f, indent=4)
            logger.info(f"Created credentials template at {CREDENTIALS_TEMPLATE_FILE}")
        except Exception as e:
            logger.error(f"Error creating credentials template: {str(e)}")

def validate_credentials(credentials):
    """
    Validate and normalize Reddit API credentials.
    Returns a dictionary with validated client_id, client_secret, and user_agent.
    """
    # Validate credentials format
    if not isinstance(credentials, dict):
        logger.error("Invalid credentials format")
        return {
            'client_id': '',
            'client_secret': '',
            'user_agent': 'Goon/1.0'
        }
    
    # Ensure all required fields are present
    required_fields = ['client_id', 'client_secret', 'user_agent']
    for field in required_fields:
        if field not in credentials:
            logger.warning(f"Missing {field} in credentials")
            credentials[field] = '' if field != 'user_agent' else 'Goon/1.0'
    
    # Ensure user_agent is not empty
    if not credentials.get('user_agent'):
        credentials['user_agent'] = 'Goon/1.0'
    
    # Ensure all values are strings and trim whitespace
    for key in credentials:
        try:
            if credentials[key] is None:
                credentials[key] = '' if key != 'user_agent' else 'Goon/1.0'
            elif not isinstance(credentials[key], str):
                # Convert to string safely
                credentials[key] = str(credentials[key])
            
            # Trim whitespace if it's a string
            if isinstance(credentials[key], str):
                credentials[key] = credentials[key].strip()
        except Exception as e:
            logger.error(f"Error processing credential {key}: {str(e)}")
            credentials[key] = '' if key != 'user_agent' else 'Goon/1.0'
    
    # Log that credentials were validated (without showing the actual values)
    logger.info("Credentials validated")
    
    return credentials

def load_credentials():
    """
    Load Reddit API credentials from file.
    Returns a dictionary with client_id, client_secret, and user_agent.
    """
    # Create template file if it doesn't exist
    create_credentials_template()
    
    # Determine if we're running as an executable
    is_frozen = getattr(sys, 'frozen', False)
    
    # When running as executable, look in the executable directory first
    # Otherwise, look in the application directory (CREDENTIALS_FILE)
    if is_frozen:
        exe_dir = os.path.dirname(sys.executable)
        primary_credentials_file = os.path.join(exe_dir, 'credentials.json')
        logger.info(f"Running as executable, will look for credentials in: {primary_credentials_file}")
    else:
        primary_credentials_file = CREDENTIALS_FILE
        logger.info(f"Running in development mode, will look for credentials in: {primary_credentials_file}")
    
    # List of potential credentials file locations to check
    credentials_locations = [primary_credentials_file]  # Start with the primary location
    
    # For backward compatibility and credentials import support, add some additional locations
    # but only if they're not already in the list
    if is_frozen:
        # Add the default location as a fallback if it's different from the primary
        if CREDENTIALS_FILE != primary_credentials_file and CREDENTIALS_FILE not in credentials_locations:
            credentials_locations.append(CREDENTIALS_FILE)
    
    # Log all locations we're checking
    logger.info(f"Checking these locations for credentials: {credentials_locations}")
    
    # Check for marker files first to prioritize locations
    for location in list(credentials_locations):  # Use a copy of the list
        marker_path = os.path.join(os.path.dirname(location), '.credentials_saved')
        if os.path.exists(marker_path):
            # If a marker exists, prioritize this location
            logger.info(f"Found credentials marker at {marker_path}, prioritizing {location}")
            # Move this location to the front of the list
            if location in credentials_locations:  # Check if it's still in the list
                credentials_locations.remove(location)
                credentials_locations.insert(0, location)
    
    # Try each location in order
    for credentials_file in credentials_locations:
        if os.path.exists(credentials_file) and os.path.isfile(credentials_file):
            try:
                logger.info(f"Attempting to load credentials from: {credentials_file}")
                with open(credentials_file, 'r') as f:
                    credentials = json.load(f)
                
                logger.info(f"Successfully loaded credentials from {credentials_file}")
                
                # Copy these credentials to the default location if they're not already there
                if credentials_file != CREDENTIALS_FILE:
                    try:
                        logger.info(f"Copying credentials from {credentials_file} to {CREDENTIALS_FILE}")
                        os.makedirs(os.path.dirname(CREDENTIALS_FILE), exist_ok=True)
                        with open(CREDENTIALS_FILE, 'w') as f:
                            json.dump(credentials, f, indent=2)
                    except Exception as copy_e:
                        logger.warning(f"Could not copy credentials to default location: {str(copy_e)}")
                
                # Validate and return the credentials
                return validate_credentials(credentials)
            except Exception as e:
                logger.error(f"Error loading credentials from {credentials_file}: {str(e)}")
                # Continue to next location
    
    # If we get here, no valid credentials file was found
    logger.warning(f"Credentials file not found at any location")
    logger.info("Using empty credentials")
    return {
        'client_id': '',
        'client_secret': '',
        'user_agent': 'Goon/1.0'
    }

def save_credentials(credentials):
    """
    Save Reddit API credentials to file.
    Returns True if successful, False otherwise.
    """
    # Validate credentials
    credentials = validate_credentials(credentials)
    
    try:
        # Determine if we're running as an executable
        is_frozen = getattr(sys, 'frozen', False)
        
        # When running as executable, save to the executable directory
        # Otherwise, save to the application directory (CREDENTIALS_FILE)
        if is_frozen:
            exe_dir = os.path.dirname(sys.executable)
            credentials_file_to_use = os.path.join(exe_dir, 'credentials.json')
            logger.info(f"Running as executable, will save credentials to: {credentials_file_to_use}")
        else:
            credentials_file_to_use = CREDENTIALS_FILE
            logger.info(f"Running in development mode, will save credentials to: {credentials_file_to_use}")
        
        # Create directory if it doesn't exist
        try:
            os.makedirs(os.path.dirname(credentials_file_to_use), exist_ok=True)
        except Exception as dir_e:
            logger.warning(f"Could not create directory for credentials: {str(dir_e)}")
            # Continue anyway, we'll handle the file creation error if it occurs
        
        # Save credentials to file
        with open(credentials_file_to_use, 'w') as f:
            json.dump(credentials, f, indent=4)
        
        logger.info(f"Saved credentials to {credentials_file_to_use}")
        
        # Create a marker file to indicate this is where credentials were last saved
        marker_file = os.path.join(os.path.dirname(credentials_file_to_use), '.credentials_saved')
        try:
            with open(marker_file, 'w') as f:
                f.write(datetime.now().isoformat())
            logger.info(f"Created credentials marker at {marker_file}")
        except Exception as marker_e:
            logger.warning(f"Could not create credentials marker: {str(marker_e)}")
            # Non-critical, continue
        
        return True
    except Exception as e:
        logger.error(f"Error saving credentials: {str(e)}")
        return False
