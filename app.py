"""
Goon - Main Application
A Flask web application for browsing Reddit and custom content.
"""
from flask import Flask, render_template, jsonify, request, send_from_directory
import os
import logging
import random
import time
import json
from datetime import datetime

# Import from our modules
from utils import get_application_path, logger, clean_subreddit_name
from reddit_wrapper import get_reddit_instance, get_reddit_content, update_credentials, reddit
from settings import (
    load_settings, save_settings, import_settings, migrate_settings,
    USER_SETTINGS_FILE, USER_SETTINGS_FALLBACK_FILE, SETTINGS_VERSION,
    default_user_settings
)
from content_manager import get_content, get_custom_content, get_custom_folders, folder_cache
from credentials import load_credentials, save_credentials, CREDENTIALS_FILE, CREDENTIALS_TEMPLATE_FILE

# Application root path
APP_ROOT = get_application_path()
logger.info(f"Application root directory: {APP_ROOT}")

# This will be overridden by launcher.py when running as an executable
USER_CONTENT_DIR = None

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev_key_change_in_production')

# Initialize Reddit instance
reddit = get_reddit_instance()
if reddit is None:
    logger.warning("Failed to initialize Reddit instance on startup")

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/user_content/<path:filename>')
def user_content(filename):
    """
    Serve files from the user_content directory.
    This is needed for custom content in the executable version.
    """
    # Check if we're running as an executable
    import sys
    is_frozen = getattr(sys, 'frozen', False)
    
    # First try USER_CONTENT_DIR if it exists
    if USER_CONTENT_DIR and os.path.exists(USER_CONTENT_DIR):
        # Make sure the requested file is within USER_CONTENT_DIR for security
        requested_path = os.path.join(USER_CONTENT_DIR, filename)
        if os.path.commonpath([requested_path, USER_CONTENT_DIR]) == USER_CONTENT_DIR:
            if os.path.exists(requested_path) and os.path.isfile(requested_path):
                # Get the directory containing the file
                directory = os.path.dirname(requested_path)
                # Get the filename
                basename = os.path.basename(requested_path)
                # Serve the file from the directory
                logger.info(f"Serving file from USER_CONTENT_DIR: {requested_path}")
                return send_from_directory(directory, basename)
    
    # If running as executable, also check the user_content directory next to the executable
    if is_frozen:
        exe_dir = os.path.dirname(sys.executable)
        exe_user_content_dir = os.path.join(exe_dir, 'user_content')
        
        if os.path.exists(exe_user_content_dir):
            # Make sure the requested file is within exe_user_content_dir for security
            requested_path = os.path.join(exe_user_content_dir, filename)
            if os.path.commonpath([requested_path, exe_user_content_dir]) == exe_user_content_dir:
                if os.path.exists(requested_path) and os.path.isfile(requested_path):
                    # Get the directory containing the file
                    directory = os.path.dirname(requested_path)
                    # Get the filename
                    basename = os.path.basename(requested_path)
                    # Serve the file from the directory
                    logger.info(f"Serving file from executable directory: {requested_path}")
                    return send_from_directory(directory, basename)
    
    # If file not found in any location, return 404
    logger.warning(f"File not found: {filename}")
    return jsonify({'error': 'File not found'}), 404

@app.route('/get_content', methods=['POST'])
def get_content_route():
    return get_content()

@app.route('/get_custom_folders', methods=['GET'])
def get_custom_folders_route():
    return get_custom_folders()

@app.route('/update_credentials', methods=['POST'])
def update_credentials_route():
    return update_credentials(request)

@app.route('/direct_save_credentials', methods=['POST'])
def direct_save_credentials_route():
    """
    Directly save Reddit credentials to multiple locations to ensure they're accessible in the executable version.
    This is a more direct approach than the regular update_credentials endpoint.
    """
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Invalid request data'}), 400
        
        # Extract credentials
        client_id = data.get('client_id', '').strip()
        client_secret = data.get('client_secret', '').strip()
        user_agent = data.get('user_agent', 'Goon/1.0').strip()
        debug_info = data.get('debug_info', False)
        
        # Validate credentials
        if not client_id or not client_secret:
            return jsonify({'error': 'Client ID and Client Secret are required'}), 400
        
        # Prepare credentials object
        credentials = {
            'client_id': client_id,
            'client_secret': client_secret,
            'user_agent': user_agent
        }
        
        # Log the credential save attempt (without showing the actual values)
        logger.info(f"Direct save of Reddit credentials - client_id present: {bool(client_id)}, "
                   f"client_secret present: {bool(client_secret)}")
        
        # Determine if we're running as an executable
        is_frozen = getattr(sys, 'frozen', False)
        
        # List of locations to save credentials to
        save_locations = [CREDENTIALS_FILE]  # Start with the default location
        
        # If running as executable, save to additional locations
        if is_frozen:
            exe_dir = os.path.dirname(sys.executable)
            user_home = os.path.expanduser('~')
            temp_dir = os.environ.get('TEMP', user_home)
            downloads_dir = os.path.join(user_home, 'Downloads')
            
            # Add additional locations to save to
            additional_locations = [
                os.path.join(exe_dir, 'credentials.json'),  # Executable directory
                os.path.join(user_home, 'Documents', 'Goon', 'credentials.json'),  # User's Documents
                os.path.join(downloads_dir, 'goon', 'credentials.json'),  # Downloads folder
                os.path.join(temp_dir, 'goon_credentials.json')  # Temp directory
            ]
            save_locations.extend(additional_locations)
        
        # Log all locations we're saving to
        logger.info(f"Directly saving credentials to these locations: {save_locations}")
        
        # Save to each location
        success_locations = []
        failed_locations = []
        
        for credentials_file in save_locations:
            try:
                # Create directory if it doesn't exist
                os.makedirs(os.path.dirname(credentials_file), exist_ok=True)
                
                # Save credentials to file
                with open(credentials_file, 'w') as f:
                    json.dump(credentials, f, indent=4)
                
                logger.info(f"Successfully saved credentials to {credentials_file}")
                success_locations.append(credentials_file)
                
                # Create a marker file to indicate successful save
                try:
                    marker_path = os.path.join(os.path.dirname(credentials_file), '.credentials_saved')
                    with open(marker_path, 'w') as f:
                        f.write(f"Credentials saved on {datetime.now().isoformat()}")
                    logger.info(f"Created credentials save marker at {marker_path}")
                except Exception as marker_e:
                    logger.warning(f"Could not create credentials save marker: {str(marker_e)}")
            except Exception as e:
                logger.error(f"Error saving credentials to {credentials_file}: {str(e)}")
                failed_locations.append(credentials_file)
        
        # Also update the global Reddit instance
        from reddit_wrapper import get_reddit_instance
        reddit = get_reddit_instance()
        
        # Prepare response
        response = {
            'success': len(success_locations) > 0,
            'message': f"Credentials saved to {len(success_locations)} locations"
        }
        
        # Add debug info if requested
        if debug_info:
            response['debug'] = {
                'success_locations': success_locations,
                'failed_locations': failed_locations,
                'is_frozen': is_frozen,
                'reddit_initialized': reddit is not None
            }
        
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error in direct_save_credentials: {str(e)}")
        return jsonify({'error': f'Error saving credentials: {str(e)}'}), 500

@app.route('/load_settings', methods=['GET'])
def load_settings_route():
    return load_settings()

@app.route('/save_settings', methods=['POST'])
def save_settings_route():
    return save_settings()

@app.route('/import_settings', methods=['POST'])
def import_settings_route():
    return import_settings()

@app.route('/generate_caption', methods=['POST'])
def generate_caption_route():
    """Generate an erotic teasing caption using a local Ollama model."""
    try:
        data = request.json or {}
        size = data.get('penis_size', '').strip()
        template = data.get('prompt_template', '')
        model = data.get('model', 'mistral:instruct').strip() or 'mistral:instruct'

        # Default prompt template
        default_template = (
            "User has a [SIZE]-inch penis. Write a short, erotic teasing caption for a sexy image being shown *because of their size*. The tone should be flirtatious, dominant, or lightly humiliating depending on the size."
            "Always imply that the user received this specific post *because of* their size as a reward, punishment, or mockery."
            "Speak as a confident domme, never uncertain. Keep the response under 25 words."
        )

        prompt = (template or default_template).replace('[SIZE]', size or '6')

        import subprocess, shlex
        try:
            logger.info(f"Calling Ollama model '{model}' with prompt: {prompt[:60]}…")
            result = subprocess.run(
                ["ollama", "run", model, prompt],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=False,
                timeout=30
            )
            if result.returncode != 0:
                logger.warning(f"Ollama returned non-zero code: {result.stderr}")
                return jsonify({"caption": ""})
            raw_bytes = result.stdout or b''
            try:
                raw = raw_bytes.decode('utf-8').strip()
            except UnicodeDecodeError:
                raw = raw_bytes.decode('utf-8', errors='ignore').strip()
        except FileNotFoundError:
            logger.warning("Ollama executable not found – skipping caption generation")
            return jsonify({"caption": ""})
        except Exception as e:
            logger.error(f"Error during Ollama run: {e}")
            return jsonify({"caption": ""})

        # Sanitize / trim: remove markdown, newlines, >25 words, keep single sentence
        import re
        text = re.sub(r"[\r\n]+", " ", raw)
        text = re.sub(r"[*_`~>|#]", "", text)  # strip simple markdown chars
        text = text.strip()
        # Split into sentences
        sentence = re.split(r"[.!?]", text)[0].strip()
        words = sentence.split()
        if len(words) > 25:
            sentence = " ".join(words[:25])
        return jsonify({"caption": sentence})
    except Exception as e:
        logger.error(f"generate_caption error: {e}")
        return jsonify({"caption": ""})


@app.route('/import_settings_file', methods=['POST'])
def import_settings_file_route():
    """Handle file upload for settings import"""
    try:
        if 'settingsFile' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
            
        file = request.files['settingsFile']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
            
        if not file.filename.endswith('.json'):
            return jsonify({'error': 'File must be a .json file'}), 400
        
        # Create a temporary file to store the uploaded settings
        import tempfile
        temp_dir = tempfile.gettempdir()
        temp_file_path = os.path.join(temp_dir, 'uploaded_settings.json')
        
        # Save the uploaded file
        file.save(temp_file_path)
        logger.info(f"Saved uploaded settings file to temporary location: {temp_file_path}")
        
        # Now use the existing import_settings function with a modified request
        from werkzeug.datastructures import ImmutableDict
        # Create a new request context with the path to the temporary file
        request_data = ImmutableDict({'path': temp_file_path})
        # Use the existing import logic by creating a mock request object
        class MockRequest:
            def __init__(self, json_data):
                self.json = json_data
        
        # Import the settings using the existing function
        from settings import import_settings_from_path
        result = import_settings_from_path(temp_file_path)
        
        # Clean up the temporary file
        try:
            os.remove(temp_file_path)
            logger.info(f"Removed temporary settings file: {temp_file_path}")
        except Exception as e:
            logger.warning(f"Could not remove temporary file: {str(e)}")
        
        return result
    except Exception as e:
        logger.error(f"Error importing settings from file: {str(e)}")
        return jsonify({'error': f'Error importing settings: {str(e)}'}), 500

# Set content directory for executable mode
def set_user_content_dir(path):
    """
    Set the user content directory when running as an executable.
    This is called from launcher.py.
    """
    global USER_CONTENT_DIR
    USER_CONTENT_DIR = path
    logger.info(f"Set USER_CONTENT_DIR to {path}")
    
    # Also update the module's USER_CONTENT_DIR
    import content_manager
    content_manager.USER_CONTENT_DIR = path

# Set fallback settings file for executable mode
def set_settings_fallback_file(path):
    """
    Set the fallback settings file when running as an executable.
    This is called from launcher.py.
    """
    global USER_SETTINGS_FALLBACK_FILE
    USER_SETTINGS_FALLBACK_FILE = path
    logger.info(f"Set USER_SETTINGS_FALLBACK_FILE to {path}")
    
    # Also update the module's USER_SETTINGS_FALLBACK_FILE
    import settings
    settings.USER_SETTINGS_FALLBACK_FILE = path

# Main entry point
if __name__ == '__main__':
    # Use 127.0.0.1 instead of localhost for consistency
    app.run(host='127.0.0.1', debug=True)
