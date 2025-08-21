import requests
from bs4 import BeautifulSoup
import re
from .base import BaseScraper
from logger_config import get_logger
from email.utils import parsedate_to_datetime
from dateutil import parser
from datetime import timezone

BASE_URL = 'https://engineering.fb.com'
HEADERS = {'User-Agent': 'Mozilla/5.0'}

logger = get_logger("handlers")
class FacebookScraper(BaseScraper):
    def scrape(self):
        categories = set()
        page = 1
        
        max_pages = 10
    
        while page <= max_pages:
            if page == 1:
                url = BASE_URL
            else:
                url = f"{BASE_URL}/page/{page}/"
    
            resp = requests.get(url, headers=HEADERS)
            if resp.status_code != 200:
                break
    
            soup = BeautifulSoup(resp.text, 'html.parser')
    
            found_something = False
    
            # Extract category tags (they appear as <a class="category">)
            for tag in soup.find_all("a", class_=re.compile("category")):
                text = tag.get_text(strip=True)
                if text:
                    categories.add(text.lower())
                    found_something = True
    
            # Fallback: grab title words
            titles = soup.find_all("h2")
            for title in titles:
                title_text = title.get_text(strip=True)
                if title_text:
                    found_something = True
                    words = re.findall(r'\b[a-zA-Z]{4,}\b', title_text)
                    categories.update(word.lower() for word in words if len(word) > 4)
    
            if not found_something:
                break  # no content found, stop crawling
    
            page += 1
    
        return sorted(categories)
    
    def search_blog_posts(self, category, last_scan_time):
        res = requests.get(BASE_URL)
        soup = BeautifulSoup(res.text, "html.parser")
    
        posts = []
        articles = soup.find_all("article", class_="post")
    
        for article in articles:
            try:
                title_tag = article.select_one(".entry-title a")
                if not title_tag:
                    logger.exception("Title not found")
                    continue
                title = title_tag.get_text(strip=True)
                post_url = title_tag["href"]
    
                # Categories
                cats = [c.get_text(strip=True).lower() for c in article.select(".cat-links a")]
    
                # Date
                date_tag = article.select_one("time.entry-date")
                if not date_tag:
                    logger.exception("Published Date not found")
                    continue
                
                date_str = date_tag.get_text(strip=True)
    
                try:
                    # Parse published date using the correct format
                    published = parser.parse(date_str)
                    if published.tzinfo is None:
                        published = published.replace(tzinfo=timezone.utc)
                except ValueError as e:
                    logger.error(f"Date parse error: {date_str} -> {e}")
                    continue
                
                if last_scan_time.tzinfo is None:
                    last_scan_time = last_scan_time.replace(tzinfo=timezone.utc)
                
                # breaking the loop when first article appears having stale
                if published <= last_scan_time:
                    break
    
                posts.append({
                    "title": title,
                    "url": post_url,
                    "tags": cats,
                    "published": published.isoformat()
                })
    
            except Exception as e:
                logger.warning(f"Error parsing article: {e}")
                continue
        
        return posts

