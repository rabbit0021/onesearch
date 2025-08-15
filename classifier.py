# Install
# pip install sentence-transformers

from sentence_transformers import SentenceTransformer, util
from db import enums

# 1. Load model
model = SentenceTransformer('all-MiniLM-L6-v2')

# 2. Define categories
categories = {
    enums.PublisherCategory.SOFTWARE_ENGINEERING.value: "includes frontend, backend, system design, devops, storage",
    enums.PublisherCategory.SOFTWARE_TESTING.value: "manual, automation, performance, load testing",
    enums.PublisherCategory.DATA_ANALYTICS.value: "analytics, business intelligence, data visualization",
    enums.PublisherCategory.DATA_SCIENCE.value: "machine learning, ai, predictive modeling, deep learning",
    enums.PublisherCategory.PRODUCT_MANAGEMENT.value: "product design, user experience, product strategy"
}

# 3. Encode category descriptions
category_embeddings = {cat: model.encode(desc, convert_to_tensor=True) 
                       for cat, desc in categories.items()}

def classify_post(post_title, post_content=""):
    # 4. Encode input text
    title_embedding = model.encode(post_title, convert_to_tensor=True)
    content_embedding = model.encode(post_content, convert_to_tensor=True)
    text_embedding = (0.7 * title_embedding + 0.3 * content_embedding)
    # 5. Compute cosine similarity
    scores = {cat: util.cos_sim(text_embedding, emb).item() 
              for cat, emb in category_embeddings.items()}
    
    # 6. Return the category with the highest score
    return max(scores, key=scores.get)