from .base import BaseScraper

BASE_URL = "https://stripe.dev/blog/feed"

class StripeScraper(BaseScraper):

    def get_feed_url(self):
        return BASE_URL
