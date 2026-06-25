import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.routes import auth
from app.core.config import settings

# ──────────────────────────────────────────────
# Logger
# ──────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# App
# ──────────────────────────────────────────────
app = FastAPI(
    title="RepoTalk",
    description="GitHub Codebase Chatbot",
    version="1.0.0",
    docs_url="/docs",
)

# ──────────────────────────────────────────────
# CORS  (restrict origins in production)
# ──────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# Global error handler
# ──────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url}: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal Server Error"},
    )

# ──────────────────────────────────────────────
# Core routes
# ──────────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    return {"message": "RepoTalk API", "docs": "/docs"}


@app.get("/health", tags=["Root"])
async def health_check():
    return {
        "status": "online",
        "message": "RepoTalk API is running",
        "environment": settings.ENVIRONMENT,
    }


# ──────────────────────────────────────────────
# Routers
# ──────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(repo.router, prefix="/api/v1")

