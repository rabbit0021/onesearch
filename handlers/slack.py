from .base import BaseScraper

BASE_URL = "https://slack.engineering/feed/"

class SlackScraper(BaseScraper):
        
    def get_feed_url(self):
        return BASE_URL