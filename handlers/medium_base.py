import feedparser
import ssl
import urllib
from .base import BaseScraper
from logger_config import get_logger

logger = get_logger("medium-handler")

class MediumScraper(BaseScraper):
    """
    Base scraper for Medium-hosted engineering blogs.
    Overrides extract_article to pull content:encoded from the RSS feed
    instead of fetching the URL (Medium blocks server-side requests from DC IPs).
    """

    def extract_article(self, url):
        feed_url = self.get_feed_url()
        context = ssl._create_unverified_context()
        feed = feedparser.parse(
            feed_url,
            handlers=[urllib.request.HTTPSHandler(context=context)]
        )
        for entry in feed.entries:
            if entry.get("link") == url or entry.get("id") == url:
                # feedparser maps content:encoded to entry.content[0].value
                content_list = entry.get("content")
                if content_list:
                    return content_list[0].get("value")
                return entry.get("summary")
        logger.warning(f"No feed entry found for URL: {url}")
        return None
