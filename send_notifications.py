import smtplib
import markdown as md_lib
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
from dotenv import load_dotenv
from urllib.parse import urlparse                                                                                 

load_dotenv()   

# === CONFIG ===
SMTP_SERVER = "smtp.zoho.in"
SMTP_PORT = 587
SMTP_USERNAME = os.getenv('SMTP_USERNAME', 'xxxx@onesearch.blog')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', 'xxxx')
PRIMARY_COLOR = '#d97757'  # Claude theme
print(f"SMTP_USERNAME: {SMTP_USERNAME}, SMTP_PASSWORD: {'*' * len(SMTP_PASSWORD)}")

logger = get_logger("send_notification_worker")


def favicon_url(post_url):
    try:
        domain = urlparse(post_url).netloc
        return f"https://www.google.com/s2/favicons?domain={domain}&sz=32"
    except Exception:
        return None

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
    # if logo_path and os.path.exists(logo_path):
    #     with open(logo_path, "rb") as f:
    #         img_data = f.read()
    #     image = MIMEImage(img_data)
    #     image.add_header("Content-ID", "<logo>")
    #     image.add_header("Content-Disposition", "inline", filename=os.path.basename(logo_path))
    #     msg.attach(image)
    
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

def leave_unmature_notifications(notifications):
    """Remove unmatured based on timing of the subscriber. if subcriber frequency is diff, the notification stays in the queue"""
    matured = []
    for row in notifications:
        maturity_dt = datetime.fromisoformat(row['maturity_date'])        

        if maturity_dt.tzinfo is None:
            maturity_dt = maturity_dt.replace(tzinfo=timezone.utc)        

        if maturity_dt <= datetime.now(timezone.utc):
            matured.append(row)
            
    return matured

def process_notifications(db, conn, target_email=None, cancel_event=None, force=False):
    notifications = db.get_active_notifications(conn)
    if target_email:
        notifications = [n for n in notifications if n["email"].lower() == target_email.lower()]
        logger.info(f"filtering for {target_email}: {len(notifications)} notifications")
    logger.info(f"found {len(notifications)} notifications to be processed")

    notifications = deduplicate_notifications(notifications)
    logger.info(f"After dedup, found {len(notifications)} notifications to be processed")

    if not force:
        notifications = leave_unmature_notifications(notifications)
    logger.info(f"After leaving unmatured, found {len(notifications)} notifications to be processed")

    # fetch like counts for all posts in one query
    urls = [n['post_url'] for n in notifications]
    like_counts = db.get_like_counts_by_urls(conn, urls)
    for n in notifications:
        n['like_count'] = like_counts.get(n['post_url'], 0)

    # generate summaries only for posts that don't have one yet (skip in test env)
    if os.getenv('FLASK_ENV') != 'test':
        try:
            from llm import summarize_article, PostNotFoundError, ContentExtractionError
            seen_post_ids = set()
            for n in notifications:
                post_id = n.get('post_id')
                if post_id and n.get('summary') is None and post_id not in seen_post_ids:
                    seen_post_ids.add(post_id)
                    try:
                        summary = summarize_article(post_id)
                        db.save_post_summary(conn, post_id, summary)
                        conn.commit()
                        n['summary'] = summary
                        logger.info(f"Generated summary for post {post_id}")
                    except (PostNotFoundError, ContentExtractionError) as e:
                        logger.warning(f"Skipping summary for post {post_id}: {e}")
                    except Exception as e:
                        logger.warning(f"Summary generation failed for post {post_id}: {e}")
        except ImportError:
            logger.warning("llm module not available, skipping summary generation")

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
    with open("static/email_template_v2.html", "r") as f:
        html_template = Template(f.read())

    failed_emails = []

    for email, heading_map in organised_by_heading.items():
        if cancel_event and cancel_event.is_set():
            from app import JobCancelledError
            raise JobCancelledError()
        subject = get_random_subject()

        CATEGORY_COLORS = {
            'Software Engineering':      '#00577F',
            'Frontend Engineering':      '#2E8AB0',
            'Backend Engineering':       '#6B5EA8',
            'Mobile Engineering':        '#E08C3A',
            'Platform & Infrastructure': '#ED717F',
            'Data Engineering':          '#2E8A6A',
            'Data Science':              '#9B6E9E',
            'Machine Learning & AI':     '#D4828E',
            'Data Analytics':            '#5B8FAE',
            'Security Engineering':      '#B05A6A',
            'QA & Testing':              '#6E8EAE',
            'Product Management':        '#F5AD92',
            'General':                   '#A0A0A0',
        }

        def publisher_icon_html(notification):
            publisher = notification['publisher']
            url = notification.get('post_url', '')
            slug = publisher.lower().replace(' ', '')
            # individual: circular photo
            individual_img = f"/individuals/{slug}-thumb.jpg"
            # try simpleicons for company, fallback to google favicon
            icon_src = f"https://cdn.simpleicons.org/{slug}"
            return f'''<div style="width:28px; height:28px; border-radius:6px;
                          background:linear-gradient(135deg,#f0ede8,#f0e0cc);">
                        <img src="{icon_src}" width="16" height="16" alt=""
                             style="display:block; margin:6px auto;"
                             onerror="this.src='https://www.google.com/s2/favicons?domain={urlparse(url).netloc}&amp;sz=32'">
                       </div>'''

        category_sections = ""
        all_notifications_for_email = []
        for heading, notifications_for_email in heading_map.items():
            category = heading
            category_color = CATEGORY_COLORS.get(category, PRIMARY_COLOR)

            #formatting before sending mail
            for notification in notifications_for_email:
                notification['post_title'] = notification['post_title'][0].upper() + notification['post_title'][1:]
                notification['publisher'] = notification['publisher'][0].upper() + notification['publisher'][1:]

            def publisher_icon(n):
                slug = n['publisher'].lower().replace(' ', '')
                domain = urlparse(n.get('post_url', '')).netloc
                icon_src = f"https://cdn.simpleicons.org/{slug}"
                fallback = f"https://www.google.com/s2/favicons?domain={domain}&sz=32"
                return f'''<div style="width:28px; height:28px; border-radius:6px;
                              background:linear-gradient(135deg,#f0ede8,#f0e0cc);">
                            <img src="{icon_src}" width="16" height="16" alt=""
                                 style="display:block; margin:6px auto;">
                           </div>'''

            def post_link(n):
                post_id = n.get('post_id')
                if post_id:
                    return f"https://onesearch.blog/read/{post_id}"
                return n['post_url']

            def summary_html(n):
                summary = n.get('summary')
                if not summary:
                    return ''
                html = md_lib.markdown(summary)
                # inline email-safe styles
                html = html.replace('<p>', '<p style="margin:4px 0 6px; font-family:\'Segoe UI\',Arial,sans-serif; font-size:11px; color:#555; line-height:1.6;">')
                html = html.replace('<ul>', '<ul style="margin:4px 0 8px; padding-left:18px; font-family:\'Segoe UI\',Arial,sans-serif; font-size:11px; color:#555; line-height:1.7;">')
                html = html.replace('<li>', '<li style="margin-bottom:3px;">')
                html = html.replace('<code>', '<code style="font-size:11px; background:#f4f4f4; padding:1px 4px; border-radius:3px; font-family:monospace;">')
                label = '<p style="margin:8px 0 3px; font-family:\'Segoe UI\',Arial,sans-serif; font-size:9px; font-weight:700; color:#bbb; letter-spacing:0.12em; text-transform:uppercase;">✦ AI Summary</p>'
                return f'<div style="margin:6px 0 10px;">{label}{html}</div>'

            blog_items = "".join([
                f"""
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                  <tr>
                    <td style="vertical-align:top; padding-right:12px; width:28px;">
                      {publisher_icon(notification)}
                    </td>
                    <td style="vertical-align:top;">
                      <p style="margin:0 0 2px; font-family:'Segoe UI',Arial,sans-serif;
                                 font-size:12px; font-weight:700; color:#999;
                                 letter-spacing:0.06em; text-transform:uppercase;">
                        {notification['publisher']}
                      </p>
                      <a href="{post_link(notification)}"
                         style="font-size:17px; font-weight:700; color:#111; text-decoration:none;
                                line-height:1.4; display:block; margin-bottom:4px; font-family:'Georgia',serif;">
                        {notification['post_title']}
                      </a>
                      {summary_html(notification)}
                      <a href="{post_link(notification)}"
                         style="font-family:'Segoe UI',Arial,sans-serif; font-size:11px;
                                color:{PRIMARY_COLOR}; font-weight:600; text-decoration:none;">
                        Read &#8594;
                      </a>
                    </td>
                  </tr>
                </table>
                """
                for notification in notifications_for_email
            ])

            all_notifications_for_email.extend(notifications_for_email)

            category_sections += f"""
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                  <tr>
                    <td style="padding-bottom:12px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="font-family:'Segoe UI',Arial,sans-serif; font-size:9px; font-weight:700;
                                     color:{category_color}; letter-spacing:0.18em; text-transform:uppercase;
                                     white-space:nowrap; padding-right:10px; width:1%;">
                            {category}
                          </td>
                          <td style="border-top:1px solid #f0e0cc;"></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td>{blog_items}</td>
                  </tr>
                </table>
            """

        # Render template with dynamic sections
        html_body = html_template.render(category_sections=category_sections, primary_color=PRIMARY_COLOR)

        BASE_DIR = os.path.dirname(os.path.abspath(__file__))

        header_file = os.path.join(BASE_DIR, "static", "og-preview.png")

        try:
            send_email(email, subject, html_body, header_path=header_file)
            logger.info(f"✅ Email sent successfully: {email}")
        except Exception as e:
            logger.error(f"❌ Failed to send to {email}: {e}")
            failed_emails.append((email, e))
            continue

        for notification in all_notifications_for_email:
            logger.info(f"Deleting notification for email: {email} and post url: {notification['post_url']}")

        for notification in all_notifications_for_email:
            db.delete_notification(conn, email, notification['post_url'])
            conn.commit()

        db.update_subscription_last_notified(conn, email)
        conn.commit()

    if failed_emails:
        summary = ", ".join(f"{e}" for _, e in failed_emails)
        raise RuntimeError(f"Failed to send to {len(failed_emails)} recipient(s): {summary}")
            
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", help="Send only to this email (for testing)")
    parser.add_argument("--force", action="store_true", help="Ignore maturity_date — send all pending notifications immediately")
    args = parser.parse_args()

    db = get_database()
    conn = db.get_connection()

    if args.force:
        logger.info("--force: skipping maturity date check")

    process_notifications(db, conn, target_email=args.email, force=args.force)
    conn.close()

