from .base import BaseScraper

BASE_URL = "https://aws.amazon.com/blogs/aws/feed/"
class AwsScraper(BaseScraper):
    
    def get_feed_url(self):
        return BASE_URL