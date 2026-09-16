from .medium_base import MediumScraper

BASE_URL = "https://medium.com/feed/pinterest-engineering"

class PinterestScraper(MediumScraper):

    def get_feed_url(self):
        return BASE_URL
