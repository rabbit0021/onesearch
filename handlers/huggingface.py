from .base import BaseScraper

BASE_URL = "https://huggingface.co/blog/feed.xml"

class HuggingFaceScraper(BaseScraper):

    def get_feed_url(self):
        return BASE_URL
