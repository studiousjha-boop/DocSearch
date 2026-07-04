import os
import uuid
import json
import time
import io
import pickle
import numpy as np
from pathlib import Path
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
METADATA_FILE = DATA_DIR / "documents.json"
CHUNKS_FILE = DATA_DIR / "chunks.json"
VECTORIZER_FILE = DATA_DIR / "vectorizer.pkl"
MATRIX_FILE = DATA_DIR / "matrix.npz"

_vectorizer = None   # TfidfVectorizer
_matrix = None       # sparse matrix (N, vocab)
_chunk_meta: List[dict] = []
_documents_cache: Optional[dict] = None


def _rebuild_index():
    """Fit TF-IDF vectorizer and matrix from current chunk_meta."""
    global _vectorizer, _matrix
    from sklearn.feature_extraction.text import TfidfVectorizer
    if not _chunk_meta:
        _vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=50000)
        _matrix = None
        return
    texts = [m["chunk_text"] for m in _chunk_meta]
    _vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=50000)
    _matrix = _vectorizer.fit_transform(texts)


def _load_store():
    global _vectorizer, _matrix, _chunk_meta
    if CHUNKS_FILE.exists():
        with open(CHUNKS_FILE) as f:
            _chunk_meta = json.load(f)
    else:
        _chunk_meta = []

    if VECTORIZER_FILE.exists() and MATRIX_FILE.exists() and _chunk_meta:
        with open(VECTORIZER_FILE, "rb") as f:
            _vectorizer = pickle.load(f)
        data = np.load(str(MATRIX_FILE), allow_pickle=True)
        from scipy.sparse import csr_matrix
        _matrix = csr_matrix(
            (data["data"], data["indices"], data["indptr"]),
            shape=data["shape"]
        )
    else:
        _rebuild_index()


def _save_store():
    with open(CHUNKS_FILE, "w") as f:
        json.dump(_chunk_meta, f)
    if _vectorizer is not None and _matrix is not None:
        with open(VECTORIZER_FILE, "wb") as f:
            pickle.dump(_vectorizer, f)
        np.savez(str(MATRIX_FILE),
                 data=_matrix.data,
                 indices=_matrix.indices,
                 indptr=_matrix.indptr,
                 shape=_matrix.shape)


def _add_chunks(chunks: List[str], doc_id: str, doc_name: str):
    global _chunk_meta
    for i, chunk in enumerate(chunks):
        _chunk_meta.append({
            "document_id": doc_id,
            "document_name": doc_name,
            "chunk_index": i,
            "chunk_text": chunk,
        })
    _rebuild_index()
    _save_store()


def _remove_chunks(doc_id: str):
    global _chunk_meta
    _chunk_meta = [m for m in _chunk_meta if m["document_id"] != doc_id]
    _rebuild_index()
    _save_store()


def _search(query: str, top_k: int, doc_ids: Optional[List[str]] = None) -> List[dict]:
    if not _chunk_meta or _matrix is None or _vectorizer is None:
        return []
    from sklearn.metrics.pairwise import cosine_similarity

    # Filter by doc_ids if provided
    if doc_ids:
        indices = [i for i, m in enumerate(_chunk_meta) if m["document_id"] in doc_ids]
        if not indices:
            return []
        subset_meta = [_chunk_meta[i] for i in indices]
        subset_matrix = _matrix[indices]
    else:
        indices = list(range(len(_chunk_meta)))
        subset_meta = _chunk_meta
        subset_matrix = _matrix

    q_vec = _vectorizer.transform([query])
    scores = cosine_similarity(q_vec, subset_matrix)[0]

    top_k = min(top_k, len(scores))
    top_idx = np.argsort(scores)[::-1][:top_k]
    return [
        {"meta": subset_meta[i], "score": float(scores[i])}
        for i in top_idx
        if scores[i] > 0
    ]


def load_documents() -> dict:
    global _documents_cache
    if _documents_cache is None:
        if METADATA_FILE.exists():
            with open(METADATA_FILE) as f:
                _documents_cache = json.load(f)
        else:
            _documents_cache = {}
    return _documents_cache


def save_documents(docs: dict):
    global _documents_cache
    _documents_cache = docs
    with open(METADATA_FILE, "w") as f:
        json.dump(docs, f, indent=2)


def extract_text(file_bytes: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    elif ext in (".docx", ".doc"):
        import docx
        document = docx.Document(io.BytesIO(file_bytes))
        return "\n".join(para.text for para in document.paragraphs)
    elif ext == ".txt":
        return file_bytes.decode("utf-8", errors="replace")
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    if not text.strip():
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start += chunk_size - overlap
    return chunks


@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_store()
    load_documents()
    yield


app = FastAPI(title="DocSearch RAG API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = FastAPI()


class DocumentOut(BaseModel):
    id: str
    name: str
    status: str
    chunk_count: int
    size_bytes: int
    file_type: str
    created_at: str
    error_message: Optional[str] = None


class DeleteResult(BaseModel):
    success: bool
    message: str


class QueryInput(BaseModel):
    question: str
    top_k: int = 5
    document_ids: Optional[List[str]] = None


class SourceChunk(BaseModel):
    document_id: str
    document_name: str
    chunk_text: str
    score: float
    chunk_index: int


class QueryResult(BaseModel):
    answer: str
    sources: List[SourceChunk]
    has_llm: bool
    question: str
    processing_time_ms: float


class SystemStats(BaseModel):
    total_documents: int
    total_chunks: int
    ready_documents: int
    has_llm: bool
    embedding_model: str
    vector_db: str


class HealthStatus(BaseModel):
    status: str


@api.get("/healthz", response_model=HealthStatus)
def health_check():
    return {"status": "ok"}


@api.get("/documents", response_model=List[DocumentOut])
def list_documents():
    return list(load_documents().values())


@api.post("/documents", response_model=DocumentOut)
async def upload_document(file: UploadFile = File(...)):
    allowed = {".pdf", ".docx", ".doc", ".txt"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed:
        raise HTTPException(400, detail=f"Unsupported file type: {ext}. Allowed: {', '.join(allowed)}")

    doc_id = str(uuid.uuid4())
    file_bytes = await file.read()

    docs = load_documents()
    doc_record = {
        "id": doc_id,
        "name": file.filename,
        "status": "processing",
        "chunk_count": 0,
        "size_bytes": len(file_bytes),
        "file_type": ext.lstrip("."),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "error_message": None,
    }
    docs[doc_id] = doc_record
    save_documents(docs)

    try:
        text = extract_text(file_bytes, file.filename)
        chunks = chunk_text(text)
        if not chunks:
            raise ValueError("No text could be extracted from this file.")
        _add_chunks(chunks, doc_id, file.filename)
        doc_record["status"] = "ready"
        doc_record["chunk_count"] = len(chunks)
    except Exception as e:
        doc_record["status"] = "error"
        doc_record["error_message"] = str(e)

    docs[doc_id] = doc_record
    save_documents(docs)
    return doc_record


@api.get("/documents/{id}", response_model=DocumentOut)
def get_document(id: str):
    docs = load_documents()
    if id not in docs:
        raise HTTPException(404, detail="Document not found")
    return docs[id]


@api.delete("/documents/{id}", response_model=DeleteResult)
def delete_document(id: str):
    docs = load_documents()
    if id not in docs:
        raise HTTPException(404, detail="Document not found")
    _remove_chunks(id)
    del docs[id]
    save_documents(docs)
    return {"success": True, "message": "Document deleted"}


@api.post("/query", response_model=QueryResult)
def query_documents(body: QueryInput):
    start_t = time.time()
    docs = load_documents()
    if not any(d["status"] == "ready" for d in docs.values()):
        raise HTTPException(400, detail="No documents indexed yet. Please upload documents first.")

    results = _search(body.question, body.top_k, body.document_ids)

    sources = [
        SourceChunk(
            document_id=r["meta"]["document_id"],
            document_name=r["meta"]["document_name"],
            chunk_text=r["meta"]["chunk_text"],
            score=round(r["score"], 4),
            chunk_index=r["meta"]["chunk_index"],
        )
        for r in results
    ]

    has_llm = False
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")

    if openrouter_key and sources:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openrouter_key, base_url="https://openrouter.ai/api/v1")
            context = "\n\n---\n\n".join(
                f"[From: {s.document_name}]\n{s.chunk_text}" for s in sources[:5]
            )
            response = client.chat.completions.create(
                model="openai/gpt-oss-120b:free",
                max_tokens=1024,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a helpful assistant. Answer the question using ONLY the provided document excerpts. "
                            "If the answer is not in the excerpts, say so clearly."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Document excerpts:\n{context}\n\nQuestion: {body.question}",
                    },
                ],
            )
            answer = response.choices[0].message.content.strip()
            has_llm = True
        except Exception as e:
            answer = f"LLM error: {e}\n\n" + _format_chunks(sources)
    elif sources:
        answer = _format_chunks(sources)
    else:
        answer = "No relevant content found in your documents for this question."

    return QueryResult(
        answer=answer,
        sources=sources,
        has_llm=has_llm,
        question=body.question,
        processing_time_ms=round((time.time() - start_t) * 1000, 1),
    )


def _format_chunks(sources: List[SourceChunk]) -> str:
    lines = ["Here are the most relevant passages from your documents:\n"]
    for i, s in enumerate(sources, 1):
        lines.append(f"**{i}. From: {s.document_name}** (relevance: {s.score:.0%})")
        lines.append(s.chunk_text.strip())
        lines.append("")
    return "\n".join(lines)


@api.get("/stats", response_model=SystemStats)
def get_stats():
    docs = load_documents()
    return SystemStats(
        total_documents=len(docs),
        total_chunks=len(_chunk_meta),
        ready_documents=sum(1 for d in docs.values() if d["status"] == "ready"),
        has_llm=bool(os.environ.get("OPENROUTER_API_KEY", "")),
        embedding_model="TF-IDF (all-MiniLM-L6-v2 optional)",
        vector_db="In-memory TF-IDF index",
    )


app.mount("/api", api)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
