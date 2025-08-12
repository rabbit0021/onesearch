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

# === CONFIG ===
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USERNAME = "manavoriginal@gmail.com"
SMTP_PASSWORD = "ajde noro qgty ldxt"

logger = get_logger("notify_worker")

# === EMAIL TEMPLATE ===

# === MAIN LOGIC ===

def send_email(to_email, subject, html_body, logo_path=None, header_path=None):
    msg = MIMEMultipart("related")
    msg["From"] = formataddr(("no-reply@onesearch.blog","Engineering Blog Alerts"))
    msg["To"] = to_email
    msg["Subject"] = subject

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
        
def process_notifications():
    conn =  get_database().get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM notifications")
    notifications = cursor.fetchall()
    
    logger.info(f"found {len(notifications)} notifications to be processed")

    for row in notifications:
        email = row[0]
        company = row[1]
        category = row[2]
        post_url = row[3]
        post_title = row[4]    

        subject = f"[{company}] New blog post in {category}"    

        html_body = f"""
           <html>
           <body style="font-family: Arial, sans-serif; color: #333; margin:0; padding:0;">
           
               <!-- Header image -->
               <div style="width:100%; height:150px; overflow:hidden;">
                   <img src="cid:header" alt="Header Image" 
                        style="width:100%; height:150px; object-fit:cover; display:block;">
               </div>
           
               <!-- Main content -->
               <div style="padding:32px; font-family:'Segoe UI', Arial, sans-serif; color:#222; background-color:#f9fbfd; border-radius:10px; border:1px solid #e6ecf2;">
                   
                   <!-- Emoji + Category -->
                   <div style="font-size:14px; letter-spacing:1px; text-transform:uppercase; color:#555; margin-bottom:8px;">
                       📂 {category}
                   </div>
               
                   <!-- Big Headline -->
                   <h2 style="font-size:30px; color:#0073e6; margin:0 0 18px 0; font-weight:700; line-height:1.3;">
                       ✨ A Fresh Read Awaits
                   </h2>
               
                   <!-- Blog Title -->
                   <p style="font-size:20px; margin:0 0 24px 0; font-weight:500; color:#333;">
                       {post_title}
                   </p>
               
                   <!-- CTA Button -->
                   <a href="{post_url}" style="display:inline-block; padding:14px 28px; background-color:#0073e6; 
                       color:#fff; text-decoration:none; border-radius:6px; font-size:16px; font-weight:600; 
                       box-shadow:0 3px 6px rgba(0,0,0,0.08); transition:background-color 0.2s;">
                       Read Full Article →
                   </a>
               
               </div>

           
               <!-- Footer -->
               <div style="padding:16px; border-top:1px solid #e0e0e0; display:flex; align-items:center; background-color:#fafafa; font-family:Arial, sans-serif; font-size:12px; color:#555;">
                   <img src="cid:logo" alt="OneSearch logo" style="width:60px; height:auto; margin-right:10px;">
                   <div>
                       <div style="font-weight:bold; color:#222; font-size:13px;">OneSearch</div>
                       <div style="color:#777;">One place for all engineering blogs</div>
                   </div>
               </div>
           </body>
           </html>
        """    
        env = os.getenv('FLASK_ENV', 'development')
        logo_file = "/data/logo.png" if env == 'production' else 'data/logo.png'
        header_file = "/data/header.jpg" if env == 'production' else 'data/header.jpg'
        
        try:
            send_email(email, subject, html_body, logo_path=logo_file, header_path=header_file)
        except Exception as e:
            logger.error(f"❌ Failed to send to {email}: {e}")
            continue
        
        try:
            time_now = datetime.now(timezone.utc).isoformat()
    
            cursor.execute("""
                UPDATE notification_state
                SET last_notified_at = ?
                WHERE email = ? AND company = ? AND category = ?
            """, (time_now, email, company, category))
            
            # Delete notifications
            cursor.execute("""
                DELETE FROM notifications
                WHERE email = ? AND company = ? AND category = ? AND post_title = ?
            """, (email, company, category, post_title))
            
            conn.commit()

        except Exception as e:
            logger.error(f"❌ Failed to update notificaation {email}: {e}")
        
    conn.close()

if __name__ == "__main__":
    process_notifications()
