from flask import Flask, send_from_directory, jsonify, request, send_from_directory, render_template
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

app = Flask(__name__, static_folder="static", template_folder="templates")
app.db = get_database()
SECRET_KEY = os.getenv("POSTS_SECRET_KEY", "123")

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

@app.route("/")
def index():
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

@app.route("/postview.html")
def postview():
    return send_from_directory(app.template_folder, "posts.html")
        
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

    conn = app.db.get_connection()
    try:
        app.db.update_post_label(conn, post_id, topic)
        return jsonify({"status": "success", "message": f"Post {post_id} updated"})
    finally:
        conn.close()
        
if __name__ == "__main__":
    if os.getenv("FLASK_ENV") == "Production":
        app.run()
    else:
        app.run(debug=True)
        
