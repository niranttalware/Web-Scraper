"""
db/__init__.py — PostgreSQL connection singleton.

Connects using psycopg2. On first connect it automatically creates the
scrape_history table if it does not already exist.

Falls back gracefully — if PostgreSQL is unreachable, get_db() returns None
and history_repo.py will use the local history.json file instead.
"""

import psycopg2
import psycopg2.extras
from config import Config

_conn = None


# ── Schema ─────────────────────────────────────────────────────────────────

CREATE_TABLE_USERS_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS scrape_history (
    id           SERIAL PRIMARY KEY,
    job_id       TEXT UNIQUE NOT NULL,
    user_id      INTEGER REFERENCES users(id),
    name         TEXT,
    safe_name    TEXT,
    mode         TEXT,
    job_type     TEXT DEFAULT 'full_scrape',
    urls         JSONB,
    scraped_at   TEXT,
    stats        JSONB,
    zip_path     TEXT,
    preview_data JSONB,
    saved_at     TEXT
);
"""

ALTER_TABLE_SQL = """
ALTER TABLE scrape_history 
ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'full_scrape';
ALTER TABLE scrape_history
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
"""


def _build_dsn():
    """Return a psycopg2 DSN string from config values."""
    if Config.PG_DSN:
        return Config.PG_DSN
    return (
        f"host={Config.PG_HOST} "
        f"port={Config.PG_PORT} "
        f"dbname={Config.PG_DB} "
        f"user={Config.PG_USER} "
        f"password={Config.PG_PASSWORD}"
    )


def get_db():
    """
    Return a live psycopg2 connection (singleton).
    Automatically creates the scrape_history table on first connect.
    Returns None if PostgreSQL is not available.
    """
    global _conn

    # If we already have a live connection, reuse it.
    if _conn is not None:
        try:
            # Quick ping to detect dropped connections.
            _conn.cursor().execute("SELECT 1")
            return _conn
        except Exception:
            _conn = None  # Connection was dropped — reconnect below.

    try:
        dsn = _build_dsn()
        _conn = psycopg2.connect(dsn, connect_timeout=5)
        _conn.autocommit = True  # No need to call commit() after every write.

        # Ensure the table exists and schema is up to date.
        with _conn.cursor() as cur:
            cur.execute(CREATE_TABLE_USERS_SQL)
            cur.execute(CREATE_TABLE_SQL)
            cur.execute(ALTER_TABLE_SQL)

        print(f"[PostgreSQL] Connected to '{Config.PG_DB}' successfully.")
        return _conn

    except Exception as e:
        print(f"[PostgreSQL] WARNING: Could not connect: {e}")
        print("[PostgreSQL] Falling back to history.json file storage.")
        _conn = None
        return None
