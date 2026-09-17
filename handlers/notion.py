import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone
from dateutil import parser as dateparser
from .base import BaseScraper
from logger_config import get_logger

BASE_URL = "https://www.notion.com/blog/topic/tech"
POST_BASE = "https://www.notion.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

logger = get_logger("notion-handler")


class NotionScraper(BaseScraper):

    def _fetch_post(self, url):
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return None
        return BeautifulSoup(resp.text, "html.parser")

    def get_date_from_post(self, url):
        try:
            soup = self._fetch_post(url)
            if not soup:
                return None
            time_tag = soup.find("time", class_="entry-date")
            if not time_tag:
                return None
            dt = dateparser.parse(time_tag.get_text(strip=True))
            if dt and dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            logger.exception(f"Failed to get date from {url}")
            return None

    def extract_article(self, url):
        try:
            from urllib.parse import urljoin
            soup = self._fetch_post(url)
            if not soup:
                return None
            # Notion article content lives in article.contentfulRichText*__richText
            container = soup.select_one("article[class*='richText']")
            if not container:
                return None
            # Absolutize relative URLs
            for tag, attr in [("a", "href"), ("img", "src")]:
                for el in container.find_all(tag):
                    val = el.get(attr)
                    if val and not val.startswith(("http://", "https://", "data:", "#", "mailto:")):
                        el[attr] = urljoin(url, val)
            # Strip Notion's scoped CSS classes so our articleContent styles apply cleanly
            for el in container.find_all(True):
                el.attrs.pop("class", None)
                el.attrs.pop("style", None)
            # Fix Notion tables: first row uses th[scope=row] for headers — convert to proper thead/th
            for table in container.find_all("table"):
                rows = table.find_all("tr")
                if not rows:
                    continue
                first_row = rows[0]
                # If first row has th elements, move it into a thead
                if first_row.find("th"):
                    thead = soup.new_tag("thead")
                    first_row.extract()
                    # Convert th content to clean th without scope
                    for th in first_row.find_all("th"):
                        del th["scope"]
                    thead.append(first_row)
                    table.insert(0, thead)
                    # Convert remaining th[scope=row] in tbody to td
                    for th in table.find_all("th"):
                        th.name = "td"
            return str(container)
        except Exception:
            logger.exception(f"Failed to extract article from {url}")
            return None

    def search_blog_posts(self, category, last_scan_time):
        if last_scan_time.tzinfo is None:
            last_scan_time = last_scan_time.replace(tzinfo=timezone.utc)

        try:
            resp = requests.get(BASE_URL, headers=HEADERS, timeout=10)
            if resp.status_code != 200:
                logger.warning(f"Non-200 response from Notion: {resp.status_code}")
                return []
        except Exception:
            logger.exception("Failed to fetch Notion blog listing")
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        posts = []

        for article in soup.find_all("article", class_="post-preview"):
            a_tag = article.find("a", href=True)
            if not a_tag:
                continue

            title = a_tag.get("title") or a_tag.get_text(strip=True)
            url = POST_BASE + a_tag["href"]

            published = self.get_date_from_post(url)
            if not published:
                logger.warning(f"Could not get date for {title}")
                continue

            if published <= last_scan_time:
                logger.debug(f"Skipping {title}: published {published} before {last_scan_time}")
                break

            posts.append({
                "title": title,
                "url": url,
                "published": published.isoformat(),
                "tags": ["tech"]
            })

        return posts
