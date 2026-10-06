import json
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from .base import BaseScraper
from logger_config import get_logger

BASE_URL = "https://stripe.dev/blog/feed"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

logger = get_logger("stripe-handler")


def _md_to_html(md):
    """Convert Stripe blog markdown to HTML. Handles headings, bold, inline code, code blocks, links, images, lists, paragraphs."""
    lines = md.split('\n')
    html_parts = []
    i = 0
    while i < len(lines):
        line = lines[i]

        # Fenced code block
        if line.startswith('```'):
            lang = line[3:].strip()
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code_lines.append(lines[i])
                i += 1
            code = '\n'.join(code_lines)
            # escape HTML entities
            code = code.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            html_parts.append(f'<pre><code class="language-{lang}">{code}</code></pre>')
            i += 1
            continue

        # Headings
        m = re.match(r'^(#{1,4})\s+(.*)', line)
        if m:
            level = min(len(m.group(1)), 6)
            html_parts.append(f'<h{level}>{_inline(m.group(2))}</h{level}>')
            i += 1
            continue

        # Unordered list
        if re.match(r'^[-*]\s+', line):
            items = []
            while i < len(lines) and re.match(r'^[-*]\s+', lines[i]):
                items.append(f'<li>{_inline(lines[i][2:].strip())}</li>')
                i += 1
            html_parts.append('<ul>' + ''.join(items) + '</ul>')
            continue

        # Ordered list
        if re.match(r'^\d+\.\s+', line):
            items = []
            while i < len(lines) and re.match(r'^\d+\.\s+', lines[i]):
                stripped = re.sub(r'^\d+\.\s+', '', lines[i])
                items.append(f'<li>{_inline(stripped)}</li>')
                i += 1
            html_parts.append('<ol>' + ''.join(items) + '</ol>')
            continue

        # Blank line
        if not line.strip():
            i += 1
            continue

        # Paragraph
        html_parts.append(f'<p>{_inline(line)}</p>')
        i += 1

    return '\n'.join(html_parts)


def _inline(text):
    """Convert inline markdown (bold, italic, code, links, images) to HTML."""
    # Images before links
    text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'<img src="\2" alt="\1">', text)
    # Links
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    # Bold
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # Italic
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    # Inline code
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    return text


class StripeScraper(BaseScraper):

    def get_feed_url(self):
        return BASE_URL

    def extract_article(self, url):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
            if resp.status_code != 200:
                return None
            resp.encoding = 'utf-8'
            soup = BeautifulSoup(resp.text, 'html.parser')

            script = soup.find('script', id='__NEXT_DATA__')
            if not script:
                return None

            data = json.loads(script.string)
            post = data.get('props', {}).get('pageProps', {}).get('postData', {})
            content_md = post.get('content', '')
            if not content_md:
                return None

            return _md_to_html(content_md)
        except Exception:
            logger.exception(f"Failed to extract article from {url}")
            return None
