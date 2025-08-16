from .base import BaseScraper

BASE_URL = "https://blogs.nvidia.com/feed/"

class NvideaScraper(BaseScraper):
        
    def get_feed_url(self):
        return BASE_URL