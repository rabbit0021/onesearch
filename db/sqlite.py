# db/sqlite.py
import sqlite3
from threading import Lock
from logger_config import get_logger

logger = get_logger("DATABASE")

class SQLiteDatabase:
    _instance = None
    _lock = Lock()

    def __init__(self, db_path):
        self.db_path = db_path
        self.conn = None
        self._connect()
        conn = self.get_connection()
        c = conn.cursor()
        
        # Ensure tables
        c.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT,
            heading TEXT,
            style_version INTEGER,
            post_url TEXT,
            post_title TEXT,
            deleted BOOL DEFAULT 0
        )
        """)
        c.execute("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT,
            publisher_id INTEGER,
            joined_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            topic TEXT NOT NULL CHECK (topic IN ('Software Engineering', 'Data Analytics', 'Data Science', 'Software Testing', 'Product Management')),
            last_notified_at DATETIME DEFAULT NULL,
            FOREIGN KEY (publisher_id) REFERENCES publishers(id),
            UNIQUE (email, publisher_id, topic)
        )
        """)
        c.execute("""
        CREATE TABLE IF NOT EXISTS publishers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            publisher_name TEXT NOT NULL,
            publisher_type TEXT NOT NULL CHECK (publisher_type IN ('techteam', 'individual', 'community')),
            last_scraped_at DATETIME DEFAULT NULL,
            UNIQUE (publisher_name)
        )
        """)
        logger.info(f"SQLite database initialized Successfully")
        conn.commit()

    def _connect(self):
        if self.conn:
            try:
                self.conn.execute("SELECT 1")
                return  # connection is still alive
            except Exception:
                self.close()
                
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        logger.info("Connection Initialized")

    def get_connection(self):
        self._connect()
        return self.conn

    def close(self):
        if self.conn:
            try:
                self.conn.close()
            except Exception:
                pass
            self.conn = None
    
    def get_subscriptions(self, conn):
        c = conn.cursor()
        c.execute("""
            SELECT s.email, s.publisher_id, s.joined_time, s.last_notified_at,
               p.id as publisher_id, p.publisher_name, p.category, p.sub_category
            FROM subscriptions s
            JOIN publishers p ON s.publisher_id = p.id
        """)
        rows = c.fetchall()
        result = []
        for row in rows:
            subscription = {
            "email": row["email"],
            "publisher_id": row["publisher_id"],
            "joined_time": row["joined_time"],
            "last_notified_at": row["last_notified_at"],
            "publisher": {
                "id": row["publisher_id"],
                "name": row["publisher_name"],
                "category": row["category"],
                "sub_category": row["sub_category"]
                }
            }
            result.append(subscription)
        return result

    def get_subscriptions_by_email(self, conn, email):
        query = """
            SELECT s.email, s.topic, s.publisher_id, s.joined_time, s.last_notified_at,
                   p.id AS publisher_id, p.publisher_name
            FROM (
                SELECT *
                FROM subscriptions
                WHERE email = ?
            ) s
            JOIN publishers p ON s.publisher_id = p.id
        """
        cursor = conn.execute(query, (email,))
        return [
            {
                "email": row["email"],
                "topic": row["topic"],
                "publisher_id": row["publisher_id"],
                "joined_time": row["joined_time"],
                "last_notified_at": row["last_notified_at"],
                "publisher": {
                    "id": row["publisher_id"],
                    "name": row["publisher_name"]
                },
            }
            for row in cursor.fetchall()
        ]  
    
    def get_subscriptions_by_publisher(self, conn, publisher_id):
        c = conn.cursor()
        c.execute("""
            SELECT s.email, s.topic, s.joined_time, s.last_notified_at
            FROM subscriptions s
            JOIN publishers p ON s.publisher_id = p.id
            WHERE p.id = ?
        """, (publisher_id,))
        rows = c.fetchall()
        return [
            {
                "email": row["email"],
                "topic": row["topic"],
                "joined_time": row["joined_time"],
                "last_notified_at": row["last_notified_at"]
            }
            for row in rows
        ]  


    def add_subscription(self, conn, email, topic, publisher_id, joined_time=None):
        c = conn.cursor()
        logger.info(f"Adding subscription for email: {email}, topic: {topic}, publisher_id: {publisher_id}, joined_time: {joined_time}")    

        if joined_time is None:
            # Let SQLite fill in the default CURRENT_TIMESTAMP
            c.execute("""
                INSERT INTO subscriptions (email, topic, publisher_id)
                VALUES (?, ?, ?)
            """, (email, topic, publisher_id))
        else:
            c.execute("""
                INSERT INTO subscriptions (email, topic, publisher_id, joined_time)
                VALUES (?, ?, ?, ?)
            """, (email, topic, publisher_id, joined_time))    

        logger.info(f"Subscription for {email} added successfully")
        
    def remove_subscription(self, conn, email, topic, publisher_id):
        c = conn.cursor()
        c.execute("""
            DELETE FROM subscriptions
            WHERE email = ? AND topic = ? AND publisher_id = ?
        """, (email, topic, publisher_id))
            
    def get_notifications(self, conn):
        c = conn.cursor()
        c.execute("""
            SELECT email, heading, style_version, post_url, post_title
            FROM notifications
        """)
        rows = c.fetchall()
        return [dict(row) for row in rows]

    def add_notification(self, conn, email, heading, style_version, post_url, post_title):
        logger.info(f"Adding notification: {email}, type: {post_title}")
        c = conn.cursor()
        c.execute("""
            INSERT INTO notifications (email, heading, style_version, post_url, post_title)
            VALUES (?, ?, ?, ?, ?)
        """, (email, heading, style_version, post_url, post_title))
        logger.info("notification added successfully!")
    
    def delete_notification(self, conn, email, heading, post_title):
        logger.info(f"Deleting notification: {email}, type: {post_title}")
        c = conn.cursor()
        c.execute("""
            UPDATE notifications
            SET deleted = 1
            WHERE email = ? AND heading = ? AND post_title = ?
        """, (email, heading, post_title))
        logger.info("notification deleted successfully!")
    
    def delete_notifications_by_email(self, conn, email):
        logger.info(f"Deleting all notifications for {email}")
        c = conn.cursor()
        c.execute("""
            UPDATE notifications
            SET deleted = 1
            WHERE email = ?
        """, (email,))
        logger.info("notifications deleted successfully!")
        
    def get_publishers(self, conn):
        c = conn.cursor()
        c.execute("""
            SELECT *
            FROM publishers
        """)
        rows = c.fetchall()
        return [dict(row) for row in rows]

    def get_publishers_by_type(self, conn, publisher_type):
        c = conn.cursor()
        c.execute("""
            SELECT id, publisher_name, publisher_type
            FROM publishers
            WHERE publisher_type = ?
        """, (publisher_type,))
        rows = c.fetchall()
        return [dict(row) for row in rows]
    
    def get_publisher_by_name(self, conn, name):
        c = conn.cursor()
        c.execute("""
            SELECT id, publisher_name, publisher_type
            FROM publishers
            WHERE publisher_name = ?
        """, (name,))
        rows = c.fetchall()
        return [dict(row) for row in rows]

    def add_publisher(self, conn, publisher_name, publisher_type,):
        logger.info(f"Adding publisher: {publisher_name}, type: {publisher_type}")
        c = conn.cursor()
        c.execute("""
            INSERT INTO publishers (publisher_name, publisher_type)
            VALUES (?, ?)
        """, (publisher_name, publisher_type))
        logger.info(f"Publisher {publisher_name} added successfully")
    
    def update_publisher(self, conn, publisher_id, last_scraped_at):
        logger.info(f"Updating publisher: {publisher_id}, last_scraped_at: {last_scraped_at}")
        c = conn.cursor()
        c.execute("""
            UPDATE publishers
            SET last_scraped_at = ?
            WHERE id = ?
        """, (last_scraped_at, publisher_id))
        logger.info(f"Publisher {publisher_id} updated successfully")

    @classmethod
    def get_instance(cls, db_path):
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls(db_path)
            elif cls._instance.db_path != db_path:
                raise ValueError("SQLiteDatabase already initialized with a different path")
            return cls._instance    
