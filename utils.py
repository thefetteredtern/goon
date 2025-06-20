"""
Utility functions for the Goon application.
"""
import os
import sys
import logging
import json
from datetime import datetime

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def get_application_path():
    """
    Get the absolute path to the application directory.
    Works in both development and PyInstaller environments.
    """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
        logger.info(f"Running as executable, base path: {base_path}")
        return base_path
    except Exception:
        # We are running in a normal Python environment
        # Get the directory containing the script
        base_path = os.path.dirname(os.path.abspath(__file__))
        logger.info(f"Running in development environment, base path: {base_path}")
        return base_path

def clean_subreddit_name(name):
    """
    Clean and normalize a subreddit name.
    Removes 'r/', whitespace, and converts to lowercase.
    """
    if not name:
        return ""
        
    # Remove r/ prefix if present
    if name.lower().startswith('r/'):
        name = name[2:]
        
    # Remove leading/trailing whitespace
    name = name.strip()
    
    # Convert to lowercase
    name = name.lower()
    
    # Remove any remaining invalid characters
    # Only allow alphanumeric, underscore, and hyphen
    name = ''.join(c for c in name if c.isalnum() or c == '_' or c == '-')
    
    return name
