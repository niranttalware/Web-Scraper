"""
app.py — Flask application entry point.

Responsibilities:
  - Create the Flask app
  - Register blueprints (route modules)
  - Start the server

All business logic lives in routes/, services/, and db/.
"""

import sys
import os

# Make sure the backend directory is on the Python path so sub-packages resolve.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from flask_cors import CORS

from routes.scrape_routes import scrape_bp
from routes.history_routes import history_bp
from routes.download_routes import download_bp


def create_app():
    app = Flask(__name__)
    CORS(app)

    # Register all route blueprints
    app.register_blueprint(scrape_bp)
    app.register_blueprint(history_bp)
    app.register_blueprint(download_bp)
    
    from routes.auth_routes import auth_bp
    app.register_blueprint(auth_bp)

    from db import get_db
    get_db()

    return app


app = create_app()

if __name__ == '__main__':
    print('Starting Web Scraper Backend...')
    print('PostgreSQL integration active — history is now persistent.')
    app.run(port=5000, debug=True)
