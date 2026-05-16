from handlers.base import BaseScraper

class SimonWillisonScraper(BaseScraper):
    def get_feed_url(self):
        return "https://simonwillison.net/atom/everything/"
