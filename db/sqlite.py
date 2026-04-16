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
        conn = self.get_connection()
        c = conn.cursor()
        
        # Ensure tables
        c.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            heading TEXT NOT NULL,
            post_url TEXT NOT NULL,
            post_title TEXT NOT NULL,
            style_version INTEGER,
            deleted BOOL DEFAULT 0,
            maturity_date DATETIME NOT NULL
        )
        """)
        c.execute("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            publisher_id INTEGER NOT NULL,
            joined_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            topic TEXT NOT NULL CHECK (topic IN ('Software Engineering', 'Frontend Engineering', 'Backend Engineering', 'Mobile Engineering', 'Platform & Infrastructure', 'Data Engineering', 'Data Science', 'Machine Learning & AI', 'Data Analytics', 'Security Engineering', 'QA & Testing', 'Product Management')),
            frequency_in_days INTEGER DEFAULT 3,
            last_notified_at DATETIME DEFAULT NULL,
            active BOOL DEFAULT 1,
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
        c.execute("""
        CREATE TABLE IF NOT EXISTS posts(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            publisher_id INTEGER NOT NULL,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            tags TEXT,
            published_at DATETIME NOT NULL,
            modified_at DATETIME NOT NULL,
            labelled BOOL DEFAULT 0,
            topic TEXT NOT NULL CHECK (topic IN ('Software Engineering', 'Frontend Engineering', 'Backend Engineering', 'Mobile Engineering', 'Platform & Infrastructure', 'Data Engineering', 'Data Science', 'Machine Learning & AI', 'Data Analytics', 'Security Engineering', 'QA & Testing', 'Product Management', 'General')),
            FOREIGN KEY (publisher_id) REFERENCES publishers(id),
            UNIQUE (url)
        )
        """)
        c.execute("""
        CREATE TABLE IF NOT EXISTS post_likes (
            post_id INTEGER NOT NULL,
            jira_account_id TEXT NOT NULL,
            liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (post_id, jira_account_id),
            FOREIGN KEY (post_id) REFERENCES posts(id)
        )
        """)

        # Migration: add embedding column if it doesn't exist yet
        try:
            c.execute("ALTER TABLE posts ADD COLUMN embedding BLOB")
            logger.info("Migration: added embedding column to posts")
        except Exception:
            pass  # column already exists

        # Migration: expand topic CHECK constraints to new detailed categories
        try:
            c.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='posts'")
            row = c.fetchone()
            if row and 'Frontend Engineering' not in row[0]:
                new_post_topics = ("'Software Engineering', 'Frontend Engineering', 'Backend Engineering', "
                                   "'Mobile Engineering', 'Platform & Infrastructure', 'Data Engineering', "
                                   "'Data Science', 'Machine Learning & AI', 'Data Analytics', "
                                   "'Security Engineering', 'QA & Testing', 'Product Management', 'General'")
                new_sub_topics = ("'Software Engineering', 'Frontend Engineering', 'Backend Engineering', "
                                  "'Mobile Engineering', 'Platform & Infrastructure', 'Data Engineering', "
                                  "'Data Science', 'Machine Learning & AI', 'Data Analytics', "
                                  "'Security Engineering', 'QA & Testing', 'Product Management'")

                # Rename old Software Testing → QA & Testing
                c.execute("UPDATE posts SET topic = 'QA & Testing' WHERE topic = 'Software Testing'")
                c.execute("UPDATE subscriptions SET topic = 'QA & Testing' WHERE topic = 'Software Testing'")

                # Rebuild posts table with new constraint
                c.execute(f"""CREATE TABLE posts_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    publisher_id INTEGER NOT NULL,
                    url TEXT NOT NULL,
                    title TEXT NOT NULL,
                    tags TEXT,
                    published_at DATETIME NOT NULL,
                    modified_at DATETIME NOT NULL,
                    labelled BOOL DEFAULT 0,
                    topic TEXT NOT NULL CHECK (topic IN ({new_post_topics})),
                    embedding BLOB,
                    FOREIGN KEY (publisher_id) REFERENCES publishers(id),
                    UNIQUE (url)
                )""")
                c.execute("INSERT INTO posts_new SELECT id, publisher_id, url, title, tags, published_at, modified_at, labelled, topic, embedding FROM posts")
                c.execute("DROP TABLE posts")
                c.execute("ALTER TABLE posts_new RENAME TO posts")

                # Rebuild subscriptions table with new constraint
                c.execute(f"""CREATE TABLE subscriptions_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL,
                    publisher_id INTEGER NOT NULL,
                    joined_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    topic TEXT NOT NULL CHECK (topic IN ({new_sub_topics})),
                    frequency_in_days INTEGER DEFAULT 3,
                    last_notified_at DATETIME DEFAULT NULL,
                    active BOOL DEFAULT 1,
                    FOREIGN KEY (publisher_id) REFERENCES publishers(id),
                    UNIQUE (email, publisher_id, topic)
                )""")
                c.execute("INSERT INTO subscriptions_new SELECT * FROM subscriptions")
                c.execute("DROP TABLE subscriptions")
                c.execute("ALTER TABLE subscriptions_new RENAME TO subscriptions")

                logger.info("Migration: expanded topic categories and rebuilt posts/subscriptions tables")
        except Exception as e:
            logger.warning(f"Topic category migration failed: {e}")

        logger.info(f"SQLite database initialized Successfully")
        conn.commit()
        conn.close()

    def get_connection(self):
        """
        Always returns a new SQLite connection.
        Caller is responsible for closing it after use.
        """
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        logger.info("New SQLite connection created")
        return conn
    
    def get_subscriptions(self, conn):
        c = conn.cursor()
        c.execute("""
            SELECT s.email, s.publisher_id, s.joined_time, s.last_notified_at,
               p.id as publisher_id, p.publisher_name, p.last_scraped_at, p.publisher_type, s.topic, s.frequency_in_days
            FROM subscriptions s
            JOIN publishers p ON s.publisher_id = p.id
            WHERE s.active=1
        """)
        rows = c.fetchall()
        result = []
        for row in rows:
            subscription = {
            "email": row["email"],
            'topic': row['topic'],
            "publisher_id": row["publisher_id"],
            "joined_time": row["joined_time"],
            "last_notified_at": row["last_notified_at"],
            'frequency_in_days': row['frequency_in_days'],
            "publisher": {
                "id": row["publisher_id"],
                "publisher_name": row["publisher_name"],
                "last_scraped_at": row['last_scraped_at'],
                "publisher_type": row['publisher_type']
                }
            }
            result.append(subscription)
        return result

    def get_subscriptions_by_email(self, conn, email):
        query = """
            SELECT s.email, s.topic, s.publisher_id, s.joined_time, s.last_notified_at,
                   p.id AS publisher_id, p.publisher_name, p.last_scraped_at, p.publisher_type
            FROM (
                SELECT *
                FROM subscriptions
                WHERE email = ? and active = 1
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
                    "publisher_name": row["publisher_name"],
                    "last_scraped_at": row['last_scraped_at'],
                    "publisher_type": row['publisher_type']

                },
            }
            for row in cursor.fetchall()
        ]  
    
    def get_subscriptions_by_email_and_topic_and_publisher_id(self, conn, email, topic, publisher_id):
        query = """
            SELECT s.email, s.topic, s.publisher_id, s.joined_time, s.last_notified_at,
                   p.id AS publisher_id, p.publisher_name, p.last_scraped_at, p.publisher_type
            FROM subscriptions s
            JOIN publishers p ON s.publisher_id = p.id
            WHERE s.email = ? and s.topic = ? and s.active = 1 and  p.id = ?
        """
        cursor = conn.execute(query, (email, topic, publisher_id))
        row = cursor.fetchone()
        if row:
            return dict(row)
        else:
            return None
    
    def get_subscriptions_by_publisher(self, conn, publisher_id):
        c = conn.cursor()
        c.execute("""
            SELECT *
            FROM subscriptions s
            JOIN publishers p ON s.publisher_id = p.id
            WHERE p.id = ? and s.active=1
        """, (publisher_id,))
        rows = c.fetchall()
        return [dict(row) for row in rows]

    def add_subscription(self, conn, email, topic, publisher_id, joined_time=None, operation="", frequency=3):
        c = conn.cursor()
        logger.info(f"Adding subscription for email: {email}, topic: {topic}, publisher_id: {publisher_id}, joined_time: {joined_time}, frequency: {frequency}")   
        
        sub = self.get_subscriptions_by_email_and_topic_and_publisher_id(conn, email, topic, publisher_id); 

        if operation == "resume":
            c.execute("""
                UPDATE subscriptions
                SET last_notified_at = CURRENT_TIMESTAMP, active = 1
                WHERE id = ?
            """, (sub['id'],))
            
            logger.info(f"Subscription for {email} resumed successfully")
            
            return sub['id']

        elif not sub:
           if joined_time is None:
               # Let SQLite fill in the default CURRENT_TIMESTAMP
               c.execute("""
                   INSERT INTO subscriptions (email, topic, publisher_id, frequency_in_days)
                   VALUES (?, ?, ?, ?)
               """, (email, topic, publisher_id, frequency))
           else:
               c.execute("""
                   INSERT INTO subscriptions (email, topic, publisher_id, joined_time)
                   VALUES (?, ?, ?, ?, ?)
               """, (email, topic, publisher_id, joined_time, frequency))    
   
           logger.info(f"Subscription for {email} addeed successfully")
           
           return c.lastrowid
        else:
            logger.info(f"Subscription for {email} already exists")
            return sub['id']

    def update_subscription_last_notified(self, conn, email):
        logger.info(f"Updating subscription: {email}")
        c = conn.cursor()
        c.execute("""
                UPDATE subscriptions
                SET last_notified_at = CURRENT_TIMESTAMP
                WHERE email = ?
            """, (email, ))
        
        logger.info(f"Subscription's {email} last notified updated to current time")
        
    def remove_subscription(self, conn, id):
        c = conn.cursor()
        c.execute("""
            UPDATE subscriptions
            SET active=0
            WHERE id = ?
        """, (id,))
            
    def get_active_notifications(self, conn):
        c = conn.cursor()
        c.execute("""
            SELECT *
            FROM notifications
            WHERE deleted = 0
        """)
        rows = c.fetchall()
        return [dict(row) for row in rows]
    
    def get_notifications_by_email(self, conn, email):
        c = conn.cursor()
        c.execute("""
            SELECT *
            FROM notifications
            WHERE email = ?
        """, (email,))
        rows = c.fetchall()
        return [dict(row) for row in rows]
    
    def get_notifications_by_email_and_url(self, conn, email, url):
        c = conn.cursor()
        
        c.execute("""
            SELECT *
            FROM notifications
            WHERE email = ? and post_url = ?
        """, (email,url))
        row = c.fetchone()
        return dict(row) if row else None

    def add_notification(self, conn, email, heading, style_version, post_url, post_title, maturity_date):
        logger.info(f"Adding notification: {email}, type: {post_title}")
        
        notf = self.get_notifications_by_email_and_url(conn, email, post_url)
        
        if not notf:
            c = conn.cursor()
            c.execute("""
                INSERT INTO notifications (email, heading, style_version, post_url, post_title, maturity_date)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (email, heading, style_version, post_url, post_title, maturity_date))
            logger.info("notification added successfully!")
        else:
            logger.info("notification already existed!")

    
    def delete_notification(self, conn, email, post_url):
        logger.info(f"Deleting notification: {email}, url: {post_url}")
        c = conn.cursor()
        c.execute("""
            UPDATE notifications
            SET deleted = 1
            WHERE email = ? AND post_url = ?
        """, (email, post_url))
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
        logger.info(f"Getting publisher by name: {name}")
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
        return c.lastrowid
    
    def update_publisher(self, conn, publisher_id, last_scraped_at):
        logger.info(f"Updating publisher: {publisher_id}, last_scraped_at: {last_scraped_at}")
        c = conn.cursor()
        c.execute("""
            UPDATE publishers
            SET last_scraped_at = ?
            WHERE id = ?
        """, (last_scraped_at, publisher_id))
        logger.info(f"Publisher {publisher_id} updated successfully")
    
    def add_post(self, conn, post_url, post_title, published_by, tags, published_at, topic):
        logger.info(f"Adding post: {post_title}, published_by: {published_by}")
        c = conn.cursor()
        
        post = self.get_post_by_url(conn, post_url)
        
        if not post:
            c.execute("""
                INSERT INTO posts (url, title, publisher_id, topic, tags, published_at, modified_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (post_url, post_title, published_by, topic, tags, published_at, published_at))
            logger.info(f"post {post_title} added successfully!")
            return c.lastrowid
        else:
            logger.info(f"post {post_title} already exists!")
            return post['id']

    
    def save_post_embedding(self, conn, post_id, embedding_bytes):
        c = conn.cursor()
        c.execute("UPDATE posts SET embedding = ? WHERE id = ?", (embedding_bytes, post_id))

    def get_post_by_url(self, conn, url):
        c = conn.cursor()
        c.execute("""
            SELECT *
            FROM posts
            WHERE url = ?
        """, (url,))
        row = c.fetchone()
        return dict(row) if row else None
    
    def get_labelled_post_by_publisher_and_topic(self,conn, publisher_id, topic):
        c = conn.cursor()
        c.execute("""
            SELECT *
            FROM posts
            WHERE publisher_id = ? AND topic = ? AND labelled=1 
        """, (publisher_id, topic))
        rows = c.fetchall()
        return [dict(row) for row in rows]
    
    def get_posts(self, conn):
        c = conn.cursor()
        c.execute("""
            SELECT po.id, po.url, po.title, po.tags, po.published_at,
                   po.modified_at, po.labelled, po.topic, po.embedding,
                   p.id AS publisher_id, p.publisher_name, p.publisher_type,
                   COALESCE(lc.like_count, 0) AS like_count
            FROM posts po
            JOIN publishers p ON po.publisher_id = p.id
            LEFT JOIN (
                SELECT post_id, COUNT(*) AS like_count
                FROM post_likes
                GROUP BY post_id
            ) lc ON lc.post_id = po.id
        """)
        rows = c.fetchall()
        return [dict(row) for row in rows]

    def like_post(self, conn, post_id, jira_account_id):
        c = conn.cursor()
        c.execute(
            "INSERT OR IGNORE INTO post_likes (post_id, jira_account_id) VALUES (?, ?)",
            (post_id, jira_account_id)
        )
        conn.commit()
        c.execute("SELECT COUNT(*) FROM post_likes WHERE post_id = ?", (post_id,))
        return c.fetchone()[0]

    def get_most_liked_this_month(self, conn, limit=5):
        c = conn.cursor()
        c.execute("""
            SELECT po.id, po.url, po.title, po.tags, po.published_at,
                   po.modified_at, po.labelled, po.topic,
                   p.id AS publisher_id, p.publisher_name, p.publisher_type,
                   COUNT(pl.jira_account_id) AS like_count
            FROM post_likes pl
            JOIN posts po ON pl.post_id = po.id
            JOIN publishers p ON po.publisher_id = p.id
            WHERE strftime('%Y-%m', pl.liked_at) = strftime('%Y-%m', 'now')
              AND po.labelled = 1
            GROUP BY po.id
            ORDER BY like_count DESC
            LIMIT ?
        """, (limit,))
        rows = c.fetchall()
        return [dict(row) for row in rows]
    
    def get_posts_by_publisher_id(self, conn, pub_id):
        c = conn.cursor()
        c.execute("""
            SELECT *
            FROM posts
            WHERE publisher_id = ?
        """, (pub_id,))
        rows = c.fetchall()
        return [dict(row) for row in rows]
    
    def update_post_label(self, conn, post_id, label, tags=None):
        logger.info(f"Updating post: {post_id}, with label: {label}, tags: {tags}")
        c = conn.cursor()
        c.execute("""
            UPDATE posts
            SET topic = ?,
                tags = ?,
                modified_at = CURRENT_TIMESTAMP,
                labelled = 1
            WHERE id = ?
        """, (label, tags, post_id))
        conn.commit()  # don’t forget to commit the change
        logger.info(f"Post {post_id} updated successfully")

    @classmethod
    def get_instance(cls, db_path):
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls(db_path)
            elif cls._instance.db_path != db_path:
                raise ValueError("SQLiteDatabase already initialized with a different path")
            return cls._instance    
