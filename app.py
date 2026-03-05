from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from github_loader import fetch_repo_files, load_file_content, fetch_issue, fetch_repo_metadata, fetch_repo_tree
from rag import build_vector_store, save_vector_store, load_vector_store
from langchain_groq import ChatGroq
from dotenv import load_dotenv
import os
import json
import re
import concurrent.futures
import shutil

# Load environment variables
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found. Please set it in .env file")

app = FastAPI(title="RepoTalk - GitHub Codebase Chatbot")

# -------- CORS --------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------- CONFIG --------
DB_DIR = "repository_db"
if not os.path.exists(DB_DIR):
    os.makedirs(DB_DIR)

# -------- GLOBAL STATE --------
vectorstore = None
current_repo = None
repo_metadata_cache = None
repo_documents_cache = []

# -------- LLM --------
llm = ChatGroq(
    groq_api_key=GROQ_API_KEY,
    model_name="meta-llama/llama-4-maverick-17b-128e-instruct"
)

# -------- MODELS --------
class RepoRequest(BaseModel):
    repo_url: str


class ChatRequest(BaseModel):
    query: str


# -------- HELPERS --------
def extract_owner_repo(repo_url: str):
    """Extract owner and repo from a GitHub URL."""
    parts = repo_url.rstrip("/").split("/")
    if len(parts) < 2:
        return None, None
    owner = parts[-2]
    repo = parts[-1].replace(".git", "")
    return owner, repo


def extract_issue_number(query: str):
    match = re.search(r'issue\s+#?(\d+)', query.lower())
    if match:
        return int(match.group(1))
    return None


# -------- LOAD REPOSITORY --------
@app.post("/load-repo")
def load_repo(data: RepoRequest):
    global vectorstore, current_repo, repo_metadata_cache, repo_documents_cache

    owner, repo = extract_owner_repo(data.repo_url)
    if not owner or not repo:
        return {"error": "Invalid GitHub repository URL"}

    repo_id = f"{owner}_{repo}"
    repo_path = os.path.join(DB_DIR, repo_id)
    metadata_path = os.path.join(repo_path, "metadata.json")
    docs_path = os.path.join(repo_path, "documents.json")

    # Check if we already have this repo indexed locally
    if os.path.exists(repo_path) and os.path.exists(metadata_path):
        try:
            with open(metadata_path, 'r') as f:
                repo_metadata_cache = json.load(f)
            if os.path.exists(docs_path):
                with open(docs_path, 'r') as f:
                    repo_documents_cache = json.load(f)
            
            vectorstore = load_vector_store(repo_path)
            current_repo = {"owner": owner, "repo": repo}
            
            return {
                "message": "Repository loaded from local cache",
                "repository": f"{owner}/{repo}",
                "metadata": repo_metadata_cache,
                "cached": True
            }
        except Exception as e:
            print(f"Error loading cache for {repo_id}: {e}")
            # If cache is corrupted, proceed to re-load

    # Fetch metadata
    metadata, meta_error = fetch_repo_metadata(owner, repo)
    if not metadata:
        return {"error": meta_error or "Could not fetch repository. Check if the URL is correct and the repo is public."}

    repo_metadata_cache = metadata

    # Fetch files
    files = fetch_repo_files(owner, repo, branch=metadata.get("default_branch", "main"))

    if not files:
        return {"error": "No readable source files found in repository"}

    def fetch_and_format(f):
        try:
            content = load_file_content(f["url"])
            if content and content.strip():
                return (
                    f"File Path: {f['path']}\n"
                    f"---------------------\n"
                    f"{content}"
                )
        except Exception as e:
            print(f"Error loading {f['path']}: {e}")
        return None

    # Fetch file contents concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
        results = executor.map(fetch_and_format, files)
        
    documents = [res for res in results if res]
    repo_documents_cache = documents

    try:
        vectorstore = build_vector_store(documents)
        
        # Save for persistence
        if not os.path.exists(repo_path):
            os.makedirs(repo_path)
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f)
        
        # Save a sample of documents for the analysis endpoint to avoid re-fetching
        with open(docs_path, 'w') as f:
            json.dump(documents[:20], f) # Cache first 20 docs for analysis
            
        save_vector_store(vectorstore, repo_path)
        
    except Exception as e:
        return {"error": str(e)}

    current_repo = {
        "owner": owner,
        "repo": repo
    }

    return {
        "message": "Repository indexed successfully",
        "files_indexed": len(files),
        "repository": f"{owner}/{repo}",
        "metadata": metadata
    }


# -------- REPO INFO --------
@app.get("/repo-info")
def repo_info():
    if repo_metadata_cache is None:
        return {"error": "No repository loaded. Please call /load-repo first."}
    return repo_metadata_cache


# -------- REPO STRUCTURE (for graph) --------
@app.get("/repo-structure")
def repo_structure():
    if current_repo is None:
        return {"error": "No repository loaded. Please call /load-repo first."}

    owner = current_repo["owner"]
    repo = current_repo["repo"]
    branch = repo_metadata_cache.get("default_branch", "main") if repo_metadata_cache else "main"

    tree = fetch_repo_tree(owner, repo, branch)
    if not tree:
        return {"error": "Could not fetch repository tree"}

    # Build graph data: nodes and edges
    nodes = [{"id": "root", "name": repo, "type": "root", "size": 0}]
    edges = []
    seen_dirs = set()

    for item in tree:
        path = item["path"]
        parts = path.split("/")

        # Create directory nodes for all parent directories
        for i in range(len(parts) - 1):
            dir_path = "/".join(parts[:i + 1])
            if dir_path not in seen_dirs:
                seen_dirs.add(dir_path)
                parent = "/".join(parts[:i]) if i > 0 else "root"
                nodes.append({
                    "id": dir_path,
                    "name": parts[i],
                    "type": "directory",
                    "size": 0
                })
                edges.append({"source": parent, "target": dir_path})

        # Add file node
        if item["type"] == "file":
            parent = "/".join(parts[:-1]) if len(parts) > 1 else "root"
            nodes.append({
                "id": path,
                "name": parts[-1],
                "type": "file",
                "size": item.get("size", 0)
            })
            edges.append({"source": parent, "target": path})

    return {"nodes": nodes, "edges": edges}


# -------- REPO ANALYSIS (AI-generated) --------
@app.post("/repo-analysis")
def repo_analysis():
    if current_repo is None or not repo_documents_cache:
        return {"error": "No repository loaded. Please call /load-repo first."}

    # Use a sample of files for the analysis prompt (to avoid token limits)
    sample_docs = repo_documents_cache[:15]
    context = "\n\n".join(sample_docs)

    # Truncate if too long
    if len(context) > 12000:
        context = context[:12000] + "\n\n... (truncated)"

    meta = repo_metadata_cache or {}
    meta_text = f"""
Repository: {meta.get('full_name', 'Unknown')}
Description: {meta.get('description', 'N/A')}
Language: {meta.get('language', 'Unknown')}
Stars: {meta.get('stars', 0)}
Topics: {', '.join(meta.get('topics', []))}
"""

    prompt = f"""You are an expert software architect analyzing a GitHub repository.

REPOSITORY METADATA:
{meta_text}

SAMPLE SOURCE FILES:
{context}

Based on the above, provide a detailed, well-structured analysis covering the following points. 
**CRITICAL REQUIREMENT:** You MUST include a ````mermaid` code block containing a flowchart or architecture diagram that visually explains the repository's structure or workflow.

1. **Purpose & Overview**: What does this project do? What problem does it solve?
2. **Architecture Diagram (Mermaid)**: Provide a beautiful ````mermaid` graph (e.g. `graph TD` or `flowchart LR`) illustrating the core components and data flow.
3. **Architecture Details**: How is the codebase structured? What design patterns are used?
4. **Key Components**: What are the main modules/files and what do they do?
5. **Tech Stack**: What technologies, frameworks, and libraries are used?
6. **How It Works**: Explain the core workflow/data flow of the application.
7. **Why It Was Built**: Based on the code and description, what motivated this project?
8. **Strengths**: What's well-done in this codebase?
9. **Potential Improvements**: What could be improved?

Format your response with clear markdown headers and bullet points. Be specific and reference actual file names and code patterns you see. Do not forget the Mermaid diagram.

ANALYSIS:
"""

    try:
        response = llm.invoke(prompt)
        return {"analysis": response.content}
    except Exception as e:
        return {"error": f"Analysis generation failed: {str(e)}"}


# -------- CHAT (NORMAL + ISSUE-AWARE) --------
@app.post("/chat")
def chat(data: ChatRequest):
    if vectorstore is None or current_repo is None:
        return {"error": "Repository not indexed. Please call /load-repo first."}

    query = data.query.strip()
    if not query:
        return {"error": "Query cannot be empty"}

    issue_number = extract_issue_number(query)

    # ISSUE-AWARE FLOW
    if issue_number is not None:
        owner = current_repo["owner"]
        repo = current_repo["repo"]

        issue = fetch_issue(owner, repo, issue_number)
        if not issue:
            return {"error": f"Issue #{issue_number} not found or is a pull request"}

        issue_text = f"""
Title: {issue['title']}
Description: {issue['body']}
Labels: {', '.join(issue['labels'])}
"""

        docs = vectorstore.similarity_search(issue_text, k=8)
        context = "\n\n".join([doc.page_content for doc in docs])

        prompt = f"""
You are a senior software engineer.

The user is asking about a GitHub issue.

RULES:
- Use ONLY repository code
- No runtime assumptions
- No invented files
- If confidence is low, say so clearly

GITHUB ISSUE:
{issue_text}

RELEVANT CODE:
{context}

USER QUESTION:
{query}

TASK:
Explain the issue and, if requested, suggest how it can be fixed.
Provide example code snippets that follow repository style.

ANSWER:
"""

        response = llm.invoke(prompt)

        return {
            "mode": "issue-aware",
            "issue": issue,
            "answer": response.content
        }

    # NORMAL RAG CHAT
    docs = vectorstore.similarity_search(query, k=7)
    context = "\n\n".join([doc.page_content for doc in docs])

    prompt = f"""
You are an expert software engineer.

RULES:
- Use ONLY repository context
- Do NOT hallucinate
- Mention file names
- Say when information is missing
- Format your response with markdown for readability

REPOSITORY CONTEXT:
{context}

USER QUESTION:
{query}

ANSWER:
"""

    response = llm.invoke(prompt)

    return {
        "mode": "normal-chat",
        "answer": response.content
    }
