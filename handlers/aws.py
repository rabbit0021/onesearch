import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re
import logging
import feedparser
from datetime import timezone

BASE_URL = 'https://aws.amazon.com/blogs/aws/'
HEADERS = {'User-Agent': 'Mozilla/5.0'}

def scrape_aws():
    feed_url = "https://aws.amazon.com/blogs/aws/feed/"
    feed = feedparser.parse(feed_url)
    categories = set()

    for entry in feed.entries:
        for cat in entry.get('tags', []):
            categories.add(cat.term.lower())

    return sorted(categories)

def search_aws_blog_posts(company, category, last_scan_time):
    """Search AWS blog posts matching a category and published after a specific datetime."""
    feed_url = "https://aws.amazon.com/blogs/aws/feed/"
    feed = feedparser.parse(feed_url)
    matching_posts = []

    for entry in feed.entries:
        # Normalize tags
        categories = [tag.term.lower() for tag in entry.get("tags", [])]

        if category.lower() not in categories:
            continue

        try:
            # Parse published date using the correct format
            published = datetime.strptime(entry.published, "%a, %d %b %Y %H:%M:%S %z")
        except ValueError as e:
            print(f"Date parse error: {entry.published} -> {e}")
            continue
        
        if last_scan_time.tzinfo is None:
            last_scan_time = last_scan_time.replace(tzinfo=timezone.utc)
        if published <= last_scan_time:
            continue

        matching_posts.append({
            "title": entry.title,
            "url": entry.link,
            "published": published.isoformat(),
            "categories": categories
        })

    return matching_posts
