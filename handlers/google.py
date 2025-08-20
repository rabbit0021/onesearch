from .base import BaseScraper

BASE_URL = "https://blog.google/rss/"

class GoogleScraper(BaseScraper):
        
    def get_feed_url(self):
        return BASE_URL