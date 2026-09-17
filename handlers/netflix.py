from .medium_base import MediumScraper

BASE_URL = "https://netflixtechblog.com/feed?limit=50"

class NetflixScraper(MediumScraper):

    def get_feed_url(self):
        return BASE_URL