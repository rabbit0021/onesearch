# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# --- Frontend (React/Vite) ---
cd frontend
npm install          # first-time setup
npm run dev          # dev server on :5173 (proxies API to Flask on :5000)
npm run build        # build to frontend/dist/ (Flask serves this in production)

# --- Backend (Flask) ---
FLASK_ENV=development python app.py   # API server on :5000

# Run both in separate terminals for local development

# Run background jobs
python scrape_pubs.py          # Fetch and classify RSS feeds
python notify.py               # Build notification queue from labeled posts
python send_notifications.py   # Dispatch queued email notifications
python training.py             # Retrain ML classifier from labeled posts

# Run tests
pytest                         # All tests
pytest -m e2e                  # End-to-end tests only
pytest -m notifications        # Notification tests only
pytest -m pubs                 # Scraper tests only
pytest -m real                 # Tests that actually send emails (use carefully)
pytest tests/e2e/test_e2e.py  # Single test file

# Docker
docker-compose up --build      # Local dev with Cloudflare tunnel
```

## Environment Variables

```bash
FLASK_ENV=development|test|production   # Controls log directory and DB path
POSTS_SECRET_KEY=<key>                  # Required for /posts admin endpoints
SMTP_USERNAME=<email>                   # Zoho SMTP sender
SMTP_PASSWORD=<password>                # Zoho SMTP app password
DB_PATH=data/onesearch_dev.db          # SQLite database path
MODEL_PATH=data/dev/trained_classifier.pkl  # Trained ML classifier
```

## Architecture

**OneSearch** is a Flask app that aggregates engineering blog posts from tech companies, classifies them with ML, and emails curated digests to subscribers.

### Data Pipeline

```
scrape_pubs.py → classify (classifier.py) → DB (posts, unlabeled)
                                                    ↓
                                    notify.py (match posts to subscriptions)
                                                    ↓
                                    send_notifications.py (Zoho SMTP)
```

### Key Components

**`app.py`** — Flask routes: subscription management, admin post labeling (`/posts`, `/posts/<id>`), feedback, interest tracking. The `/posts` endpoint requires `POSTS_SECRET_KEY`.

**`handlers/`** — 18+ company-specific RSS scraper classes (e.g., `AwsScraper`, `NetflixScraper`). All extend a base interface and are dispatched via `ScraperFactory.get_scraper(company)` in `scraper_factory.py`.

**`classifier.py`** — ML classification using `all-mpnet-base-v2` sentence-transformer embeddings + scikit-learn LogisticRegression. Falls back to embedding cosine similarity when model confidence < 0.7. Categories: Software Engineering, Data Science, QA/Testing, Analytics, Product Management, General.

**`db/sqlite.py`** — Singleton SQLite database wrapper. Key tables: `posts`, `subscriptions`, `publishers`, `notifications`. Access via `SQLiteDatabase.get_instance(db_path)`.

**`training.py`** — Retrains classifier from labeled posts in DB; saves model to `.pkl` file for hot-loading.

**`frontend/`** — React SPA (Vite). Pages: `Home` (subscription form) and `AdminPosts` (post labeling, route `/admin`). Each component lives in its own folder with a paired `.module.css` file. All API calls go through `frontend/src/api/index.js`. Toast notifications use `frontend/src/context/ToastContext.jsx`. In production, `npm run build` outputs to `frontend/dist/`, which Flask serves as a catch-all SPA.

**`templates/`** — Legacy Jinja2 templates (kept for email: `static/email_template.html`). The web pages are now served by the React build.

### Test Fixtures (`tests/conftest.py`)

- `db` fixture: creates a fresh `data/tests.db` before each test function
- `DummySMTP` class: mocks SMTP calls (starttls, login, sendmail, quit); inspect `dummy_smtp.sent` to verify email contents

### Deployment

Push to `main` triggers GitHub Actions: builds Docker image → pushes to Azure Container Registry → runs pytest in container → updates Azure AKS deployment via `kubectl`.
