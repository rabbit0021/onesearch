from handlers.base import BaseScraper

class AddyOsmaniScraper(BaseScraper):
    def get_feed_url(self):
        return "https://addyosmani.com/rss.xml"
