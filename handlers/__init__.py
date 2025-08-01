from .facebook import scrape_facebook, search_facebook_blog_posts

def get_scrape_handler(company):
    handlers = {
        'facebook': scrape_facebook,
        'meta': scrape_facebook  # alias
    }
    return handlers.get(company)

def get_blog_post_handler(company):
    handlers = {
        'facebook': search_facebook_blog_posts,
    }
    return handlers.get(company)