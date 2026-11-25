"""Entity resolution: stitch each division's raw records into one golden Account.

Rules, in order of confidence:
  1. GSTIN exact match                      -> 1.00  (legal identity; PAN = chars 3-12)
  2. PAN match (same legal entity, other state) -> 0.97
  3. Fuzzy name within the same city/pincode block:
       token_set_ratio on normalised names (legal suffixes, branch tags, punctuation removed)
       plus an initials check for abbreviations ("Galaxy Tech Systems" ~ "Galaxy TS")
       accept >= 86, review queue 72-86, reject < 72
Blocking by city keeps it O(n * block) instead of O(n^2) so it scales to the full 10k+ network.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from rapidfuzz import fuzz

LEGAL = re.compile(r"\b(pvt|private|ltd|limited|llp|p|co|inc|the)\b\.?", re.I)
NON_ALNUM = re.compile(r"[^a-z0-9 ]+")


def normalise(name: str, city: str | None = None) -> str:
    s = name.lower()
    if city:
        s = s.replace(f"- {city.lower()}", " ").replace(city.lower(), " ")
    s = s.replace("&", " and ")
    s = NON_ALNUM.sub(" ", s)
    s = LEGAL.sub(" ", s)
    return " ".join(s.split())


def initials(name: str) -> str:
    return "".join(w[0] for w in name.split() if w)


@dataclass
class Match:
    account_id: int | None
    confidence: float
    rule: str


def score_pair(raw: str, golden: str, city: str | None) -> float:
    a, b = normalise(raw, city), normalise(golden, city)
    s = fuzz.token_set_ratio(a, b)
    pa, pb = a.split(), b.split()
    if pa and pb and pa[0] == pb[0]:
        # abbreviation: first token equal and initials of the rest line up
        rest_a = "".join(pa[1:])
        if rest_a and initials(" ".join(pb[1:])).startswith(rest_a[: len(initials(" ".join(pb[1:])))]):
            s = max(s, 90)
    # transposition typos
    s = max(s, fuzz.ratio(a.replace(" ", ""), b.replace(" ", "")))
    return float(s)


def resolve(records: list[dict], accounts: list[dict]) -> tuple[list[Match], dict]:
    by_gstin = {a["gstin"]: a["id"] for a in accounts if a.get("gstin")}
    by_pan = {a["pan"]: a["id"] for a in accounts if a.get("pan")}
    by_city: dict[str, list[dict]] = {}
    for a in accounts:
        by_city.setdefault(a["city"], []).append(a)

    out: list[Match] = []
    for rec in records:
        g = rec.get("raw_gstin")
        if g and g in by_gstin:
            out.append(Match(by_gstin[g], 1.0, "gstin_exact"))
            continue
        if g and g[2:12] in by_pan:
            out.append(Match(by_pan[g[2:12]], 0.97, "pan_match"))
            continue
        best, best_s = None, 0.0
        for a in by_city.get(rec.get("city") or "", []):
            s = score_pair(rec["raw_name"], a["name"], rec.get("city"))
            if s > best_s:
                best, best_s = a, s
        if best and best_s >= 86:
            out.append(Match(best["id"], round(best_s / 100, 3), "fuzzy_name_city"))
        elif best and best_s >= 72:
            out.append(Match(best["id"], round(best_s / 100, 3), "review_queue"))
        else:
            out.append(Match(None, round(best_s / 100, 3), "unmatched"))

    # quality report against synthetic ground truth
    tp = fp = fn = review = 0
    for rec, m in zip(records, out, strict=True):
        truth = rec.get("truth_account_id")
        if m.rule == "review_queue":
            review += 1
        if m.account_id is None:
            fn += 1
        elif m.account_id == truth:
            tp += 1
        else:
            fp += 1
    report = {
        "records": len(records),
        "golden_accounts": len(accounts),
        "auto_matched": sum(1 for m in out if m.rule in ("gstin_exact", "pan_match", "fuzzy_name_city")),
        "review_queue": review,
        "unmatched": sum(1 for m in out if m.account_id is None),
        "precision": round(tp / max(1, tp + fp), 4),
        "recall": round(tp / max(1, tp + fn), 4),
        "by_rule": {r: sum(1 for m in out if m.rule == r) for r in
                    ("gstin_exact", "pan_match", "fuzzy_name_city", "review_queue", "unmatched")},
        "duplicates_collapsed": len(records) - len({m.account_id for m in out if m.account_id}),
    }
    return out, report
