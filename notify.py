import json
import sqlite3
from datetime import datetime

from handlers import ScraperFactory  # maps company -> handler class
from db import get_database
import os
from logger_config import get_logger
from classifier import classify_post
import time

def parse_datetime(dt_str):
    if dt_str is None:
        return None
    try:
        return datetime.fromisoformat(dt_str)
    except ValueError:
        print(f"Warning: invalid datetime string: {dt_str}")
        return None
    
# Load subscribers
env = os.getenv('FLASK_ENV', 'development')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

logger = get_logger("notify_worker")

db = get_database()
conn = db.get_connection()

publishers = db.get_publishers(conn)

for publisher in publishers:
    
    last_scraped_at =  parse_datetime(publisher.get("last_scraped_at"))
    
    if last_scraped_at is None:
        last_scraped_at = datetime.fromisoformat("2023-01-01T00:00:00+00:00")

    if publisher.get("publisher_type") == "techteam":

        subscribers = db.get_subscriptions_by_publisher(conn, publisher["id"])
        if not subscribers:
            logger.info(f"No subscribers found for {publisher['publisher_name']}")
            continue
        
        try:
            scraper = ScraperFactory.get_scraper(publisher["publisher_name"])
        except Exception as e:
            logger.error(f"{e}")
            pass
        
        if not scraper:
            continue

        logger.info(f"🔍 Scraping {publisher['publisher_name']} for new blog posts after {last_scraped_at}...")

        blog_posts = scraper.search_blog_posts("", last_scraped_at)
        
        if not blog_posts:
            logger.info(f"No new blog posts found for {publisher['publisher_name']}")
            continue
        
        for post in blog_posts:
            tags = ', '.join(post["categories"])
            logger.info(f"Found new post: {post['title']} published by {post['published']} with tags: {tags}")
            category = classify_post(post["title"], tags)
            if not category:
                logger.warning(f"⚠️ Could not classify post: {post['title']}")
                continue
            
            logger.info(f" {category} - Classified post '{post['title']}'")

            topic_subscribers = [sub for sub in subscribers if sub["topic"] == category]
            
            if not topic_subscribers:
                logger.info(f"No subscribers found for category '{category}' in {publisher['publisher_name']}")
                continue
            
            for subscriber in topic_subscribers:
                if category != subscriber["topic"]:
                    logger.debug(f"Skipping {subscriber['email']} for {post['title']} - category mismatch: {category} != {subscriber['topic']}")
                    continue
                
                # Add notification
                logger.info(f"Adding notification for {subscriber['email']} about {post['title']}")
                notification = {
                    "email": subscriber["email"].lower(),
                    "heading": publisher["publisher_name"] + " ," + category,
                    "style_version": "v1",
                    "post_url": post["url"],
                    "post_title": post["title"]
                }
                
                db.add_notification(conn, **notification)
                conn.commit()
                    
        
        publisher["last_scraped_at"] = datetime.now().isoformat()
        db.update_publisher(conn, publisher["id"], publisher["last_scraped_at"])
        conn.commit()


conn.close()
logger.info("Notification run ended.")