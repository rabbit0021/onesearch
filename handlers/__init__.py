from .facebook import scrape_facebook, search_facebook_blog_posts
from .aws import scrape_aws, search_aws_blog_posts
def get_scrape_handler(company):
    handlers = {
        'facebook': scrape_facebook,
        'meta': scrape_facebook,
        'aws': scrape_aws
    }
    return handlers.get(company)

def get_blog_post_handler(company):
    handlers = {
        'facebook': search_facebook_blog_posts,
        'aws': search_aws_blog_posts
    }
    return handlers.get(company)