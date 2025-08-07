from flask import Flask, jsonify, request, send_from_directory, render_template
import json
import os
from handlers import ScraperFactory
from datetime import datetime
import logging
from middleware import register_middlewares

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default-secret')

# Logging    
log_dir = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(log_dir, exist_ok=True)

env = os.getenv('FLASK_ENV', 'development')
log_file_name = 'server_prod.log' if env == 'production' else 'server_dev.log'

file_handler = logging.FileHandler(os.path.join(log_dir, log_file_name))
file_handler.setLevel(logging.INFO)

formatter = logging.Formatter(
    '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
)
file_handler.setFormatter(formatter)

app.logger.setLevel(logging.INFO)
app.logger.addHandler(file_handler)

# optional: log to stdout too
stream_handler = logging.StreamHandler()
stream_handler.setFormatter(formatter)
app.logger.addHandler(stream_handler)

# test log
app.logger.info("Logger initialized.")
register_middlewares(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data", "companies.json")
SUBSCRIBERS_FILE = os.path.join(BASE_DIR, "data", "subscribers.json")
CATEGORIES_FILE =  os.path.join(BASE_DIR, "data", "categories.json")
    
def load_companies():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_companies(companies):
    with open(DATA_FILE, "w") as f:
        json.dump(companies, f, indent=2)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/companies", methods=["GET"])
def get_companies():
    query = request.args.get("search", "").lower()
    companies = load_companies()
    if query:
        companies = [c for c in companies if query in c["name"].lower()]
    return jsonify(companies)

@app.route("/companies", methods=["POST"])
def add_company():
    data = request.json
    if not data or "name" not in data or "link" not in data:
        return jsonify({"error": "Missing 'name' or 'link'"}), 400

    companies = load_companies()
    for company in companies:
        if company["name"].lower() == data["name"].lower():
            return jsonify({"error": "Company already exists"}), 409

    companies.append({
        "name": data["name"].strip(),
        "link": data["link"].strip()
    })

    save_companies(companies)
    return jsonify({"message": "Company added successfully"}), 201

@app.route("/categories")
def get_categories():
    company = request.args.get("company")
    if not company:
        return jsonify({"error": "Company name is required"}), 400
    
    company = company.lower()
    
    # Load keywords
    if not os.path.exists(CATEGORIES_FILE):
        return jsonify([])

    with open(CATEGORIES_FILE, "r") as f:
        data = json.load(f)

    categories = data.get(company, [])
    return jsonify(categories)

@app.route('/scrape_categories')
def scrape_categories():
    company = request.args.get('company')
    if not company:
        return jsonify({'error': 'company param required'}), 400

    scraper = ScraperFactory.get_scraper(company)
    if not scraper:
        return jsonify({'error': f"No handler for {company}"}), 404

    categories = scraper.scrape()
    
    # Save to keywords.json
    if os.path.exists(CATEGORIES_FILE):
        with open(CATEGORIES_FILE) as f:
            data = json.load(f)
    else:
        data = {}

    data[company] = categories

    with open(CATEGORIES_FILE, 'w') as f:
        json.dump(data, f, indent=2)

    return jsonify({'company': company, 'categories': categories})

@app.route('/subscribe', methods=['POST'])
def subscribe():
    data = request.form
    email = data.get('email')
    company = data.get('company')
    categories_raw = data.get('categories', '')
    categories = [cat.strip() for cat in categories_raw.split(',') if cat.strip()]

    if not email or not company or not categories:
        return jsonify({"status": "error", "message": "Missing email, company or categories."}), 400

    try:
        with open(SUBSCRIBERS_FILE, "r") as f:
            subscribers = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        subscribers = []

    updated = False
    time_now = datetime.utcnow().isoformat()

    for cat in categories:
        found = False
        for sub in subscribers:
            if sub["email"] == email and sub["company"] == company and sub["category"] == cat:
                updated = True
                found = True
                break
        if not found:
            subscribers.append({
                "email": email,
                "company": company,
                "category": cat,
                "time": time_now
            })
            updated = False

    with open(SUBSCRIBERS_FILE, "w") as f:
        json.dump(subscribers, f, indent=2)

    return jsonify({
        "status": "success",
        "message": "Subscription updated." if updated else "Subscription added."
    })

@app.route("/subscriptions_for_email")
def subscriptions_for_email():
    email = request.args.get("email", "").strip().lower()
    if not email:
        return jsonify([])
    
    if not os.path.exists(SUBSCRIBERS_FILE):
        return jsonify([])

    with open(SUBSCRIBERS_FILE, "r") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            return jsonify([])
    
    grouped = {}
    for entry in data:
        if entry["email"] == email.lower():
            company = entry["company"]
            if company not in grouped:
                grouped[company] = set()
            grouped[company].add(entry["category"])
            
    # Convert sets to lists for JSON serializability
    result = {company: list(categories) for company, categories in grouped.items()}
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)
