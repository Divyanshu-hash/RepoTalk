import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user, get_llm,_repo_to_metadata_dict,_update_repo_row
from app.db.models.ChatHistory import ChatHistory
from app.db.models.Repository import Repository
from app.db.models.User import User
from app.db.schemas import ChatRequest, ChatResponse, LoadRepoResponse, RepoRequest
from app.db.session import get_db
from app.services.github_loader import (
    extract_owner_repo,
    fetch_files_concurrently,
    fetch_issue,
    fetch_repo_files,
    fetch_repo_metadata,
    fetch_repo_tree,
)
from app.services.rag import build_vector_store, load_vector_store, save_vector_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repo", tags=["Repository"])

# ──────────────────────────────────────────────
# FAISS persistence directory
# ──────────────────────────────────────────────
DB_DIR = Path("repository_db")
DB_DIR.mkdir(exist_ok=True)

# ──────────────────────────────────────────────
# In-memory vectorstore cache  { repo_id → FAISS }
# ──────────────────────────────────────────────

# ──────────────────────────────────────────────
# In-memory vectorstore cache  { repo_id → FAISS }
# ──────────────────────────────────────────────
_vectorstore_cache: dict[str, object] = {}


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
def _extract_issue_number(query: str) -> int | None:
    match = re.search(r"issue\s+#?(\d+)", query.lower())
    return int(match.group(1)) if match else None


def _build_repo_graph(tree: list[dict], repo_name: str) -> dict:
    nodes = [{"id": "root", "name": repo_name, "type": "root", "size": 0}]
    edges = []
    seen_dirs: set[str] = set()

    for item in tree:
        path = item["path"]
        parts = path.split("/")

        for i in range(len(parts) - 1):
            dir_path = "/".join(parts[: i + 1])
            if dir_path not in seen_dirs:
                seen_dirs.add(dir_path)
                parent = "/".join(parts[:i]) if i > 0 else "root"
                nodes.append({"id": dir_path, "name": parts[i], "type": "directory", "size": 0})
                edges.append({"source": parent, "target": dir_path})

        if item["type"] == "file":
            parent = "/".join(parts[:-1]) if len(parts) > 1 else "root"
            nodes.append({"id": path, "name": parts[-1], "type": "file", "size": item.get("size", 0)})
            edges.append({"source": parent, "target": path})

    return {"nodes": nodes, "edges": edges}


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


# ═══════════════════════════════════════════════
# POST /api/v1/repo/load-repo
# ═══════════════════════════════════════════════
@router.post("/load-repo", summary="Index a GitHub repository")
async def load_repo(
    data: RepoRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Fetch, index, and cache a GitHub repository.
    - On first call: fetches GitHub, builds FAISS index, saves metadata to MySQL.
    - On repeat call for the same repo: reloads from disk + MySQL.
    """
    db_user = _get_or_create_db_user(db, current_user)

    owner, repo_name = extract_owner_repo(data.repo_url)
    if not owner or not repo_name:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL.")

    repo_id = f"{owner}_{repo_name}"
    repo_path = DB_DIR / repo_id

    # ── Check MySQL for existing record ──────────────────────
    existing = (
        db.query(Repository)
        .filter(Repository.user_id == db_user.id, Repository.full_name == f"{owner}/{repo_name}")
        .first()
    )

    if existing and repo_path.exists():
        try:
            vectorstore = load_vector_store(repo_path)
            _vectorstore_cache[repo_id] = vectorstore

            # Update last_accessed
            existing.last_accessed = datetime.now(timezone.utc)
            db.commit()

            logger.info("Loaded %s/%s from cache for user %s", owner, repo_name, db_user.email)
            return {
                "success": True,
                "message": "Repository loaded from local cache.",
                "repository": f"{owner}/{repo_name}",
                "files_indexed": existing.files_indexed,
                "metadata": _repo_to_metadata_dict(existing),
                "cached": True,
            }
        except Exception as exc:
            logger.warning("Cache corrupt for %s, re-indexing: %s", repo_id, exc)

    # ── Fetch metadata from GitHub ────────────────────────────
    metadata, meta_error = fetch_repo_metadata(owner, repo_name)
    if not metadata:
        raise HTTPException(status_code=404, detail=meta_error or "Repository not found.")

    # ── Fetch source files ────────────────────────────────────
    branch = metadata.get("default_branch", "main")
    files = fetch_repo_files(owner, repo_name, branch=branch)
    if not files:
        raise HTTPException(status_code=422, detail="No readable source files found.")

    documents = fetch_files_concurrently(files)
    if not documents:
        raise HTTPException(status_code=422, detail="All files were empty or unreadable.")

    # ── Build & persist FAISS index ───────────────────────────
    try:
        vectorstore = build_vector_store(documents)
        repo_path.mkdir(parents=True, exist_ok=True)

        # Cache a sample of docs for the analysis endpoint
        docs_path = repo_path / "documents.json"
        docs_path.write_text(json.dumps(documents[:20]))

        save_vector_store(vectorstore, repo_path)
        _vectorstore_cache[repo_id] = vectorstore
    except Exception as exc:
        logger.error("Indexing failed for %s: %s", repo_id, exc)
        raise HTTPException(status_code=500, detail=f"Indexing failed: {exc}")

    # ── Upsert Repository row in MySQL ────────────────────────
    if existing:
        _update_repo_row(existing, metadata, len(files), str(repo_path))
    else:
        existing = Repository(
            user_id=db_user.id,
            owner=owner,
            name=repo_name,
            full_name=metadata.get("full_name", f"{owner}/{repo_name}"),
            html_url=metadata.get("html_url"),
            description=metadata.get("description"),
            language=metadata.get("language"),
            stars=metadata.get("stars", 0),
            forks=metadata.get("forks", 0),
            open_issues=metadata.get("open_issues", 0),
            default_branch=branch,
            topics=metadata.get("topics", []),
            owner_avatar=metadata.get("owner_avatar"),
            files_indexed=len(files),
            index_path=str(repo_path),
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)

    logger.info("Indexed %s/%s (%d files) for user %s", owner, repo_name, len(files), db_user.email)
    return {
        "success": True,
        "message": "Repository indexed successfully.",
        "repository": f"{owner}/{repo_name}",
        "files_indexed": len(files),
        "metadata": metadata,
        "cached": False,
    }


# ═══════════════════════════════════════════════
# GET /api/v1/repo/info
# ═══════════════════════════════════════════════
@router.get("/info", summary="Get currently loaded repository metadata")
async def repo_info(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = _get_or_create_db_user(db, current_user)
    repo = (
        db.query(Repository)
        .filter(Repository.user_id == db_user.id)
        .order_by(Repository.last_accessed.desc())
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="No repository loaded. Call /load-repo first.")
    return {"success": True, "metadata": _repo_to_metadata_dict(repo)}


# ═══════════════════════════════════════════════
# GET /api/v1/repo/history
# ═══════════════════════════════════════════════
@router.get("/history", summary="List all repos indexed by the current user")
async def repo_history(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = _get_or_create_db_user(db, current_user)
    repos = (
        db.query(Repository)
        .filter(Repository.user_id == db_user.id)
        .order_by(Repository.last_accessed.desc())
        .all()
    )
    return {
        "success": True,
        "repositories": [
            {
                "id": r.id,
                "full_name": r.full_name,
                "description": r.description,
                "language": r.language,
                "stars": r.stars,
                "owner_avatar": r.owner_avatar,
                "files_indexed": r.files_indexed,
                "last_accessed": r.last_accessed.isoformat(),
            }
            for r in repos
        ],
    }




# ═══════════════════════════════════════════════
# POST /api/v1/repo/analysis
# ═══════════════════════════════════════════════
@router.post("/analysis", summary="Generate AI-powered repository analysis")
async def repo_analysis(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = _get_or_create_db_user(db, current_user)
    repo = (
        db.query(Repository)
        .filter(Repository.user_id == db_user.id)
        .order_by(Repository.last_accessed.desc())
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="No repository loaded. Call /load-repo first.")

    # Load cached documents from disk
    docs_path = Path(repo.index_path) / "documents.json"
    documents: list[str] = []
    if docs_path.exists():
        documents = json.loads(docs_path.read_text())

    if not documents:
        raise HTTPException(status_code=404, detail="No cached documents. Re-index the repository.")

    context = "\n\n".join(documents[:15])
    if len(context) > 12000:
        context = context[:12000] + "\n\n... (truncated)"

    meta_text = (
        f"Repository: {repo.full_name}\n"
        f"Description: {repo.description or 'N/A'}\n"
        f"Language: {repo.language or 'Unknown'}\n"
        f"Stars: {repo.stars}\n"
        f"Topics: {', '.join(repo.topics or [])}"
    )

    prompt = f"""You are an expert software architect analyzing a GitHub repository.

REPOSITORY METADATA:
{meta_text}

SAMPLE SOURCE FILES:
{context}

Based on the above, provide a detailed, well-structured analysis.
**CRITICAL:** Include EXACTLY TWO mermaid code blocks.

1. **Purpose & Overview**: What does this project do?
2. **Architecture Diagram (Mermaid #1)**: flowchart showing core components and data flow.
3. **Architecture Details**: Structure and design patterns.
4. **Key Components**: Main modules/files and their roles.
5. **Tech Stack**: Technologies, frameworks, libraries.
6. **How It Works**: Core workflow and data flow.
7. **Sequence Diagram (Mermaid #2)**: sequenceDiagram or component dependency graph.
8. **Why It Was Built**: Motivation.
9. **Strengths**: What is well-done.
10. **Potential Improvements**: What could be better.

Format with clear markdown headers. Reference actual file names.
MERMAID SYNTAX: No parentheses inside node labels [ ] or {{ }}. Use hyphens instead.

ANALYSIS:"""

    try:
        llm = get_llm()
        response = llm.invoke(prompt)
        return {"success": True, "analysis": response.content}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Analysis failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Analysis generation failed: {exc}")


# ═══════════════════════════════════════════════
# POST /api/v1/repo/chat
# ═══════════════════════════════════════════════
@router.post("/chat", summary="Chat with the indexed repository")
async def chat(
    data: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = _get_or_create_db_user(db, current_user)

    # Get the most-recently-accessed repo for this user
    repo = (
        db.query(Repository)
        .filter(Repository.user_id == db_user.id)
        .order_by(Repository.last_accessed.desc())
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="No repository loaded. Call /load-repo first.")

    # Load vectorstore from cache or disk
    repo_id = f"{repo.owner}_{repo.name}"
    vectorstore = _vectorstore_cache.get(repo_id)
    if vectorstore is None:
        try:
            vectorstore = load_vector_store(Path(repo.index_path))
            _vectorstore_cache[repo_id] = vectorstore
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to load search index: {exc}")

    llm = get_llm()
    query = data.query
    issue_number = _extract_issue_number(query)
    mode = "normal-chat"
    issue_data = None

    # ── Persist user message ──────────────────────────────────
    user_msg = ChatHistory(
        user_id=db_user.id,
        repository_id=repo.id,
        role="user",
        content=query,
        mode=mode,
    )
    db.add(user_msg)

    # ── Issue-aware flow ──────────────────────────────────────
    if issue_number is not None:
        mode = "issue-aware"
        issue_data = fetch_issue(repo.owner, repo.name, issue_number)
        if not issue_data:
            raise HTTPException(
                status_code=404,
                detail=f"Issue #{issue_number} not found or is a pull request.",
            )

        issue_text = (
            f"Title: {issue_data['title']}\n"
            f"Description: {issue_data['body']}\n"
            f"Labels: {', '.join(issue_data['labels'])}"
        )
        docs = vectorstore.similarity_search(issue_text, k=8)
        context = "\n\n".join(doc.page_content for doc in docs)

        prompt = f"""You are a senior software engineer.

GITHUB ISSUE:
{issue_text}

RELEVANT CODE:
{context}

USER QUESTION:
{query}

RULES: Use ONLY repository code. No invented files. If confidence is low, say so.

ANSWER:"""
        response = llm.invoke(prompt)
        answer = response.content

    else:
        # ── Normal RAG chat ───────────────────────────────────
        docs = vectorstore.similarity_search(query, k=7)
        context = "\n\n".join(doc.page_content for doc in docs)

        prompt = f"""You are an expert software engineer.

RULES:
- Use ONLY the repository context below
- Do NOT hallucinate or invent code
- Mention file names when referencing code
- Say when information is missing
- Format with markdown

REPOSITORY CONTEXT:
{context}

USER QUESTION:
{query}

ANSWER:"""
        response = llm.invoke(prompt)
        answer = response.content

    # ── Persist assistant reply ───────────────────────────────
    assistant_msg = ChatHistory(
        user_id=db_user.id,
        repository_id=repo.id,
        role="assistant",
        content=answer,
        mode=mode,
    )
    db.add(assistant_msg)
    db.commit()

    return {
        "success": True,
        "mode": mode,
        "answer": answer,
        "issue": issue_data,
    }


# ═══════════════════════════════════════════════
# GET /api/v1/repo/chat-history
# ═══════════════════════════════════════════════
@router.get("/chat-history", summary="Get chat history for the current repository")
async def get_chat_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = _get_or_create_db_user(db, current_user)
    repo = (
        db.query(Repository)
        .filter(Repository.user_id == db_user.id)
        .order_by(Repository.last_accessed.desc())
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="No repository loaded.")

    messages = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.user_id == db_user.id,
            ChatHistory.repository_id == repo.id,
        )
        .order_by(ChatHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    messages.reverse()  # oldest first

    return {
        "success": True,
        "repository": repo.full_name,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "mode": m.mode,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }






