#!/usr/bin/env python
"""
Goon Build Script
------------------------------
This script builds the Goon application into a standalone executable.
It handles all necessary preparation and cleanup before building.

Usage:
    python build.py
"""

import os
import sys
import json
import shutil
import subprocess
from pathlib import Path

def clean_build_directories():
    """Clean up previous build artifacts"""
    print("Cleaning up previous build artifacts...")
    
    # Directories to clean
    dirs_to_clean = ['build', 'dist']
    
    # Files to clean
    files_to_clean = [f for f in os.listdir('.') if f.endswith('.spec')]
    
    # Clean directories
    for dir_name in dirs_to_clean:
        if os.path.exists(dir_name):
            print(f"Removing {dir_name} directory...")
            try:
                shutil.rmtree(dir_name)
            except Exception as e:
                print(f"Error removing {dir_name}: {str(e)}")
    
    # Clean files
    for file_name in files_to_clean:
        if os.path.exists(file_name):
            print(f"Removing {file_name}...")
            try:
                os.remove(file_name)
            except Exception as e:
                print(f"Error removing {file_name}: {str(e)}")

def backup_credentials():
    """Backup credentials.json if it exists"""
    creds_file = 'credentials.json'
    backup_file = 'credentials.json.bak'
    
    if os.path.exists(creds_file):
        print(f"Backing up {creds_file}...")
        try:
            shutil.copy2(creds_file, backup_file)
            os.remove(creds_file)
            return True
        except Exception as e:
            print(f"Error backing up credentials: {str(e)}")
    
    return False

def restore_credentials():
    """Restore credentials.json from backup if it exists"""
    creds_file = 'credentials.json'
    backup_file = 'credentials.json.bak'
    
    if os.path.exists(backup_file):
        print(f"Restoring {creds_file} from backup...")
        try:
            shutil.copy2(backup_file, creds_file)
            os.remove(backup_file)
        except Exception as e:
            print(f"Error restoring credentials: {str(e)}")

def create_user_content_directories():
    """Create user_content directories with example folders"""
    print("Creating user_content directories...")
    
    # Create base directories
    user_content_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_content')
    target_content_dir = os.path.join(user_content_dir, 'custom_content')
    target_punishment_dir = os.path.join(user_content_dir, 'custom_punishment')
    
    os.makedirs(target_content_dir, exist_ok=True)
    os.makedirs(target_punishment_dir, exist_ok=True)
    
    # Create example folders
    example_content_dir = os.path.join(target_content_dir, 'example')
    os.makedirs(example_content_dir, exist_ok=True)
    print(f"Created example content folder: example")
    
    example_punishment_dir = os.path.join(target_punishment_dir, 'example')
    os.makedirs(example_punishment_dir, exist_ok=True)
    print(f"Created example punishment folder: example")
    
    # Create README files
    with open(os.path.join(example_content_dir, 'README.txt'), 'w') as f:
        f.write("""Place your custom content files here.
Supported file types: jpg, jpeg, png, gif, mp4, webm
""")
    
    with open(os.path.join(example_punishment_dir, 'README.txt'), 'w') as f:
        f.write("""Place your custom punishment files here.
Supported file types: jpg, jpeg, png, gif, mp4, webm
""")
    
    # Create main README file
    readme_path = os.path.join(user_content_dir, 'README.txt')
    with open(readme_path, 'w') as f:
        f.write("""Goon Custom Content

Place your custom content in these folders:

1. custom_content - For regular content
2. custom_punishment - For punishment content

Supported file types: jpg, jpeg, png, gif, mp4, webm

The app will automatically detect new content when you refresh the folders in settings.
""")
    
    return user_content_dir

def backup_settings():
    """Backup user_settings.json if it exists"""
    print("Checking for user settings to backup...")
    
    # Define paths
    user_settings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_settings.json')
    backup_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_settings.backup.json')
    
    # Check if settings file exists
    if os.path.exists(user_settings_path):
        print(f"Backing up user settings from {user_settings_path}")
        try:
            shutil.copy2(user_settings_path, backup_path)
            return True
        except Exception as e:
            print(f"Error backing up user settings: {str(e)}")
    else:
        print("No user settings file found to backup")
    
    return False

def create_default_settings():
    """Create a default user_settings.json file for the build"""
    print("Creating default user_settings.json for build...")
    
    # Import settings from settings.py if possible
    try:
        # Try to import the default settings from settings.py
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from settings import default_user_settings as settings_py_defaults
        print("Successfully imported default settings from settings.py")
        
        # Create a copy of the settings to modify
        default_settings = settings_py_defaults.copy()
        
        # Update version for the build
        default_settings["version"] = "2.0"
        
        # Remove metronomeSpeed if it exists
        if "metronomeSpeed" in default_settings:
            del default_settings["metronomeSpeed"]
            print("Removed metronomeSpeed from default settings")
        
        # Ensure metronome sound settings are present
        if "metronomeSound" not in default_settings:
            default_settings["metronomeSound"] = "default"
        if "metronomeVolume" not in default_settings:
            default_settings["metronomeVolume"] = 0.7
            
        print("Updated default settings from settings.py")
    except ImportError:
        print("Could not import settings.py, using hardcoded defaults")
        # Define default settings if import fails
        default_settings = {
            "favorites": [],
            "punishments": [],
            "favoritesCompletedCount": 0,
            "punishmentsCompletedCount": 0,
            "timerMin": "30",
            "timerMax": "120",
            "soundEnabled": True,
            "metronomeSound": "default",
            "metronomeVolume": 0.7,
            "contentSource": "reddit",
            "punishmentsEnabled": False,
            "autoCycleEnabled": True,
            "videoTimerSoftLimitEnabled": True,
            "enabledContentFolders": [],
            "enabledPunishmentFolders": [],
            "version": "2.0",
            "lastUpdated": None
        }
    
    # Check if user_settings.json exists and back it up if it does
    user_settings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_settings.json')
    if os.path.exists(user_settings_path):
        backup_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_settings.backup.json')
        print(f"Backing up existing user_settings.json to {backup_path}")
        shutil.copy2(user_settings_path, backup_path)
    
    # Write default settings to user_settings.json for the build
    with open(user_settings_path, 'w') as f:
        json.dump(default_settings, f, indent=2)

def backup_test_content():
    """Backup and remove test content from static folders"""
    print("Checking for test content to exclude from build...")
    
    # Define paths for static content folders
    static_content_dir = os.path.join('static', 'custom_content')
    static_punishment_dir = os.path.join('static', 'custom_punishment')
    
    # Define paths for temporary backup folders
    temp_content_backup = os.path.join('static', 'custom_content_backup')
    temp_punishment_backup = os.path.join('static', 'custom_punishment_backup')
    
    # Track what we backed up
    backed_up = {
        'content': False,
        'punishment': False
    }
    
    # Handle custom content
    if os.path.exists(static_content_dir) and os.listdir(static_content_dir):
        print(f"Found test content in {static_content_dir}, backing up...")
        try:
            # Create backup directory
            os.makedirs(temp_content_backup, exist_ok=True)
            
            # Move all content to backup directory
            for item in os.listdir(static_content_dir):
                src_path = os.path.join(static_content_dir, item)
                dst_path = os.path.join(temp_content_backup, item)
                if os.path.isdir(src_path):
                    shutil.copytree(src_path, dst_path)
                    shutil.rmtree(src_path)
                else:
                    shutil.copy2(src_path, dst_path)
                    os.remove(src_path)
            
            backed_up['content'] = True
            print(f"Successfully backed up test content from {static_content_dir}")
        except Exception as e:
            print(f"Error backing up test content: {str(e)}")
    else:
        print(f"No test content found in {static_content_dir}")
    
    # Handle custom punishment content
    if os.path.exists(static_punishment_dir) and os.listdir(static_punishment_dir):
        print(f"Found test punishment content in {static_punishment_dir}, backing up...")
        try:
            # Create backup directory
            os.makedirs(temp_punishment_backup, exist_ok=True)
            
            # Move all content to backup directory
            for item in os.listdir(static_punishment_dir):
                src_path = os.path.join(static_punishment_dir, item)
                dst_path = os.path.join(temp_punishment_backup, item)
                if os.path.isdir(src_path):
                    shutil.copytree(src_path, dst_path)
                    shutil.rmtree(src_path)
                else:
                    shutil.copy2(src_path, dst_path)
                    os.remove(src_path)
            
            backed_up['punishment'] = True
            print(f"Successfully backed up test punishment content from {static_punishment_dir}")
        except Exception as e:
            print(f"Error backing up test punishment content: {str(e)}")
    else:
        print(f"No test punishment content found in {static_punishment_dir}")
    
    # Ensure the directories still exist (empty) for the build process
    os.makedirs(static_content_dir, exist_ok=True)
    os.makedirs(static_punishment_dir, exist_ok=True)
    
    # Create placeholder README files to explain the empty folders
    with open(os.path.join(static_content_dir, 'README.txt'), 'w') as f:
        f.write("This folder is for custom content.\n")
        f.write("The build process excludes test content from being packaged.\n")
    
    with open(os.path.join(static_punishment_dir, 'README.txt'), 'w') as f:
        f.write("This folder is for custom punishment content.\n")
        f.write("The build process excludes test content from being packaged.\n")
    
    return backed_up

def restore_test_content(backed_up):
    """Restore test content after build process"""
    print("Checking for test content to restore...")
    
    # Define paths for static content folders
    static_content_dir = os.path.join('static', 'custom_content')
    static_punishment_dir = os.path.join('static', 'custom_punishment')
    
    # Define paths for temporary backup folders
    temp_content_backup = os.path.join('static', 'custom_content_backup')
    temp_punishment_backup = os.path.join('static', 'custom_punishment_backup')
    
    # Restore custom content if it was backed up
    if backed_up.get('content') and os.path.exists(temp_content_backup):
        print(f"Restoring test content to {static_content_dir}...")
        try:
            # Remove placeholder README
            readme_path = os.path.join(static_content_dir, 'README.txt')
            if os.path.exists(readme_path):
                os.remove(readme_path)
            
            # Move all content back from backup directory
            for item in os.listdir(temp_content_backup):
                src_path = os.path.join(temp_content_backup, item)
                dst_path = os.path.join(static_content_dir, item)
                if os.path.isdir(src_path):
                    shutil.copytree(src_path, dst_path)
                else:
                    shutil.copy2(src_path, dst_path)
            
            # Remove backup directory
            shutil.rmtree(temp_content_backup)
            print(f"Successfully restored test content to {static_content_dir}")
        except Exception as e:
            print(f"Error restoring test content: {str(e)}")
    
    # Restore custom punishment content if it was backed up
    if backed_up.get('punishment') and os.path.exists(temp_punishment_backup):
        print(f"Restoring test punishment content to {static_punishment_dir}...")
        try:
            # Remove placeholder README
            readme_path = os.path.join(static_punishment_dir, 'README.txt')
            if os.path.exists(readme_path):
                os.remove(readme_path)
            
            # Move all content back from backup directory
            for item in os.listdir(temp_punishment_backup):
                src_path = os.path.join(temp_punishment_backup, item)
                dst_path = os.path.join(static_punishment_dir, item)
                if os.path.isdir(src_path):
                    shutil.copytree(src_path, dst_path)
                else:
                    shutil.copy2(src_path, dst_path)
            
            # Remove backup directory
            shutil.rmtree(temp_punishment_backup)
            print(f"Successfully restored test punishment content to {static_punishment_dir}")
        except Exception as e:
            print(f"Error restoring test punishment content: {str(e)}")

def ensure_sound_files():
    """Ensure all metronome sound files are present"""
    print("Checking and creating metronome sound files...")
    
    # Check for default metronome sound in static root directory
    default_metronome_path = os.path.join('static', 'metronome.wav')
    if not os.path.exists(default_metronome_path):
        print(f"Default metronome sound not found at {default_metronome_path}, creating placeholder...")
        # Create an empty file to ensure the path exists
        with open(default_metronome_path, 'wb') as f:
            # Write a minimal valid WAV file header (8 bytes)
            f.write(b'RIFF\x04\x00\x00\x00WAVE')
        print(f"Created placeholder for default metronome sound at {default_metronome_path}")
    else:
        print(f"Found default metronome sound at {default_metronome_path}")
    
    # Create sounds directory if it doesn't exist
    sounds_dir = os.path.join('static', 'sounds')
    os.makedirs(sounds_dir, exist_ok=True)
    
    # List of expected sound files in the sounds directory
    sound_files = [
        ('metronome-click.mp3', 'Click sound for metronome'),
        ('metronome-beep.mp3', 'Beep sound for metronome'),
        ('metronome-soft.mp3', 'Soft sound for metronome'),
        ('metronome-wood.mp3', 'Wood sound for metronome')
    ]
    
    # Check if each sound file exists, create placeholder if not
    for sound_file, description in sound_files:
        sound_path = os.path.join(sounds_dir, sound_file)
        if not os.path.exists(sound_path):
            print(f"Creating placeholder for {sound_file}...")
            # Create an empty MP3 file to ensure the path exists
            with open(sound_path, 'wb') as f:
                # Write a minimal valid MP3 file header (4 bytes)
                f.write(b'ID3\x03')
            print(f"Created placeholder for {sound_file} at {sound_path}")
            
            # Also create a README explaining the placeholder
            with open(sound_path + '.README.txt', 'w') as f:
                f.write(f"This is a placeholder for {sound_file}\n")
                f.write(f"{description}\n\n")
                f.write("Please replace this file with an actual sound file.\n")
                f.write("The file should be in MP3 format and named exactly as this README.\n")

def build_executable():
    """Build the executable using PyInstaller"""
    print("Building executable with PyInstaller...")
    
    # Ensure sound files are present
    ensure_sound_files()
    
    # PyInstaller command
    pyinstaller_cmd = [
        'pyinstaller',
        '--name=Goon',
        '--clean',
        '--onefile',
        '--add-data', 'templates;templates',
        '--add-data', 'static;static',  # Include all static files
        '--add-data', 'static/metronome.wav;static',  # Explicitly include default metronome sound
        '--add-data', 'static/sounds;static/sounds',  # Explicitly include sounds directory
        '--add-data', 'user_content;user_content',
        # PRAW imports
        '--hidden-import=praw',
        '--hidden-import=praw.models',
        '--hidden-import=praw.config',
        '--hidden-import=praw.util',
        '--hidden-import=praw.util.token_manager',
        '--hidden-import=praw.exceptions',
        # Flask imports
        '--hidden-import=flask',
        '--hidden-import=dotenv',
        '--hidden-import=flask.templating',
        '--hidden-import=werkzeug',
        # Add options to reduce false positives (these are safe additions)
        '--noupx'                # Disable UPX compression which often triggers AV
    ]
    
    # Add favicon if it exists
    favicon_path = os.path.join('static', 'favicon.ico')
    if os.path.exists(favicon_path):
        pyinstaller_cmd.extend(['--icon', favicon_path])
    
    # Add the main script
    pyinstaller_cmd.append('launcher.py')
    
    # Run PyInstaller
    try:
        subprocess.run(pyinstaller_cmd, check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error running PyInstaller: {str(e)}")
        return False
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return False

def restore_user_files():
    """Restore user settings after build"""
    # Restore user_settings.json if backup exists
    backup_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_settings.backup.json')
    user_settings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_settings.json')
    
    if os.path.exists(backup_path):
        print("Restoring user_settings.json from backup...")
        try:
            shutil.copy2(backup_path, user_settings_path)
            os.remove(backup_path)
        except Exception as e:
            print(f"Error restoring user settings: {str(e)}")



def create_version_info():
    """Create a version info file for the build"""
    print("Creating version info file...")
    
    version_info = {
        "version": "2.0.0",
        "build_date": "2025-05-23",
        "features": [
            "External content window handling",
            "Multiple metronome sound options",
            "Automatic BPM generation",
            "Improved Reddit content display"
        ],
        "requirements": {
            "python": "3.8+",
            "flask": "2.0+",
            "praw": "7.0+"
        }
    }
    
    # Write version info to file
    version_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'version.json')
    with open(version_path, 'w') as f:
        json.dump(version_info, f, indent=2)
    
    return version_info

def main():
    """Main build process"""
    print("Starting build process for Goon v2.0...")
    
    # Clean previous build artifacts
    clean_build_directories()
    
    # Backup credentials if they exist
    had_credentials = backup_credentials()
    
    # Backup user settings if they exist
    had_settings = backup_settings()
    
    # Backup test content to exclude it from the build
    test_content_backup = backup_test_content()
    
    # Create user content directories
    user_content_dir = create_user_content_directories()
    
    # Create default settings for build
    create_default_settings()
    
    # Create version info
    version_info = create_version_info()
    
    # Build the executable
    build_success = build_executable()
    
    # Restore user files
    restore_user_files()
    
    # Restore credentials if they existed
    if had_credentials:
        restore_credentials()
    
    # Restore test content after build is complete
    restore_test_content(test_content_backup)
    
    if build_success:
        print("\nBuild completed successfully!")
        print(f"Goon v{version_info['version']} is located in the 'dist' folder")
        print("\nFeatures in this version:")
        for feature in version_info['features']:
            print(f"  - {feature}")
        print("\nUser content will be stored in a 'user_content' folder next to the executable.")
        print("\nSound files are located in the 'static/sounds' directory.")
        print("\nNote: Some antivirus software may still flag the executable as suspicious.")
        print("This is a common issue with PyInstaller applications and is usually a false positive.")
        print("Consider adding an exception in your antivirus software if needed.")
    else:
        print("\nBuild failed. Check the output above for errors.")
        
    print("\nPress Enter to exit...")
    input()

if __name__ == "__main__":
    main()
