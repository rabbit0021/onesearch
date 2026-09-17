import ssl
import urllib
import requests
import feedparser
from bs4 import BeautifulSoup
from .base import BaseScraper

BASE_URL = "https://shopify.engineering/blog.atom"

def _fix_encoding(text):
    """Fix Windows-1252 mojibake in text that was mis-decoded as Latin-1."""
    if not text:
        return text
    try:
        return text.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text

class ShopifyScraper(BaseScraper):

    def get_feed_url(self):
        return BASE_URL

    def extract_article(self, url):
        """Fetch Shopify article directly with correct encoding."""
        try:
            res = requests.get(url, timeout=20, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            })
            res.raise_for_status()
            # Force utf-8; apparent_encoding picks it up correctly from the page
            res.encoding = res.apparent_encoding or 'utf-8'
            soup = BeautifulSoup(res.text, 'html.parser')
            article = soup.find('article') or soup.find('main') or soup.find('div', class_=lambda c: c and 'content' in c)
            return str(article) if article else None
        except Exception:
            return None
