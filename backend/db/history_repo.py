"""
history_repo.py — All PostgreSQL operations for scrape history.

Public API (unchanged from MongoDB version):
  save_history_entry(entry)
  load_history()
  find_by_job_id(job_id)
  delete_by_job_id(job_id)
  update_zip_path(job_id, zip_path)

Falls back gracefully to history.json if PostgreSQL is not available,
so the app works even without a database connection.
"""

import os
import json
from datetime import datetime
import psycopg2.extras
from db import get_db

# Fallback file path (inside db/ folder, same as before)
HISTORY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'history.json')


# ── File fallback helpers ──────────────────────────────────────────────────

def _load_file():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []
    return []


def _save_file(history):
    try:
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[HistoryRepo] Failed to write history.json: {e}")


# ── Row → dict helper ──────────────────────────────────────────────────────

def _row_to_dict(row):
    """Convert a psycopg2 RealDictRow to a plain Python dict."""
    if row is None:
        return None
    d = dict(row)
    # Remove the internal serial id — frontend never needs it.
    d.pop('id', None)
    # JSONB fields come back as Python objects already; no extra parsing needed.
    return d


# ── Public API ─────────────────────────────────────────────────────────────

def save_history_entry(entry):
    """
    Save or update a history entry.
    Requires job_id. Updates if exists, inserts otherwise.
    """
    job_id = entry.get('job_id')
    user_id = entry.get('user_id')
    if not job_id:
        return

    conn = get_db()
    if conn is not None:
        try:
            sql = """
                INSERT INTO scrape_history (
                    job_id, user_id, name, safe_name, mode, job_type, urls, 
                    scraped_at, stats, zip_path, preview_data, saved_at
                ) VALUES (
                    %(job_id)s, %(user_id)s, %(name)s, %(safe_name)s, %(mode)s, %(job_type)s, %(urls)s,
                    %(scraped_at)s, %(stats)s, %(zip_path)s, %(preview_data)s, %(saved_at)s
                )
                ON CONFLICT (job_id) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    name = EXCLUDED.name,
                    safe_name = EXCLUDED.safe_name,
                    mode = EXCLUDED.mode,
                    job_type = EXCLUDED.job_type,
                    urls = EXCLUDED.urls,
                    scraped_at = EXCLUDED.scraped_at,
                    stats = EXCLUDED.stats,
                    zip_path = EXCLUDED.zip_path,
                    preview_data = EXCLUDED.preview_data,
                    saved_at = EXCLUDED.saved_at;
            """
            params = {
                'job_id':       entry.get('job_id'),
                'user_id':      entry.get('user_id'),
                'name':         entry.get('name'),
                'safe_name':    entry.get('safe_name'),
                'mode':         entry.get('mode'),
                'job_type':     entry.get('job_type', 'full_scrape'),
                'urls':         json.dumps(entry.get('urls', [])),
                'scraped_at':   entry.get('scraped_at'),
                'stats':        json.dumps(entry.get('stats', {})),
                'zip_path':     entry.get('zip_path'),
                'preview_data': json.dumps(entry.get('preview_data', {})),
                'saved_at':     datetime.now().isoformat(),
            }
            with conn.cursor() as cur:
                cur.execute(sql, params)
            print(f"[HistoryRepo] Saved job {entry.get('job_id')} to PostgreSQL.")
            return
        except Exception as e:
            print(f"[HistoryRepo] PostgreSQL write failed, using file: {e}")

    # File fallback
    history = _load_file()
    history.insert(0, entry)
    history = history[:100]
    _save_file(history)


def load_history(user_id=None):
    """Return all history entries, newest first (up to 100)."""
    pg_records = []
    conn = get_db()
    if conn is not None:
        try:
            sql = """
                SELECT * FROM scrape_history
                WHERE user_id = %s OR user_id IS NULL
                ORDER BY saved_at DESC
                LIMIT 100;
            """
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, (user_id,))
                rows = cur.fetchall()
            pg_records = [_row_to_dict(r) for r in rows]
        except Exception as e:
            print(f"[HistoryRepo] PostgreSQL read failed, using file: {e}")

    # Load local file to merge older jobs that were saved before PostgreSQL integration
    local_records = _load_file()
    
    if not conn:
        return local_records
        
    # Merge, ensuring no duplicates by job_id
    pg_job_ids = {r.get('job_id') for r in pg_records if r.get('job_id')}
    
    combined = list(pg_records)
    for entry in local_records:
        if entry.get('job_id') not in pg_job_ids:
            combined.append(entry)
            
    # Sort combined descending by saved_at
    combined.sort(key=lambda x: x.get('saved_at', ''), reverse=True)
    return combined[:100]


def find_by_job_id(job_id, user_id=None):
    """Return a single history entry by job_id, or None."""
    conn = get_db()
    if conn is not None:
        try:
            sql = "SELECT * FROM scrape_history WHERE job_id = %s AND (user_id = %s OR user_id IS NULL) LIMIT 1;"
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, (job_id, user_id))
                row = cur.fetchone()
            return _row_to_dict(row)
        except Exception as e:
            print(f"[HistoryRepo] PostgreSQL lookup failed, using file: {e}")

    history = _load_file()
    return next((e for e in history if e.get('job_id') == job_id), None)


def delete_by_job_id(job_id, user_id=None):
    """Delete a history entry. Returns True if deleted, False if not found."""
    deleted_from_pg = False
    conn = get_db()
    if conn is not None:
        try:
            sql = "DELETE FROM scrape_history WHERE job_id = %s AND (user_id = %s OR user_id IS NULL);"
            with conn.cursor() as cur:
                cur.execute(sql, (job_id, user_id))
                deleted_from_pg = cur.rowcount > 0
        except Exception as e:
            print(f"[HistoryRepo] PostgreSQL delete failed: {e}")

    # ALWAYS try to delete from local file as well, to prevent ghost records reappearing
    history = _load_file()
    updated = [e for e in history if e.get('job_id') != job_id]
    deleted_from_file = False
    if len(updated) < len(history):
        _save_file(updated)
        deleted_from_file = True

    return deleted_from_pg or deleted_from_file


def update_zip_path(job_id, zip_path):
    """Update the zip_path for an existing history entry."""
    conn = get_db()
    if conn is not None:
        try:
            sql = "UPDATE scrape_history SET zip_path = %s WHERE job_id = %s;"
            with conn.cursor() as cur:
                cur.execute(sql, (zip_path, job_id))
            return
        except Exception as e:
            print(f"[HistoryRepo] PostgreSQL update failed, using file: {e}")

    history = _load_file()
    for entry in history:
        if entry.get('job_id') == job_id:
            entry['zip_path'] = zip_path
            break
    _save_file(history)
