from datetime import datetime, timezone
from db import enums
from handlers import ScraperFactory  # maps company -> handler class
from db import get_database
from logger_config import get_logger
from classifier import classify_post

def parse_datetime(dt_str):
    if dt_str is None:
        return None
    try:
        return datetime.fromisoformat(dt_str)
    except ValueError:
        print(f"Warning: invalid datetime string: {dt_str}")
        return None
    
# Load subscribers
logger = get_logger("notify_worker")

def scrape_pubs(db, conn):
    subscriptions = db.get_subscriptions(conn)  

    publishers = {}    

    for sub in subscriptions:
        pub = sub['publisher']
        publishers[pub['id']] = pub
        
    for publisher_id in publishers:
        publisher = publishers[publisher_id]
        
        last_scraped_at =  parse_datetime(publisher.get("last_scraped_at"))
        
        # if last_scraped_at is None:
        if not last_scraped_at:
            last_scraped_at = datetime.fromisoformat("2025-01-01T00:00:00+00:00")    

        if publisher.get("publisher_type") == "techteam":    

            subscribers = db.get_subscriptions_by_publisher(conn, publisher["id"])
            if not subscribers:
                logger.info(f"No subscribers found for {publisher['publisher_name']}")
                continue
            
            scraper = ScraperFactory.get_scraper(publisher["publisher_name"])
            
            if not scraper:
                continue    

            logger.info(f"🔍 Scraping {publisher['publisher_name']} for new blog posts after {last_scraped_at}...")    

            blog_posts = scraper.search_blog_posts("", last_scraped_at)
            
            if not blog_posts:
                logger.info(f"No new blog posts found for {publisher['publisher_name']}")
                continue
            
            try:
                for post in blog_posts:
                    tags = ', '.join(post["tags"])
                    logger.info(f"Found new post: {post['title']} published by {post['published']} with tags: {tags}")
                    category = classify_post(post["title"], tags)
                    if not category:
                        logger.error(f"⚠️ Could not classify post: {post['title']}")
                        category = enums.PublisherCategory.GENERAL.value
                    
                    logger.info(f" {category} - Classified post '{post['title']}'")
        
                    db.add_post(conn, post['url'], post['title'], publisher['id'], tags, post['published'], category)                    
                
                publisher["last_scraped_at"] = datetime.now(timezone.utc).isoformat()
                db.update_publisher(conn, publisher["id"], publisher["last_scraped_at"])
                conn.commit()
            except Exception as e:
                logger.exception(f"Error while scraping publisher: {publisher['publisher_name']}")
                conn.rollback()    

if __name__ == "__main__":
    logger.info("Scraping pubs started")
    db = get_database()
    conn = db.get_connection()
    scrape_pubs(db, conn)
    conn.close()
    logger.info("Scraping pubs ended")


