
from handlers.base import BaseScraper

class AphyrScraper(BaseScraper):
    def get_feed_url(self):
        return "https://aphyr.com/posts.atom"
