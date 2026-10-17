# RepoTalk 💬🕸️

**RepoTalk** is a full-stack AI-powered application that lets you chat with any public GitHub repository. Paste a GitHub URL, and RepoTalk fetches the source code, indexes it into a local FAISS vector store, and uses large language models to answer natural-language questions about the codebase.

It also generates an **interactive AI architecture diagram** — a Mermaid flowchart streamed live to the client via Server-Sent Events (SSE) — and provides an **AI-powered repository analysis** covering purpose, architecture, tech stack, and more.

---

## ✨ Features

- **Chat with any codebase** — Ask questions about architecture, files, functions, or specific GitHub issues
- **Issue-aware mode** — Mention `issue #42` and RepoTalk fetches that issue's context automatically for more accurate answers
- **AI architecture diagram** — Live-streamed Mermaid flowchart with colored subgraphs and clickable file links, generated via structured LLM output with validation and retry logic
- **AI repository analysis** — Detailed markdown analysis including architecture diagrams, tech stack, key components, and improvements
- **Recently explored repos** — Landing page shows your previously explored repositories for quick re-access
- **Global diagram caching** — Architecture diagrams are cached in MySQL; the second user to load the same repo gets an instant result
- **3-tier vector store caching** — In-memory → disk (FAISS) → full re-index; shared across all users for the same repo
- **Google OAuth + JWT** — Secure login with 7-day tokens and per-user history tracking
- **Dark / Light theme** — Starfield dark mode and clean light mode with full theme persistence
- **Chat history** — Conversation history is persisted per user per repository

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Mermaid.js 11, react-markdown, remark-gfm |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy |
| **Database** | MySQL (PyMySQL) |
| **LLM** | Groq API (`openai/gpt-oss-20b`) via LangChain + native Groq SDK |
| **Embeddings** | HuggingFace `sentence-transformers/all-MiniLM-L6-v2` |
| **Vector Store** | FAISS (CPU) |
| **Auth** | Google OAuth 2.0, JWT (`python-jose`) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React 19)                       │
│  LandingPage  ──►  WikiPage  ──►  RepoOverview / RepoGraph      │
│                                        │                         │
│                              ChatPanel (RAG Q&A)                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST + SSE
┌──────────────────────────▼──────────────────────────────────────┐
│                      Backend (FastAPI)                           │
│                                                                  │
│  /api/v1/auth      Google OAuth → JWT                           │
│  /api/v1/repo      load-repo, chat, analysis, history           │
│  /api/v1/generate  SSE diagram generation pipeline              │
└────────┬──────────────────────┬──────────────────────┬──────────┘
         │                      │                      │
    GitHub API              Groq LLM API           MySQL DB
    (source files,          (chat, analysis,       (users, repos,
     issues, tree)           diagram gen)           chat history,
                                                    diagram cache)
                                    │
                              FAISS Index
                           (disk: repository_db/)
```

---

## ⚙️ Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL (running locally or remote)
- A [Groq API key](https://console.groq.com/)
- A [Google OAuth 2.0 client](https://console.cloud.google.com/) (Client ID + Secret)

---

### 1. Clone the repository

```bash
git clone https://github.com/Divyanshu-hash/RepoTalk.git
cd RepoTalk
```

### 2. Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
.\venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback

# JWT — generate with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=your-random-secret-key

# MySQL
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/repotalk

# Groq
GROQ_API_KEY=your-groq-api-key

# GitHub — optional but strongly recommended (raises rate limit 60 → 5000 req/hr)
GITHUB_TOKEN=your-github-pat

# App
FRONTEND_URL=http://localhost:5173
ENVIRONMENT=development
```

### 4. Start the backend

```bash
cd backend
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`.

### 5. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📡 API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/auth/google` | Redirect to Google OAuth consent |
| `GET` | `/api/v1/auth/google/callback` | OAuth callback — issues JWT |
| `POST` | `/api/v1/repo/load-repo` | Index a GitHub repository |
| `GET` | `/api/v1/repo/history` | List user's explored repositories |
| `POST` | `/api/v1/repo/analysis` | Generate AI-powered repo analysis |
| `POST` | `/api/v1/repo/chat` | Chat with the indexed repository |
| `GET` | `/api/v1/repo/chat-history` | Fetch previous chat messages |
| `POST` | `/api/v1/generate/stream` | Stream architecture diagram (SSE) |

---

## 📁 Project Structure

```
RepoTalk/
├── backend/
│   ├── app/
│   │   ├── api/v1/routes/     # auth.py, repo.py, graph.py
│   │   ├── core/              # config, security, observability
│   │   ├── db/                # SQLAlchemy models, schemas, session
│   │   ├── services/          # rag, groq, github, graph, mermaid
│   │   └── main.py
│   ├── repository_db/         # FAISS indexes (auto-created)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/        # ChatPanel, Hero, RepoGraph, RepoOverview
    │   ├── context/           # AuthContext, RepoContext, ThemeContext
    │   ├── pages/             # LandingPage, WikiPage
    │   └── layouts/           # RootLayout
    ├── package.json
    └── vite.config.js
```

---

## 📝 Notes

- **GitHub rate limits** — Without `GITHUB_TOKEN`, the GitHub API limits requests to 60/hour. Loading a repo fetches many files, so you will hit this quickly. A Personal Access Token (PAT) is strongly recommended.
- **MySQL required** — The app needs a running MySQL instance. If MySQL is offline, JWT auth still works but DB-dependent features (history, chat persistence, diagram caching) will fail gracefully.
- **Mermaid validation** — The diagram generator optionally validates Mermaid syntax using a [Bun](https://bun.sh/) subprocess (`scripts/validate_mermaid.mjs`). If Bun is not installed, validation is skipped and the diagram is rendered directly.
- **FAISS indexes are shared** — The vector store lives on disk at `repository_db/<owner>_<repo>/` and is shared across all users. Each user gets their own MySQL record for history tracking.

---

## 📄 License

[MIT](LICENSE)
