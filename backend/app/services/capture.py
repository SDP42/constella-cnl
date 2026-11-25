"""Whisper capture: turn an unstructured WhatsApp/call note into structured intent signals.

Reps hear buying intent every day ("school tender next month", "opening 6 stores") and it dies
in chat history. A rep pastes or forwards the text; we extract
  * intent themes   -> categories (keyword lexicon, same one the model uses as a feature)
  * quantities      -> deal scale ("40 classrooms", "6 stores")
  * timing          -> urgency ("next month", "this quarter", "tender closing")
  * competitor mention -> leakage risk
Deterministic and auditable on purpose: every extracted field points back to the matched span.
"""

from __future__ import annotations

import re
from typing import Any

from app.data import catalog as C
from app.ml.features import INTENT_KEYWORDS

QTY = re.compile(r"(\d{1,4})\s*(?:-|\s)?\s*(classrooms?|stores?|outlets?|branches?|seats?|rooms?|beds?|units?|screens?|sites?|labs?)", re.I)
TIMING = {
    r"\b(today|tomorrow|this week|asap|urgent)\b": ("immediate", 1.0),
    r"\b(next week|this month|closing)\b": ("this_month", 0.85),
    r"\b(next month|this quarter|q[1-4])\b": ("this_quarter", 0.7),
    r"\b(next quarter|next year|later)\b": ("later", 0.4),
}
COMPETITORS = ["redington", "ingram", "savex", "rashi", "supertron", "tech data", "amazon business"]
EXTRA = {
    "classroom": ["interactive_display", "mini_pc"], "school": ["interactive_display", "structured_cabling"],
    "college": ["interactive_display", "structured_cabling"], "hospital": ["digital_signage", "air_purifier"],
    "pollution": ["air_purifier", "filter_subscription"], "aqi": ["air_purifier"], "smog": ["air_purifier"],
    "meeting room": ["interactive_display", "home_audio", "mini_pc"], "boardroom": ["interactive_display", "home_audio"],
    "cctv": ["structured_cabling"], "network": ["structured_cabling", "connectivity"], "wifi": ["connectivity"],
    "camera": ["action_camera", "memory_cards"], "esports": ["gaming_pc", "gaming_peripherals"],
    "amc": ["display_amc"], "warranty": ["extended_warranty"], "rent": ["device_as_a_service"],
    "lease": ["device_as_a_service"], "subscription": ["device_as_a_service"],
}


def parse(text: str) -> dict[str, Any]:
    low = text.lower()
    hits: dict[str, list[str]] = {}
    for kw, cats in {**INTENT_KEYWORDS, **EXTRA}.items():
        if kw in low:
            for c in cats:
                hits.setdefault(c, []).append(kw)
    qty = [{"qty": int(m.group(1)), "unit": m.group(2).lower(), "span": m.group(0)} for m in QTY.finditer(text)]
    timing, urgency = "unspecified", 0.5
    for pat, (label, u) in TIMING.items():
        if re.search(pat, low):
            timing, urgency = label, u
            break
    competitor = next((c for c in COMPETITORS if c in low), None)
    solutions = []
    for s in C.SOLUTIONS:
        comp = {x["category"] for x in s["components"]}
        overlap = comp & set(hits)
        if len(overlap) >= 2:
            solutions.append({"id": s["id"], "name": s["name"], "matched": sorted(overlap),
                              "coverage": round(len(overlap) / len(comp), 2)})
    solutions.sort(key=lambda x: -x["coverage"])
    categories = [{"category": c, "label": C.CATEGORIES[c]["label"], "division": C.CATEGORIES[c]["div"],
                   "matched": sorted(set(k))} for c, k in hits.items()]
    strength = min(1.0, 0.35 + 0.15 * len(categories) + 0.25 * urgency + (0.1 if qty else 0))
    return {"categories": categories, "quantities": qty, "timing": timing, "urgency": urgency,
            "competitor": competitor, "solutions": solutions[:3], "strength": round(strength, 2)}
