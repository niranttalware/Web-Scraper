import os
from dotenv import load_dotenv

# Load .env file from the backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

class Config:
    # PostgreSQL connection settings
    PG_HOST     = os.getenv('PG_HOST', 'localhost')
    PG_PORT     = os.getenv('PG_PORT', '5432')
    PG_DB       = os.getenv('PG_DB', 'web_scraper')
    PG_USER     = os.getenv('PG_USER', 'postgres')
    PG_PASSWORD = os.getenv('PG_PASSWORD', 'postgres')
    # Full DSN (optional — overrides individual settings if set)
    PG_DSN      = os.getenv('PG_DSN', '')
    SECRET_KEY  = os.getenv('SECRET_KEY', 'dev-secret-key')
