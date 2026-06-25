from datetime import datetime
from typing import Optional

from pydantic import BaseModel, HttpUrl, field_validator


# ══════════════════════════════════════════════
# Request schemas
# ══════════════════════════════════════════════

class RepoRequest(BaseModel):
    repo_url: str

    @field_validator("repo_url")
    @classmethod
    def must_be_github_url(cls, v: str) -> str:
        v = v.strip()
        if "github.com" not in v:
            raise ValueError("URL must be a GitHub repository URL.")
        return v


class ChatRequest(BaseModel):
    query: str

    @field_validator("query")
    @classmethod
    def query_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Query cannot be empty.")
        return v.strip()


# ══════════════════════════════════════════════
# User schemas
# ══════════════════════════════════════════════

class UserOut(BaseModel):
    id: int
    google_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime
    last_login: datetime

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════
# Repository schemas
# ══════════════════════════════════════════════

class RepoMetadata(BaseModel):
    """GitHub metadata returned alongside load/info responses."""
    name: str
    full_name: str
    description: Optional[str] = None
    stars: int = 0
    forks: int = 0
    open_issues: int = 0
    watchers: int = 0
    language: Optional[str] = None
    topics: list[str] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    license: Optional[str] = None
    homepage: Optional[str] = None
    default_branch: str = "main"
    owner_avatar: Optional[str] = None
    html_url: Optional[str] = None
    size: int = 0


class RepositoryOut(BaseModel):
    """DB representation of an indexed repository."""
    id: int
    owner: str
    name: str
    full_name: str
    html_url: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None
    stars: int
    forks: int
    open_issues: int
    default_branch: str
    topics: list
    owner_avatar: Optional[str] = None
    files_indexed: int
    indexed_at: datetime
    last_accessed: datetime

    model_config = {"from_attributes": True}


class LoadRepoResponse(BaseModel):
    success: bool
    message: str
    repository: str
    files_indexed: Optional[int] = None
    metadata: RepoMetadata
    cached: bool


# ══════════════════════════════════════════════
# Chat schemas
# ══════════════════════════════════════════════

class ChatMessageOut(BaseModel):
    id: int
    role: str           # "user" | "assistant"
    content: str
    mode: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    success: bool
    mode: str           # "normal-chat" | "issue-aware"
    answer: str
    issue: Optional[dict] = None


