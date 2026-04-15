"""
One-time script to compute and store embeddings for existing posts that have none.
Run once: python backfill_embeddings.py
"""
from dotenv import load_dotenv
load_dotenv()

from db import get_database
from classifier import get_embedding
from logger_config import get_logger

logger = get_logger("backfill_embeddings")

def backfill(db, conn):
    c = conn.cursor()
    c.execute("SELECT id, title, tags FROM posts WHERE embedding IS NULL")
    rows = c.fetchall()
    total = len(rows)

    if total == 0:
        logger.info("No posts missing embeddings — nothing to do.")
        return

    logger.info(f"Backfilling embeddings for {total} posts...")

    for i, row in enumerate(rows, 1):
        post_id, title, tags = row["id"], row["title"], row["tags"] or ""
        text = f"{title} {tags}".strip()
        embedding = get_embedding(text)
        db.save_post_embedding(conn, post_id, embedding.tobytes())

        if i % 50 == 0 or i == total:
            conn.commit()
            logger.info(f"  {i}/{total} done")

    logger.info("Backfill complete.")

if __name__ == "__main__":
    db = get_database()
    conn = db.get_connection()
    try:
        backfill(db, conn)
    finally:
        conn.close()