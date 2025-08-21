import pytest
from db import enums
import time
from datetime import datetime, timezone
from scrape_pubs import scrape_pubs
from notify import notify
from send_notifications import process_notifications

@pytest.mark.e2e
def test_scrape_pubs_techteams(db, dummy_smtp):
    conn = db.get_connection()
    assert 0 == 0
    
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
    
    notifications = db.get_notifications_by_email(conn, "newemail@gmail.com")
    
    assert len(notifications) == 1
    notification = notifications[0]
    assert notification['email'] == "newemail@gmail.com"
    assert notification['post_url'] == post['url']
    assert notification['post_title'] == post['title']
    assert notification['deleted'] == 0
    
    process_notifications(db, conn)
    assert len(dummy_smtp.sent) == 0
    
    db.add_subscription(conn, "newemail2@gmail.com", enums.PublisherCategory.SOFTWARE_ENGINEERING.value, 1, frequency=0)
    conn.commit()
    
    notify(db, conn)
    
    notifications = db.get_notifications_by_email(conn, "newemail2@gmail.com")
    
    assert len(notifications) == 1
    notification = notifications[0]
    assert notification['email'] == "newemail2@gmail.com"
    assert notification['post_url'] == post['url']
    assert notification['post_title'] == post['title']
    assert notification['deleted'] == 0
    
    beforeprocesstime = datetime.now(timezone.utc)
    
    time.sleep(1)

    process_notifications(db, conn)
        
    notifications = db.get_notifications_by_email(conn, "newemail2@gmail.com")
    
    assert len(notifications) == 1
    notification = notifications[0]
    assert notification['email'] == "newemail2@gmail.com"
    assert notification['post_url'] == post['url']
    assert notification['post_title'] == post['title']
    assert notification['deleted'] == 1
    
    assert len(dummy_smtp.sent) == 1
    
    subcriptions = db.get_subscriptions_by_email(conn, "newemail2@gmail.com")
    subs = subcriptions[0] # in this case only one sub is expected
    last_notify =  subs['last_notified_at']
    
    assert last_notify
    
    last_notify_at = datetime.fromisoformat(last_notify) 

    if last_notify_at.tzinfo is None:
        last_notify_at = last_notify_at.replace(tzinfo=timezone.utc)        

    assert last_notify_at and  last_notify_at > beforeprocesstime
    
    notify(db, conn)
    
    notifications = db.get_notifications_by_email(conn, "newemail2@gmail.com")
    
    assert len(notifications) == 1
    notification = notifications[0]
    assert notification['email'] == "newemail2@gmail.com"
    assert notification['post_url'] == post['url']
    assert notification['post_title'] == post['title']
    assert notification['deleted'] == 1
    
    assert len(dummy_smtp.sent) == 1
    
    conn.close()

    





    

    
    
    
    
    
    