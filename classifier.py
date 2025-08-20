# classifier_model.py
import os
from sentence_transformers import SentenceTransformer, util
from db import enums
import pickle
from logger_config import get_logger

env = os.getenv('FLASK_ENV', 'development')
MODEL_PATH = os.getenv("MODEL_PATH") if env == 'production' else 'data/dev/trained_classifier.pkl'
CONFIDENCE_THRESHOLD = 0.7

logger = get_logger("classifier")
# Load embedding model
embedding_model = SentenceTransformer('all-mpnet-base-v2')

# Category descriptions
categories = {
    enums.PublisherCategory.SOFTWARE_ENGINEERING.value: (
        "frontend, backend, APIs, microservices, databases, relational databases, cloud databases, DevOps, system design, CI/CD, containers, scalability, performance, distributed systems, mobile, UI/UX"
    ),
    enums.PublisherCategory.SOFTWARE_TESTING.value: (
        "manual testing, automated testing, Selenium, Cypress, Playwright, unit tests, integration tests, end-to-end tests, performance, load, stress, TDD, BDD, defect tracking, CI/CD testing"
    ),
    enums.PublisherCategory.DATA_ANALYTICS.value: (
        "data analysis, business intelligence, dashboards, reporting, KPI, SQL, NoSQL, ETL pipelines, data visualization, Tableau, Power BI, Looker, anomaly detection, A/B testing, insights"
    ),
    enums.PublisherCategory.DATA_SCIENCE.value: (
        "machine learning, deep learning, AI, predictive modeling, NLP, computer vision, recommender systems, feature engineering, model training, Python, R, TensorFlow, PyTorch, scikit-learn, ML deployment, recommendation systems"
    ),
    enums.PublisherCategory.PRODUCT_MANAGEMENT.value: (
        "product strategy, design, UX/UI, customer research, roadmap planning, prioritization, market analysis, cross-functional collaboration, agile, lean, product launch, product lifecycle management, product metrics, stakeholder communication"
    ),
    enums.PublisherCategory.GENERAL.value: (
        "general technology, business, professional development, industry news, opinions, AI and tech trends, interdisciplinary topics, updates not fitting other categories"
    )
}

# Precompute embeddings for baseline
category_embeddings = {
    cat: embedding_model.encode(desc, convert_to_tensor=True)
    for cat, desc in categories.items()
}

# Optional keyword mapping
keywords_map = {
    enums.PublisherCategory.SOFTWARE_ENGINEERING.value: [
        "react", "angular", "vue", "node.js", "django", "java", "go",
        "microservices", "api", "devops", "kubernetes",
        "aurora", "rds", "cloud database", "postgresql", "mysql", "mongodb", "redis", "database"
    ],
    enums.PublisherCategory.SOFTWARE_TESTING.value: [
        "selenium", "cypress", "playwright", "testing", "qa", "unit test", "integration test", "e2e test", "load testing", "performance testing", "performance engineering"
    ],
    enums.PublisherCategory.DATA_ANALYTICS.value: [
        "sql", "nosql", "tableau", "power bi", "looker", "etl", "dashboard", "kpi", "analysis", "data pipelines"
    ],
    enums.PublisherCategory.DATA_SCIENCE.value: [
        "machine learning", "deep learning", "ai", "nlp", "computer vision", "tensorflow", "pytorch", "scikit-learn"
    ],
    enums.PublisherCategory.PRODUCT_MANAGEMENT.value: [
        "product strategy", "roadmap", "ux", "ui", "customer research", "agile", "lean", "launch", "metrics"
    ]
}

# ===== Load trained classifier if exists =====
trained_clf = None
label_encoder = None
os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)

if os.path.exists(MODEL_PATH):
    with open(MODEL_PATH, "rb") as f:
        trained_clf, label_encoder = pickle.load(f)
    logger.info(f"[Classifier] Loaded trained classifier from {MODEL_PATH}")

# ===== Baseline classifier =====
def classify_with_embeddings(title, tags="", content=""):
    content_snippet = content[:100] if content else ""
    combined_text = f"Title: {title}. Tags: {tags}. Content: {content_snippet}".lower()
    text_embedding = embedding_model.encode(combined_text, convert_to_tensor=True)

    scores = {cat: util.cos_sim(text_embedding, emb).item()
              for cat, emb in category_embeddings.items()}

    combined_lower = combined_text.lower()
    for cat, kw_list in keywords_map.items():
        for kw in kw_list:
            if kw in combined_lower:
                scores[cat] += 0.1
                break

    best_cat = max(scores, key=scores.get)
    sorted_scores = sorted(scores.values(), reverse=True)
    top_score = sorted_scores[0]
    second_score = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
    if top_score < 0.25 or (top_score - second_score) < 0.05:
        return enums.PublisherCategory.GENERAL.value
    return best_cat

# ===== Unified classifier =====
def classify_post(title, tags="", content=""):
    global trained_clf, label_encoder

    if trained_clf and label_encoder:
        logger.info("Attempt to use trained classifier")

        text_embedding = embedding_model.encode(f"Title: {title}. Tags: {tags}. Content: {content[:100]}")
        pred_proba = trained_clf.predict_proba([text_embedding])[0]
        max_prob = pred_proba.max()
        if max_prob >= CONFIDENCE_THRESHOLD:
            logger.info("Good confidence score with trained classifier")
            pred_label = trained_clf.predict([text_embedding])[0]
            return label_encoder.inverse_transform([pred_label])[0]
        else:
            logger.info(f"Fallback to normal without trained mode due to low confidence: {max_prob}")

    # fallback
    return classify_with_embeddings(title, tags, content)
