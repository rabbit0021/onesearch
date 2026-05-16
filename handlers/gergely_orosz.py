from handlers.base import BaseScraper

class GergelyOroszScraper(BaseScraper):
    def get_feed_url(self):
        return "https://newsletter.pragmaticengineer.com/feed"
