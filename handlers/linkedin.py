import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin
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
            

    def extract_article(self, url):
        """
        LinkedIn engineering blog posts split their content across multiple
        `div.component-richText` and `div.component-standaloneImage` sections.
        Readability only captures one of them, so we extract all sections manually.
        """
        try:
            resp = requests.get(url, timeout=20, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                              'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            })
            resp.raise_for_status()
            resp.encoding = resp.apparent_encoding or 'utf-8'
        except Exception:
            return None

        soup = BeautifulSoup(resp.text, 'html.parser')

        container = soup.find('section', id='component-container')
        if not container:
            return None

        # Resolve LinkedIn's lazy-loaded images (data-delayed-url → src)
        for img in container.find_all('img'):
            if not img.get('src') or img['src'].startswith('data:'):
                lazy = img.get('data-delayed-url')
                if lazy:
                    img['src'] = lazy
            if not img.get('srcset'):
                lazy_ss = img.get('data-delayed-srcset') or img.get('data-srcset')
                if lazy_ss:
                    img['srcset'] = lazy_ss

        # Absolutize all src / href / srcset
        for tag, attr in [('img', 'src'), ('a', 'href'), ('source', 'src')]:
            for el in container.find_all(tag):
                val = el.get(attr)
                if val and not val.startswith(('http://', 'https://', 'data:', '#', 'mailto:')):
                    el[attr] = urljoin(url, val)
        for el in container.find_all(['img', 'source']):
            ss = el.get('srcset') or ''
            if ss and not ss.startswith('http'):
                parts = []
                for entry in ss.split(','):
                    entry = entry.strip()
                    if entry:
                        tokens = entry.split()
                        tokens[0] = urljoin(url, tokens[0])
                        parts.append(' '.join(tokens))
                el['srcset'] = ', '.join(parts)

        # Collect content sections in document order, skip nav/header/related-posts
        _SKIP = {'component-articleHeadline', 'component-postList'}
        parts = []
        for div in container.find_all('div', class_='component', recursive=False):
            component_classes = set(div.get('class', []))
            if component_classes & _SKIP:
                continue
            if 'component-richText' in component_classes:
                rich = div.find('div', class_='rich-text')
                if rich:
                    parts.append(rich.decode_contents())
            elif 'component-standaloneImage' in component_classes:
                fig = div.find('figure')
                if fig:
                    parts.append(str(fig))

        if not parts:
            return None

        return '<div>' + '\n'.join(parts) + '</div>'

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

