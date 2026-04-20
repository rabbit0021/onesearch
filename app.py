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
            return send_from_directory(REACT_BUILD_DIR, path)
        return send_from_directory(REACT_BUILD_DIR, "index.html")
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
            })
        result.sort(
            key=lambda x: datetime.fromisoformat(x["published_at"]),
            reverse=True,
        )
        return jsonify(result[:limit])
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
                "tags": post["tags"],
                "labelled": post['labelled']
            })
        result.sort(
            key=lambda x: datetime.fromisoformat(x['published_at']),
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

    conn = app.db.get_connection()
    try:
        app.db.update_post_label(conn, post_id, topic, tags=tags)
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
        } for post in posts])
    finally:
        conn.close()


if __name__ == "__main__":
    if os.getenv("FLASK_ENV") == "Production":
        app.run()
    else:
        app.run(debug=True)
        
