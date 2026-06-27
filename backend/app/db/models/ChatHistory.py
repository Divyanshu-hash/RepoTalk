from datetime import datetime

from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ChatHistory(Base):
    """
    Stores individual chat messages (user + assistant turns) for a given repository session.
    This lets users revisit past conversations.
    """
    __tablename__ = "chat_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Which user sent/received this message
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Which indexed repository this chat belongs to
    repository_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("repositories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # "user" | "assistant"
    role: Mapped[str] = mapped_column(String(16), nullable=False)

    # The actual message text (markdown / code is fine here)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Chat mode: "normal-chat" | "issue-aware"
    mode: Mapped[str] = mapped_column(String(32), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    repository: Mapped["Repository"] = relationship(  # type: ignore
        "Repository",
        back_populates="chat_history",
    )

    def __repr__(self) -> str:
        return f"<ChatHistory id={self.id} role={self.role!r} repo={self.repository_id}>"
