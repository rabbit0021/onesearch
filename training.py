# train_classifier.py
import pickle
from sentence_transformers import SentenceTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder
from db import get_database
import os 
from logger_config import get_logger

env = os.getenv('FLASK_ENV', 'development')
MODEL_PATH = os.getenv("MODEL_PATH") if env == 'production' else 'data/dev/trained_classifier.pkl'
MIN_LABELED_POSTS = 0

logger = get_logger("training")

def train_classifier():
    db = get_database()
    conn = db.get_connection()
    
    posts = db.get_posts(conn)
    posts_filtered = [
            post for post in posts
            if post['labelled'] == 1
        ]
    
    logger.info(f"training on post: {len(posts_filtered)}")
    if len(posts_filtered) < MIN_LABELED_POSTS:
        logger.info(f"[Train] Not enough labeled posts ({len(posts_filtered)})")
        return

    texts = []
    labels = []
    for row in posts_filtered:
        title = row["title"]
        tags = row.get("tags") or ""
        content = row.get("content") or ""
        texts.append(f"Title: {title}. Tags: {tags}. Content: {content[:100]}")
        labels.append(row["topic"])

    # Compute embeddings
    embedding_model = SentenceTransformer('all-mpnet-base-v2')
    embeddings = embedding_model.encode(texts, convert_to_tensor=False)

    # Encode labels
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(labels)

    # Train Logistic Regression
    clf = LogisticRegression(max_iter=1000)
    clf.fit(embeddings, y_encoded)

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)

    # Save model
    with open(MODEL_PATH, "wb") as f:
        pickle.dump((clf, label_encoder), f)
        
    logger.info(f"[Train] Trained classifier saved at {MODEL_PATH}")

if __name__ == "__main__":
    train_classifier()
