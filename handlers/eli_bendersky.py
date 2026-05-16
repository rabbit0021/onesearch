from handlers.base import BaseScraper

class EliBenderskyScraper(BaseScraper):
    def get_feed_url(self):
        return "https://eli.thegreenplace.net/feeds/all.atom.xml"
