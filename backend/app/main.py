from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware



app = FastAPI(
    title="RepoTalk",
    description="GitHub Codebase Chatbot",
    version="1.0.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include


@app.get("/")
def root():
    return {"message": "RepoTalk API", "docs": "/docs"}

@app.get("/health")
def read_root():
    return {"message": "RepoTalk API is running", "status": "online"}