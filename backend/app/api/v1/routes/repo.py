
from fastapi import APIRouter, Request

from app.db.schemas import RepoRequest


router = APIRouter(prefix="/repo", tags=["Repository"])



@router.post("/load-repo", summary="Load repository")
async def load_repository(data: RepoRequest):
    """
    Load a GitHub repository for analysis.
    """
    
