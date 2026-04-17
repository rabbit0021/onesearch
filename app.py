from dotenv import load_dotenv
load_dotenv()

from flask import Flask, send_from_directory, jsonify, request, render_template, session
import json
import os
from handlers import ScraperFactory
from datetime import datetime
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


@app.route("/posts", methods=["GET"])
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


@app.route("/posts/<int:post_id>/like", methods=["POST"])
def like_post(post_id):
    jira_account_id = session.get('jira_account_id')
    if not jira_account_id:
        return jsonify({"error": "Not authenticated with Jira"}), 401
    conn = app.db.get_connection()
    try:
        count, is_new = app.db.like_post(conn, post_id, jira_account_id)
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
        
