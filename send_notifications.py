import sqlite3
import smtplib
from email.mime.text import MIMEText
from datetime import datetime

# === CONFIG ===
DB_PATH = "notifications.db"
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USERNAME = "xxxxx@gmail.com"
SMTP_PASSWORD = "app password" 

# === EMAIL TEMPLATE ===
def send_email(to_email, subject, body):
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = SMTP_USERNAME
    msg["To"] = to_email

    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        print(f"✅ Sent email to {to_email}")

# === MAIN LOGIC ===
def process_notifications():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM notifications")
    notifications = cursor.fetchall()

    for row in notifications:
        email = row[0]
        company = row[1]
        category = row[2]
        post_url = row[3]
        post_title = row[4]

        subject = f"[{company}] New blog post in {category}"
        body = f"New post: {post_title}\n{post_url}"

        try:
            send_email(email, subject, body)
        except Exception as e:
            print(f"❌ Failed to send to {email}: {e}")
            continue

        # Delete after sending
        cursor.execute("""
            DELETE FROM notifications
            WHERE email = ? AND company = ? AND category = ? AND post_title = ?
        """, (email, company, category, post_title))
        conn.commit()
        
        cursor.execute("""
            UPDATE notification_state
            SET last_notified_at = ?
            WHERE email = ? AND company = ? AND category = ?
        """, (datetime.utcnow().isoformat(), email, company, category))

    conn.close()

if __name__ == "__main__":
    process_notifications()
