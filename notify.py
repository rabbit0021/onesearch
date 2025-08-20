from db import get_database
from logger_config import get_logger
from datetime import timedelta, datetime

logger = get_logger("notify_worker")

def notify(db, conn):
    
    subscriptions = db.get_subscriptions(conn)    

    postcache = {}    

    for subscriber in subscriptions:
        email = subscriber['email']
        pub_id = subscriber['publisher']['id']
        pub_name = subscriber['publisher']['publisher_name']
        topic = subscriber['topic']
        logger.debug(f"working for {email} and topic: {topic} and publusher_id: {pub_id}")

        last_notified_at = subscriber['last_notified_at']
        
        if last_notified_at is None:
            last_notified_at_dt = datetime.fromisoformat(subscriber['joined_time'])
        else:
            last_notified_at_dt = datetime.fromisoformat(last_notified_at)
            
        if ((pub_id, topic)) not in postcache:
            posts = db.get_labelled_post_by_publisher_and_topic(conn, pub_id, topic)
            postcache[(pub_id, topic)] = posts
        else:
            posts = postcache[(pub_id, topic)]
        
        logger.debug(f"total posts to be notified before filtering: {len(posts)}")
        
        logger.debug(f"filtering posts afer: {last_notified_at_dt}")
        posts_filtered = [
            post for post in posts
            if datetime.fromisoformat(post['modified_at']) >= last_notified_at_dt
        ]
        
        logger.debug(f"total posts to be notified: {len(posts_filtered)}")
        
        try:
            for post in posts_filtered:
                frequency = subscriber['frequency_in_days']
                maturity_date = last_notified_at_dt + timedelta(days=frequency)
                maturity_date = maturity_date.isoformat()
                topic = post['topic']
                logger.info(f"Adding notification for {subscriber['email']} about {post['title']}")
                notification = {
                    "email": email.lower(),
                    "heading": pub_name + " ," + topic,
                    "style_version": "v1",
                    "post_url": post["url"],
                    "post_title": post["title"],
                    "maturity_date": maturity_date
                }
                
                db.add_notification(conn, **notification)
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Unable to process notifications for email: {email}, error: {e}")
    
    logger.info("Notify run ended")
    
if __name__ == "__main__":
    logger.info("Notify run started")
    db = get_database()
    conn = db.get_connection()
    notify(db, conn)
    conn.close()
    
    
    
    
    
    