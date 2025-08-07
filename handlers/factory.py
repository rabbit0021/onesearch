from handlers import aws, github, netflix, airbnb, dropbox, facebook, slack, spotify, cloudfare, nvidea, salesforce

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
        else:
            raise Exception("No handler found!")
        
        