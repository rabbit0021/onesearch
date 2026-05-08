from handlers.base import BaseScraper

class AntirezScraper(BaseScraper):
    def get_feed_url(self):
        return "http://antirez.com/rss"
