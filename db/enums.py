from enum import Enum

class PublisherType(Enum):
    TECHTEAM = "techteam"
    INDIVIDUAL = "individual"
    COMMUNITY = "community"

class PublisherCategory(Enum):
    SOFTWARE_ENGINEERING = "Software Engineering"
    FRONTEND_ENGINEERING = "Frontend Engineering"
    BACKEND_ENGINEERING = "Backend Engineering"
    MOBILE_ENGINEERING = "Mobile Engineering"
    PLATFORM_INFRASTRUCTURE = "Platform & Infrastructure"
    DATA_ENGINEERING = "Data Engineering"
    DATA_SCIENCE = "Data Science"
    ML_AI = "Machine Learning & AI"
    DATA_ANALYTICS = "Data Analytics"
    SECURITY_ENGINEERING = "Security Engineering"
    QA_TESTING = "QA & Testing"
    PRODUCT_MANAGEMENT = "Product Management"
    GENERAL = "General"