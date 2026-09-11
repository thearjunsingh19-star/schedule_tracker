import os
import json
import sqlite3
import urllib.parse
from datetime import datetime, timedelta

DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("SQLITE_PATH") or (
    "/tmp/schedule_tracker.db" if os.environ.get("VERCEL") and not os.environ.get("DATABASE_URL")
    else os.path.join(DB_DIR, "schedule_tracker.db")
)

DATABASE_URL = os.environ.get("DATABASE_URL")

def is_postgres():
    return bool(DATABASE_URL and (DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://")))

def get_db_connection():
    if is_postgres():
        url = DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        parsed = urllib.parse.urlparse(url)
        
        # Try pg8000 first (pure-Python, zero binary compilation), then psycopg2
        try:
            import ssl
            import pg8000.dbapi
            ssl_ctx = ssl.create_default_context()
            conn = pg8000.dbapi.connect(
                user=parsed.username,
                password=parsed.password,
                host=parsed.hostname,
                port=parsed.port or 5432,
                database=parsed.path.lstrip("/"),
                ssl_context=ssl_ctx
            )
            return conn
        except ImportError:
            try:
                import psycopg2
                import psycopg2.extras
                conn = psycopg2.connect(url)
                return conn
            except ImportError:
                raise RuntimeError("PostgreSQL DATABASE_URL provided but neither pg8000 nor psycopg2 is installed.")
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

class DictCursorWrapper:
    """Wrapper to provide consistent dict-like row access across SQLite and PostgreSQL."""
    def __init__(self, cursor, is_pg):
        self.cursor = cursor
        self.is_pg = is_pg

    def execute(self, sql, params=None):
        if self.is_pg:
            # Convert SQLite '?' placeholders to PostgreSQL '%s'
            sql = sql.replace("?", "%s")
            # Replace AUTOINCREMENT with SERIAL for table creations
            sql = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
            sql = sql.replace("INSERT OR IGNORE INTO", "INSERT INTO")
            if params is None:
                return self.cursor.execute(sql)
            return self.cursor.execute(sql, params)
        else:
            if params is None:
                return self.cursor.execute(sql)
            return self.cursor.execute(sql, params)

    def executemany(self, sql, seq_of_params):
        if self.is_pg:
            sql = sql.replace("?", "%s")
        return self.cursor.executemany(sql, seq_of_params)

    def fetchone(self):
        row = self.cursor.fetchone()
        if row is None:
            return None
        if isinstance(row, dict):
            return row
        if hasattr(row, 'keys'): # sqlite3.Row
            return dict(row)
        # Tuple from pg8000/psycopg2
        col_names = [d[0] for d in self.cursor.description]
        return dict(zip(col_names, row))

    def fetchall(self):
        rows = self.cursor.fetchall()
        if not rows:
            return []
        if isinstance(rows[0], dict):
            return rows
        if hasattr(rows[0], 'keys'):
            return [dict(r) for r in rows]
        col_names = [d[0] for d in self.cursor.description]
        return [dict(zip(col_names, r)) for r in rows]

    @property
    def lastrowid(self):
        return getattr(self.cursor, 'lastrowid', None)

    def close(self):
        self.cursor.close()

def get_cursor(conn):
    return DictCursorWrapper(conn.cursor(), is_postgres())

def init_db():
    conn = get_db_connection()
    cur = get_cursor(conn)
    is_pg = is_postgres()

    # 1. Users table
    if is_pg:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            display_name VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
    else:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """)

    # 2. Tasks table
    if is_pg:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            category VARCHAR(50) DEFAULT 'General',
            priority VARCHAR(20) DEFAULT 'Medium',
            days_of_week TEXT DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]',
            color VARCHAR(20) DEFAULT '#3b82f6',
            target_time VARCHAR(20) DEFAULT '',
            is_archived INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
    else:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT DEFAULT 'General',
            priority TEXT DEFAULT 'Medium',
            days_of_week TEXT DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]',
            color TEXT DEFAULT '#3b82f6',
            target_time TEXT DEFAULT '',
            is_archived INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """)

    # 3. Completions table
    if is_pg:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS completions (
            id SERIAL PRIMARY KEY,
            task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            date VARCHAR(10) NOT NULL,
            completed INTEGER DEFAULT 1,
            notes TEXT DEFAULT '',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(task_id, date)
        );
        """)
    else:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            date TEXT NOT NULL,
            completed INTEGER DEFAULT 1,
            notes TEXT DEFAULT '',
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(task_id, date)
        );
        """)

    # Schema migration for existing SQLite database without user_id column
    if not is_pg:
        cur.execute("PRAGMA table_info(tasks)")
        columns = [row['name'] for row in cur.fetchall()]
        if 'user_id' not in columns:
            try:
                cur.execute("ALTER TABLE tasks ADD COLUMN user_id INTEGER DEFAULT 1")
            except Exception:
                pass

    conn.commit()

    # Create default demo user if no users exist
    cur.execute("SELECT COUNT(*) as cnt FROM users")
    count_row = cur.fetchone()
    user_count = count_row['cnt'] if count_row else 0

    if user_count == 0:
        from werkzeug.security import generate_password_hash
        # Seed default account: arjun / password123
        default_pwd_hash = generate_password_hash("password123")
        if is_pg:
            cur.execute("""
            INSERT INTO users (username, password_hash, display_name)
            VALUES (?, ?, ?) RETURNING id
            """, ("arjun", default_pwd_hash, "Arjun"))
            uid_row = cur.fetchone()
            default_user_id = uid_row['id'] if uid_row else 1
        else:
            cur.execute("""
            INSERT INTO users (username, password_hash, display_name)
            VALUES (?, ?, ?)
            """, ("arjun", default_pwd_hash, "Arjun"))
            default_user_id = cur.lastrowid or 1
            # Update any unassigned tasks to this default user
            cur.execute("UPDATE tasks SET user_id = ? WHERE user_id IS NULL OR user_id = 1", (default_user_id,))

        conn.commit()

        # Check if tasks exist for this user
        cur.execute("SELECT COUNT(*) as cnt FROM tasks WHERE user_id = ?", (default_user_id,))
        task_count_row = cur.fetchone()
        task_count = task_count_row['cnt'] if task_count_row else 0
        if task_count == 0:
            seed_starter_tasks_for_user(default_user_id, conn)

    conn.commit()
    conn.close()

# =========================================================================
# User Management Functions
# =========================================================================

def get_user_by_username(username):
    """Case-insensitive username lookup."""
    if not username:
        return None
    conn = get_db_connection()
    cur = get_cursor(conn)
    cur.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username.strip(),))
    user = cur.fetchone()
    conn.close()
    return user

def get_user_by_id(user_id):
    if not user_id:
        return None
    conn = get_db_connection()
    cur = get_cursor(conn)
    cur.execute("SELECT id, username, display_name, created_at FROM users WHERE id = ?", (user_id,))
    user = cur.fetchone()
    conn.close()
    return user

def create_user(username, password_hash, display_name=None):
    """Creates a new user profile and seeds default habits/tasks."""
    username = username.strip()
    if not display_name or not display_name.strip():
        display_name = username.capitalize()
    else:
        display_name = display_name.strip()

    # Check duplicate username
    if get_user_by_username(username):
        return None, "Username already exists. Please choose a different username."

    conn = get_db_connection()
    cur = get_cursor(conn)
    is_pg = is_postgres()

    if is_pg:
        cur.execute("""
        INSERT INTO users (username, password_hash, display_name)
        VALUES (?, ?, ?) RETURNING id, username, display_name
        """, (username, password_hash, display_name))
        new_user = cur.fetchone()
        user_id = new_user['id']
    else:
        cur.execute("""
        INSERT INTO users (username, password_hash, display_name)
        VALUES (?, ?, ?)
        """, (username, password_hash, display_name))
        user_id = cur.lastrowid
        cur.execute("SELECT id, username, display_name FROM users WHERE id = ?", (user_id,))
        new_user = cur.fetchone()

    conn.commit()

    # Automatically seed starter tasks for new profile
    seed_starter_tasks_for_user(user_id, conn)
    conn.close()

    return new_user, None

def seed_starter_tasks_for_user(user_id, conn=None):
    close_conn = False
    if conn is None:
        conn = get_db_connection()
        close_conn = True
    cur = get_cursor(conn)
    is_pg = is_postgres()

    sample_tasks = [
        (
            user_id,
            "Morning Exercise & Stretch",
            "30-minute cardio or yoga session to kickstart energy",
            "Health",
            "High",
            json.dumps(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
            "#10b981",
            "07:30"
        ),
        (
            user_id,
            "Review Daily Goals & Plan",
            "Prioritize top 3 high-impact tasks for the day",
            "Work",
            "High",
            json.dumps(["mon", "tue", "wed", "thu", "fri"]),
            "#3b82f6",
            "09:00"
        ),
        (
            user_id,
            "Deep Work Focus Block",
            "90 minutes uninterrupted coding/creative focus",
            "Work",
            "High",
            json.dumps(["mon", "tue", "wed", "thu", "fri"]),
            "#6366f1",
            "10:30"
        ),
        (
            user_id,
            "Read 20 Pages (Book / Articles)",
            "Continuous learning & industry insights",
            "Study",
            "Medium",
            json.dumps(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
            "#8b5cf6",
            "20:00"
        ),
        (
            user_id,
            "Evening Walk & Hydration Check",
            "Unwind and hit daily 10k step goal",
            "Personal",
            "Low",
            json.dumps(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
            "#ec4899",
            "19:00"
        ),
        (
            user_id,
            "Weekly Review & Financial Check",
            "Audit expenses, plan upcoming schedule & clean desk",
            "Chores",
            "Medium",
            json.dumps(["sun"]),
            "#f59e0b",
            "16:00"
        )
    ]

    for task in sample_tasks:
        cur.execute("""
        INSERT INTO tasks (user_id, title, description, category, priority, days_of_week, color, target_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, task)

    conn.commit()

    # Get created task IDs for seeding initial completions
    cur.execute("SELECT id FROM tasks WHERE user_id = ? ORDER BY id ASC", (user_id,))
    task_rows = cur.fetchall()
    task_ids = [r['id'] for r in task_rows]

    today = datetime.now().date()
    start_of_week = today - timedelta(days=today.weekday())

    for i in range(today.weekday() + 1):
        day_date = (start_of_week + timedelta(days=i)).strftime("%Y-%m-%d")
        if task_ids:
            cur.execute("""
            INSERT INTO completions (task_id, date, completed) VALUES (?, ?, 1)
            ON CONFLICT (task_id, date) DO NOTHING
            """ if is_pg else """
            INSERT OR IGNORE INTO completions (task_id, date, completed) VALUES (?, ?, 1)
            """, (task_ids[0], day_date))
        if len(task_ids) > 1 and i % 2 == 0:
            cur.execute("""
            INSERT INTO completions (task_id, date, completed) VALUES (?, ?, 1)
            ON CONFLICT (task_id, date) DO NOTHING
            """ if is_pg else """
            INSERT OR IGNORE INTO completions (task_id, date, completed) VALUES (?, ?, 1)
            """, (task_ids[1], day_date))
        if len(task_ids) > 3 and i in [0, 1]:
            cur.execute("""
            INSERT INTO completions (task_id, date, completed) VALUES (?, ?, 1)
            ON CONFLICT (task_id, date) DO NOTHING
            """ if is_pg else """
            INSERT OR IGNORE INTO completions (task_id, date, completed) VALUES (?, ?, 1)
            """, (task_ids[3], day_date))

    conn.commit()
    if close_conn:
        conn.close()

# =========================================================================
# Multi-User Task & Completion Query Functions
# =========================================================================

def get_all_tasks(user_id, include_archived=False):
    conn = get_db_connection()
    cur = get_cursor(conn)
    if include_archived:
        cur.execute("""
        SELECT * FROM tasks 
        WHERE user_id = ? 
        ORDER BY priority = 'High' DESC, priority = 'Medium' DESC, id ASC
        """, (user_id,))
    else:
        cur.execute("""
        SELECT * FROM tasks 
        WHERE user_id = ? AND is_archived = 0 
        ORDER BY priority = 'High' DESC, priority = 'Medium' DESC, id ASC
        """, (user_id,))
    rows = cur.fetchall()
    for row in rows:
        try:
            row['days_of_week'] = json.loads(row['days_of_week']) if row['days_of_week'] else []
        except Exception:
            row['days_of_week'] = []
    conn.close()
    return rows

def get_task_by_id(task_id, user_id=None):
    conn = get_db_connection()
    cur = get_cursor(conn)
    if user_id:
        cur.execute("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
    else:
        cur.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = cur.fetchone()
    conn.close()
    if row:
        try:
            row['days_of_week'] = json.loads(row['days_of_week']) if row['days_of_week'] else []
        except Exception:
            row['days_of_week'] = []
        return row
    return None

def create_task(user_id, data):
    conn = get_db_connection()
    cur = get_cursor(conn)
    is_pg = is_postgres()
    days = data.get('days_of_week', ["mon","tue","wed","thu","fri","sat","sun"])
    days_json = json.dumps(days)

    if is_pg:
        cur.execute("""
        INSERT INTO tasks (user_id, title, description, category, priority, days_of_week, color, target_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
        """, (
            user_id,
            data.get('title', '').strip(),
            data.get('description', '').strip(),
            data.get('category', 'General').strip(),
            data.get('priority', 'Medium'),
            days_json,
            data.get('color', '#3b82f6'),
            data.get('target_time', '').strip()
        ))
        res = cur.fetchone()
        task_id = res['id']
    else:
        cur.execute("""
        INSERT INTO tasks (user_id, title, description, category, priority, days_of_week, color, target_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            data.get('title', '').strip(),
            data.get('description', '').strip(),
            data.get('category', 'General').strip(),
            data.get('priority', 'Medium'),
            days_json,
            data.get('color', '#3b82f6'),
            data.get('target_time', '').strip()
        ))
        task_id = cur.lastrowid

    conn.commit()
    conn.close()
    return get_task_by_id(task_id, user_id)

def update_task(task_id, user_id, data):
    conn = get_db_connection()
    cur = get_cursor(conn)
    days = data.get('days_of_week', ["mon","tue","wed","thu","fri","sat","sun"])
    days_json = json.dumps(days)
    cur.execute("""
    UPDATE tasks 
    SET title = ?, description = ?, category = ?, priority = ?, days_of_week = ?, color = ?, target_time = ?
    WHERE id = ? AND user_id = ?
    """, (
        data.get('title', '').strip(),
        data.get('description', '').strip(),
        data.get('category', 'General').strip(),
        data.get('priority', 'Medium'),
        days_json,
        data.get('color', '#3b82f6'),
        data.get('target_time', '').strip(),
        task_id,
        user_id
    ))
    conn.commit()
    conn.close()
    return get_task_by_id(task_id, user_id)

def delete_task(task_id, user_id):
    conn = get_db_connection()
    cur = get_cursor(conn)
    cur.execute("DELETE FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
    conn.commit()
    conn.close()
    return True

def toggle_completion(task_id, user_id, date_str):
    # Verify task belongs to this user
    task = get_task_by_id(task_id, user_id)
    if not task:
        return None

    conn = get_db_connection()
    cur = get_cursor(conn)
    cur.execute("SELECT id, completed FROM completions WHERE task_id = ? AND date = ?", (task_id, date_str))
    row = cur.fetchone()

    if row:
        new_state = 0 if row['completed'] == 1 else 1
        cur.execute("UPDATE completions SET completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_state, row['id']))
        completed = bool(new_state)
    else:
        cur.execute("INSERT INTO completions (task_id, date, completed) VALUES (?, ?, 1)", (task_id, date_str))
        completed = True

    conn.commit()
    conn.close()
    return {"task_id": task_id, "date": date_str, "completed": completed}

def get_completions_for_period(user_id, start_date_str, end_date_str):
    conn = get_db_connection()
    cur = get_cursor(conn)
    cur.execute("""
    SELECT c.task_id, c.date, c.completed 
    FROM completions c
    INNER JOIN tasks t ON c.task_id = t.id
    WHERE t.user_id = ? AND c.date >= ? AND c.date <= ? AND c.completed = 1
    """, (user_id, start_date_str, end_date_str))
    rows = cur.fetchall()
    conn.close()

    res = {}
    for r in rows:
        key = f"{r['task_id']}_{r['date']}"
        res[key] = True
    return res

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
