from flask import Flask, jsonify, request, send_from_directory, render_template
import json
import os
from handlers import ScraperFactory
from datetime import datetime
from middleware import register_middlewares
from logger_config import get_logger
from datetime import timezone
from db import get_database

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default-secret')
app.db = get_database()

# Logging    
app.logger = get_logger("app")

# test log
register_middlewares(app)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/techteams", methods=["GET"])
def get_companies():
    query = request.args.get("search", "").lower()
    
    conn = app.db.get_connection()

    techteams = app.db.get_publishers_by_type(conn, publisher_type="techteam")
    teamNames = [team["publisher_name"] for team in techteams if query in team["publisher_name"].lower()]
    return jsonify(teamNames)

@app.route('/subscribe', methods=['POST'])
def subscribe():
    data = request.form
    email = data.get('email').lower().strip()
    topic = data.get('topic').strip()
    techteams = data.get('techteams')
    individuals = data.get('individuals')
    communities = data.get('communities')

    if not email or not topic or (not techteams and not individuals and not communities):
        return jsonify({"status": "error", "message": "Missing email or topic or publisher"
                        }), 400
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
                app.db.add_subscription(conn, email, topic, publisher['id'])

    return jsonify({
        "status": "success",
        "message": "Subscription updated."
    })

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
        publisher = entry["publisher"]["name"]
        if topic not in grouped:
            grouped[topic] = set()
        grouped[topic].add(publisher)
            
    # Convert sets to lists for JSON serializability
    result = {topic: list(publishers) for topic, publishers in grouped.items()}
    return jsonify(result)

if __name__ == "__main__":
    if os.getenv("FLASK_ENV") == "Production":
        app.run()
    else:
        app.run(debug=True)
        
