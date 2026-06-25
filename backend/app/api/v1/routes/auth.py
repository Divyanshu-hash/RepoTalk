import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.core.config import settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.db.models.User import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


# ──────────────────────────────────────────────
# Step 1 — Redirect user to Google consent page
# ──────────────────────────────────────────────
@router.get("/google", summary="Initiate Google OAuth login")
async def google_login():
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{query_string}")


# ──────────────────────────────────────────────
# Step 2 — Google redirects back here with ?code=
# ──────────────────────────────────────────────
@router.get("/google/callback", summary="Google OAuth callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:

        # Exchange authorization code for access token
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        token_data = token_resp.json()

        if "error" in token_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Google OAuth error: {token_data.get('error_description', token_data['error'])}",
            )

        # Fetch user profile from Google
        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        google_user = userinfo_resp.json()

    # ── Upsert user into MySQL ────────────────────────────────
    db_user = db.query(User).filter(User.google_id == google_user["id"]).first()

    if db_user is None:
        # First login — create new user
        db_user = User(
            google_id=google_user["id"],
            email=google_user["email"],
            name=google_user.get("name", ""),
            picture=google_user.get("picture", ""),
        )
        db.add(db_user)
    else:
        # Returning user — update mutable fields
        db_user.name = google_user.get("name", db_user.name)
        db_user.picture = google_user.get("picture", db_user.picture)

    db.commit()
    db.refresh(db_user)

    # ── Build and sign JWT ────────────────────────────────────
    jwt_token = create_access_token(
        data={
            "sub": google_user["id"],
            "email": google_user["email"],
            "name": google_user.get("name", ""),
            "picture": google_user.get("picture", ""),
        }
    )

    # Redirect back to frontend — token delivered as query param
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/auth/callback?token={jwt_token}"
    )


# ──────────────────────────────────────────────
# Utility — who am I?
# ──────────────────────────────────────────────
@router.get("/me", summary="Get current authenticated user")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "success": True,
        "user": current_user,
    }
