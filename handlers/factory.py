from handlers import aws, netflix, airbnb, dropbox

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
        else:
            raise Exception("No handler found!")
        
        