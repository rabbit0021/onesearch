from handlers import aws, github, netflix, airbnb, dropbox, facebook, slack, spotify, cloudfare, nvidea, salesforce, google, databricks
from logger_config import get_logger;

logger = get_logger("HANDLERS")
class ScraperFactory:
    
    def get_scraper(comapny):
        if comapny.lower() == "aws":
            return aws.AwsScraper()
        elif comapny.lower() == "netflix":
            return netflix.NetflixScraper()
        elif comapny.lower() == "airbnb":
            return airbnb.AirbnbScraper()
        elif comapny.lower() == "dropbox":
            return dropbox.DropboxScraper()
        elif comapny.lower() == 'facebook':
            return facebook.FacebookScraper()
        elif comapny.lower() == 'github':
            return github.Githubcraper()
        elif comapny.lower() == 'slack':
            return slack.SlackScraper()
        elif comapny.lower() == 'spotify':
            return spotify.SpotifyScraper()
        elif comapny.lower() == 'cloudflare':
            return cloudfare.CloudfareScraper()
        elif comapny.lower() == 'nvidea':
            return nvidea.NvideaScraper()
        elif comapny.lower() == 'salesforce':
            return salesforce.SalesforceScraper()
        elif comapny.lower() == 'google':
            return google.GoogleScraper()
        elif comapny.lower() == "databricks":
            return databricks.DatabricksScraper()
        else:
            logger.error(f"No handler found for {comapny}")
            return None
        
        