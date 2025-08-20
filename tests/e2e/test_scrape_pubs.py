import pytest
from db import enums
import os
from datetime import datetime
from scrape_pubs import scrape_pubs

@pytest.mark.pubs
def test_scrape_pubs_techteams1(db):
    conn = db.get_connection()
    
    pubid = db.add_publisher(conn, "facebook", "techteam")
    db.add_subscription(conn, "newemail5@gmail.com", enums.PublisherCategory.SOFTWARE_ENGINEERING.value, pubid)
    
    scrape_pubs(db, conn)
    
    posts = db.get_posts_by_publisher_id(conn, pubid)
    
    assert len(posts) > 10
    
    conn.close()

@pytest.mark.pubs
def test_scrape_pubs_techteams2(db):
    conn = db.get_connection()
    
    pubid = db.add_publisher(conn, "databricks", "techteam")
    db.add_subscription(conn, "newemail6@gmail.com", enums.PublisherCategory.SOFTWARE_ENGINEERING.value, pubid)
    
    scrape_pubs(db, conn)
    
    posts = db.get_posts_by_publisher_id(conn, pubid)
    
    assert len(posts) > 9
    
    conn.close()

    

    
    
    
    
    
    