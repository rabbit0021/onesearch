from .base import BaseScraper

BASE_URL = "https://netflixtechblog.com/feed"

class NetflixScraper(BaseScraper):
        
    def get_feed_url(self):
        return BASE_URL