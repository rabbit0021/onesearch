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
