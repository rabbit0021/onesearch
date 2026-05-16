from handlers.base import BaseScraper

class MarcBrookerScraper(BaseScraper):
    def get_feed_url(self):
        return "https://brooker.co.za/blog/rss.xml"
