# Onesearch – Code, read & repeat

[🌐 Visit Live App](https://onesearch.blog) | [📂 GitHub Repo](https://github.com/rabbit0021/onesearch) | [Privacy Policy](https://onesearch.blog/privacy-policy)

**OneSearch** aggregates engineering blog posts from top tech companies, classifies them with ML, and delivers curated digests to subscribers. Browse trending posts, like what you find useful, and optionally connect Jira to get posts matched to your active work.

---

## Features

- **Subscribe without registration** — enter your email, pick topics and publishers, set your digest frequency
- **ML-powered classification** — posts are automatically categorized across 13 engineering topics (Software Engineering, ML & AI, Data Engineering, etc.) using sentence-transformer embeddings + logistic regression
- **Jira integration** — connect your Atlassian Jira account to see blog posts matched to your active issues. Read-only, OAuth 2.0, issues never stored on our servers
- **Trending posts** — see the most liked posts this month, visible to all users
- **Post likes** — like posts with just your email, no account required
- **Automated pipeline** — RSS feeds scraped, classified, and dispatched via Zoho SMTP on a schedule

## Jira Privacy & Compliance

Jira issues flow directly from Atlassian to your browser — they never pass through or are stored on our servers. We request only `read:jira-work` and `read:me` scopes. See the [Privacy Policy](https://onesearch.blog/privacy-policy) for full details.

> Before connecting Jira, ensure your use is permitted under your employer's IT and acceptable-use policies.

---

## Stack

- **Backend** — Python / Flask, SQLite, scikit-learn, sentence-transformers
- **Frontend** — React (Vite), CSS Modules
- **Deployment** — Docker, Hetzner VPS, GitHub Actions CI/CD

---
