from abc import ABC, abstractmethod

class BaseDatabase(ABC):
    @abstractmethod
    def connect(self):
        pass

    @abstractmethod
    def get_connection(self):
        pass

    @abstractmethod
    def close(self):
        pass
    
    @abstractmethod
    def get_subscriptions():
        pass
    
    @abstractmethod
    def add_subscription(self, email, publisher_id, topic):
        pass

    @abstractmethod
    def remove_subscription(self, email, topic, publisher_id):
        pass
    
    @abstractmethod
    def get_notifications(self):
        pass                                
    
    @abstractmethod
    def add_notification(self, email, heading, style_version, post_url, post_title):
        pass
    
    @abstractmethod
    def remove_notification(self, email, post_url):
        pass
    
    @abstractmethod
    def get_publishers(self):
        pass
    
    @abstractmethod
    def add_publisher(self, publisher_name, publisher_type, category, sub_category):
        pass
    
    @abstractmethod
    def get_publisher_by_name(self, name):
        pass    

    @abstractmethod
    def update_publisher(self, publisher_id, publisher_name, publisher_type, category, sub_category):
        pass
    
    @abstractmethod
    def delete_publisher(self, publisher_id):
        pass
    