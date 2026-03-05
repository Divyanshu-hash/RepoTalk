import requests
import os
from dotenv import load_dotenv

load_dotenv(override=True)

GITHUB_API = "https://api.github.com/repos"


def get_headers():
    """Build GitHub API headers, reading token fresh each time."""
    load_dotenv(override=True)
    token = os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token and token.strip():
        headers["Authorization"] = f"Bearer {token.strip()}"
    return headers


def github_get(url):
    """Make a GitHub API GET request. Falls back to no-auth on 401."""
    headers = get_headers()
    response = requests.get(url, headers=headers)

    # If token is bad, retry without it (works for public repos)
    if response.status_code == 401 and "Authorization" in headers:
        print("⚠️ GitHub token returned 401, retrying without token...")
        del headers["Authorization"]
        response = requests.get(url, headers=headers)

    return response


# File extensions we allow
ALLOWED_EXTENSIONS = (
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".c", ".cpp", ".go",
    ".rs", ".md", ".txt", ".json", ".yaml", ".yml", ".toml",
    ".html", ".css", ".scss", ".rb", ".php", ".swift", ".kt",
    ".sh", ".bat", ".sql", ".r", ".lua", ".dart"
)

IGNORE_DIRS = {
    "node_modules", ".git", "dist", "build", "__pycache__",
    "venv", ".venv", ".idea", ".vscode", "vendor", ".next"
}


def fetch_repo_metadata(owner: str, repo: str):
    """
    Fetch repository metadata from GitHub API (description, stars, topics, etc.)
    Returns (dict, None) on success, (None, error_string) on failure.
    """
    url = f"{GITHUB_API}/{owner}/{repo}"
    response = github_get(url)

    if response.status_code != 200:
        print(f"GitHub metadata API error ({response.status_code}): {response.text}")
        return None, f"GitHub API error ({response.status_code}): {response.json().get('message', response.text)}"

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
        "license": data.get("license", {}).get("name", "None") if data.get("license") else "None",
        "homepage": data.get("homepage", ""),
        "default_branch": data.get("default_branch", "main"),
        "owner_avatar": data.get("owner", {}).get("avatar_url", ""),
        "html_url": data.get("html_url", ""),
        "watchers": data.get("watchers_count", 0),
        "size": data.get("size", 0),
    }, None


def fetch_repo_tree(owner: str, repo: str, branch: str = "main") -> list:
    """
    Fetch full repository file tree using the Git Trees API (single API call).
    Returns a list of { path, type, size } for building graph visualization.
    """
    url = f"{GITHUB_API}/{owner}/{repo}/git/trees/{branch}?recursive=1"
    response = github_get(url)

    if response.status_code != 200:
        # Try 'master' branch as fallback
        url = f"{GITHUB_API}/{owner}/{repo}/git/trees/master?recursive=1"
        response = github_get(url)
        if response.status_code != 200:
            return []

    data = response.json()
    tree = data.get("tree", [])

    result = []
    for item in tree:
        path = item.get("path", "")
        item_type = item.get("type", "")

        # Skip ignored directories
        parts = path.split("/")
        if any(p in IGNORE_DIRS for p in parts):
            continue

        result.append({
            "path": path,
            "type": "directory" if item_type == "tree" else "file",
            "size": item.get("size", 0)
        })

    return result


def fetch_repo_files(owner: str, repo: str, branch: str = "main"):
    """
    Fetches a list of all readable source files from a GitHub repository.
    Uses the Git Trees API (via fetch_repo_tree) for a single fast API call 
    instead of recursively polling the Contents API.
    """
    tree = fetch_repo_tree(owner, repo, branch)
    
    files = []
    for item in tree:
        if item["type"] == "file":
            # Only include allowed extensions
            if item["path"].lower().endswith(ALLOWED_EXTENSIONS):
                # Construct the raw download URL
                url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{item['path']}"
                files.append({
                    "path": item["path"],
                    "url": url
                })
                
    return files


def load_file_content(url: str) -> str:
    response = github_get(url)
    if response.status_code == 200:
        return response.text
    return ""


def fetch_issue(owner: str, repo: str, issue_number: int):
    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}"
    response = github_get(url)

    if response.status_code != 200:
        return None

    data = response.json()

    # Ignore pull requests (they appear as issues)
    if "pull_request" in data:
        return None

    return {
        "number": data["number"],
        "title": data["title"],
        "body": data.get("body", ""),
        "labels": [label["name"] for label in data.get("labels", [])]
    }
