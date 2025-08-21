import feedparser
from datetime import timezone
import ssl
import urllib
from logger_config import get_logger
from email.utils import parsedate_to_datetime

HEADERS = {'User-Agent': 'Mozilla/5.0'}

logger = get_logger("base-handler")

class BaseScraper:        
    def get_feed_url(self):
        return ""
    
    def scrape(self):
        feed_url = self.get_feed_url()
        context = ssl._create_unverified_context()
        feed = feedparser.parse(feed_url, request_headers={}, handlers=[urllib.request.HTTPSHandler(context=context)])
        categories = set()
        for entry in feed.entries:
            for cat in entry.get('tags', []):
                categories.add(cat.term.lower())    

        return sorted(categories)    

    def search_blog_posts(self, category, last_scan_time):
        """Search AWS blog posts matching a category and published after a specific datetime."""
        feed_url = self.get_feed_url()

        feed = feedparser.parse(feed_url)
        
        matching_posts = []    

        for entry in feed.entries:
            # Normalize tags
            categories = [tag.term.lower() for tag in entry.get("tags", [])]     

            try:
                # Parse published date using the correct format
                published = None
                if hasattr(entry, "published"):
                    published = parsedate_to_datetime(entry.published)
                elif hasattr(entry, "updated"):
                    published = parsedate_to_datetime(entry.updated)
                
                if published is None:
                   published = self.get_date_from_url(entry)
                                                          
                if last_scan_time.tzinfo is None:
                    last_scan_time = last_scan_time.replace(tzinfo=timezone.utc)
                
                # breaking the loop when first article appears having stale
                if published <= last_scan_time:
                    logger.debug(f"Skipping {entry.title}: article published on {published} before last scan time: {last_scan_time}")
                    break    
                
                matching_posts.append({
                    "title": entry.title,
                    "url": entry.link,
                    "published": published.isoformat(),
                    "tags": categories
                })   
            except Exception:
                logger.exception(f"Date parse error: {entry}") 

        return matching_posts
