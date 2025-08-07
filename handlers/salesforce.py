from .base import BaseScraper

BASE_URL = "https://engineering.salesforce.com/feed"

class SalesforceScraper(BaseScraper):
        
    def get_feed_url(self):
        return BASE_URL