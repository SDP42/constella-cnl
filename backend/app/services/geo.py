"""Geospatial layer: territory twin, open-data demand (OSM Overpass) and site twins.

* Territory: every partner carries lat/lng. Cities roll up spend, wallet, share and leakage.
  Branch catchments use the haversine distance to the nearest CNL branch.
* Demand: the browser runs an OSM Overpass query (bounding circle only, no personal data) for schools,
  colleges, hospitals and clinics near a partner. Each POI type maps to a CNL solution with a typical deal
  size and an attach rate, which gives an **addressable demand** figure in rupees. If Overpass is unreachable, a deterministic synthetic set is scored
  instead and flagged as such.
* Site twin: a solution's bill of materials is laid out as a physical room. Each component is
  coloured owned / missing from the partner's purchase history, so the gap is visible spatially.
"""

from __future__ import annotations

import hashlib
import math
import random
from typing import Any

import pandas as pd

from app.data import catalog as C


# POI type -> (solution id, typical deal ₹, attach rate within 24 months, why)
POI_PLAYS: dict[str, tuple[str, float, float, str]] = {
    "school": ("smart_classroom", 9.5e5, 0.06, "Interactive panels + cabling per school (NEP / PM SHRI digital classrooms)"),
    "college": ("drone_stem_lab", 6.0e5, 0.08, "Drone STEM labs and AI workstations for engineering & polytechnic colleges"),
    "university": ("onprem_ai_pod", 4.5e7, 0.03, "On-prem GPU pods for research groups that cannot send data to cloud"),
    "hospital": ("clinic_command", 2.2e6, 0.05, "Patient-experience displays, surveillance and fire safety (NABH audits)"),
    "clinic": ("healthy_workplace", 1.2e5, 0.04, "Air purifiers + displays for waiting areas"),
    "townhall": ("smart_city_security", 3.0e6, 0.04, "City-surveillance and command-centre tenders"),
}
BRANCHES = list(C.CITIES.keys())  # CNL runs a branch or stocking point in each hub city


def haversine(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def territory(tx: pd.DataFrame, accounts: pd.DataFrame, opps: pd.DataFrame, now: Any) -> dict[str, Any]:
    from datetime import timedelta

    t12 = tx[tx["tx_date"] > now - timedelta(days=365)]
    spend = t12.groupby("account_id")["amount"].sum()
    divs = t12.groupby("account_id")["division_code"].agg(lambda s: sorted(set(s)))
    open_o = opps[opps["status"].isin(["NEW", "ASSIGNED", "ACCEPTED", "CONTACTED", "PROPOSAL", "NEGOTIATION"])] if len(opps) else opps
    top = open_o.sort_values("score", ascending=False).groupby("account_id").first() if len(open_o) else pd.DataFrame()
    open_v = open_o.groupby("account_id")["est_value"].sum() if len(open_o) else pd.Series(dtype=float)
    partners = []
    for a in accounts.itertuples():
        sp = float(spend.get(a.id, 0.0))
        w = float(a.est_annual_tech_spend)
        t = top.loc[a.id] if a.id in top.index else None
        partners.append({
            "id": int(a.id), "name": a.name, "lat": float(a.lat), "lng": float(a.lng), "city": a.city, "region": a.region,
            "type": str(a.account_type).split(".")[-1].lower(), "vertical": a.vertical, "tier": a.tier,
            "spend": round(sp), "wallet": round(w), "share": round(sp / max(1.0, w), 3),
            "leakage": round(max(0.0, w - sp)), "divisions": divs.get(a.id, []), "open": round(float(open_v.get(a.id, 0.0))),
            "top_opp": None if t is None else {"id": int(t["id"]), "title": t["title"], "value": round(float(t["est_value"]))},
        })
    pdf = pd.DataFrame(partners)
    cities = []
    for city, g in pdf.groupby("city"):
        region, lat, lng, _ = C.CITIES[city]
        w, sp = float(g["wallet"].sum()), float(g["spend"].sum())
        cities.append({"city": city, "region": region, "lat": lat, "lng": lng, "partners": int(len(g)),
                       "spend": round(sp), "wallet": round(w), "share": round(sp / max(1.0, w), 3),
                       "leakage": round(float(g["leakage"].sum())), "open": round(float(g["open"].sum())),
                       "single_division": int((g["divisions"].map(len) <= 1).sum())})
    cities.sort(key=lambda c: -c["leakage"])
    # expansion: where is wallet large, share low and partner density thin? (partner-recruitment priority)
    mx = max(c["leakage"] for c in cities) or 1
    for c in cities:
        density = c["partners"] / max(1, len(pdf)) * len(cities)
        c["expansion_score"] = round(0.6 * c["leakage"] / mx + 0.25 * (1 - c["share"]) + 0.15 * max(0.0, 1 - density), 3)
    return {"partners": partners, "cities": cities, "branches": [{"city": b, "lat": C.CITIES[b][1], "lng": C.CITIES[b][2]} for b in BRANCHES],
            "totals": {"wallet": round(float(pdf["wallet"].sum())), "spend": round(float(pdf["spend"].sum())),
                       "leakage": round(float(pdf["leakage"].sum())), "partners": int(len(pdf))}}


def _classify(tags: dict[str, str]) -> str | None:
    am = tags.get("amenity", "")
    if am in ("school", "kindergarten"):
        return "school"
    if am in ("college",):
        return "college"
    if am in ("university",):
        return "university"
    if am in ("hospital",):
        return "hospital"
    if am in ("clinic", "doctors"):
        return "clinic"
    if am in ("townhall",) or tags.get("office") == "government":
        return "townhall"
    return None


def _synthetic(lat: float, lng: float, radius_m: int) -> list[dict[str, Any]]:
    seed = int(hashlib.sha1(f"{lat:.3f},{lng:.3f},{radius_m}".encode()).hexdigest()[:8], 16)
    r = random.Random(seed)
    mix = [("school", 46), ("college", 9), ("hospital", 7), ("clinic", 22), ("university", 1), ("townhall", 2)]
    out = []
    for kind, n in mix:
        for i in range(int(n * radius_m / 3000)):
            d = radius_m * math.sqrt(r.random()) / 111_000
            th = r.random() * 2 * math.pi
            out.append({"id": f"syn-{kind}-{i}", "kind": kind, "name": f"{kind.title()} {i + 1}",
                        "lat": lat + d * math.sin(th), "lng": lng + d * math.cos(th) / math.cos(math.radians(lat))})
    return out


def classify_kind(kind: str) -> str | None:
    return _classify({"amenity": kind}) or (kind if kind in POI_PLAYS else None)


def score_pois(lat: float, lng: float, radius_m: int, items: list[dict[str, Any]] | None, source: str) -> dict[str, Any]:
    """Turn POIs into addressable demand. Items come from the browser's own Overpass call
    (the public endpoint serves browser tools, not servers); without them a deterministic synthetic set is used."""
    radius_m = max(500, min(radius_m, 8000))
    if not items:
        items, source = _synthetic(lat, lng, radius_m), "synthetic"
    counts: dict[str, int] = {}
    for it in items:
        counts[it["kind"]] = counts.get(it["kind"], 0) + 1
    plays, total = [], 0.0
    sol_names = {s["id"]: s["name"] for s in C.SOLUTIONS}
    for kind, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        if kind not in POI_PLAYS:
            continue
        sol, deal, attach, why = POI_PLAYS[kind]
        v = n * deal * attach
        total += v
        plays.append({"kind": kind, "count": n, "solution_id": sol, "solution": sol_names.get(sol, sol), "deal": deal,
                      "attach": attach, "addressable": round(v), "why": why})
    return {"center": {"lat": lat, "lng": lng}, "radius_m": radius_m, "source": source, "pois": items[:800],
            "counts": counts, "plays": plays, "addressable_24m": round(total),
            "attribution": "© OpenStreetMap contributors (ODbL)" if source == "openstreetmap" else "Synthetic POIs (OSM not reached)",
            "how": "addressable = Σ POIs × typical deal × 24-month attach rate (attach rates to be replaced by CNL's measured win history per vertical)."}


# ------------------------------------------------------------------ site twin
LAYOUT: dict[str, list[dict[str, Any]]] = {
    # x,z in metres in a 10×8 room; y height; kind = mesh archetype the frontend draws
    "interactive_display": [{"x": 0, "z": -3.9, "y": 1.4, "mesh": "panel"}],
    "projector": [{"x": 0, "z": 0.5, "y": 2.8, "mesh": "projector"}],
    "mini_pc": [{"x": 1.2, "z": -3.6, "y": 0.9, "mesh": "box"}],
    "structured_cabling": [{"x": 0, "z": 0, "y": 2.95, "mesh": "tray"}],
    "connectivity": [{"x": -2.5, "z": 1.0, "y": 0.78, "mesh": "hub"}],
    "commercial_monitor": [{"x": -4.9, "z": -1, "y": 1.5, "mesh": "monitor"}, {"x": 4.9, "z": -1, "y": 1.5, "mesh": "monitor"}],
    "home_audio": [{"x": -3.5, "z": -3.8, "y": 2.4, "mesh": "speaker"}, {"x": 3.5, "z": -3.8, "y": 2.4, "mesh": "speaker"}],
    "surveillance": [{"x": -4.8, "z": 3.8, "y": 2.8, "mesh": "camera"}, {"x": 4.8, "z": -3.8, "y": 2.8, "mesh": "camera"}],
    "fire_safety": [{"x": 4.8, "z": 3.6, "y": 1.6, "mesh": "panelbox"}, {"x": 0, "z": 2, "y": 2.95, "mesh": "detector"}],
    "air_purifier": [{"x": -4.4, "z": 3.4, "y": 0.5, "mesh": "tower"}, {"x": 4.4, "z": 0.5, "y": 0.5, "mesh": "tower"}],
    "drone_kits": [{"x": -1.5, "z": 1.5, "y": 0.85, "mesh": "drone"}, {"x": 1.5, "z": 1.5, "y": 0.85, "mesh": "drone"}],
    "ai_workstation": [{"x": 3.5, "z": 2.5, "y": 0.9, "mesh": "tower"}],
    "ai_server": [{"x": -4.3, "z": -3.2, "y": 1.0, "mesh": "rack"}],
    "gaming_pc": [{"x": -3, "z": 2.5, "y": 0.9, "mesh": "tower"}, {"x": 3, "z": 2.5, "y": 0.9, "mesh": "tower"}],
    "enterprise_storage": [{"x": -3.6, "z": -3.2, "y": 1.0, "mesh": "rack"}],
}
DEFAULT_SLOT = {"x": 0, "z": 3.5, "y": 0.8, "mesh": "box"}


def site_twin(account: dict[str, Any], owned_cats: set[str], installed: list[dict[str, Any]], solution_id: str | None = None) -> dict[str, Any]:
    fits = [s for s in C.SOLUTIONS if account["vertical"] in s["verticals"]] or C.SOLUTIONS[:1]
    sol = next((s for s in C.SOLUTIONS if s["id"] == solution_id), None) or max(
        fits, key=lambda s: sum(1 for c in s["components"] if c["category"] in owned_cats) / len(s["components"]) + 0.01 * len(s["components"]))
    emp = max(20, int(account.get("employees", 100)))
    comps, owned_v, gap_v = [], 0.0, 0.0
    for c in sol["components"]:
        cat = C.CATEGORIES[c["category"]]
        units = max(1, round(c["per100"] * emp / 100))
        value = units * cat["price"]
        own = c["category"] in owned_cats
        owned_v += value if own else 0
        gap_v += 0 if own else value
        comps.append({"category": c["category"], "label": cat["label"], "role": c["role"], "required": c["required"],
                      "division": cat["div"], "brand": cat["brands"][0], "units": units, "value": round(value),
                      "status": "owned" if own else "missing", "slots": LAYOUT.get(c["category"], [DEFAULT_SLOT])})
    ann = [{"category": a["category"], "label": C.CATEGORIES[a["category"]]["label"],
            "value": round(max(1, round(a["per100"] * emp / 100)) * C.CATEGORIES[a["category"]]["price"])} for a in sol["annuity"]]
    health = []
    for a in installed[:40]:
        age = a.get("age_months", 0)
        health.append({"category": a["category"], "age_months": age, "state": "renewal due" if age >= 30 else "ageing" if age >= 20 else "healthy"})
    return {"account": {"id": account["id"], "name": account["name"], "city": account["city"], "vertical": account["vertical"], "employees": emp},
            "solution": {"id": sol["id"], "name": sol["name"], "tagline": sol["tagline"]},
            "alternatives": [{"id": s["id"], "name": s["name"]} for s in fits],
            "components": comps, "annuity": ann, "owned_value": round(owned_v), "gap_value": round(gap_v),
            "completion": round(owned_v / max(1.0, owned_v + gap_v), 3), "installed_health": health,
            "how": "Units = component density per 100 employees × site size (solution templates). Owned = category in the partner's purchase history."}
