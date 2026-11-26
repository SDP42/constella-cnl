"""Turn scored whitespace into ranked, explained opportunities and the signals behind them.

Opportunity ladder (product -> integrated solution -> annuity):
  cross_sell : one category the account has never bought from CNL
  upsell     : move an active category up the range (Essential -> Pro/Max) when momentum is high
  solution   : an account has part of a solution template; recommend the missing components as ONE deal
  recurring  : installed base without its annuity (filters, AMC, CMS, certification) or a renewal due

Ranking metric = Value-at-Stake (VaS), CNL's Quadrant logic turned into a number:
  VaS = P(win) x gross margin x cash velocity x credit factor  +  P(win) x 3-yr annuity margin
  cash velocity = 1 / (1 + working-capital days / 60)
  credit factor = 1 if the deal fits the partner's credit headroom, else 0.6 (flagged)
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd

from app.data import catalog as C
from app.ml.features import FEATURES, INTENT_KEYWORDS
from app.ml.model import TrainedModel, reason_codes

LABEL = {c: s["label"] for c, s in C.CATEGORIES.items()}
SOL = {s["id"]: s for s in C.SOLUTIONS}


def _fmt_inr(v: float) -> str:
    if v >= 1e7:
        return f"₹{v / 1e7:.2f} Cr"
    if v >= 1e5:
        return f"₹{v / 1e5:.1f} L"
    return f"₹{v:,.0f}"


def velocity(wc_days: float) -> float:
    return 1.0 / (1.0 + wc_days / 60.0)


class OpportunityBuilder:
    def __init__(self, model: TrainedModel, accounts: pd.DataFrame, products: pd.DataFrame,
                 tx: pd.DataFrame, assets: pd.DataFrame, interactions: pd.DataFrame, now: datetime):
        self.m = model
        self.acc = accounts.set_index("id")
        self.products = products
        self.tx = tx
        self.assets = assets
        self.interactions = interactions
        self.now = now
        self.avg_price = products.groupby("category")["unit_price"].mean().to_dict()
        # typical first-order size per (type, category) from history
        first = tx.sort_values("tx_date").groupby(["account_id", "category"]).first().reset_index()
        first = first.merge(accounts[["id", "account_type", "employees"]], left_on="account_id", right_on="id")
        first["per_emp"] = first["amount"] / first["employees"].clip(lower=5)
        self.first_per_emp = first.groupby(["account_type", "category"])["per_emp"].median().to_dict()
        self.first_median = first.groupby("category")["amount"].median().to_dict()
        self.signals: list[dict[str, Any]] = []
        self.opps: list[dict[str, Any]] = []
        self._sig_id = 0

    # ------------------------------------------------------------------ helpers
    def _signal(self, aid: int, kind: str, title: str, strength: float, source: str, **payload: Any) -> int:
        self._sig_id += 1
        self.signals.append({"id": self._sig_id, "account_id": int(aid), "kind": kind, "title": title,
                             "strength": round(float(strength), 3), "source": source, "payload": payload,
                             "created_at": self.now - timedelta(hours=int(np.random.default_rng(self._sig_id).integers(1, 240)))})
        return self._sig_id

    def _est_value(self, aid: int, cat: str) -> float:
        a = self.acc.loc[aid]
        per = self.first_per_emp.get((a["account_type"], cat))
        if per is None or not np.isfinite(per):
            return float(self.first_median.get(cat, self.avg_price.get(cat, 10000) * 3))
        v = per * max(5, a["employees"])
        lo, hi = self.avg_price.get(cat, 1000), self.first_median.get(cat, 1e5) * 4
        return float(np.clip(v, lo, max(lo, hi)))

    @staticmethod
    def _units(a: pd.Series) -> float:
        """Deal scale: own headcount for end-customers, project throughput for channel partners."""
        if a["account_type"] in ("enterprise", "retailer"):
            return max(1.0, a["employees"] / 100)
        return float(np.clip(a["est_annual_tech_spend"] / 6e6, 1.0, 8.0))

    def _vas(self, p: float, value: float, margin_pct: float, wc: float, annuity: float, ann_margin: float,
             headroom: float) -> tuple[float, bool]:
        fits = value <= headroom
        credit = 1.0 if fits else 0.6
        vas = p * value * margin_pct * velocity(wc) * credit + p * annuity * ann_margin * 3
        return float(vas), fits

    def _pitch(self, a: pd.Series, title: str, why: list[str], value: float) -> dict[str, str]:
        first = why[0] if why else "it fits how you're growing"
        wa = (f"Hi {a['name']} team 👋 — quick one from Creative Newtech. {title}. "
              f"Why now: {first.lower()}. We can bundle it as one PO with a single point of contact, "
              f"credit within your limit. Shall I share a proposal this week?")
        email = (f"Subject: {title} — one proposal, one point of contact\n\n"
                 f"Hello {a['name']} team,\n\nBased on what you already run with us, we've put together "
                 f"{title.lower()} (indicative value {_fmt_inr(value)}).\n\nWhy we think it fits:\n"
                 + "\n".join(f"  • {w}" for w in why[:4])
                 + "\n\nHappy to walk you through it — 20 minutes this week?\n\nRegards,\nCreative Newtech")
        return {"whatsapp": wa, "email": email}

    # ------------------------------------------------------------------ main
    def build(self, live: pd.DataFrame) -> None:
        live = live.copy()
        live["p"] = self.m.clf.predict_proba(live[FEATURES])[:, 1]
        by_acc = {aid: g for aid, g in live.groupby("account_id")}
        owned_by_acc = self.tx.groupby("account_id")["category"].agg(set).to_dict()
        annuity_cats = set(C.ANNUITY_FOR.values())
        notes = self.interactions[self.interactions["ts"] > self.now - timedelta(days=150)]
        notes_by_acc = defaultdict(list)
        for row in notes.itertuples():
            notes_by_acc[row.account_id].append(row)

        last6 = self.tx[self.tx["tx_date"] > (self.now - timedelta(days=182)).date()].groupby("account_id")["amount"].sum()
        prev6 = self.tx[(self.tx["tx_date"] <= (self.now - timedelta(days=182)).date()) &
                        (self.tx["tx_date"] > (self.now - timedelta(days=365)).date())].groupby("account_id")["amount"].sum()

        for aid, a in self.acc.iterrows():
            g = by_acc.get(aid)
            owned = owned_by_acc.get(aid, set())
            headroom = max(0.0, a["credit_limit"] - a["credit_used"])
            acc_opps: list[dict[str, Any]] = []
            pmap = dict(zip(g["category"], g["p"], strict=True)) if g is not None else {}
            rows = {r.category: r for r in g.itertuples()} if g is not None else {}

            # -------- account-level signals
            for n in notes_by_acc.get(aid, []):
                if any(k in n.note.lower() for k in INTENT_KEYWORDS):
                    self._signal(aid, "intent_note", f"Intent captured: “{n.note}”", 0.8, f"{n.channel} note", note=n.note)
            s6, p6 = float(last6.get(aid, 0)), float(prev6.get(aid, 0))
            if p6 > 0 and s6 / p6 > 1.6:
                self._signal(aid, "growth_spike", f"Spend up {s6 / p6:.1f}× vs previous 6 months", min(1, s6 / p6 / 3), "erp", ratio=s6 / p6)
            if p6 > 0 and s6 / p6 < 0.45:
                self._signal(aid, "churn_risk", f"Spend down {100 * (1 - s6 / p6):.0f}% — possible leakage to another distributor",
                             0.7, "erp", ratio=s6 / p6)
            if headroom / max(1, a["credit_limit"]) < 0.12:
                self._signal(aid, "credit_constraint", "Credit limit nearly exhausted — route via credit review", 0.6, "finance")
            wallet_share = float(self.tx[self.tx["account_id"] == aid]["amount"].sum()) / 2 / max(1.0, a["est_annual_tech_spend"])

            # -------- solutions
            sol_cats: set[str] = set()
            for s in C.SOLUTIONS:
                if a["vertical"] not in s["verticals"]:
                    continue
                comps = s["components"]
                req = [c for c in comps if c["required"]]
                have_req = [c for c in req if c["category"] in owned]
                missing = [c for c in comps if c["category"] not in owned]
                if not missing:
                    continue
                coverage = len(have_req) / len(req)
                intent_hit = any(c["category"] in rows and rows[c["category"]].intent > 0 for c in missing)
                if coverage < 0.34 and not intent_hit:
                    continue
                miss_req = [c for c in missing if c["required"]] or missing
                pr = [pmap.get(c["category"], 0.05) for c in miss_req]
                p_sol = float(np.clip(np.mean(pr) * (1.2 + coverage) + (0.12 if intent_hit else 0), 0.02, 0.92))
                units = self._units(a)
                value = sum(max(1, round(c["per100"] * units)) * self.avg_price[c["category"]] for c in missing)
                value = min(value, a["est_annual_tech_spend"] * 0.35)
                margin = sum(C.CATEGORIES[c["category"]]["margin"] * self.avg_price[c["category"]] for c in missing) / \
                    sum(self.avg_price[c["category"]] for c in missing)
                wc = float(np.mean([C.CATEGORIES[c["category"]]["wc"] for c in missing]))
                annuity = sum(max(1, round(x["per100"] * units)) * self.avg_price[x["category"]] *
                              (12 / C.CATEGORIES[x["category"]]["recurring"]) for x in s["annuity"]
                              if x["category"] not in owned)
                annuity = min(annuity, a["est_annual_tech_spend"] * 0.06)
                vas, fits = self._vas(p_sol, value, margin, wc, annuity, 0.4, headroom)
                divs = sorted({C.CATEGORIES[c["category"]]["div"] for c in missing})
                sid = self._signal(aid, "solution_gap", f"{s['name']}: {len(have_req)}/{len(req)} core components in place",
                                   coverage, "constella", solution=s["id"])
                why = [f"Already runs {', '.join(LABEL[c['category']] for c in have_req) or 'none of the core yet'}"
                       f" — {len(have_req)}/{len(req)} of a {s['name']}",
                       f"Missing pieces span {len(divs)} division(s): {', '.join(divs)} — today no single team sees this"]
                if intent_hit:
                    why.insert(0, "Recent conversation signals an active project")
                if annuity:
                    why.append(f"Adds {_fmt_inr(annuity)}/yr recurring ({', '.join(LABEL[x['category']] for x in s['annuity'])})")
                acc_opps.append({
                    "kind": "solution", "title": f"{s['name']} solution for {a['name']}",
                    "categories": [c["category"] for c in missing], "solution_id": s["id"],
                    "est_value": round(value, -2), "est_margin": round(value * margin, -1), "est_annuity": round(annuity, -2),
                    "probability": round(p_sol, 3), "score": round(vas, 2), "signal_ids": [sid],
                    "explanation": {"why": why, "coverage": coverage, "have": [c["category"] for c in have_req],
                                    "missing": [{"category": c["category"], "role": c["role"], "required": c["required"],
                                                 "p": round(pmap.get(c["category"], 0.05), 3)} for c in missing],
                                    "fits_credit": fits, "divisions": divs, "wallet_share": round(wallet_share, 3)},
                })
                if p_sol >= 0.15:
                    sol_cats.update(c["category"] for c in missing)

            # -------- cross-sell (skip categories already folded into a solution: overlap rule #1)
            if g is not None:
                for r in g.sort_values("p", ascending=False).head(6).itertuples():
                    c = r.category
                    if c in sol_cats or c in annuity_cats or r.p < 0.08:
                        continue
                    spec = C.CATEGORIES[c]
                    value = self._est_value(aid, c)
                    ann_cat = C.ANNUITY_FOR.get(c)
                    annuity = 0.0
                    if ann_cat:
                        annuity = value * 0.08
                    vas, fits = self._vas(r.p, value, spec["margin"], spec["wc"], annuity, 0.4, headroom)
                    row = live.loc[(live["account_id"] == aid) & (live["category"] == c)].iloc[0]
                    codes = reason_codes(row, self.m)
                    why = []
                    if isinstance(row["_note"], str):
                        why.append(f"Partner said: “{row['_note']}”")
                    if isinstance(row["_antecedent"], str):
                        why.append(f"Accounts that buy {LABEL[row['_antecedent']]} adopt {spec['label']} "
                                   f"{row['rule_lift']:.1f}× more often")
                    if row["peer_adoption"] > 0:
                        why.append(f"{row['peer_adoption'] * 100:.0f}% of similar {a['vertical'].replace('_', ' ')} "
                                   f"{a['account_type'].replace('_', ' ')}s already buy {spec['label']}")
                    if row["owns_division"] == 0:
                        why.append(f"Never bought from {spec['div']} — invisible to that division today")
                    if row["season"] > 0:
                        why.append("Seasonal demand window opens in the next 120 days")
                    sid = self._signal(aid, "whitespace", f"{spec['label']} whitespace (p={r.p:.2f})", r.p, "constella",
                                       category=c)
                    acc_opps.append({
                        "kind": "cross_sell", "title": f"Introduce {spec['label']} to {a['name']}",
                        "categories": [c], "solution_id": None, "est_value": round(value, -2),
                        "est_margin": round(value * spec["margin"], -1), "est_annuity": round(annuity, -2),
                        "probability": round(float(r.p), 3), "score": round(vas, 2), "signal_ids": [sid],
                        "explanation": {"why": why, "reason_codes": codes, "fits_credit": fits,
                                        "divisions": [spec["div"]], "wallet_share": round(wallet_share, 3)},
                    })

            # -------- recurring: installed base without annuity + renewals
            acc_assets = self.assets[self.assets["account_id"] == aid]
            for base, ann in C.ANNUITY_FOR.items():
                inst = acc_assets[acc_assets["category"] == base]
                if inst.empty:
                    continue
                qty = int(inst["qty"].sum())
                period = C.CATEGORIES[ann]["recurring"]
                annual = min(qty * self.avg_price[ann] * (12 / period), a["est_annual_tech_spend"] * 0.03)
                if ann not in owned:
                    p = float(np.clip(pmap.get(ann, 0.25) + 0.15, 0.1, 0.85))
                    vas, fits = self._vas(p, annual, C.CATEGORIES[ann]["margin"], C.CATEGORIES[ann]["wc"], annual,
                                          C.CATEGORIES[ann]["margin"], headroom)
                    sid = self._signal(aid, "annuity_gap", f"{qty} × {LABEL[base]} installed with no {LABEL[ann]}",
                                       0.7, "installed_base", base=base, annuity=ann, qty=qty)
                    acc_opps.append({
                        "kind": "recurring", "title": f"Attach {LABEL[ann]} to {qty} installed {LABEL[base]}",
                        "categories": [ann], "solution_id": None, "est_value": round(annual, -2),
                        "est_margin": round(annual * C.CATEGORIES[ann]["margin"], -1), "est_annuity": round(annual, -2),
                        "probability": round(p, 3), "score": round(vas, 2), "signal_ids": [sid],
                        "explanation": {"why": [f"{qty} {LABEL[base]} installed since {inst['installed_on'].min()}",
                                                f"No {LABEL[ann]} on record — {_fmt_inr(annual)}/yr annuity left on the table",
                                                f"{C.CATEGORIES[ann]['margin'] * 100:.0f}% margin, near-zero working capital"],
                                        "fits_credit": fits, "divisions": ["SVC"], "wallet_share": round(wallet_share, 3)},
                    })
                else:
                    due = inst["next_service_due"].dropna()
                    soon = due[(pd.to_datetime(due) <= self.now + timedelta(days=45))]
                    if not soon.empty:
                        p = 0.72
                        vas, fits = self._vas(p, annual, C.CATEGORIES[ann]["margin"], 5, annual, C.CATEGORIES[ann]["margin"], headroom)
                        sid = self._signal(aid, "replenishment_due", f"{LABEL[ann]} renewal due {soon.min()}", 0.9,
                                           "installed_base", annuity=ann)
                        acc_opps.append({
                            "kind": "recurring", "title": f"Renew {LABEL[ann]} ({qty} units)", "categories": [ann],
                            "solution_id": None, "est_value": round(annual, -2),
                            "est_margin": round(annual * C.CATEGORIES[ann]["margin"], -1), "est_annuity": round(annual, -2),
                            "probability": p, "score": round(vas, 2), "signal_ids": [sid],
                            "explanation": {"why": [f"Renewal due {soon.min()}", "Auto-renew offer drafted for the partner"],
                                            "fits_credit": fits, "divisions": ["SVC"], "wallet_share": round(wallet_share, 3)},
                        })

            # -------- upsell: strong momentum on Essential-tier SKUs
            acc_tx = self.tx[self.tx["account_id"] == aid]
            if not acc_tx.empty and p6 > 0 and s6 / p6 > 1.3:
                ess = acc_tx[acc_tx["sku"].str.endswith("0")]
                if len(ess) >= 3:
                    cat = ess["category"].value_counts().idxmax()
                    spec = C.CATEGORIES[cat]
                    value = float(ess[ess["category"] == cat]["amount"].mean() * 0.5 * 4)
                    p = 0.34
                    vas, fits = self._vas(p, value, spec["margin"] * 1.25, spec["wc"], 0, 0, headroom)
                    sid = self._signal(aid, "upsell_momentum", f"Buying Essential-tier {spec['label']} with rising volume",
                                       0.5, "erp", category=cat)
                    acc_opps.append({
                        "kind": "upsell", "title": f"Upgrade {spec['label']} from Essential to Pro range",
                        "categories": [cat], "solution_id": None, "est_value": round(value, -2),
                        "est_margin": round(value * spec["margin"] * 1.25, -1), "est_annuity": 0.0, "probability": p,
                        "score": round(vas, 2), "signal_ids": [sid],
                        "explanation": {"why": [f"Spend up {s6 / p6:.1f}× in 6 months",
                                                f"{len(ess)} Essential-tier orders — Pro range carries ~25% more margin"],
                                        "fits_credit": fits, "divisions": [spec["div"]], "wallet_share": round(wallet_share, 3)},
                    })

            acc_opps.sort(key=lambda o: -o["score"])
            # keep a balanced ladder: at most one annuity play per account in the top list
            picked, seen_rec = [], False
            for o in acc_opps:
                if o["kind"] == "recurring":
                    if seen_rec:
                        continue
                    seen_rec = True
                picked.append(o)
            for o in picked[:4]:
                if o["probability"] < 0.06:
                    continue
                o["account_id"] = int(aid)
                o["explanation"]["pitch"] = self._pitch(a, o["title"], o["explanation"]["why"], o["est_value"])
                self.opps.append(o)
