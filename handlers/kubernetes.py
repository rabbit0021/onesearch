from .base import BaseScraper

BASE_URL = "https://kubernetes.io/feed.xml"

class KubernetesScraper(BaseScraper):
        
    def get_feed_url(self):
        return BASE_URL