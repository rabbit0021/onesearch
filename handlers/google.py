from .base import BaseScraper
from datetime import datetime
from datetime import timezone
from logger_config import get_logger
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://developers.googleblog.com/rss"

logger = get_logger("google-handler")

class GoogleScraper(BaseScraper):
    
    def get_feed_url(self):
        return BASE_URL
        
    def parse_google_blog_date(self, date_str: str):
        """
        Parse Google Developers Blog dates like:
        - 'AUG. 18, 2025'
        - 'JULY 24, 2025'
        Returns a timezone-aware datetime in UTC.
        """
        if not date_str:
            return None    

        # Clean string: remove dots, normalize case
        # e.g. 'SEPT. 15, 2026' -> 'Sept 15, 2026'
        clean_str = date_str.replace('.', '').title()

        # Try full month name first (%B), then abbreviated (%b)
        # Also try truncating 4-char abbrevs like 'Sept' -> 'Sep'
        parts = clean_str.split(' ', 1)
        candidates = [clean_str]
        if len(parts) == 2 and len(parts[0]) > 3:
            candidates.append(parts[0][:3] + ' ' + parts[1])

        for s in candidates:
            for fmt in ("%B %d, %Y", "%b %d, %Y"):
                try:
                    dt = datetime.strptime(s, fmt)
                    return dt.replace(tzinfo=timezone.utc)
                except ValueError:
                    continue

        logger.warning(f"Unable to parse date from Google blog: '{date_str}'")
        return None
        
    def get_date_from_url(self, entry):
        """Fetch published date from Google Developers Blog post HTML."""
        try:
            url = entry.link
            title = entry.title
            resp = requests.get(url, timeout=5)
            if resp.status_code != 200:
                logger.warning(f"Non-200 response for {title}: {resp.status_code}")
                return None    

            soup = BeautifulSoup(resp.text, "html.parser")    

            # Target the div with class "published-date glue-font-weight-medium"
            div_date = soup.find("div", class_="published-date glue-font-weight-medium")
            if div_date and div_date.text.strip():
                published_text = div_date.text.strip()
                logger.info(f"Published date for title {title}: {published_text}")
                return self.parse_google_blog_date(published_text)    

            # fallback to HTTP Last-Modified header
            last_mod = resp.headers.get("Last-Modified")
            if last_mod:
                logger.info(f"Published date for title {title}: {last_mod}")
                return self.parse_google_blog_date(last_mod)    

        except Exception:
            logger.exception(f"Failed to get published date from {url}")    

        logger.info(f"No published date found for {url}")
        return None