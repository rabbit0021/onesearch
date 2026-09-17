from .base import BaseScraper

BASE_URL = "https://shopify.engineering/blog.atom"

class ShopifyScraper(BaseScraper):

    def get_feed_url(self):
        return BASE_URL
