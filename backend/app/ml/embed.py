"""Pretrained sentence embeddings (BAAI/bge-small-en-v1.5, MIT licence, ONNX via fastembed — no PyTorch).

Used where meaning matters more than exact words:
  * copilot RAG (hybrid with TF-IDF),
  * intent detection in rep notes ("principal wants every room to have a board" → interactive panels),
  * partner-name dedupe ("Shree Ganesh Infotech" vs "Sri Ganesh Info Tech").
Everything degrades gracefully to the lexical path if the model is unavailable.
"""

from __future__ import annotations

import threading
from functools import lru_cache
from pathlib import Path

import numpy as np

MODEL = "BAAI/bge-small-en-v1.5"
CACHE = Path(__file__).resolve().parents[2] / "data" / "models"
_lock = threading.Lock()


@lru_cache(maxsize=1)
def _model():
    try:
        from fastembed import TextEmbedding

        CACHE.mkdir(parents=True, exist_ok=True)
        return TextEmbedding(MODEL, cache_dir=str(CACHE))
    except Exception:  # noqa: BLE001 — offline / not installed: callers fall back to TF-IDF
        return None


def available() -> bool:
    return _model() is not None


def encode(texts: list[str]) -> np.ndarray | None:
    m = _model()
    if m is None or not texts:
        return None
    with _lock:
        v = np.array(list(m.embed(texts)), dtype=np.float32)
    return v / np.maximum(1e-9, np.linalg.norm(v, axis=1, keepdims=True))


@lru_cache(maxsize=4096)
def encode_one(text: str) -> tuple[float, ...] | None:
    v = encode([text])
    return None if v is None else tuple(v[0].tolist())


def cosine(a: str, b: str) -> float | None:
    va, vb = encode_one(a), encode_one(b)
    if va is None or vb is None:
        return None
    return float(np.dot(va, vb))
