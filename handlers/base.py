import requests
from datetime import datetime
import feedparser
from datetime import timezone
import ssl
import urllib

HEADERS = {'User-Agent': 'Mozilla/5.0'}
class BaseScraper:
    def scrape_feed(self, feed_url):
        context = ssl._create_unverified_context()
        feed = feedparser.parse(feed_url, request_headers={}, handlers=[urllib.request.HTTPSHandler(context=context)])
        categories = set()
        print(feed)
        for entry in feed.entries:
            for cat in entry.get('tags', []):
                categories.add(cat.term.lower())    

        return sorted(categories)    

    def search_feed_blog_posts(self, feed_url, category, last_scan_time):
        """Search AWS blog posts matching a category and published after a specific datetime."""
        feed = feedparser.parse(feed_url)
        matching_posts = []    

        for entry in feed.entries:
            # Normalize tags
            categories = [tag.term.lower() for tag in entry.get("tags", [])]    

            if category.lower() not in categories:
                continue    

            try:
                # Parse published date using the correct format
                published = datetime.strptime(entry.published, "%a, %d %b %Y %H:%M:%S %z")
            except ValueError as e:
                print(f"Date parse error: {entry.published} -> {e}")
                continue
            
            if last_scan_time.tzinfo is None:
                last_scan_time = last_scan_time.replace(tzinfo=timezone.utc)
            if published <= last_scan_time:
                continue    

            matching_posts.append({
                "title": entry.title,
                "url": entry.link,
                "published": published.isoformat(),
                "categories": categories
            })    

        return matching_posts
