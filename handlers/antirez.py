from handlers.base import BaseScraper

class AntirezScraper(BaseScraper):
    def get_feed_url(self):
        return "http://antirez.com/rss"

    def clean_article(self, soup):
        # Remove the header metadata line injected by antirez.com:
        # <span class="info"><span class="username"><a href="/user/antirez">antirez</a></span> 13 days ago. 140118 views.  </span>
        for span in soup.find_all('span', class_='info'):
            span.decompose()
