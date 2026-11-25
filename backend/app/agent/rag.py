"""Retrieval layer for the copilot: TF-IDF over playbooks/policies (chunked by paragraph).

Kept dependency-light on purpose (scikit-learn only, no external embedding API), so the
knowledge base can contain internal pricing/credit policy without leaving the network.
Swap `TfidfVectorizer` for a sentence-embedding model + pgvector when the corpus grows.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

KB_DIR = Path(__file__).parent / "kb"


@dataclass
class Chunk:
    doc: str
    title: str
    text: str


@lru_cache
def _index() -> tuple[list[Chunk], TfidfVectorizer, np.ndarray]:
    chunks: list[Chunk] = []
    for f in sorted(KB_DIR.glob("*.md")):
        lines = f.read_text().splitlines()
        title = lines[0].lstrip("# ").strip() if lines else f.stem
        for para in "\n".join(lines[1:]).split("\n"):
            if para.strip():
                chunks.append(Chunk(doc=f.stem, title=title, text=para.strip()))
    vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english")
    mat = vec.fit_transform([f"{c.title}. {c.text}" for c in chunks])
    return chunks, vec, mat


def search(query: str, k: int = 4) -> list[dict[str, object]]:
    chunks, vec, mat = _index()
    q = vec.transform([query])
    scores = (mat @ q.T).toarray().ravel()
    top = np.argsort(-scores)[:k]
    return [{"doc": chunks[i].doc, "title": chunks[i].title, "text": chunks[i].text, "score": round(float(scores[i]), 3)}
            for i in top if scores[i] > 0]
