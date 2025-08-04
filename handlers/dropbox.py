from .base import BaseScraper

BASE_URL = "https://dropbox.tech/feed"

class DropboxScraper(BaseScraper):
    
    def get_feed_url(self):
        return BASE_URL