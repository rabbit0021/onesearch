from .medium_base import MediumScraper

BASE_URL = "https://medium.com/feed/airbnb-engineering"

class AirbnbScraper(MediumScraper):

    def get_feed_url(self):
        return BASE_URL