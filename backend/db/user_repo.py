import psycopg2.extras
import bcrypt
from db import get_db

def create_user(email, full_name, password):
    """Creates a new user and returns the user dict on success, or None if email exists."""
    conn = get_db()
    if not conn:
        return None
    
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    try:
        sql = "INSERT INTO users (email, full_name, password_hash) VALUES (%s, %s, %s) RETURNING id, email, full_name, created_at;"
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, (email, full_name, password_hash))
            row = cur.fetchone()
        return dict(row) if row else None
    except psycopg2.IntegrityError:
        # Email already exists
        return None
    except Exception as e:
        print(f"[UserRepo] Error creating user: {e}")
        return None

def verify_user(email, password):
    """Verifies a user's password and returns the user dict on success."""
    conn = get_db()
    if not conn:
        return None
    
    try:
        sql = "SELECT * FROM users WHERE email = %s LIMIT 1;"
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, (email,))
            row = cur.fetchone()
            
        if row and bcrypt.checkpw(password.encode('utf-8'), row['password_hash'].encode('utf-8')):
            d = dict(row)
            d.pop('password_hash', None)
            return d
    except Exception as e:
        print(f"[UserRepo] Error verifying user: {e}")
    return None

def get_user_by_id(user_id):
    """Fetches a user by ID."""
    conn = get_db()
    if not conn:
        return None
        
    try:
        sql = "SELECT id, email, full_name, created_at FROM users WHERE id = %s LIMIT 1;"
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, (user_id,))
            row = cur.fetchone()
        return dict(row) if row else None
    except Exception as e:
        print(f"[UserRepo] Error fetching user: {e}")
    return None
