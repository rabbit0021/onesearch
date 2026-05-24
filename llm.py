import os
import time
from bs4 import BeautifulSoup
from google import genai
from google.genai import types

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

_MODEL = "gemini-2.5-flash-lite"
_SYSTEM_PROMPT = (
    "You are a helpful assistant answering questions about a specific article. "
    "Answer only based on the article content provided. Be concise and direct. "
    "If the answer is not in the article, say so honestly."
)

_article_cache = {}
_CACHE_TTL = 3600       # 1 hour
_MAX_ARTICLE_CHARS = 20_000  # ~5k tokens — stays within free tier limits


class PostNotFoundError(Exception):
    pass


class ContentExtractionError(Exception):
    pass


def _get_article_context(post_id):
    """Fetch article context (title, publisher, body text) with in-memory cache."""
    now = time.time()
    cached = _article_cache.get(post_id)
    if cached and cached["expires_at"] > now:
        return cached["text"]

    from app import app, _extract_article_content
    from handlers.factory import ScraperFactory

    conn = app.db.get_connection()
    try:
        c = conn.cursor()
        c.execute("""
            SELECT po.url, po.title, pu.publisher_name
            FROM posts po
            JOIN publishers pu ON po.publisher_id = pu.id
            WHERE po.id = ?
        """, (post_id,))
        row = c.fetchone()
    finally:
        conn.close()

    if not row:
        raise PostNotFoundError(f"Post {post_id} not found")

    url, title, publisher_name = row["url"], row["title"], row["publisher_name"]

    scraper = ScraperFactory.get_scraper(publisher_name) if publisher_name else None
    html = None

    if scraper:
        try:
            html = scraper.extract_article(url)
        except Exception:
            html = None

    if not html:
        try:
            html = _extract_article_content(url)
        except Exception as e:
            raise ContentExtractionError(f"Could not fetch article: {e}")

    if not html:
        raise ContentExtractionError("Could not extract article content")

    body = BeautifulSoup(html, "html.parser").get_text(separator=" ", strip=True)
    body = body[:_MAX_ARTICLE_CHARS]

    context = f"Title: {title}\nPublisher: {publisher_name}\n\n{body}"
    _article_cache[post_id] = {"text": context, "expires_at": now + _CACHE_TTL}
    return context


def ask_article(post_id, question):
    """Return an answer string for question about the article."""
    context = _get_article_context(post_id)
    response = _client.models.generate_content(
        model=_MODEL,
        contents=f"Article:\n{context}\n\nQuestion: {question}",
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_PROMPT,
            temperature=0.2,
            max_output_tokens=1024,
        ),
    )
    return response.text.strip()
