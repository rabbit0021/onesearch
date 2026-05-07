from handlers.base import BaseScraper

class JuliaEvansScraper(BaseScraper):
    def get_feed_url(self):
        return "https://jvns.ca/atom.xml"
