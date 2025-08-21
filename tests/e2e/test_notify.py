import pytest
from db import enums
import os
from datetime import datetime, timezone
from notify import notify

@pytest.mark.notifications
def test_notify(db):
    conn = db.get_connection()
    
    db.add_publisher(conn, "google", "techteam")
    db.add_subscription(conn, "xyz2@gmail.com", enums.PublisherCategory.SOFTWARE_ENGINEERING.value, 1)
    postid = db.add_post(conn, "url1", "How to scale your database", 1, "infrastructure", datetime.now(timezone.utc).isoformat(), enums.PublisherCategory.SOFTWARE_ENGINEERING.value)
    
    conn.commit()
    
    notify(db, conn)
    
    notifications = db.get_notifications_by_email(conn, "xyz2@gmail.com")
    
    assert len(notifications) == 0
    
    db.update_post_label(conn, postid, enums.PublisherCategory.SOFTWARE_ENGINEERING.value)
    conn.commit()
    
    notify(db, conn)
    
    notifications = db.get_notifications_by_email(conn, "xyz2@gmail.com")
    
    assert len(notifications) == 1
    
    conn.close()

    
    
    
    
    
    