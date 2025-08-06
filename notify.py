import json
import sqlite3
from datetime import datetime
from handlers import ScraperFactory  # maps company -> handler class
from db import get_database

def parse_datetime(dt_str):
    if dt_str is None:
        return None
    try:
        return datetime.fromisoformat(dt_str)
    except ValueError:
        print(f"Warning: invalid datetime string: {dt_str}")
        return None

def get_notification_state(c, email, company, category):
    c.execute("""
        SELECT * from notification_state
        WHERE email = ? AND company = ? AND category = ?
    """, (email, company, category))
    row = c.fetchone()
    return row

# Load subscribers
with open("/data/subscribers.json") as f:
    subscribers = json.load(f)

db = get_database()
conn = db.get_connection()
c = conn.cursor()

# Ensure tables
c.execute("""
CREATE TABLE IF NOT EXISTS notifications (
    email TEXT,
    company TEXT,
    category TEXT,
    post_url TEXT,
    post_title TEXT,
    notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (email, company, category, post_title)
)
""")
c.execute("""
CREATE TABLE IF NOT EXISTS notification_state (
    email TEXT,
    company TEXT,
    category TEXT,
    last_notified_at DATETIME,
    PRIMARY KEY (email, company, category)
)
""")
conn.commit()

# Organize subscriptions: email -> company -> set(categories)
sub_map = {}
for sub in subscribers:
    email = sub['email']
    company = sub['company']
    time = sub['time']
    category = sub['category']
    sub_map.setdefault(email, {}).setdefault(company, set()).add((category, time))
# Process notifications
for email, companies in sub_map.items():
    
    for company, categories in companies.items():
        scraper = ScraperFactory.get_scraper(company)
                
        if not scraper:
            print(f"⚠️ No handler found for company: {scraper}")
            continue
                
        for categorytime in categories:
            category = categorytime[0]
            joined_time = categorytime[1]
            print("working for ", email, company, category)
            # try:
            notification_state = get_notification_state(c, email, company, category)
            if not notification_state:
                time = parse_datetime(joined_time)
                c.execute("""
                    INSERT INTO notification_state
                    (email, company, category, last_notified_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(email, company, category)
                    DO UPDATE SET last_notified_at = excluded.last_notified_at
                """, (email, company, category, time))
            else:
                last_notified_at = parse_datetime(notification_state[3])
                blog_posts = scraper.search_blog_posts(notification_state[2], last_notified_at)

                if not blog_posts:
                    continue
                
                for blog in blog_posts:
                    print(f"🔔 Notifying {email} about new post: {blog['title']}")
        
                    # Insert notification
                    c.execute("""
                        INSERT INTO notifications
                        (email, company, category, post_url, post_title)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(email, company, category, post_title) DO UPDATE SET post_url=excluded.post_url
                    """, (email, company, category, blog['url'], blog['title']))
            # except Exception as e:
            #     print(f"⚠️ Error in notify for {company}/{category}: {e}")
            #     continue

# Final commit and cleanup
conn.commit()
conn.close()
print("Notification run ended.")