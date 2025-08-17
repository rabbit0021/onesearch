import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timezone
from db import get_database
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
import smtplib
import os
from email.utils import formataddr
from logger_config import get_logger
from collections import defaultdict
import random
from jinja2 import Template

# === CONFIG ===
SMTP_SERVER = "smtp.zoho.in"
SMTP_PORT = 587
SMTP_USERNAME = os.getenv('SMTP_USERNAME', 'xxxx@domain.com')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', 'xxxxx')

logger = get_logger("notify_worker")

# === EMAIL TEMPLATE ===

# === MAIN LOGIC ===

SUBJECT_TAGLINES = [
    "Stay Hungry, Stay Foolish",
    "Stay Curious, Stay Bold",
    "Learn Fast, Ship Faster",
    "Build More, Noise Less",
    "Read Less, Learn More",
    "Think Different, Ship Different",
    "Fresh Reads, Zero Clutter",
    "Ideas Today, Impact Tomorrow"
]

def get_random_subject():
    tagline = random.choice(SUBJECT_TAGLINES)
    return f"OneSearch Digest: {tagline}"


def send_email(to_email, subject, html_body, logo_path=None, header_path=None):
    msg = MIMEMultipart("related")
    msg["To"] = to_email
    msg["Subject"] = subject
    msg['From'] = SMTP_USERNAME

    # Alternative plain text for clients that can't render HTML
    plain_text = "This email contains HTML content. Please view it in an email client that supports HTML."
    alt_part = MIMEMultipart("alternative")
    alt_part.attach(MIMEText(plain_text, "plain"))
    alt_part.attach(MIMEText(html_body, "html"))
    msg.attach(alt_part)

    # Optional inline image
    if logo_path and os.path.exists(logo_path):
        with open(logo_path, "rb") as f:
            img_data = f.read()
        image = MIMEImage(img_data)
        image.add_header("Content-ID", "<logo>")
        image.add_header("Content-Disposition", "inline", filename=os.path.basename(logo_path))
        msg.attach(image)
    
    if header_path and os.path.exists(header_path):
        with open(header_path, "rb") as f:
            img_data = f.read()
        image = MIMEImage(img_data)
        image.add_header("Content-ID", "<header>")
        image.add_header("Content-Disposition", "inline", filename=os.path.basename(header_path))
        msg.attach(image)

    # Send email
    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(msg["From"], to_email, msg.as_string())

def deduplicate_notifications(notifications):
    """Remove duplicates based on (email, heading, post_url)."""
    seen = set()
    deduped = []
    for row in notifications:
        key = (row["email"], row["post_url"])
        if key not in seen:
            seen.add(key)
            deduped.append(row)
    return deduped

def process_notifications(db, conn):
    # notifications = db.get_notifications_by_email(conn, "manav0611@gmail.com")
    notifications = db.get_notifications(conn)
    logger.info(f"found {len(notifications)} notifications to be processed")

    notifications = deduplicate_notifications(notifications)
    logger.info(f"After dedup, found {len(notifications)} notifications to be processed")

    notifications_by_email = defaultdict(list)
    for row in notifications:
        notifications_by_email[row["email"]].append(row)

    organised_by_heading = {}
    for email, rows in notifications_by_email.items():
        heading_map = defaultdict(list)
        for row in rows:
            heading = row["heading"]
            publisher, category = heading.split(",", 1)
            row["publisher"] = publisher.strip()
            heading_map[category.strip()].append(row)
        organised_by_heading[email] = heading_map
    
    # Load static template once
    with open("static/email_template.html", "r") as f:
        html_template = Template(f.read())

    for email, heading_map in organised_by_heading.items():
        subject = get_random_subject()
        
        category_sections = ""
        for heading, posts in heading_map.items():
            category = heading

            blog_items = "".join([
                f"""
                <div style="padding:14px; margin-bottom:12px; border-radius:10px;
                            background:#f9fafb; border:1px solid #e5e7eb;">
                    <div style="font-size:15px; color:#374151; margin-bottom:6px;">
                        <strong style="color:#111827;">{p['publisher']}</strong>
                    </div>
                    <a href="{p['post_url']}" style="font-size:16px; font-weight:500;
                            color:#2563eb; text-decoration:none;">
                        {p['post_title']}
                    </a>
                </div>
                """
                for p in posts
            ])

            category_sections += f"""
                <div style="margin-bottom:32px;">
                    <h2 style="font-size:20px; color:#111827; margin:0 0 16px 0;
                               border-left:4px solid #2563eb; padding-left:8px;">
                        📂 {category}
                    </h2>
                    {blog_items}
                </div>
            """

        # Render template with dynamic sections
        html_body = html_template.render(category_sections=category_sections)
        
        # print(html_body)
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))

        logo_file = os.path.join(BASE_DIR, "static", "logo.png")
        header_file = os.path.join(BASE_DIR, "static", "header.png")

        try:
            send_email(email, subject, html_body, logo_path=logo_file, header_path=header_file)
        except Exception as e:
            logger.error(f"❌ Failed to send to {email}: {e}")
            continue

        try:
            db.delete_notifications_by_email(conn, email)
            conn.commit()
        except Exception as e:
            logger.error(f"❌ Failed to cleanup for {email}: {e}")
            
            
if __name__ == "__main__":
    db = get_database()
    conn = db.get_connection()
    process_notifications(db, conn)
    conn.close()

