from email import message_from_string
import pytest
from send_notifications import process_notifications
from datetime import datetime, timedelta, timezone


@pytest.mark.notifications
def test_send_email_e2e(db, dummy_smtp):
    """
    End-to-end test for sending an email notification.
    Verifies:
    - Notification gets inserted into DB
    - process_notifications sends email
    - Email subject/body contains correct info
    - Notification is marked deleted
    """
    db_instance = db
    conn = db_instance.get_connection()
    email = "manav0611@gmail.com"
    heading = "CompanyX, Software Engineering"
    post_title = "How We Scaled PostgreSQL"
    post_url = "https://example.com/postgres"
    post_url2 = "https://example.com/postgres2"
    post_title2 = "How We Scaled Meta"
    post_url3 = "https://example.com/postgres3"
    post_title3 = "How We Scaled Meta 2"
    email2 = "manavoriginal@gmail.com"
    email3 = "xyz@gmail.com"
    
    maturity_date = datetime.now(timezone.utc).isoformat()
    maturity_date2 = datetime.now(timezone.utc) + timedelta(days=1)
    maturity_date2 = maturity_date2.isoformat()

    # Insert a notification into DB
    db_instance.add_notification(conn, email, heading, 1, post_url, post_title, maturity_date)
    db_instance.add_notification(conn, email, heading, 1, post_url, post_title, maturity_date)
    db_instance.add_notification(conn, email, "Meta, Software Engineering", 1, post_url2, post_title2, maturity_date)
    db_instance.add_notification(conn, email2, "Meta, Software Engineering", 1, post_url3, post_title3, maturity_date)
    db_instance.add_notification(conn, email2, "Meta, Data Science", 1, "new post url for manav", post_title3, maturity_date2)
    db_instance.add_notification(conn, email3, "Meta, Data Science", 1, "new post url", post_title3, maturity_date2)
    conn.commit()
    
    # Process and send notifications
    process_notifications(db_instance, conn)

    # ✅ Ensure one email was sent
    assert len(dummy_smtp.sent) == 2
    
    from_addr, to_addrs, raw_msg = dummy_smtp.sent[0]
    from_addr2, to_addrs2, raw_msg2 = dummy_smtp.sent[1]

    assert to_addrs == "manav0611@gmail.com"
    assert to_addrs2 == email2

    # ✅ Parse the MIME email
    msg = message_from_string(raw_msg)

    # Assert subject contains our prefix
    assert "OneSearch Digest:" in msg["Subject"]

    # ✅ Extract email body (prefer HTML if available)
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            if ctype == "text/html":  # <-- use HTML part
                body = part.get_payload(decode=True).decode()
                break
            elif ctype == "text/plain" and not body:  
                # fallback to plain text if no HTML
                body = part.get_payload(decode=True).decode()
    else:
        body = msg.get_payload(decode=True).decode()

    # ✅ Verify email body contains our content
    assert post_url in body
    assert post_title in body
    assert post_url2 in body
    assert post_title2 in body
    
    msg = message_from_string(raw_msg2)

    # Assert subject contains our prefix
    assert "OneSearch Digest:" in msg["Subject"]

    # ✅ Extract email body (prefer HTML if available)
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            if ctype == "text/html":  # <-- use HTML part
                body = part.get_payload(decode=True).decode()
                break
            elif ctype == "text/plain" and not body:  
                # fallback to plain text if no HTML
                body = part.get_payload(decode=True).decode()
    else:
        body = msg.get_payload(decode=True).decode()

    # ✅ Verify email body contains our content
    assert post_url3 in body
    assert post_title3 in body

    # ✅ Verify notification is marked as deleted
    c = conn.cursor()
    c.execute("""
        SELECT deleted FROM notifications
        WHERE email = ? 
    """, (email,))
    row = c.fetchall()
    assert len(row) == 2
    assert row[0][0] == 1
    assert row[1][0] == 1
    
    notifications = db.get_notifications_by_email(conn, email2)
    assert len(notifications) == 2
    assert notifications[0]['deleted'] == 1
    assert notifications[1]["deleted"] == 0
    
    notifications = db.get_notifications_by_email(conn, email3)
    assert len(notifications) == 1
    assert notifications[0]['deleted'] == 0
    
    conn.close()

@pytest.mark.notifications
def test_last_notified_at_is_committed_after_send(db, dummy_smtp):
    """
    Regression test: last_notified_at must be persisted after process_notifications.
    Previously a missing conn.commit() meant the value was never written to disk,
    causing notify.py to re-queue the same posts on every run.
    """
    conn = db.get_connection()
    email = "subscriber@example.com"

    db.add_publisher(conn, "TestCo", "techteam")
    db.add_subscription(conn, email, "Software Engineering", 1, frequency=0)
    conn.commit()

    before = datetime.now(timezone.utc).replace(microsecond=0)

    maturity_date = datetime.now(timezone.utc).isoformat()
    db.add_notification(conn, email, "TestCo, Software Engineering", "v1",
                        "https://testco.com/post-1", "Post One", maturity_date)
    conn.commit()

    process_notifications(db, conn)

    assert len(dummy_smtp.sent) == 1

    subs = db.get_subscriptions_by_email(conn, email)
    assert len(subs) == 1
    last_notified_at = subs[0]["last_notified_at"]
    assert last_notified_at is not None, "last_notified_at was not committed after sending"

    last_notified_dt = datetime.fromisoformat(last_notified_at)
    if last_notified_dt.tzinfo is None:
        last_notified_dt = last_notified_dt.replace(tzinfo=timezone.utc)
    assert last_notified_dt >= before

    conn.close()


@pytest.mark.notifications
def test_all_category_notifications_deleted_after_send(db, dummy_smtp):
    """
    Regression test: when an email contains posts across multiple categories,
    ALL notifications must be deleted — not just the last category's.
    Previously the loop variable `notifications_for_email` held only the last
    iteration's value, so earlier categories were never cleaned up.
    """
    conn = db.get_connection()
    email = "multi@example.com"
    maturity_date = datetime.now(timezone.utc).isoformat()

    db.add_publisher(conn, "TestCo", "techteam")
    db.add_subscription(conn, email, "Software Engineering", 1, frequency=0)
    db.add_subscription(conn, email, "Data Science", 1, frequency=0)
    conn.commit()

    # Two notifications in different categories — triggers the multi-key heading_map bug
    db.add_notification(conn, email, "TestCo, Software Engineering", "v1",
                        "https://testco.com/se-post", "SE Post", maturity_date)
    db.add_notification(conn, email, "TestCo, Data Science", "v1",
                        "https://testco.com/ds-post", "DS Post", maturity_date)
    conn.commit()

    process_notifications(db, conn)

    assert len(dummy_smtp.sent) == 1, "Expected one combined email for both categories"

    notifications = db.get_notifications_by_email(conn, email)
    assert len(notifications) == 2

    for n in notifications:
        assert n["deleted"] == 1, (
            f"Notification for '{n['post_title']}' was not deleted — "
            "multi-category cleanup bug may still be present"
        )

    conn.close()


@pytest.mark.real
def test_send_email_real(db):
    """
    End-to-end test for sending a real email via configured SMTP server.
    This test:
    - Inserts notifications into DB
    - Calls process_notifications (sends via real SMTP)
    - Verifies notifications are marked deleted
    - ⚠️ Actually sends an email (check inbox!)
    """
    db_instance = db
    conn = db_instance.get_connection()
    email = "manav0611@gmail.com"

    # Notifications from real engineering blogs
    notifications = [
        {
            "heading": "Google, Software Engineering",
            "post_title": "Announcing Android 15: What's New",
            "post_url": "https://developers.googleblog.com/get-ready-for-google-io-livestream-schedule-revealed/"
        },
        {
            "heading": "Facebook, Software Engineering",
            "post_title": "Scaling GraphQL at Meta And a whole lot in the AI world",
            "post_url": "https://engineering.fb.com/2025/08/16/scaling-graphql/"
        },
        {
            "heading": "Stripe, Software Engineering",
            "post_title": "Stripe's Migration to Rust Microservices",
            "post_url": "https://stripe.com/blog/migration-to-rust-microservices"
        }
    ]
    
    maturity_date = datetime.now(timezone.utc).isoformat()

    # Insert notifications into DB
    for n in notifications:
        db_instance.add_notification(conn, email, n["heading"], 1, n["post_url"], n["post_title"], maturity_date)

    # Process and send notifications via real SMTP
    process_notifications(db_instance, conn)

    # Verify all notifications are marked deleted in DB
    c = conn.cursor()
    c.execute("""
        SELECT deleted FROM notifications WHERE email = ?
    """, (email,))
    rows = c.fetchall()

    assert len(rows) == len(notifications)
    for r in rows:
        assert r[0] == 1  # deleted flag set

    conn.close()