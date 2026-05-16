from handlers import aws, github, linkedin, netflix, airbnb, dropbox, facebook, slack, spotify, cloudfare, nvidea, salesforce, google, databricks, addy_osmani, julia_evans, antirez, gergely_orosz, simon_willison, eli_bendersky, marc_brooker
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
        elif comapny.lower() == 'facebook' or comapny.lower() == 'meta':
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
        elif comapny.lower() == "linkedin":
            return linkedin.LinkedinScraper()
        elif comapny.lower() == "addy osmani":
            return addy_osmani.AddyOsmaniScraper()
        elif comapny.lower() == "julia evans":
            return julia_evans.JuliaEvansScraper()
        elif comapny.lower() == "antirez":
            return antirez.AntirezScraper()
        elif comapny.lower() == "gergely orosz":
            return gergely_orosz.GergelyOroszScraper()
        elif comapny.lower() == "simon willison":
            return simon_willison.SimonWillisonScraper()
        elif comapny.lower() == "eli bendersky":
            return eli_bendersky.EliBenderskyScraper()
        elif comapny.lower() == "marc brooker":
            return marc_brooker.MarcBrookerScraper()
        else:
            logger.error(f"No handler found for {comapny}")
            return None
        
        