from .base import scrape_feed, search_feed_blog_posts

HEADERS = {'User-Agent': 'Mozilla/5.0'}
BASE_URL = "https://aws.amazon.com/blogs/aws/feed/"

def scrape_aws():

    return scrape_feed(BASE_URL)

def search_aws_blog_posts(category, last_scan_time):
    """Search AWS blog posts matching a category and published after a specific datetime."""
    return search_feed_blog_posts(BASE_URL, category, last_scan_time)
