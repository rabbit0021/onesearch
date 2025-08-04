from .base import BaseScraper

BASE_URL = "https://blog.cloudflare.com/"
class CloudfareScraper(BaseScraper):
    
    def get_feed_url(self):
        return BASE_URL
