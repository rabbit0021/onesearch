# middleware.py
import time
from flask import request, g
import json

def summarize_response(response):
    content_type = response.content_type
    data = response.get_data(as_text=True)
    preview = None
    item_count = None

    try:
        if "application/json" in content_type:
            parsed = json.loads(data)
            if isinstance(parsed, list):
                item_count = len(parsed)
                preview = f"[List with {item_count} items]"
            elif isinstance(parsed, dict):
                preview = json.dumps(parsed)[:150] + "..." if len(json.dumps(parsed)) > 150 else json.dumps(parsed)
            else:
                preview = str(parsed)[:150]
        elif "text" in content_type:
            preview = data[:150] + "..." if len(data) > 150 else data
        else:
            preview = "[Binary or non-text response]"
    except Exception as e:
        preview = "[Failed to parse response]"

    return {
        "content_type": content_type,
        "length": len(response.get_data()),
        "preview": preview
    }

def get_real_ip():
    return (
        request.headers.get('CF-Connecting-IP')  # Cloudflare specific
        or request.headers.get('X-Forwarded-For', '').split(',')[0].strip()
        or request.remote_addr
    )
    
def register_middlewares(app):
    if getattr(app, "_middlewares_registered", False):
        return
    app._middlewares_registered = True
    
    @app.before_request
    def start_timer():
        if request.path == '/favicon.ico' or request.path.startswith('/static'):
            return
        g.start_time = time.time()
        log_params = {
            'method': request.method,
            'remote_addr': get_real_ip(),
            'path': request.path,
        }
        app.logger.info(f"{log_params}")


    @app.after_request
    def log_request(response):
        if request.path == '/favicon.ico' or request.path.startswith('/static'):
            return response
        
        response_summary = summarize_response(response)
        
        duration = round((time.time() - g.start_time) * 1000)
        log_params = {
            'method': request.method,
            'remote_addr': get_real_ip(),
            'path': request.path,
            'status': response.status_code,
            'duration_ms': duration,
            'response_bytes': response_summary["length"],
            'response_preview': response_summary["preview"],
            'content_type': response_summary["content_type"]
        }
        app.logger.info(f"{log_params}")
        return response
