import requests
from bs4 import BeautifulSoup
import re
from .base import BaseScraper
from logger_config import get_logger
from email.utils import parsedate_to_datetime
from dateutil import parser
from datetime import timezone

BASE_URL = 'https://engineering.linkedin.com/blog'
HEADERS = {'User-Agent': 'Mozilla/5.0'}

logger = get_logger("linkedin-heandler")
class LinkedinScraper(BaseScraper):
    def scrape(self):
        pass
    
    def get_posts_from_group_url(self, url, last_scan_time):
        logger.debug(f"Getting posts from group url: {url}")
        resp = requests.get(url, timeout=5)
        if resp.status_code != 200:
            logger.warning(f"Non-200 response for {url}: {resp.status_code}")
            return None    

        soup = BeautifulSoup(resp.text, "html.parser")  
        
        posts = []
        
        post_items = soup.find_all("li", class_="post-list__item grid-post")

        for post in post_items:
            try:
                # Title
                title_tag = post.find("div", class_="grid-post__title")
                if title_tag and title_tag.a:
                    title = title_tag.a.get_text(strip=True)
                    url = title_tag.a["href"]
                else:
                    logger.exception("Title not found")
                    continue

                # Topic
                topic_tag = post.find("p", class_="grid-post__topic")
                topic = [topic_tag.a.get_text(strip=True) if topic_tag and topic_tag.a else ""]

                # Published date
                date_tag = post.find("p", class_="grid-post__date")
                if date_tag:
                    published = parser.parse(date_tag.get_text(strip=True))
                    if published.tzinfo is None:
                        published = published.replace(tzinfo=timezone.utc)
                else:
                    published = None
                
                if not published:
                    logger.exception("Published date not found")
                    continue
                
                if last_scan_time.tzinfo is None:
                    last_scan_time = last_scan_time.replace(tzinfo=timezone.utc)
                
                # breaking the loop when first article appears having stale
                if published <= last_scan_time:
                    logger.debug(f"Skipping post: {title} as it is published on {published} before {last_scan_time}")
                    break
                
                posts.append({
                    "title": title,
                    "url": url,
                    "tags": topic,
                    "published": published.isoformat()
                })
                
                # Stop early after collecting 2 items
                if len(posts) >= 2:
                    break

            except Exception as e:
                logger.exception(f"Error parsing group post")
                continue

        return posts       
            

    def search_blog_posts(self, category, last_scan_time):
        res = requests.get(BASE_URL)
        soup = BeautifulSoup(res.text, "html.parser")
    
        posts = []
        groups = soup.select(".artdeco-dropdown__content")
    
        for group in groups:
            links = group.select(".artdeco-dropdown__item a.header-nav__link")
            
            links = links
            
            for grouplink in links:
                try:                    
                    group_url = grouplink.get("href")
                    
                    group_posts = self.get_posts_from_group_url(group_url, last_scan_time)
                    
                    for post in group_posts:
                        posts.append(post)
                except:
                    logger.exception("Failed while scraping Linkedin")
                        
        return posts

