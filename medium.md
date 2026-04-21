# Building OneSearch: How I Aggregated 20+ Engineering Blogs and Used ML to Deliver Personalized Digests — No Account Required

*A deep-dive into the architecture, ML pipeline, and engineering tradeoffs behind a subscription-free engineering blog curator*

---

## The Problem

If you're a software engineer keeping up with the industry, you probably have a dozen browser tabs open — Netflix's tech blog, AWS announcements, Databricks engineering posts, Spotify's backstage articles. There's no shortage of great content. The shortage is time to find it.

Existing solutions like Feedly or RSS readers put the curation burden on you. Newsletter aggregators require accounts, preferences setup, and usually serve you a generic mix. I wanted something different: **subscribe with just your email, tell it what topics and companies you care about, and receive a digest that's actually relevant to you.**

That's OneSearch. Here's how it works under the hood.

---

## Architecture Overview

The system has three distinct layers:

1. **A data pipeline** — scrape → classify → notify → send
2. **A Flask API** serving a React SPA
3. **An ML classifier** that categorizes every blog post at ingestion time

All of this runs on a single Hetzner CX22 VPS (4GB RAM, ~€4.50/month). Let's break each part down.

---

## The Data Pipeline

### Stage 1: Scraping with the Factory Pattern

Every publisher — AWS, Netflix, Google, Meta, LinkedIn, Spotify, and 15 others — has quirks. Different RSS feed structures, non-standard date formats, inconsistent tagging.

The solution is a **ScraperFactory** with per-publisher handler classes:

```python
class ScraperFactory:
    def get_scraper(company):
        if company.lower() == "aws":
            return aws.AwsScraper()
        elif company.lower() == "netflix":
            return netflix.NetflixScraper()
        # ... 20+ handlers
```

Each handler extends `BaseScraper` and overrides `search_blog_posts(category, last_scan_time)`. Adding a new publisher is a single new file — no changes to core scraping logic. Google's handler, for example, contains custom date parsing for their `"AUG. 18, 2025"` format. These are isolated, testable, and easy to extend.

Each post, once scraped, has its **sentence embedding computed immediately** and stored as a BLOB in SQLite. This is the key insight that makes Jira matching fast later — embeddings are precomputed at ingestion, not on demand.

### Stage 2: Notify (Matching Posts to Subscribers)

`notify.py` queries subscriptions grouped by `(publisher_id, topic)` and checks which posts are newer than each subscriber's `last_notified_at` timestamp.

Instead of sending immediately, notifications enter a queue with a **maturity date**:

```
maturity_date = last_notified_at + timedelta(days=subscriber.frequency)
```

A subscriber on a 3-day digest cycle won't see another email until their maturity window expires. This elegant design avoids per-user scheduled tasks — the frequency control lives purely in the data layer.

### Stage 3: Send (HTML Email Delivery)

`send_notifications.py` fetches pending, mature notifications, deduplicates by `(email, post_url)`, groups by category, and renders a Jinja2 HTML email. A few nice touches:

- **Domain favicons** pulled at send time via Google's favicon service (`https://www.google.com/s2/favicons?domain=...`) — zero stored assets, zero CDN
- **Like counts** pulled from the `post_likes` table — your digest shows what the community found valuable
- **Random motivational taglines** like "Stay Hungry, Stay Foolish" — small detail, but makes the email feel human

All dispatched via Zoho SMTP.

---

## The ML Classifier

This is the most interesting technical piece.

### The Model

Every post is classified into one of 13 categories:

> Software Engineering, Frontend Engineering, Backend Engineering, Mobile Engineering, Platform & Infrastructure, Data Engineering, Data Science, ML & AI, Data Analytics, Security Engineering, QA & Testing, Product Management, General

Classification uses **`all-mpnet-base-v2`** — a 110M parameter sentence-transformer from HuggingFace — to compute embeddings for post title + tags + first 100 characters of the snippet.

### Two-Tier Classification

The system is designed for **graceful degradation**:

**Tier 1 (Baseline)**: Always available. Precomputes embeddings for each category description (e.g., "React, Vue, Angular, JavaScript, CSS, TypeScript, browser performance..."). Scores posts via cosine similarity, with keyword bonuses (+0.1) for strong signals like "react", "kubernetes", "llm". Falls back to GENERAL if top score < 0.25 or the margin between top 2 categories < 0.05.

**Tier 2 (Trained)**: When `trained_classifier.pkl` exists, a pre-trained LogisticRegression model classifies posts using the same embeddings. Only used when confidence ≥ 0.7 — otherwise falls back to Tier 1.

This means you can drop in a new trained model at any time with zero downtime. If it underperforms, the system silently degrades to the embedding baseline. Real zero-risk A/B testing for a classifier.

### Jira Integration: Semantic Matching

The most unexpected feature: **connect your Jira board and get blog posts matched to your active work items**.

When a user connects Jira (via OAuth 2.0), their open issues are sent to the `/feed/suggested` endpoint. The backend:

1. Encodes each issue title + description using the same `all-mpnet-base-v2` model
2. Scores every stored post embedding against every issue embedding via cosine similarity
3. Returns the top-matching posts, ranked by relevance

Issue embeddings are cached in-memory for 2 days using an MD5 hash of content as the cache key. This handles the common case where someone opens the feed multiple times against the same Jira issues.

**Privacy note**: Jira OAuth tokens are stored in Flask session only, never persisted. Issue content is sent to the matching endpoint but never stored. Fully read-only scopes (`read:jira-work`, `read:me`).

---

## The Backend: Flask Done Right

### Database Design

SQLite with a simple, normalized schema. Core tables:

- **`posts`**: `id, publisher_id, url, title, tags, published_at, topic, embedding (BLOB)`
- **`subscriptions`**: `email, publisher_id, topic, frequency_in_days, last_notified_at, active`
- **`notifications`**: `email, post_url, post_title, maturity_date`
- **`post_likes`**: `(post_id, user_email)` — composite primary key prevents double-likes
- **`job_runs`**: Job execution history with logs stored as JSON

The singleton database pattern with a threading lock ensures safe concurrent access from gunicorn workers:

```python
class SQLiteDatabase:
    _instance = None
    _lock = Lock()

    @classmethod
    def get_instance(cls, db_path):
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls(db_path)
            return cls._instance
```

### No Auth, No Accounts

Subscriptions are keyed by email. Likes are keyed by email. An OTP flow exists for optional email verification, but it's not required to subscribe.

The design philosophy: **minimum viable friction**. You shouldn't need a password to get a curated newsletter.

### Real-Time Job Streaming

Admin jobs (scrape, notify, send) run on daemon threads. Logs stream to the UI via **Server-Sent Events**:

```python
def generate():
    while True:
        new_logs = get_new_logs(job_id, cursor)
        for log in new_logs:
            yield f"data: {json.dumps({'log': log})}\n\n"
        # Force-flush via padding
        yield ": " + " " * 8192 + "\n\n"
        time.sleep(1)
```

Jobs are cancellable too — a `threading.Event()` is checked periodically:

```python
if cancel_event and cancel_event.is_set():
    raise JobCancelledError()
```

### Audit Trail with Disk Awareness

The system keeps the last 10 job runs in the DB, but only stores full logs for the 2 most recent:

```sql
UPDATE job_runs SET logs = '[]'
WHERE job_name = ?
AND id NOT IN (
    SELECT id FROM job_runs WHERE job_name = ?
    ORDER BY started_at DESC LIMIT 2
)
```

Disk space preserved; enough history to debug last night's failed scrape.

---

## The Frontend: React + Vite

The UI is a React SPA built with Vite, served directly from Flask in production (output to `frontend/dist/`). No separate frontend server in production — one Docker container, one process.

Key pages:
- **Home** — main feed, subscribe modal, trending posts widget
- **Admin** — post labeling, job management, live log streaming

CSS Modules for scoped styles. All API calls go through a centralized `api/index.js` wrapper. Vite proxies `/feed`, `/subscribe`, etc. to Flask in development.

---

## Infrastructure: Cheap but Solid

**Hetzner CX22, ~€4.50/month**, running Docker Compose with three services:

- `app` — Flask + Gunicorn, internal only
- `nginx` — Alpine, SSL termination with Let's Encrypt
- `certbot` — automatic certificate renewal

Security posture is reasonable for a small app:

```yaml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
read_only: true
tmpfs:
  - /tmp
mem_limit: 3g
cpus: 1.5
pids_limit: 100
```

Flask runs as a non-root `appuser`. Nginx handles HTTPS and HTTP redirects. Certbot handles Let's Encrypt cert renewal.

**CI/CD via GitHub Actions**:
1. Build Docker image (with layer caching)
2. Run pytest (mocked SMTP, no real email sends)
3. On `main`: SSH into Hetzner, `git pull`, write `.env` from secrets, `docker compose up -d --build`

HuggingFace model cache (~1.5GB for `all-mpnet-base-v2`) is persisted in a Docker volume to avoid re-downloading on every deploy.

---

## What I'd Do Differently

**SQLite to Postgres**: SQLite works well for this scale but concurrent writes from multiple workers require care. Postgres would simplify locking.

**Celery for jobs**: Background jobs on daemon threads work, but a proper task queue (Celery + Redis) would add retries, dead-letter queues, and better visibility.

**Vector database**: Post embeddings stored as BLOBs and loaded into memory for cosine similarity is fine at this scale (~10k posts), but a vector DB like Qdrant or pgvector would scale better and open up interesting search features.

**More training data**: The LogisticRegression classifier is only used when confidence ≥ 0.7. With more labeled data, that threshold could be higher — and the quality of personalized feeds would improve with better classification.

---

## The Numbers

- **20+ publishers** crawled: AWS, Netflix, Google, Meta, LinkedIn, Spotify, Databricks, Stripe, GitHub, Figma, and more
- **13 engineering topic categories**
- **1 VPS** running everything
- **~€4.50/month** infrastructure cost
- **0 accounts required** to subscribe

---

## Try It / Read the Code

If you're building something similar, the patterns here — ScraperFactory, maturity-window notifications, tiered ML classifiers, SSE job streaming — are all independently useful.

*All feedback welcome.*
