from .base import BaseScraper

BASE_URL = "https://github.blog/engineering/feed/"

class Githubcraper(BaseScraper):
        
    def get_feed_url(self):
        return BASE_URL