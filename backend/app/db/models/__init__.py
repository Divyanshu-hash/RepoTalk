# Import all models so SQLAlchemy's metadata knows about every table.
# This is required for `Base.metadata.create_all(engine)` to work correctly.

from app.db.models.User import User
from app.db.models.Repository import Repository
from app.db.models.ChatHistory import ChatHistory

__all__ = ["User", "Repository", "ChatHistory"]
