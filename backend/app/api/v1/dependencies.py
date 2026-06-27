import os
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.models.Repository import Repository
from app.db.session import get_db
from langchain_groq import ChatGroq


bearer_scheme = HTTPBearer()


# ──────────────────────────────────────────────
# JWT → current user payload
# ──────────────────────────────────────────────
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Validate the JWT Bearer token and return the decoded payload.
    Returns a dict with keys: id, email, name, picture.

    Usage:
        current_user: dict = Depends(get_current_user)
    """
    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "id": payload.get("sub"),
        "email": payload.get("email"),
        "name": payload.get("name"),
        "picture": payload.get("picture"),
    }


# ──────────────────────────────────────────────
# JWT + DB → ORM User row
# ──────────────────────────────────────────────
async def get_current_db_user(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Like get_current_user but also fetches and returns the full ORM User object.
    Raises 404 if the user doesn't exist in the database yet.

    Usage:
        user: User = Depends(get_current_db_user)
    """
    from app.db.models.User import User

    db_user = db.query(User).filter(User.google_id == current_user["id"]).first()
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in database.",
        )
    return db_user


# ──────────────────────────────────────────────
# URL parsing helper
# ──────────────────────────────────────────────
async def extract_owner_repo(repo_url: str):
    """Extract owner and repo name from a GitHub URL."""
    parts = repo_url.rstrip("/").split("/")
    if len(parts) < 2:
        return None, None
    owner = parts[-2]
    repo = parts[-1].replace(".git", "")
    return owner, repo


_llm: ChatGroq | None = None


def get_llm() -> ChatGroq:
    global _llm
    if _llm is None:
        groq_key = os.getenv("GROQ_API_KEY", "")
        if not groq_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="GROQ_API_KEY is not configured on the server.",
            )
        _llm = ChatGroq(
            groq_api_key=groq_key,
            model_name="llama-3.3-70b-versatile",
        )
    return _llm

def _repo_to_metadata_dict(repo: Repository) -> dict:
    return {
        "name": repo.name,
        "full_name": repo.full_name,
        "description": repo.description,
        "stars": repo.stars,
        "forks": repo.forks,
        "open_issues": repo.open_issues,
        "watchers": 0,
        "language": repo.language,
        "topics": repo.topics or [],
        "default_branch": repo.default_branch,
        "owner_avatar": repo.owner_avatar,
        "html_url": repo.html_url,
        "size": 0,
    }

def _update_repo_row(repo: Repository, metadata: dict, files_indexed: int, index_path: str) -> None:
    repo.description = metadata.get("description", repo.description)
    repo.language = metadata.get("language", repo.language)
    repo.stars = metadata.get("stars", repo.stars)
    repo.forks = metadata.get("forks", repo.forks)
    repo.open_issues = metadata.get("open_issues", repo.open_issues)
    repo.topics = metadata.get("topics", repo.topics)
    repo.owner_avatar = metadata.get("owner_avatar", repo.owner_avatar)
    repo.files_indexed = files_indexed
    repo.index_path = index_path
    repo.last_accessed = datetime.now(timezone.utc)
