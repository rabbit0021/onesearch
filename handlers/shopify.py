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
            # Force utf-8 — Shopify pages are UTF-8, requests defaults to ISO-8859-1
            res.encoding = 'utf-8'
            soup = BeautifulSoup(res.text, 'html.parser')

            # Article title
            title = soup.find('h1')

            # Article body: div with tailwind class text-body-base + pt-10
            body = soup.find('div', class_=lambda c: c and 'text-body-base' in c and 'pt-10' in c)
            if not body:
                return None

            # Strip hiring/marketing sections
            for el in body.find_all(['div', 'section'], class_=lambda c: c and any(
                k in c for k in ['leadpage', 'hiring', 'support-card', 'popular-posts', 'marketing']
            )):
                el.decompose()

            html = (str(title) if title else '') + str(body)
            return html
        except Exception:
            return None
