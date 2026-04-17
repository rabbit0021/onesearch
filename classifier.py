# classifier_model.py
import os
from sentence_transformers import SentenceTransformer, util
from db import enums
import pickle
from logger_config import get_logger

env = os.getenv('FLASK_ENV', 'development')
MODEL_PATH = os.getenv("MODEL_PATH", "data/trained_classifier.pkl") if env == 'production' else 'data/dev/trained_classifier.pkl'
CONFIDENCE_THRESHOLD = 0.7

logger = get_logger("classifier")
# Load embedding model
embedding_model = SentenceTransformer('all-mpnet-base-v2')

# Category descriptions
categories = {
    enums.PublisherCategory.SOFTWARE_ENGINEERING.value: (
        "software engineering, fullstack development, system design, architecture, scalability, performance, distributed systems, microservices, APIs, CI/CD, code quality, refactoring, open source"
    ),
    enums.PublisherCategory.FRONTEND_ENGINEERING.value: (
        "frontend, UI development, React, Vue, Angular, JavaScript, TypeScript, CSS, HTML, browser, web performance, accessibility, design systems, component libraries, single-page apps, web animations"
    ),
    enums.PublisherCategory.BACKEND_ENGINEERING.value: (
        "backend, server-side, APIs, REST, GraphQL, gRPC, databases, PostgreSQL, MySQL, Redis, caching, message queues, Kafka, RabbitMQ, Python, Java, Go, Node.js, microservices, service mesh"
    ),
    enums.PublisherCategory.MOBILE_ENGINEERING.value: (
        "mobile development, iOS, Android, Swift, Kotlin, React Native, Flutter, mobile performance, push notifications, app store, cross-platform, mobile UI, mobile testing"
    ),
    enums.PublisherCategory.PLATFORM_INFRASTRUCTURE.value: (
        "cloud, AWS, GCP, Azure, Kubernetes, Docker, infrastructure as code, Terraform, Helm, networking, DNS, load balancing, reliability, SRE, observability, monitoring, logging, Prometheus, Grafana, site reliability"
    ),
    enums.PublisherCategory.DATA_ENGINEERING.value: (
        "data pipelines, ETL, ELT, Apache Spark, Flink, Airflow, dbt, data lake, data warehouse, Snowflake, BigQuery, Redshift, streaming, batch processing, data infrastructure, data quality, schema management"
    ),
    enums.PublisherCategory.DATA_SCIENCE.value: (
        "data science, statistical modeling, experimentation, A/B testing, hypothesis testing, Python, R, Jupyter, feature engineering, predictive modeling, regression, classification, clustering, recommender systems"
    ),
    enums.PublisherCategory.ML_AI.value: (
        "machine learning, deep learning, neural networks, large language models, LLMs, generative AI, NLP, computer vision, transformers, PyTorch, TensorFlow, MLOps, model training, model serving, fine-tuning, embeddings, RAG"
    ),
    enums.PublisherCategory.DATA_ANALYTICS.value: (
        "data analysis, business intelligence, dashboards, reporting, KPI, SQL, metrics, Tableau, Power BI, Looker, data visualization, analytics engineering, product analytics, growth analytics"
    ),
    enums.PublisherCategory.SECURITY_ENGINEERING.value: (
        "security, application security, AppSec, penetration testing, vulnerability, threat modeling, OWASP, authentication, authorization, OAuth, zero trust, encryption, secrets management, CVE, incident response, compliance"
    ),
    enums.PublisherCategory.QA_TESTING.value: (
        "quality assurance, testing, test automation, Selenium, Cypress, Playwright, unit tests, integration tests, end-to-end tests, performance testing, load testing, TDD, BDD, test strategy, defect tracking, reliability"
    ),
    enums.PublisherCategory.PRODUCT_MANAGEMENT.value: (
        "product management, product strategy, roadmap, prioritization, product discovery, customer research, user feedback, agile, OKRs, product metrics, go-to-market, product launch, stakeholder management, product lifecycle"
    ),
    enums.PublisherCategory.GENERAL.value: (
        "general technology, industry news, engineering culture, career development, team management, company engineering blog, tech trends, opinion, interdisciplinary topics"
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
        "system design", "architecture", "microservices", "api", "ci/cd", "open source", "scalability", "distributed"
    ],
    enums.PublisherCategory.FRONTEND_ENGINEERING.value: [
        "react", "vue", "angular", "javascript", "typescript", "css", "html", "browser", "webpack", "vite", "frontend", "web app", "component"
    ],
    enums.PublisherCategory.BACKEND_ENGINEERING.value: [
        "node.js", "django", "java", "golang", "go lang", "postgresql", "mysql", "mongodb", "redis", "kafka", "rabbitmq", "grpc", "rest api", "graphql", "backend"
    ],
    enums.PublisherCategory.MOBILE_ENGINEERING.value: [
        "ios", "android", "swift", "kotlin", "react native", "flutter", "mobile", "app store", "push notification"
    ],
    enums.PublisherCategory.PLATFORM_INFRASTRUCTURE.value: [
        "kubernetes", "docker", "aws", "gcp", "azure", "terraform", "helm", "prometheus", "grafana", "devops", "sre", "cloud", "infrastructure", "observability"
    ],
    enums.PublisherCategory.DATA_ENGINEERING.value: [
        "spark", "flink", "airflow", "dbt", "snowflake", "bigquery", "redshift", "etl", "elt", "data pipeline", "data lake", "data warehouse", "streaming"
    ],
    enums.PublisherCategory.DATA_SCIENCE.value: [
        "scikit-learn", "jupyter", "regression", "classification", "clustering", "a/b test", "experimentation", "feature engineering", "data science"
    ],
    enums.PublisherCategory.ML_AI.value: [
        "machine learning", "deep learning", "llm", "large language model", "generative ai", "nlp", "computer vision", "tensorflow", "pytorch", "transformer", "embedding", "rag", "fine-tuning", "mlops"
    ],
    enums.PublisherCategory.DATA_ANALYTICS.value: [
        "sql", "tableau", "power bi", "looker", "dashboard", "kpi", "business intelligence", "analytics", "data visualization"
    ],
    enums.PublisherCategory.SECURITY_ENGINEERING.value: [
        "security", "appsec", "vulnerability", "owasp", "penetration", "authentication", "oauth", "zero trust", "encryption", "cve", "threat"
    ],
    enums.PublisherCategory.QA_TESTING.value: [
        "selenium", "cypress", "playwright", "testing", "qa", "unit test", "integration test", "e2e test", "load testing", "performance testing", "tdd", "bdd"
    ],
    enums.PublisherCategory.PRODUCT_MANAGEMENT.value: [
        "product strategy", "roadmap", "customer research", "agile", "okr", "product launch", "stakeholder", "product metrics"
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

# ===== Embedding helper =====
def get_embedding(text):
    """Return a numpy array embedding for the given text."""
    return embedding_model.encode(text, convert_to_numpy=True)

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
