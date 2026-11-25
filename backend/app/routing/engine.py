"""Capture & route: who owns an opportunity, who assists, when it escalates.

Routing contract (docs/ROUTING.md):
  1. Lead division
       cross_sell / upsell -> division that owns the category
       solution            -> account owner's division if it supplies >= 1 component (relationship first),
                              else the division with the largest share of the missing value
       recurring           -> SVC desk (digital-first) unless value > ₹2L, then the account owner leads
  2. Lead rep inside that division
       account owner if they sit in that division -> else same-region rep with the lowest load/capacity
  3. Assists (split credit, 70/30 by default — sharing pays, so nobody hoards accounts)
       the account owner when they are not the lead ("relationship assist")
       one rep per other component division ("component assist")
  4. Overlaps: a new opportunity that shares a category with an open one on the same account
     is MERGED into it (assists union, signals appended) — never two reps chasing one PO.
  5. Escalation ladder when nobody acts within SLA
       L1 nudge (WhatsApp/email to lead)  -> L2 reassign to next-best rep + division head
       L3 national sales head review       -> L4 auto digital-nurture campaign (zero headcount)
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any

from app.core.config import get_settings
from app.data import catalog as C

settings = get_settings()

HALF_LIFE_DAYS = {"solution": 60, "cross_sell": 90, "upsell": 45, "recurring": 40}
ESCALATION_LABELS = {0: "On track", 1: "Nudged", 2: "Reassigned", 3: "Head review", 4: "Digital nurture"}


def cost_of_delay(score: float, kind: str, age_days: float) -> dict[str, float]:
    """Signals decay. Value-at-stake halves every H days, so each idle day costs dV/dt."""
    h = HALF_LIFE_DAYS.get(kind, 60)
    lam = math.log(2) / h
    remaining = score * math.exp(-lam * age_days)
    return {"per_day": round(remaining * lam, 2), "remaining_vas": round(remaining, 2), "half_life_days": h,
            "decayed_pct": round(100 * (1 - math.exp(-lam * age_days)), 1)}


class Router:
    def __init__(self, reps: list[dict[str, Any]], accounts: dict[int, dict[str, Any]]):
        self.reps = {r["id"]: r for r in reps}
        self.accounts = accounts
        self.load: dict[int, int] = {r["id"]: 0 for r in reps}
        self.head = next((r for r in reps if r["role"] == "head"), None)
        self.svc_desk = next((r for r in reps if r["division_code"] == "SVC" and r["role"] == "rep"), None)

    def _field_reps(self, div: str, region: str) -> list[dict[str, Any]]:
        out = [r for r in self.reps.values() if r["division_code"] == div and r["role"] == "rep" and r["region"] == region]
        return out or [r for r in self.reps.values() if r["division_code"] == div and r["role"] == "rep"]

    def _least_loaded(self, cands: list[dict[str, Any]], exclude: set[int] | None = None) -> dict[str, Any] | None:
        cands = [c for c in cands if not exclude or c["id"] not in exclude]
        if not cands:
            return None
        return min(cands, key=lambda r: (self.load[r["id"]] / max(1, r["capacity"]), r["id"]))

    def lead_division(self, opp: dict[str, Any], owner: dict[str, Any] | None) -> tuple[str, str]:
        divs = [C.CATEGORIES[c]["div"] for c in opp["categories"]]
        if opp["kind"] in ("cross_sell", "upsell"):
            return divs[0], "Category owner division"
        if opp["kind"] == "recurring":
            if opp["est_value"] > 200000 and owner:
                return owner["division_code"], "High-value annuity: relationship owner leads, SVC assists"
            return "SVC", "Annuity desk (digital-first)"
        if owner and owner["division_code"] in divs:
            return owner["division_code"], "Relationship-first: owner's division supplies a component"
        share: dict[str, float] = {}
        for c in opp["categories"]:
            d = C.CATEGORIES[c]["div"]
            share[d] = share.get(d, 0) + C.CATEGORIES[c]["price"]
        return max(share, key=share.get), "Largest share of solution value"

    def route(self, opp: dict[str, Any]) -> dict[str, Any]:
        acc = self.accounts[opp["account_id"]]
        owner = self.reps.get(acc.get("owner_rep_id"))
        div, why_div = self.lead_division(opp, owner)
        if owner and owner["division_code"] == div and self.load[owner["id"]] < owner["capacity"]:
            lead, why_rep = owner, "Account owner"
        elif div == "SVC" and self.svc_desk:
            lead, why_rep = self._least_loaded(self._field_reps("SVC", acc["region"])) or self.svc_desk, "Annuity desk"
        else:
            lead = self._least_loaded(self._field_reps(div, acc["region"]))
            why_rep = "Same-region rep with most spare capacity"
        assists: list[dict[str, Any]] = []
        if owner and lead and owner["id"] != lead["id"]:
            assists.append({"rep_id": owner["id"], "division": owner["division_code"], "role": "relationship"})
        other_divs = sorted({C.CATEGORIES[c]["div"] for c in opp["categories"]} - {div})
        for d in other_divs:
            if owner and owner["division_code"] == d:
                continue
            r = self._least_loaded(self._field_reps(d, acc["region"]))
            if r:
                assists.append({"rep_id": r["id"], "division": d, "role": "component"})
        n = len(assists)
        lead_share = settings.lead_credit_share if n else 1.0
        for a in assists:
            a["credit"] = round((1 - lead_share) / n, 3)
        if lead:
            self.load[lead["id"]] += 1
        return {"lead_rep_id": lead["id"] if lead else None, "lead_division": div, "assists": assists,
                "routing": {"division_rule": why_div, "rep_rule": why_rep, "lead_credit": lead_share}}

    def next_best(self, opp: dict[str, Any], current: int | None) -> dict[str, Any] | None:
        acc = self.accounts[opp["account_id"]]
        return self._least_loaded(self._field_reps(opp["lead_division"], acc["region"]),
                                  exclude={current} if current else None)


def sla_due(start: datetime, accepted: bool) -> datetime:
    return start + timedelta(hours=settings.sla_contact_hours if accepted else settings.sla_accept_hours)
