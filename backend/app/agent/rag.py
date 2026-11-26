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


@lru_cache
def _dense() -> np.ndarray | None:
    from app.ml import embed

    chunks, _, _ = _index()
    return embed.encode([f"{c.title}. {c.text}" for c in chunks])


def search(query: str, k: int = 4) -> list[dict[str, object]]:
    """Hybrid retrieval: TF-IDF (exact terms, policy numbers) + bge-small embeddings (meaning), 50/50."""
    chunks, vec, mat = _index()
    q = vec.transform([query])
    scores = (mat @ q.T).toarray().ravel()
    try:
        from app.ml import embed

        d = _dense()
        qv = embed.encode([query]) if d is not None else None
        if d is not None and qv is not None:
            dense = d @ qv[0]
            lex = scores / (scores.max() or 1.0)
            scores = 0.5 * lex + 0.5 * np.clip((dense - 0.3) / 0.6, 0, 1)
    except Exception:  # noqa: BLE001 — fall back to lexical only
        pass
    top = np.argsort(-scores)[:k]
    return [{"doc": chunks[i].doc, "title": chunks[i].title, "text": chunks[i].text, "score": round(float(scores[i]), 3)}
            for i in top if scores[i] > 0]
