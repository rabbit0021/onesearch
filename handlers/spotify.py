from .base import BaseScraper

BASE_URL = "https://engineering.atspotify.com/feed/"

class SpotifyScraper(BaseScraper):
        
    def get_feed_url(self):
        return BASE_URL