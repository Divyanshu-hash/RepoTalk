from datetime import datetime

from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Repository(Base):
    """
    Tracks every GitHub repository a user has indexed.
    The FAISS index is stored on disk; this table stores metadata and index state.
    """
    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Owner FK
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # GitHub identity
    owner: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)   # owner/repo
    html_url: Mapped[str] = mapped_column(String(512), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(64), nullable=True)
    stars: Mapped[int] = mapped_column(Integer, default=0)
    forks: Mapped[int] = mapped_column(Integer, default=0)
    open_issues: Mapped[int] = mapped_column(Integer, default=0)
    default_branch: Mapped[str] = mapped_column(String(128), default="main")
    topics: Mapped[list] = mapped_column(JSON, default=list)          # ["topic1", …]
    owner_avatar: Mapped[str] = mapped_column(String(512), nullable=True)

    # Index state
    files_indexed: Mapped[int] = mapped_column(Integer, default=0)
    index_path: Mapped[str] = mapped_column(String(512), nullable=True)  # path to FAISS dir

    # Timestamps
    indexed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    last_accessed: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", backref="repositories")  # type: ignore
    chat_history: Mapped[list["ChatHistory"]] = relationship(  # type: ignore
        "ChatHistory",
        back_populates="repository",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Repository id={self.id} full_name={self.full_name!r}>"