import pytest
from db import enums
import os
from datetime import datetime
from scrape_pubs import scrape_pubs
from notify import notify

@pytest.mark.e2etests
def test_scrape_pubs_techteams(db):
    conn = db.get_connection()
    
    db.add_publisher(conn, "aws", "techteam")
    db.add_subscription(conn, "newemail@gmail.com", enums.PublisherCategory.SOFTWARE_ENGINEERING.value, 1)
    
    scrape_pubs(db, conn)
    
    posts = db.get_posts(conn)
    
    assert len(posts) > 10
    
    notify(db, conn)
    
    notifications = db.get_notifications_by_email(conn, "newemail@gmail.com")
    
    assert len(notifications) == 0
    
    post = posts[0]
    
    db.update_post_label(conn, post['id'], enums.PublisherCategory.SOFTWARE_ENGINEERING.value)
    conn.commit()
    
    notify(db, conn)
    assert len(notifications) == 1



    

    
    
    
    
    
    