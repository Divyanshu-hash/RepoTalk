from datetime import datetime

from sqlalchemy import String, Integer, DateTime, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class DiagramCache(Base):
    """
    Stores generated architecture diagrams globally to save tokens and time.
    """
    __tablename__ = "diagram_cache"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Identifier
    full_name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)   # owner/repo

    # Payload
    diagram: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    graph: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<DiagramCache id={self.id} full_name={self.full_name!r}>"
