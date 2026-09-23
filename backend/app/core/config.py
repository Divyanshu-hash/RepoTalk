from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Google OAuth
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    # JWT
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = "mysql+pymysql://root:@localhost:3306/repotalk"

    # AI / LLM
    GROQ_API_KEY: str = ""

    # GitHub (optional — increases rate limits for public repos)
    GITHUB_TOKEN: str = ""

    # App
    FRONTEND_URL: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = Path(__file__).parent.parent.parent / ".env"
        extra = "ignore"


settings = Settings()
