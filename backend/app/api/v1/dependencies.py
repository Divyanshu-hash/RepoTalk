from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency — extracts and validates the JWT from the Authorization header.
    Usage:  current_user: dict = Depends(get_current_user)
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


async def extract_owner_repo(repo_url: str):
    """Extract owner and repo from a GitHub URL."""
    parts = repo_url.rstrip("/").split("/")
    if len(parts) < 2:
        return None, None
    owner = parts[-2]
    repo = parts[-1].replace(".git", "")
    return owner, repo