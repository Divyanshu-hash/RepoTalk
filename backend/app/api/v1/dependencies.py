import os
import re
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.models.Repository import Repository
from app.db.models.User import User
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
            model_name="openai/gpt-oss-20b",
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


# ──────────────────────────────────────────────
# Issue number extractor
# ──────────────────────────────────────────────
def _extract_issue_number(query: str) -> int | None:
    """Extract GitHub issue number from a query string like 'issue #42'."""
    match = re.search(r"issue\s+#?(\d+)", query.lower())
    return int(match.group(1)) if match else None


# ──────────────────────────────────────────────
# DB user helper
# ──────────────────────────────────────────────
def _get_or_create_db_user(db: Session, current_user: dict) -> User:
    """
    Fetch the ORM User row matching the JWT sub.
    If not found (e.g. MySQL was offline during login), create it now.
    """
    try:
        user = db.query(User).filter(User.google_id == current_user["id"]).first()
        if not user:
            user = User(
                google_id=current_user["id"],
                email=current_user.get("email", ""),
                name=current_user.get("name", ""),
                picture=current_user.get("picture", ""),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database unavailable. Please ensure MySQL is running. ({str(e).split(chr(10))[0]})",
        )


def _ensure_user_repo_record(
    db: Session,
    db_user: User,
    owner: str,
    repo_name: str,
    repo_path,
) -> "Repository":
    """
    Ensure the current user has a DB record for a repo that is already
    indexed on disk (possibly by a different user). If the record exists,
    update last_accessed. If not, create a lightweight record pointing to
    the shared FAISS index, fetching any missing metadata from GitHub.
    """
    from app.db.models.Repository import Repository
    from app.services.github_loader import fetch_repo_metadata
    import json

    full_name = f"{owner}/{repo_name}"
    existing = (
        db.query(Repository)
        .filter(Repository.user_id == db_user.id, Repository.full_name == full_name)
        .first()
    )

    if existing:
        existing.last_accessed = datetime.now(timezone.utc)
        db.commit()
        return existing

    # Try to load metadata from the cached documents.json first
    files_indexed = 0
    metadata = {}
    docs_path = repo_path / "documents.json"
    if docs_path.exists():
        try:
            files_indexed = len(json.loads(docs_path.read_text()))
        except Exception:
            pass

    # Fetch live metadata from GitHub (lightweight, single API call)
    meta, _ = fetch_repo_metadata(owner, repo_name)
    if meta:
        metadata = meta

    branch = metadata.get("default_branch", "main")
    new_record = Repository(
        user_id=db_user.id,
        owner=owner,
        name=repo_name,
        full_name=metadata.get("full_name", full_name),
        html_url=metadata.get("html_url"),
        description=metadata.get("description"),
        language=metadata.get("language"),
        stars=metadata.get("stars", 0),
        forks=metadata.get("forks", 0),
        open_issues=metadata.get("open_issues", 0),
        default_branch=branch,
        topics=metadata.get("topics", []),
        owner_avatar=metadata.get("owner_avatar"),
        files_indexed=files_indexed or metadata.get("size", 0),
        index_path=str(repo_path),
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record
