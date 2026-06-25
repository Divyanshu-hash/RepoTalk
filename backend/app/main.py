import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.routes import auth, repo
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
# Database — create tables on startup
# ──────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    # Import all models so Base.metadata knows every table
    import app.db.models  # noqa: F401
    from app.db.session import engine, Base
    from sqlalchemy.exc import OperationalError

    logger.info("Creating database tables if they don't exist...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database ready — all tables created/verified.")
    except OperationalError as e:
        logger.warning(
            "⚠️  Could not connect to MySQL: %s\n"
            "   → Make sure MySQL is running and DATABASE_URL in .env is correct.\n"
            "   → Server will start but DB-dependent routes will fail.",
            str(e).split("\n")[0],
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
