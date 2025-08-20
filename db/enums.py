from enum import Enum

class PublisherType(Enum):
    TECHTEAM = "techteam"
    INDIVIDUAL = "individual"
    COMMUNITY = "community"

class PublisherCategory(Enum):
    SOFTWARE_ENGINEERING = "Software Engineering"
    DATA_ANALYTICS = "Data Analytics"
    DATA_SCIENCE = "Data Science"
    SOFTWARE_TESTING = "Software Testing"
    PRODUCT_MANAGEMENT = "Product Management"
    GENERAL = "General"