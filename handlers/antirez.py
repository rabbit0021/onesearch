from handlers.base import BaseScraper

class AntirezScraper(BaseScraper):
    def get_feed_url(self):
        return "http://antirez.com/rss"

    def clean_article(self, soup):
        # Remove the header metadata line injected by antirez.com
        for span in soup.find_all('span', class_='info'):
            span.decompose()
