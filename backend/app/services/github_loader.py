import os
import concurrent.futures
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()

GITHUB_API = "https://api.github.com/repos"

# File extensions we allow
ALLOWED_EXTENSIONS = (
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".c", ".cpp", ".go",
    ".rs", ".md", ".txt", ".json", ".yaml", ".yml", ".toml",
    ".html", ".css", ".scss", ".rb", ".php", ".swift", ".kt",
    ".sh", ".bat", ".sql", ".r", ".lua", ".dart",
)

IGNORE_DIRS = {
    "node_modules", ".git", "dist", "build", "__pycache__",
    "venv", ".venv", ".idea", ".vscode", "vendor", ".next",
}


# ──────────────────────────────────────────────
# Auth headers
# ──────────────────────────────────────────────
def _get_headers() -> dict:
    """Build GitHub API headers, reading token fresh each time."""
    token = os.getenv("GITHUB_TOKEN", "").strip()
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _github_get(url: str) -> requests.Response:
    """GET with automatic 401 fallback for public repos."""
    headers = _get_headers()
    response = requests.get(url, headers=headers)
    if response.status_code == 401 and "Authorization" in headers:
        del headers["Authorization"]
        response = requests.get(url, headers=headers)
    return response


# ──────────────────────────────────────────────
# Public helpers
# ──────────────────────────────────────────────
def extract_owner_repo(repo_url: str) -> tuple[Optional[str], Optional[str]]:
    """Parse owner and repo name from a GitHub URL."""
    parts = repo_url.rstrip("/").split("/")
    if len(parts) < 2:
        return None, None
    owner = parts[-2]
    repo = parts[-1].replace(".git", "")
    return owner, repo


def fetch_repo_metadata(owner: str, repo: str) -> tuple[Optional[dict], Optional[str]]:
    """
    Fetch repository metadata from GitHub API.
    Returns (metadata_dict, None) on success, (None, error_string) on failure.
    """
    url = f"{GITHUB_API}/{owner}/{repo}"
    response = _github_get(url)

    if response.status_code != 200:
        msg = response.json().get("message", response.text)
        return None, f"GitHub API error ({response.status_code}): {msg}"

    data = response.json()
    return {
        "name": data.get("name", ""),
        "full_name": data.get("full_name", ""),
        "description": data.get("description", ""),
        "stars": data.get("stargazers_count", 0),
        "forks": data.get("forks_count", 0),
        "open_issues": data.get("open_issues_count", 0),
        "language": data.get("language", "Unknown"),
        "topics": data.get("topics", []),
        "created_at": data.get("created_at", ""),
        "updated_at": data.get("updated_at", ""),
        "license": (data.get("license") or {}).get("name", "None"),
        "homepage": data.get("homepage", ""),
        "default_branch": data.get("default_branch", "main"),
        "owner_avatar": data.get("owner", {}).get("avatar_url", ""),
        "html_url": data.get("html_url", ""),
        "watchers": data.get("watchers_count", 0),
        "size": data.get("size", 0),
    }, None


def fetch_repo_tree(owner: str, repo: str, branch: str = "main") -> list[dict]:
    """
    Fetch the full file tree using the Git Trees API (single call, recursive).
    Returns a list of { path, type, size } items.
    """
    url = f"{GITHUB_API}/{owner}/{repo}/git/trees/{branch}?recursive=1"
    response = _github_get(url)

    # Fallback to 'master'
    if response.status_code != 200:
        url = f"{GITHUB_API}/{owner}/{repo}/git/trees/master?recursive=1"
        response = _github_get(url)
        if response.status_code != 200:
            return []

    result = []
    for item in response.json().get("tree", []):
        path = item.get("path", "")
        parts = path.split("/")
        if any(p in IGNORE_DIRS for p in parts):
            continue
        result.append({
            "path": path,
            "type": "directory" if item.get("type") == "tree" else "file",
            "size": item.get("size", 0),
        })
    return result


def fetch_repo_files(owner: str, repo: str, branch: str = "main") -> list[dict]:
    """Return list of { path, url } for all readable source files in the repo."""
    tree = fetch_repo_tree(owner, repo, branch)
    files = []
    for item in tree:
        if item["type"] == "file" and item["path"].lower().endswith(ALLOWED_EXTENSIONS):
            raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{item['path']}"
            files.append({"path": item["path"], "url": raw_url})
    return files


def load_file_content(url: str) -> str:
    """Fetch raw file content from a GitHub raw URL."""
    response = _github_get(url)
    return response.text if response.status_code == 200 else ""


def fetch_issue(owner: str, repo: str, issue_number: int) -> Optional[dict]:
    """Fetch a single GitHub issue (returns None for PRs or missing issues)."""
    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}"
    response = _github_get(url)

    if response.status_code != 200:
        return None

    data = response.json()
    if "pull_request" in data:
        return None  # Skip PRs

    return {
        "number": data["number"],
        "title": data["title"],
        "body": data.get("body", ""),
        "labels": [label["name"] for label in data.get("labels", [])],
    }


def fetch_files_concurrently(files: list[dict], max_workers: int = 15) -> list[str]:
    """
    Load file contents in parallel and return formatted document strings.
    Each document is prefixed with its file path for context.
    """
    def _fetch_and_format(f: dict) -> Optional[str]:
        try:
            content = load_file_content(f["url"])
            if content and content.strip():
                return f"File Path: {f['path']}\n---------------------\n{content}"
        except Exception:
            pass
        return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        results = list(executor.map(_fetch_and_format, files))

    return [r for r in results if r]
