from sentence_transformers import SentenceTransformer, util
from db import enums
import torch

# 1. Load a stronger model
model = SentenceTransformer('all-mpnet-base-v2')

# 2. Concise category descriptions
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

# 3. Encode category descriptions
category_embeddings = {
    cat: model.encode(desc, convert_to_tensor=True)
    for cat, desc in categories.items()
}

# Optional: simple keyword mapping to override embeddings
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

def classify_post(post_title, tags="", content=""):
    """
    Classify a post into a category using title + tags + first 100 chars of content.
    Uses embeddings similarity with optional keyword boost.
    """

    # 1. Prepare text
    content_snippet = content[:100] if content else ""
    combined_text = f"Title: {post_title}. Tags: {tags}. Content: {content_snippet}".lower()

    # 2. Encode input
    text_embedding = model.encode(combined_text, convert_to_tensor=True)

    # 3. Compute similarity
    scores = {
        cat: util.cos_sim(text_embedding, emb).item()
        for cat, emb in category_embeddings.items()
    }

    # 4. Keyword boost: add 0.1 if a keyword exists in title/tags/content
    combined_lower = combined_text.lower()
    for cat, kw_list in keywords_map.items():
        for kw in kw_list:
            if kw in combined_lower:
                scores[cat] += 0.1
                break

    # 5. Assign category with highest similarity
    best_cat = max(scores, key=scores.get)

    # 6. Adaptive fallback: check relative score
    sorted_scores = sorted(scores.values(), reverse=True)
    top_score = sorted_scores[0]
    second_score = sorted_scores[1] if len(sorted_scores) > 1 else 0.0
    if top_score < 0.25 or (top_score - second_score) < 0.05:
        return enums.PublisherCategory.GENERAL.value

    return best_cat
