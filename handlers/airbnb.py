from .base import BaseScraper

BASE_URL = "https://medium.com/feed/airbnb-engineering"

class AirbnbScraper(BaseScraper):

    def scrape(self):
        return self.scrape_feed(BASE_URL)    

    def search_blog_posts(self, category, last_scan_time):
        return self.search_feed_blog_posts(BASE_URL, category, last_scan_time)    
