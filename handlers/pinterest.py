from .base import BaseScraper

BASE_URL = "https://medium.com/feed/pinterest-engineering"

class PinterestScraper(BaseScraper):

    def get_feed_url(self):
        return BASE_URL
