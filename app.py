from dotenv import load_dotenv
load_dotenv()

from flask import Flask, send_from_directory, jsonify, request, render_template, session, Response, stream_with_context
import json
import os
import uuid
import threading
import logging
import random
import re
import smtplib
from functools import lru_cache
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from handlers import ScraperFactory
from datetime import datetime, timedelta
from middleware import register_middlewares
from logger_config import get_logger
from datetime import timezone
from db import get_database
import time
from functools import wraps
from auth import jira_bp
from classifier import get_embedding
import numpy as np
import pickle
import hashlib

SMTP_SERVER   = "smtp.zoho.in"
SMTP_PORT     = 587
SMTP_USERNAME = os.getenv('SMTP_USERNAME', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')

# In-memory OTP store: { email: { otp, expires_at, verified } }
_otp_store = {}
_otp_lock  = threading.Lock()

# In-memory job store: job_id -> {status, logs, job, cancel_event}
_jobs = {}

class JobCancelledError(Exception):
    pass

# In-memory cache for Jira issue embeddings: { cache_key -> { embeddings, expires_at } }
_issue_embedding_cache = {}
_ISSUE_CACHE_TTL = 2 * 24 * 3600  # 2 days in seconds

def _get_issue_embeddings(cloud_id, issues):
    """Return cached issue embeddings or compute and cache them."""
    text_blob = cloud_id + ''.join(
        i.get('summary', '') + (i.get('description') or '') for i in issues
    )
    cache_key = hashlib.md5(text_blob.encode()).hexdigest()

    cached = _issue_embedding_cache.get(cache_key)
    if cached and cached['expires_at'] > time.time():
        return cached['embeddings']

    embeddings = []
    for issue in issues:
        text = issue.get('summary', '')
        if issue.get('description'):
            text += ' ' + issue['description']
        embeddings.append((issue, get_embedding(text)))

    _issue_embedding_cache[cache_key] = {
        'embeddings': embeddings,
        'expires_at': time.time() + _ISSUE_CACHE_TTL,
    }
    return embeddings

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-change-in-production')

# React build directory — used in production to serve the SPA
REACT_BUILD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")
app.db = get_database()
SECRET_KEY = os.getenv("POSTS_SECRET_KEY", "123")

app.register_blueprint(jira_bp)

# Logging
app.logger = get_logger("app")
logger = get_logger("app")

if os.getenv("FLASK_ENV") == "production":
    tempdata_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "tempData.json")
else:
    tempdata_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "tempData_dev.json")

# test log
register_middlewares(app)

def require_secret_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get("X-SECRET-KEY")
        if key != SECRET_KEY:
            return jsonify({"status": "error", "message": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def index(path):
    # Serve React SPA build if it exists, otherwise fall back to the Jinja2 template
    if os.path.isdir(REACT_BUILD_DIR):
        target = os.path.join(REACT_BUILD_DIR, path)
        if path and os.path.isfile(target):
            response = send_from_directory(REACT_BUILD_DIR, path)
            # Hashed assets (JS/CSS bundles) can be cached forever — content hash guarantees freshness
            if path.startswith("assets/"):
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            else:
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return response
        response = send_from_directory(REACT_BUILD_DIR, "index.html")
        # index.html must never be cached — it's the entry point that references hashed bundles
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response
    return render_template("index.html", time=time.time)

@app.route("/techteams", methods=["GET"])
def get_companies():
    query = request.args.get("search", "").lower()
    
    conn = app.db.get_connection()

    techteams = app.db.get_publishers_by_type(conn, publisher_type="techteam")
    teamNames = [team["publisher_name"] for team in techteams if query in team["publisher_name"].lower()]
    teamNames.sort()
    conn.close()  
    return jsonify(teamNames)

@app.route("/individuals", methods=["GET"])
def get_individuals():
    query = request.args.get("search", "").lower()
    conn = app.db.get_connection()
    individuals = app.db.get_publishers_by_type(conn, publisher_type="individual")
    names = [p["publisher_name"] for p in individuals if query in p["publisher_name"].lower()]
    names.sort()
    conn.close()
    return jsonify(names)

@app.route('/subscribe', methods=['POST'])
def subscribe():
    data = request.form
    email = data.get('email').lower().strip()
    topic = data.get('topic').strip()
    techteams = data.get('techteams')
    individuals = data.get('individuals')
    communities = data.get('communities')
    frequency = data.get('frquency') 
    
    if not frequency:
        frequency = 3

    if not email or not topic or (not techteams and not individuals and not communities):
        return jsonify({"status": "error", "message": "Missing email or topic or publisher"
                        }), 400
    try:
        conn = app.db.get_connection()
        
        if techteams:
            techteams = [team.lower().strip() for team in techteams.split(',')]
            
            for team in techteams:
                publishers = app.db.get_publisher_by_name(conn, team)
                if not publishers:
                    return jsonify({"status": "error", "message": f"Publisher '{team}' not found."
                                    }), 404
                
                publisher = publishers[0]
                
                existing_subscriptions = app.db.get_subscriptions_by_email(conn, email)
                if not any(sub["publisher"]["id"] == publisher["id"] and sub["topic"] == topic for sub in existing_subscriptions):
                    app.db.add_subscription(conn, email, topic, publisher['id'], frequency=frequency)
        
        if individuals:
            individuals = [p.lower().strip() for p in individuals.split(',')]
            for name in individuals:
                publishers = app.db.get_publisher_by_name(conn, name)
                if not publishers:
                    return jsonify({"status": "error", "message": f"Publisher '{name}' not found."}), 404
                publisher = publishers[0]
                existing_subscriptions = app.db.get_subscriptions_by_email(conn, email)
                if not any(sub["publisher"]["id"] == publisher["id"] and sub["topic"] == topic for sub in existing_subscriptions):
                    app.db.add_subscription(conn, email, topic, publisher['id'], frequency=frequency)

        conn.commit()
        return jsonify({
            "status": "success",
            "message": "Subscription updated."
        })
    except:
        conn.rollback()
        return jsonify({
            "status": "failed",
            "message": "Unable to add Subscription at this time, Could you please try again."
         }, 500)
    finally:
        conn.close()

@app.route("/subscriptions_for_email")
def subscriptions_for_email():
    email = request.args.get("email", "").strip().lower()
    if not email:
        return jsonify([])
    
    conn = app.db.get_connection()
    
    subscriptions = app.db.get_subscriptions_by_email(conn, email)
    
    grouped = {}
    for entry in subscriptions:
        topic = entry["topic"]
        publisher = entry["publisher"]["publisher_name"]
        if topic not in grouped:
            grouped[topic] = set()
        grouped[topic].add(publisher)
            
    # Convert sets to lists for JSON serializability
    result = {topic: list(publishers) for topic, publishers in grouped.items()}
    conn.close()  
    return jsonify(result)

@app.route("/interested", methods=["POST"])
def interested():
    # Ensure the tempdata file exists
    if not os.path.exists(tempdata_path):
        with open(tempdata_path, 'w') as f:
            json.dump({"interested-count": 0, "feedbacks": []}, f)

    # Read, increment, and save the interested count
    with open(tempdata_path, 'r+') as f:
        data = json.load(f)
        data["interested-count"] = data.get("interested-count", 0) + 1
        f.seek(0)
        json.dump(data, f, indent=2)
        f.truncate()

    return jsonify({"interested-count": data["interested-count"]})

@app.route("/feedback", methods=["POST"])
def feedback():
    data = request.get_json()  # <-- read JSON instead of request.form
    if not data:
        return jsonify({"status": "error", "message": "No data sent"}), 400

    feedback_text = data.get("feedback", "").strip()
    
    feedback_text = feedback_text[:200]  # Limit feedback to 1000 characters
    
    if not feedback_text:
        return jsonify({"status": "error", "message": "Feedback cannot be empty."}), 400

    # Ensure tempdata file exists
    if not os.path.exists(tempdata_path):
        with open(tempdata_path, 'w') as f:
            json.dump({"interested-count": 0, "feedbacks": []}, f)

    # Append and save feedback
    with open(tempdata_path, 'r+') as f:
        existing = json.load(f)
        existing["feedbacks"].append({
            "text": feedback_text,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        f.seek(0)
        json.dump(existing, f, indent=2)
        f.truncate()

    return jsonify({"status": "success", "message": "Feedback submitted successfully."})

@app.route("/admin/tempdata", methods=["GET"])
@require_secret_key
def admin_tempdata():
    if not os.path.exists(tempdata_path):
        return jsonify({"interested-count": 0, "feedbacks": []})
    with open(tempdata_path, 'r') as f:
        data = json.load(f)
    feedbacks = data.get("feedbacks", [])
    feedbacks_sorted = sorted(feedbacks, key=lambda x: x.get("timestamp", ""), reverse=True)
    return jsonify({"interested-count": data.get("interested-count", 0), "feedbacks": feedbacks_sorted})

@app.route("/admin/likes", methods=["GET"])
@require_secret_key
def admin_likes():
    conn = app.db.get_connection()
    try:
        c = conn.cursor()
        c.execute("""
            SELECT pl.user_email, pl.liked_at,
                   po.title, po.url, pu.publisher_name AS publisher,
                   (SELECT COUNT(*) FROM post_likes WHERE post_id = po.id) AS total_likes
            FROM post_likes pl
            JOIN posts po ON po.id = pl.post_id
            JOIN publishers pu ON pu.id = po.publisher_id
            ORDER BY pl.liked_at DESC
        """)
        return jsonify([dict(r) for r in c.fetchall()])
    finally:
        conn.close()

@app.route("/admin/reading-events", methods=["GET"])
@require_secret_key
def admin_reading_events():
    conn = app.db.get_connection()
    try:
        c = conn.cursor()
        c.execute("""
            SELECT re.id, re.device_id, re.user_email,
                   re.time_spent, re.max_depth, re.opened_original, re.last_read_at,
                   po.title, po.url, pu.publisher_name AS publisher
            FROM reading_events re
            JOIN posts po ON po.id = re.post_id
            JOIN publishers pu ON pu.id = po.publisher_id
            ORDER BY re.last_read_at DESC
        """)
        return jsonify([dict(r) for r in c.fetchall()])
    finally:
        conn.close()

@app.route("/privacy-policy.html")
@app.route("/privacy-policy")
def privacy_policy():
    return send_from_directory(REACT_BUILD_DIR, "privacy-policy.html")

@app.route("/robots.txt")
def robots_txt():
    return send_from_directory(app.static_folder, "robots.txt")

@app.route("/sitemap.xml")
def sitemap_xml():
    return send_from_directory(app.static_folder, "sitemap.xml")

@app.route("/feed", methods=["GET"])
def get_feed():
    limit = min(int(request.args.get("limit", 30)), 100)
    conn = app.db.get_connection()
    try:
        posts = app.db.get_posts(conn)
        result = []
        for post in posts:
            if not post.get("labelled"):
                continue
            result.append({
                "id": post["id"],
                "url": post["url"],
                "title": post["title"],
                "topic": post["topic"],
                "publisher": post["publisher_name"],
                "published_at": post["published_at"],
                "tags": post["tags"],
                "like_count": post.get("like_count", 0),
                "fire_count": post.get("fire_count", 0),
                "view_count": post.get("view_count", 0),
            })
        result.sort(
            key=lambda x: datetime.fromisoformat(x["published_at"]),
            reverse=True,
        )
        return jsonify(result[:limit])
    finally:
        conn.close()

@app.route("/feed/individuals", methods=["GET"])
def get_individuals_feed():
    limit = min(int(request.args.get("limit", 15)), 50)
    conn = app.db.get_connection()
    try:
        individuals = app.db.get_publishers_by_type(conn, publisher_type="individual")
        individual_ids = {p["id"] for p in individuals}
        posts = app.db.get_posts(conn)
        result = []
        for post in posts:
            if not post.get("labelled"):
                continue
            if post.get("publisher_id") not in individual_ids:
                continue
            result.append({
                "id": post["id"],
                "url": post["url"],
                "title": post["title"],
                "topic": post["topic"],
                "publisher": post["publisher_name"],
                "published_at": post["published_at"],
                "tags": post["tags"],
                "like_count": post.get("like_count", 0),
                "fire_count": post.get("fire_count", 0),
                "view_count": post.get("view_count", 0),
            })
        result.sort(key=lambda x: datetime.fromisoformat(x["published_at"]), reverse=True)
        return jsonify(result[:limit])
    finally:
        conn.close()

@app.route("/feed/individuals/stats", methods=["GET"])
def get_individuals_stats():
    conn = app.db.get_connection()
    try:
        cursor = conn.execute("""
            SELECT pub.publisher_name, COUNT(pl.user_email) AS total_likes
            FROM publishers pub
            LEFT JOIN posts po ON po.publisher_id = pub.id
            LEFT JOIN post_likes pl ON pl.post_id = po.id
            WHERE pub.publisher_type = 'individual'
            GROUP BY pub.publisher_name
        """)
        result = {row["publisher_name"].lower(): row["total_likes"] for row in cursor.fetchall()}
        return jsonify(result)
    finally:
        conn.close()

@app.route("/publishers", methods=["GET"])
@require_secret_key
def get_publishers():
    conn = app.db.get_connection()
    try:
        publishers = app.db.get_publishers(conn)
        return jsonify([{
            "id": p["id"],
            "publisher_name": p["publisher_name"],
            "publisher_type": p["publisher_type"],
            "last_scraped_at": p["last_scraped_at"],
        } for p in publishers])
    finally:
        conn.close()


@app.route("/publishers", methods=["POST"])
@require_secret_key
def add_publisher():
    data = request.get_json()
    name = (data.get("publisher_name") or "").strip()
    ptype = (data.get("publisher_type") or "").strip()
    if not name or ptype not in ("techteam", "individual", "community"):
        return jsonify({"status": "error", "message": "Invalid publisher_name or publisher_type"}), 400
    conn = app.db.get_connection()
    try:
        pub_id = app.db.add_publisher(conn, name, ptype)
        conn.commit()
        return jsonify({"status": "success", "id": pub_id})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 409
    finally:
        conn.close()


@app.route("/publishers/<int:publisher_id>", methods=["DELETE"])
@require_secret_key
def delete_publisher(publisher_id):
    conn = app.db.get_connection()
    try:
        app.db.delete_publisher(conn, publisher_id)
        conn.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()


@app.route("/subscriptions", methods=["GET"])
@require_secret_key
def get_subscriptions():
    conn = app.db.get_connection()
    try:
        subs = app.db.get_subscriptions(conn)
        return jsonify(subs)
    finally:
        conn.close()


@app.route("/admin/notifications/pending", methods=["GET"])
@require_secret_key
def get_pending_notifications():
    from send_notifications import leave_unmature_notifications
    conn = app.db.get_connection()
    try:
        notifications = app.db.get_active_notifications(conn)
        matured_ids = {n['id'] for n in leave_unmature_notifications(notifications)}
        for n in notifications:
            n['is_matured'] = n['id'] in matured_ids
        return jsonify({"count": len(notifications), "matured_count": len(matured_ids), "notifications": notifications})
    finally:
        conn.close()


_EXCLUDED_LOGGERS = {'werkzeug', 'app', 'DATABASE'}

class _JobLogHandler(logging.Handler):
    def __init__(self, job_id):
        super().__init__()
        self.job_id = job_id

    def emit(self, record):
        if record.name in _EXCLUDED_LOGGERS:
            return
        if self.job_id in _jobs:
            _jobs[self.job_id]["logs"].append(self.format(record))


def _run_job_thread(job_id, job_name, target_email=None):
    from datetime import datetime, timezone
    started_at = datetime.now(timezone.utc).isoformat()
    handler = _JobLogHandler(job_id)
    handler.setFormatter(logging.Formatter('%(levelname)s %(message)s'))
    logging.root.addHandler(handler)
    conn = app.db.get_connection()
    cancel_event = _jobs[job_id]["cancel_event"]
    try:
        if job_name == 'scrape':
            from scrape_pubs import scrape_pubs as _fn
            _fn(app.db, conn, cancel_event=cancel_event)
        elif job_name == 'notify':
            from notify import notify as _fn
            _fn(app.db, conn, cancel_event=cancel_event)
        elif job_name == 'send':
            from send_notifications import process_notifications as _fn
            _fn(app.db, conn, target_email=target_email, cancel_event=cancel_event)
        _jobs[job_id]["status"] = "done"
    except JobCancelledError:
        _jobs[job_id]["logs"].append("INFO Job cancelled by user")
        _jobs[job_id]["status"] = "cancelled"
    except Exception as e:
        _jobs[job_id]["logs"].append(f"ERROR {e}")
        _jobs[job_id]["status"] = "error"
    finally:
        logging.root.removeHandler(handler)
        finished_at = datetime.now(timezone.utc).isoformat()
        try:
            db_conn = app.db.get_connection()
            app.db.save_job_run(db_conn, job_id, job_name, _jobs[job_id]["status"],
                                _jobs[job_id]["logs"], started_at, finished_at)
            db_conn.close()
        except Exception:
            pass
        conn.close()


@app.route("/admin/jobs/<job_name>/run", methods=["POST"])
@require_secret_key
def start_job(job_name):
    if job_name not in ('scrape', 'notify', 'send'):
        return jsonify({"error": "Unknown job"}), 400
    data = request.get_json(silent=True) or {}
    target_email = data.get("email")
    job_id = uuid.uuid4().hex[:10]
    _jobs[job_id] = {"status": "running", "logs": [], "job": job_name, "cancel_event": threading.Event()}
    t = threading.Thread(target=_run_job_thread, args=(job_id, job_name, target_email), daemon=True)
    t.start()
    return jsonify({"job_id": job_id})


@app.route("/admin/jobs/<job_id>/cancel", methods=["POST"])
def cancel_job(job_id):
    key = request.headers.get('X-SECRET-KEY', '')
    if key != SECRET_KEY:
        return jsonify({"error": "Unauthorized"}), 401
    job = _jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    if job["status"] != "running":
        return jsonify({"error": "Job is not running"}), 400
    job["cancel_event"].set()
    return jsonify({"ok": True})


@app.route("/admin/jobs/<job_id>/stream")
def stream_job(job_id):
    key = request.args.get('key', '')
    if key != SECRET_KEY:
        return jsonify({"error": "Unauthorized"}), 401

    def generate():
        last_idx = 0
        while True:
            job = _jobs.get(job_id)
            if not job:
                yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
                break
            new_logs = job["logs"][last_idx:]
            for log in new_logs:
                yield f"data: {json.dumps({'log': log})}\n\n"
                yield ": " + " " * 8192 + "\n\n"  # force buffer flush
            last_idx += len(new_logs)
            if job["status"] != "running":
                yield f"data: {json.dumps({'done': True, 'status': job['status']})}\n\n"
                yield ": " + " " * 8192 + "\n\n"
                break
            # keep-alive ping every 0.3s
            yield ": ping\n\n"
            time.sleep(0.3)

    return Response(
        stream_with_context(generate()),
        content_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive'}
    )


@app.route("/admin/jobs/<job_id>")
def get_job_status(job_id):
    key = request.headers.get('X-SECRET-KEY', '')
    if key != SECRET_KEY:
        return jsonify({"error": "Unauthorized"}), 401
    # check memory first, then DB
    job = _jobs.get(job_id)
    if job:
        return jsonify({k: v for k, v in job.items() if k != 'cancel_event'})
    conn = app.db.get_connection()
    try:
        runs = app.db.get_job_runs(conn)
        for r in runs:
            if r['job_id'] == job_id:
                return jsonify(r)
        return jsonify({"error": "Job not found"}), 404
    finally:
        conn.close()


@app.route("/admin/jobs/history/<job_name>")
def get_job_history(job_name):
    key = request.headers.get('X-SECRET-KEY', '')
    if key != SECRET_KEY:
        return jsonify({"error": "Unauthorized"}), 401
    if job_name not in ('scrape', 'notify', 'send'):
        return jsonify({"error": "Unknown job"}), 400
    conn = app.db.get_connection()
    try:
        runs = app.db.get_job_runs(conn, job_name)
        # overlay in-memory logs (available since last restart) over DB entries
        for run in runs:
            mem = _jobs.get(run['job_id'])
            if mem and mem.get('logs'):
                run['logs'] = mem['logs']
        return jsonify(runs)
    finally:
        conn.close()


@app.route("/posts", methods=["GET"])
@require_secret_key
def get_posts():
    conn = app.db.get_connection()
    try:
        posts = app.db.get_posts(conn)
        result = []
        for post in posts:
            result.append({
                "id": post["id"],
                "url": post["url"],
                "title": post["title"],
                "topic": post["topic"],
                "publisher": post["publisher_name"],
                "published_at": post["published_at"],
                "created_at": post["created_at"],
                "tags": post["tags"],
                "labelled": post['labelled'],
                "fire_count": post.get("fire_count", 0),
            })
        def _sort_dt(s):
            try:
                return datetime.fromisoformat(s.replace('Z', '+00:00')).replace(tzinfo=None)
            except Exception:
                return datetime.min
        result.sort(
            key=lambda x: _sort_dt(x['created_at'] or x['published_at']),
            reverse=True
        )   
        return jsonify(result)
    finally:
        conn.close()
        
@app.route("/posts/<int:post_id>", methods=["PATCH"])
def update_post(post_id):
    key = request.headers.get("X-SECRET-KEY")
    if key != SECRET_KEY:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    data = request.get_json()
    topic = data.get("topic")
    if not topic:
        return jsonify({"status": "error", "message": "No topic provided"}), 400

    tags = data.get("tags") or None
    fire_count = data.get("fire_count")

    conn = app.db.get_connection()
    try:
        app.db.update_post_label(conn, post_id, topic, tags=tags)
        if fire_count is not None:
            app.db.set_fire_count(conn, post_id, int(fire_count))
        return jsonify({"status": "success", "message": f"Post {post_id} updated"})
    finally:
        conn.close()
        
@app.route("/feed/suggested", methods=["POST"])
def suggested_feed():
    data = request.get_json()
    issues = data.get("issues", [])
    limit = int(request.args.get("limit", 100))

    if not issues:
        return jsonify([])

    cloud_id = session.get('jira_cloud_id', 'anonymous')
    issue_embeddings = _get_issue_embeddings(cloud_id, issues)

    conn = app.db.get_connection()
    try:
        posts = app.db.get_posts(conn)
        feed = []
        for post in posts:
            if not post.get("labelled"):
                continue
            feed.append({
                "id": post["id"],
                "url": post["url"],
                "title": post["title"],
                "topic": post["topic"],
                "publisher": post["publisher_name"],
                "published_at": post["published_at"],
                "tags": post["tags"],
                "like_count": post.get("like_count", 0),
                "fire_count": post.get("fire_count", 0),
                "view_count": post.get("view_count", 0),
                "embedding": post.get("embedding"),
            })
        feed.sort(key=lambda x: datetime.fromisoformat(x["published_at"]), reverse=True)
        feed = feed[:limit]
    finally:
        conn.close()

    # Score each post against all issues
    result = []
    for post in feed:
        raw = post.pop("embedding")
        best_score = 0.0
        best_issue = None

        if raw:
            try:
                post_vec = np.frombuffer(raw, dtype=np.float32).copy()
                post_vec = post_vec / (np.linalg.norm(post_vec) + 1e-9)
                for issue, issue_vec in issue_embeddings:
                    iv = issue_vec / (np.linalg.norm(issue_vec) + 1e-9)
                    score = float(np.dot(post_vec, iv))
                    if score > best_score:
                        best_score = score
                        best_issue = issue
            except Exception:
                pass  # bad embedding bytes — post still included, just unranked

        post["matched_issue"] = {"key": best_issue["key"], "summary": best_issue["summary"]} if best_issue and best_score > 0.4 else None
        post["score"] = round(best_score, 4)
        result.append(post)

    # Sort: matched posts first (by score desc), then rest by date
    result.sort(key=lambda x: (x["score"] if x["matched_issue"] else 0), reverse=True)
    return jsonify(result)


@app.route("/verify-email/send", methods=["POST"])
def verify_email_send():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    if not email or not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        return jsonify({"error": "Invalid email address"}), 400

    with _otp_lock:
        record = _otp_store.get(email)
        # Rate limit: block resend within 60 seconds (5s in dev)
        rate_limit = 5 if os.getenv('FLASK_ENV') == 'development' else 60
        if record and not record['verified']:
            elapsed = (datetime.now(timezone.utc) - record['sent_at']).total_seconds()
            if elapsed < rate_limit:
                return jsonify({"error": f"Please wait {rate_limit}s before requesting another code", "wait": int(rate_limit - elapsed)}), 429

        otp = str(random.randint(100000, 999999))
        _otp_store[email] = {
            'otp': otp,
            'expires_at': datetime.now(timezone.utc) + timedelta(minutes=10),
            'sent_at': datetime.now(timezone.utc),
            'verified': False,
        }

    if os.getenv('FLASK_ENV') == 'development':
        logger.info(f"[DEV] OTP for {email}: {otp}")
    else:
        try:
            msg = MIMEMultipart()
            msg['From'] = SMTP_USERNAME
            msg['To'] = email
            msg['Subject'] = 'Your onesearch verification code'
            body = render_template('otp_email.html', otp=otp)
            msg.attach(MIMEText(body, 'html'))
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.sendmail(SMTP_USERNAME, email, msg.as_string())
        except Exception as e:
            logger.error(f"OTP send failed for {email}: {e}")
            return jsonify({"error": "Failed to send code, please try again"}), 500

    return jsonify({"ok": True})


@app.route("/verify-email/confirm", methods=["POST"])
def verify_email_confirm():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    otp   = data.get('otp', '').strip()

    with _otp_lock:
        record = _otp_store.get(email)
        if not record:
            return jsonify({"error": "No code found, please request a new one"}), 400
        if record['verified']:
            return jsonify({"ok": True})
        if datetime.now(timezone.utc) > record['expires_at']:
            del _otp_store[email]
            return jsonify({"error": "Code expired, please request a new one"}), 400
        if record['otp'] != otp:
            return jsonify({"error": "Incorrect code"}), 400
        _otp_store[email]['verified'] = True

    return jsonify({"ok": True})


_LAZY_SRC_ATTRS    = ['data-src', 'data-lazy-src', 'data-original', 'data-lazy',
                       'data-url', 'data-image-src', 'data-hi-res-src', 'data-delayed-url']
_LAZY_SRCSET_ATTRS = ['data-srcset', 'data-lazy-srcset', 'data-original-set']


# ── Per-publisher post-processors ─────────────────────────────────────────────
# Each key is a hostname substring (e.g. 'antirez.com').
# Each value is a callable: fn(soup: BeautifulSoup) -> None  (mutates in-place)
# To add a new publisher, just add an entry here.



def _resolve_lazy_images(soup):
    """Promote data-src / data-srcset to real src/srcset so readability keeps images."""
    for img in soup.find_all('img'):
        # src
        if not img.get('src') or img['src'].startswith('data:'):
            for attr in _LAZY_SRC_ATTRS:
                val = img.get(attr)
                if val:
                    img['src'] = val
                    break
        # srcset
        if not img.get('srcset'):
            for attr in _LAZY_SRCSET_ATTRS:
                val = img.get(attr)
                if val:
                    img['srcset'] = val
                    break

    # <picture><source> elements
    for source in soup.find_all('source'):
        if not source.get('srcset'):
            for attr in _LAZY_SRCSET_ATTRS:
                val = source.get(attr)
                if val:
                    source['srcset'] = val
                    break
        if not source.get('src'):
            for attr in _LAZY_SRC_ATTRS:
                val = source.get(attr)
                if val:
                    source['src'] = val
                    break


def _absolutize_srcset(el, base_url):
    """Make every URL inside a srcset attribute absolute."""
    from urllib.parse import urljoin
    srcset = el.get('srcset', '')
    if not srcset:
        return
    parts = []
    for entry in srcset.split(','):
        entry = entry.strip()
        if not entry:
            continue
        pieces = entry.split()
        if pieces and not pieces[0].startswith(('http://', 'https://', 'data:')):
            pieces[0] = urljoin(base_url, pieces[0])
        parts.append(' '.join(pieces))
    el['srcset'] = ', '.join(parts)


@lru_cache(maxsize=128)
def _extract_article_content(url):
    """Fetch and extract article content. Cached by URL (LRU, max 128 entries)."""
    import requests as req
    import urllib3
    from readability import Document
    from bs4 import BeautifulSoup
    from urllib.parse import urljoin
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    response = req.get(url, verify=False, timeout=20, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    response.raise_for_status()
    # requests defaults to ISO-8859-1 for text/html with no declared charset,
    # which corrupts UTF-8 characters. Force UTF-8, fall back to detected encoding.
    response.encoding = response.apparent_encoding or 'utf-8'
    html = response.text

    # ── Pre-process: fix lazy-loaded images BEFORE readability strips them ──
    pre_soup = BeautifulSoup(html, 'html.parser')
    _resolve_lazy_images(pre_soup)

    # Absolutize URLs in pre_soup NOW so collected images are already absolute
    for tag, attr in [('img', 'src'), ('source', 'src'), ('video', 'src'), ('audio', 'src')]:
        for el in pre_soup.find_all(tag):
            val = el.get(attr)
            if val and not val.startswith(('http://', 'https://', 'data:', '#')):
                el[attr] = urljoin(url, val)
    for el in pre_soup.find_all(['img', 'source']):
        _absolutize_srcset(el, url)

    # ── Collect figure media from original HTML (readability strips images from figures) ──
    orig_figure_media = []
    for fig in pre_soup.find_all('figure'):
        pic = fig.find('picture')
        img_tag = fig.find('img')
        if pic:
            orig_figure_media.append(str(pic))
        elif img_tag:
            orig_figure_media.append(str(img_tag))

    html = str(pre_soup)

    doc = Document(html)
    content = doc.summary(html_partial=True)
    if not content:
        return None

    soup = BeautifulSoup(content, 'html.parser')

    # ── Restore SVG width/height stripped by readability ──
    # Note: html.parser lowercases all attributes, so viewBox → viewbox
    def _svg_viewbox(el):
        return el.get('viewbox') or el.get('viewBox')

    orig_svgs = {_svg_viewbox(s): s for s in pre_soup.find_all('svg') if _svg_viewbox(s)}
    for svg in soup.find_all('svg'):
        vb = _svg_viewbox(svg)
        if not vb:
            continue
        # Try restoring from original HTML first
        orig = orig_svgs.get(vb)
        if orig:
            if orig.get('width') and not svg.get('width'):
                svg['width'] = orig['width']
            if orig.get('height') and not svg.get('height'):
                svg['height'] = orig['height']
        # Fallback: derive dimensions from viewBox (e.g. "0 0 26 37" → 26×37)
        if not svg.get('width') or not svg.get('height'):
            parts = vb.split()
            if len(parts) == 4:
                try:
                    svg['width'] = str(int(float(parts[2])))
                    svg['height'] = str(int(float(parts[3])))
                except ValueError:
                    pass

    # Absolutize all relative src / href / srcset in readability output
    for tag, attr in [('img', 'src'), ('a', 'href'), ('source', 'src'), ('video', 'src'), ('audio', 'src')]:
        for el in soup.find_all(tag):
            val = el.get(attr)
            if val and not val.startswith(('http://', 'https://', 'data:', '#', 'mailto:')):
                el[attr] = urljoin(url, val)

    for el in soup.find_all(['img', 'source']):
        _absolutize_srcset(el, url)

    # ── Re-inject images into figures that readability emptied ──
    empty_figs = [f for f in soup.find_all('figure') if not f.find('img')]
    for i, fig in enumerate(empty_figs):
        if i < len(orig_figure_media):
            media_node = BeautifulSoup(orig_figure_media[i], 'html.parser')
            figcap = fig.find('figcaption')
            if figcap:
                figcap.insert_before(media_node)
            else:
                fig.insert(0, media_node)

    # Convert prose <pre> tags (no <code> child) into paragraphs,
    # preserving inline HTML like <a> tags via decode_contents()
    for pre in soup.find_all('pre'):
        if not pre.find('code'):
            inner_html = pre.decode_contents()
            new_div = soup.new_tag('div')
            for chunk in inner_html.split('\n\n'):
                chunk = chunk.strip()
                if chunk:
                    p = soup.new_tag('p')
                    parsed = BeautifulSoup(chunk.replace('\n', ' '), 'html.parser')
                    body = parsed.body or parsed
                    for child in list(body.children):
                        p.append(child)
                    new_div.append(p)
            pre.replace_with(new_div)

    # ── Strip UI-only accessibility artifacts (Medium, Substack, etc.) ──
    import re as _re
    _UI_TEXT = _re.compile(
        r'press enter|click to view|full size|zoom in',
        _re.IGNORECASE
    )
    # collect first, then modify — avoids tree-iteration side effects
    for span in list(soup.find_all('span')):
        txt = span.get_text(strip=True)
        if txt and _UI_TEXT.search(txt) and not span.find(['img', 'picture', 'video']):
            span.decompose()

    # Unwrap <div role="button"> wrappers around images (keep children)
    for div in list(soup.find_all('div', attrs={'role': 'button'})):
        div.unwrap()

    return str(soup)


@app.route("/posts/<int:post_id>/content", methods=["GET"])
def get_post_content(post_id):
    from handlers.factory import ScraperFactory
    from bs4 import BeautifulSoup

    conn = app.db.get_connection()
    try:
        url, publisher_name = app.db.get_post_info(conn, post_id)
        if not url:
            return jsonify({"error": "Post not found"}), 404
    finally:
        conn.close()

    # Try publisher-specific extraction first; fall back to generic readability
    scraper = ScraperFactory.get_scraper(publisher_name) if publisher_name else None
    used_custom = False
    content = None
    if scraper:
        try:
            content = scraper.extract_article(url)
            if content:
                used_custom = True
        except Exception:
            content = None

    if not content:
        try:
            content = _extract_article_content(url)
        except Exception as e:
            return jsonify({"error": f"Could not fetch article: {str(e)}"}), 502

    if not content:
        return jsonify({"error": "Could not extract article content"}), 422

    # Publisher-specific cleanup only applies to the generic readability path
    if scraper and not used_custom:
        soup = BeautifulSoup(content, 'html.parser')
        scraper.clean_article(soup)
        content = str(soup)

    return jsonify({"content": content, "url": url})


@app.route("/api/tts/<int:post_id>", methods=["POST"])
def generate_post_tts(post_id):
    """Generate (or return cached) Google TTS audio for a post."""
    from tts_generator import generate_tts

    conn = app.db.get_connection()
    try:
        audio_file, timings = app.db.get_tts_cache(conn, post_id)
        if audio_file and os.path.exists(audio_file) and timings:
            return jsonify({
                "audioUrl": f"/api/tts/audio/post_{post_id}.mp3",
                "timings":  timings,
            })
        url, publisher_name = app.db.get_post_info(conn, post_id)
        if not url:
            return jsonify({"error": "Post not found"}), 404
    finally:
        conn.close()

    # Fetch article content (same logic as /posts/<id>/content)
    from handlers.factory import ScraperFactory

    scraper = ScraperFactory.get_scraper(publisher_name) if publisher_name else None
    content = None
    if scraper:
        try:
            content = scraper.extract_article(url)
        except Exception:
            content = None
    if not content:
        try:
            content = _extract_article_content(url)
        except Exception as e:
            return jsonify({"error": f"Could not fetch article: {e}"}), 502
    if not content:
        return jsonify({"error": "Could not extract article content"}), 422

    audio_dir      = os.path.join("data", "tts")
    os.makedirs(audio_dir, exist_ok=True)
    audio_filename = f"post_{post_id}.mp3"
    audio_path     = os.path.join(audio_dir, audio_filename)

    try:
        from tts_generator import html_to_ssml
        _ssml, _words = html_to_ssml(content)
        app.logger.info("TTS SSML preview (first 600 chars): %s", _ssml[:600])
        timings = generate_tts(content, audio_path)
    except Exception as e:
        app.logger.error("TTS generation failed for post %s: %s", post_id, e)
        return jsonify({"error": "TTS generation failed"}), 500

    conn = app.db.get_connection()
    try:
        app.db.save_tts_cache(conn, post_id, audio_path, timings)
    finally:
        conn.close()

    return jsonify({"audioUrl": f"/api/tts/audio/{audio_filename}", "timings": timings})


@app.route("/api/tts/<int:post_id>/stream", methods=["POST"])
def stream_post_tts(post_id):
    """Stream TTS audio chunks via SSE as each chunk is synthesized."""
    import base64
    from tts_generator import generate_tts_stream

    # ── Cache hit: stream the pre-built file as a single chunk ──────────────
    conn = app.db.get_connection()
    try:
        audio_file, timings = app.db.get_tts_cache(conn, post_id)
        if audio_file and os.path.exists(audio_file) and timings:
            def serve_cached():
                with open(audio_file, "rb") as f:
                    audio_bytes = f.read()
                payload = json.dumps({
                    "audio":   base64.b64encode(audio_bytes).decode(),
                    "timings": timings,
                    "offset":  0.0,
                })
                yield f"data: {payload}\n\n"
                yield "data: [DONE]\n\n"
            return Response(
                stream_with_context(serve_cached()),
                mimetype="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )
    finally:
        conn.close()

    # ── Fetch post metadata ──────────────────────────────────────────────────
    conn = app.db.get_connection()
    try:
        url, publisher_name = app.db.get_post_info(conn, post_id)
    finally:
        conn.close()

    if not url:
        return jsonify({"error": "Post not found"}), 404

    # ── Extract article content ──────────────────────────────────────────────
    from handlers.factory import ScraperFactory
    content = None
    scraper = ScraperFactory.get_scraper(publisher_name) if publisher_name else None
    if scraper:
        try:
            content = scraper.extract_article(url)
        except Exception:
            content = None
    if not content:
        try:
            content = _extract_article_content(url)
        except Exception:
            pass

    if not content:
        return jsonify({"error": "Could not extract article content"}), 422

    audio_dir  = os.path.join("data", "tts")
    os.makedirs(audio_dir, exist_ok=True)
    audio_path = os.path.join(audio_dir, f"post_{post_id}.mp3")

    # ── Stream chunks, write to disk incrementally ───────────────────────────
    def generate():
        all_timings  = []
        completed    = False
        tmp_path     = audio_path + ".tmp"
        try:
            with open(tmp_path, "wb") as f:
                for audio_bytes, chunk_timings, time_offset in generate_tts_stream(content):
                    f.write(audio_bytes)          # persist chunk immediately
                    f.flush()
                    all_timings += chunk_timings
                    payload = json.dumps({
                        "audio":   base64.b64encode(audio_bytes).decode(),
                        "timings": chunk_timings,
                        "offset":  time_offset,
                    })
                    yield f"data: {payload}\n\n"

            # All chunks done — promote tmp file and save cache entry
            os.replace(tmp_path, audio_path)
            completed = True
            c = app.db.get_connection()
            try:
                app.db.save_tts_cache(c, post_id, audio_path, all_timings)
            finally:
                c.close()

        except Exception as e:
            app.logger.error("TTS stream error for post %s: %s", post_id, e)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            if not completed and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)   # clean up partial file on cancellation
                except OSError:
                    pass

        yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/api/tts/audio/<filename>")
def serve_tts_audio(filename):
    """Serve cached TTS audio files."""
    if not re.match(r"^post_\d+\.mp3$", filename):
        return "", 404
    return send_from_directory(os.path.join("data", "tts"), filename, mimetype="audio/mpeg")


@app.route("/posts/<int:post_id>/view", methods=["POST"])
def record_view(post_id):
    data = request.get_json(silent=True) or {}
    user_identifier = data.get('user_identifier', 'anonymous').strip() or 'anonymous'
    device_id = data.get('device_id', '').strip()
    if not device_id:
        return jsonify({"error": "device_id required"}), 400

    conn = app.db.get_connection()
    try:
        count = app.db.record_view(conn, post_id, user_identifier, device_id)
        return jsonify({"view_count": count})
    finally:
        conn.close()


@app.route("/posts/<int:post_id>/read-event", methods=["GET"])
def get_read_event(post_id):
    device_id = request.args.get('device_id', '').strip()
    if not device_id:
        return jsonify({"error": "device_id required"}), 400
    conn = app.db.get_connection()
    try:
        c = conn.cursor()
        c.execute("""
            SELECT max_depth, time_spent, opened_original
            FROM reading_events
            WHERE post_id = ? AND device_id = ?
        """, (post_id, device_id))
        row = c.fetchone()
        return jsonify(dict(row) if row else {})
    finally:
        conn.close()

@app.route("/posts/<int:post_id>/read-event", methods=["POST"])
def record_read_event(post_id):
    data = request.get_json(silent=True) or {}
    device_id = data.get('device_id', '').strip()
    if not device_id:
        return jsonify({"error": "device_id required"}), 400

    user_email   = (data.get('user_email') or '').strip().lower() or None
    time_spent   = max(0, int(data.get('time_spent', 0)))
    max_depth    = max(0, min(100, int(data.get('max_depth', 0))))
    opened_original = bool(data.get('opened_original', False))

    conn = app.db.get_connection()
    try:
        app.db.upsert_reading_event(conn, post_id, device_id, user_email, time_spent, max_depth, opened_original)
        return jsonify({"ok": True})
    finally:
        conn.close()


@app.route("/feed/continue-reading", methods=["GET"])
def continue_reading_feed():
    device_id = request.args.get('device_id', '').strip()
    email = request.args.get('email', '').strip().lower()
    if not device_id and not email:
        return jsonify([])
    conn = app.db.get_connection()
    try:
        c = conn.cursor()
        conditions, params = [], []
        if device_id:
            conditions.append("re.device_id = ?")
            params.append(device_id)
        if email:
            conditions.append("re.user_email = ?")
            params.append(email)
        where = " OR ".join(conditions)
        c.execute(f"""
            SELECT po.id, po.title, po.url, po.published_at, po.topic, po.tags,
                   pu.publisher_name AS publisher,
                   COALESCE(lc.like_count, 0) AS like_count,
                   COALESCE(vc.view_count, 0) AS view_count,
                   COALESCE(f.fire_count, 0) AS fire_count,
                   MAX(re.max_depth) AS max_depth,
                   MAX(re.last_read_at) AS last_read_at
            FROM reading_events re
            JOIN posts po ON po.id = re.post_id
            JOIN publishers pu ON pu.id = po.publisher_id
            LEFT JOIN (SELECT post_id, COUNT(*) AS like_count FROM post_likes GROUP BY post_id) lc ON lc.post_id = po.id
            LEFT JOIN (SELECT post_id, COUNT(*) AS view_count FROM views GROUP BY post_id) vc ON vc.post_id = po.id
            LEFT JOIN fire f ON f.post_id = po.id
            WHERE ({where}) AND re.max_depth >= 2 AND re.max_depth < 95
            GROUP BY po.id
            ORDER BY last_read_at DESC
            LIMIT 10
        """, params)
        rows = c.fetchall()
        cols = [d[0] for d in c.description]
        return jsonify([dict(zip(cols, r)) for r in rows])
    finally:
        conn.close()


@app.route("/posts/<int:post_id>/like", methods=["POST"])
def like_post(post_id):
    data = request.get_json(silent=True) or {}
    user_email = data.get('email', '').strip().lower()
    if not user_email or not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', user_email):
        return jsonify({"error": "Valid email required to like posts"}), 400

    conn = app.db.get_connection()
    try:
        count, is_new = app.db.like_post(conn, post_id, user_email)
        return jsonify({"count": count, "is_new": is_new})
    finally:
        conn.close()


@app.route("/feed/most-liked", methods=["GET"])
def most_liked_feed():
    limit = min(int(request.args.get("limit", 5)), 20)
    conn = app.db.get_connection()
    try:
        posts = app.db.get_most_liked_this_month(conn, limit=limit)
        return jsonify([{
            "id": post["id"],
            "url": post["url"],
            "title": post["title"],
            "topic": post["topic"],
            "publisher": post["publisher_name"],
            "published_at": post["published_at"],
            "tags": post["tags"],
            "like_count": post["like_count"],
            "recent_like_count": post["recent_like_count"],
            "fire_count": post.get("fire_count", 0),
            "view_count": post.get("view_count", 0),
        } for post in posts])
    finally:
        conn.close()


@app.route("/feed/recommended", methods=["GET"])
def recommended_feed():
    limit = min(int(request.args.get("limit", 15)), 30)
    conn = app.db.get_connection()
    try:
        posts = app.db.get_recommended_by_fire(conn, limit=limit)
        return jsonify([{
            "id": post["id"],
            "url": post["url"],
            "title": post["title"],
            "topic": post["topic"],
            "publisher": post["publisher_name"],
            "published_at": post["published_at"],
            "tags": post["tags"],
            "like_count": post.get("like_count", 0),
            "fire_count": post.get("fire_count", 0),
            "view_count": post.get("view_count", 0),
        } for post in posts])
    finally:
        conn.close()


@app.route("/feed/most-liked-all-time", methods=["GET"])
def most_liked_all_time_feed():
    limit = min(int(request.args.get("limit", 20)), 50)
    conn = app.db.get_connection()
    try:
        posts = app.db.get_most_liked_all_time(conn, limit=limit)
        return jsonify([{
            "id": post["id"],
            "url": post["url"],
            "title": post["title"],
            "topic": post["topic"],
            "publisher": post["publisher_name"],
            "published_at": post["published_at"],
            "tags": post["tags"],
            "like_count": post["like_count"],
            "fire_count": post.get("fire_count", 0),
            "view_count": post.get("view_count", 0),
        } for post in posts])
    finally:
        conn.close()


@app.route("/api/chat/<int:post_id>", methods=["POST"])
def chat_with_article(post_id):
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    if not question:
        return jsonify({"error": "question required"}), 400

    try:
        import llm

        def generate():
            try:
                for chunk in llm.ask_article_stream(post_id, question):
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            except llm.PostNotFoundError:
                yield f"data: {json.dumps({'error': 'Post not found'})}\n\n"
            except llm.ContentExtractionError as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            except Exception as e:
                app.logger.error("LLM stream error for post %s: %s", post_id, e)
                yield f"data: {json.dumps({'error': 'Failed to get answer'})}\n\n"
            yield "data: [DONE]\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    except Exception as e:
        app.logger.error("LLM error for post %s: %s", post_id, e)
        return jsonify({"error": "Failed to get answer"}), 500


if __name__ == "__main__":
    if os.getenv("FLASK_ENV") == "Production":
        app.run()
    else:
        app.run(debug=True)
        
