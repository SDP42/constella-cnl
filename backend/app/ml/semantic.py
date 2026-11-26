"""Semantic intent: map free-text notes to catalogue categories with pretrained embeddings.

Each category has a short "buyer need" prototype written the way partners actually talk.
A note is matched to prototypes by cosine similarity; anything above a calibrated threshold
becomes an intent signal (lexicon hits from capture.py are kept and shown side by side).
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import numpy as np

from app.data import catalog as C
from app.ml import embed

NEEDS: dict[str, str] = {
    "interactive_display": "smart board for classrooms, digital teaching board, touch screen for training rooms",
    "commercial_monitor": "monitors for office desks, extra screens for staff workstations",
    "digital_signage": "display screens for menus, lobby or showroom advertising",
    "projector": "projector for auditorium, hall or seminar room",
    "enterprise_storage": "more storage, SSDs, data backup, servers running out of disk",
    "mini_pc": "small computers behind displays, compact PCs for kiosks and counters",
    "retail_security": "anti-theft display for phones in store, secure product demo stands",
    "structured_cabling": "network cabling for a new building or campus, LAN wiring, racks",
    "connectivity": "HDMI USB-C hubs, adapters, docking for laptops and meeting tables",
    "air_purifier": "air pollution, bad AQI, clean air for office, school or clinic",
    "home_audio": "speakers and microphones for meeting rooms or stores",
    "action_camera": "action cameras, 360 cameras for creators, vloggers, field teams",
    "memory_cards": "memory cards, SD cards for cameras and devices",
    "gaming_pc": "gaming computers, esports lounge, high end PCs for gaming cafe",
    "gaming_peripherals": "gaming keyboards, mice, headsets, chairs",
    "ai_workstation": "AI workstation for data science, GPU desktop for ML engineers",
    "ai_server": "GPU servers for AI training, on-premise AI cluster, LLM hosting",
    "surveillance": "CCTV cameras, video surveillance for campus, city or warehouse security",
    "fire_safety": "fire alarm, fire safety compliance, smoke detectors, NOC inspection",
    "drone_kits": "drone lab for school STEM education, drone training kits",
    "mobile_accessories": "phone covers, cases, chargers, earphones and mobile accessories for shops",
    "wozoyo_accessories": "everyday accessories, chargers, cables for retail shelves",
    "display_amc": "maintenance contract for displays and AV, service support, AMC",
    "extended_warranty": "extended warranty, protect devices after warranty ends",
    "device_as_a_service": "rent or lease devices monthly instead of buying, subscription, opex",
    "filter_subscription": "replacement filters for air purifiers on schedule",
    "signage_cms": "software to manage content on display screens remotely",
    "cabling_certification": "certify or audit network cabling, fluke test reports",
}
THRESHOLD = 0.58  # top match; runners-up must be within MARGIN of it
MARGIN = 0.05


@lru_cache(maxsize=1)
def _protos() -> tuple[list[str], np.ndarray] | None:
    keys = [k for k in NEEDS if k in C.CATEGORIES]
    v = embed.encode([f"{C.CATEGORIES[k]['label']}: {NEEDS[k]}" for k in keys])
    return None if v is None else (keys, v)


def intents(text: str, top: int = 4) -> list[dict[str, Any]]:
    p = _protos()
    q = embed.encode([text])
    if p is None or q is None:
        return []
    keys, mat = p
    sims = mat @ q[0]
    order = np.argsort(-sims)[:top]
    best = float(sims[order[0]])
    if best < THRESHOLD:
        return []
    return [{"category": keys[i], "label": C.CATEGORIES[keys[i]]["label"], "division": C.CATEGORIES[keys[i]]["div"],
             "similarity": round(float(sims[i]), 3)} for i in order if sims[i] >= max(THRESHOLD, best - MARGIN)]
