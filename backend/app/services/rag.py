import os
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

# ──────────────────────────────────────────────
# Embeddings (singleton — loaded once per worker)
# ──────────────────────────────────────────────
_embeddings: HuggingFaceEmbeddings | None = None


def get_embeddings() -> HuggingFaceEmbeddings:
    """Return a cached HuggingFace embeddings instance."""
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
    return _embeddings


# ──────────────────────────────────────────────
# Vector store operations
# ──────────────────────────────────────────────
def build_vector_store(documents: list[str]) -> FAISS:
    """
    Split raw document strings and build a FAISS vector store.

    Args:
        documents: List of formatted file-content strings.

    Returns:
        A ready-to-use FAISS vectorstore.

    Raises:
        ValueError: If documents list is empty or splits to zero chunks.
    """
    if not documents:
        raise ValueError("No documents provided to build vector store.")

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    docs = splitter.create_documents(documents)

    if not docs:
        raise ValueError("Document splitting produced zero chunks.")

    return FAISS.from_documents(docs, get_embeddings())


def save_vector_store(vectorstore: FAISS, path: str | Path) -> None:
    """Persist a FAISS vector store to disk."""
    vectorstore.save_local(str(path))


def load_vector_store(path: str | Path) -> FAISS:
    """Load a FAISS vector store from disk."""
    return FAISS.load_local(
        str(path),
        get_embeddings(),
        allow_dangerous_deserialization=True,
    )
