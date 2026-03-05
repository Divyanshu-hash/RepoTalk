from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

def get_embeddings():
    return HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

def build_vector_store(documents):
    """
    Build FAISS vector store from repository documents
    """

    if not documents or len(documents) == 0:
        raise ValueError("No documents found to build vector store")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )

    docs = splitter.create_documents(documents)

    if not docs or len(docs) == 0:
        raise ValueError("Document splitting resulted in zero chunks")

    embeddings = get_embeddings()
    vectorstore = FAISS.from_documents(docs, embeddings)

    return vectorstore

def save_vector_store(vectorstore, path):
    """Save FAISS vector store to disk"""
    vectorstore.save_local(path)

def load_vector_store(path):
    """Load FAISS vector store from disk"""
    embeddings = get_embeddings()
    return FAISS.load_local(path, embeddings, allow_dangerous_deserialization=True)
