import pytest
from db import enums
import os
from datetime import datetime
from scrape_pubs import scrape_pubs

@pytest.mark.pubs
def test_scrape_pubs_techteams(db):
    conn = db.get_connection()
    
    db.add_publisher(conn, "aws", "techteam")
    db.add_subscription(conn, "newemail@gmail.com", enums.PublisherCategory.SOFTWARE_ENGINEERING.value, 1)
    
    scrape_pubs(db, conn)
    
    posts = db.get_posts(conn)
    
    assert len(posts) > 10
    

    
    
    
    
    
    