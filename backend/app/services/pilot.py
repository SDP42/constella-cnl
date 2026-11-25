"""6-month pilot design + Monte-Carlo projection with a randomised control group.

Design
  * 20% of accounts (stratified by partner type) are a HOLDOUT: Constella still scores them,
    but nothing is routed. Difference-in-differences vs the treatment group = attributable uplift.
  * Attribution: an order is credited to Constella only if it (a) matches the opportunity's
    categories, (b) lands after the opportunity was assigned, (c) within 120 days. Lead/assist
    credit follows the routing contract. Uplift is reported at group level, so "would have bought
    anyway" is netted out by the control group.

Projection (until real pilot data exists)
  natural conversion in 6 months:  q = 1 - (1 - p)^(180/120)           (model probability, calibrated)
  treated conversion:              q' = q + action_rate * (1 - q) * uplift_kind * q
  run N simulations -> mean + 90% interval for every KPI, per month.
"""

from __future__ import annotations

from typing import Any

import numpy as np

UPLIFT = {"cross_sell": 0.9, "upsell": 0.6, "solution": 1.3, "recurring": 1.8}


def simulate(opps: list[dict[str, Any]], accounts: dict[int, dict[str, Any]], action_rate: float = 0.65,
             uplift_scale: float = 1.0, runs: int = 300, seed: int = 11) -> dict[str, Any]:
    rng = np.random.default_rng(seed)
    if not opps:
        return {}
    p = np.array([o["probability"] for o in opps])
    q = 1 - (1 - p) ** 1.5
    kind = [o["kind"] for o in opps]
    up = np.array([UPLIFT[k] * uplift_scale for k in kind])
    q_t = np.clip(q + action_rate * (1 - q) * up * q, 0, 0.97)
    value = np.array([o["est_value"] for o in opps])
    margin = np.array([o["est_margin"] for o in opps])
    annuity = np.array([o["est_annuity"] for o in opps])
    is_sol = np.array([k == "solution" for k in kind])
    is_rec = np.array([k == "recurring" for k in kind])
    is_x = np.array([k in ("cross_sell", "upsell") for k in kind])
    acc_ids = np.array([o["account_id"] for o in opps])
    hold = np.array([accounts[a]["in_holdout"] for a in acc_ids])
    n_t = max(1, sum(1 for a in accounts.values() if not a["in_holdout"]))
    n_c = max(1, sum(1 for a in accounts.values() if a["in_holdout"]))
    # month of close ~ geometric over 6 months, faster for recurring
    month_p = np.where(is_rec, 0.35, np.where(is_sol, 0.15, 0.22))

    kpis = {k: {"treatment": [], "control": []} for k in
            ("cross_sell_rate", "solution_attach_rate", "arr_per_account", "gp_per_account", "revenue_per_account")}
    monthly_t, monthly_c = np.zeros((runs, 6)), np.zeros((runs, 6))
    for i in range(runs):
        u = rng.random(len(opps))
        # every account follows its group: control converts naturally, treatment with Constella
        win = np.where(hold, u < q, u < q_t)
        months = np.minimum(5, rng.geometric(month_p) - 1)
        for grp, mask, n, store in (("treatment", ~hold, n_t, monthly_t), ("control", hold, n_c, monthly_c)):
            w = win & mask
            kpis["cross_sell_rate"][grp].append(len(set(acc_ids[w & is_x])) / n)
            kpis["solution_attach_rate"][grp].append(len(set(acc_ids[w & is_sol])) / n)
            kpis["arr_per_account"][grp].append(float((annuity * w).sum()) / n)
            kpis["gp_per_account"][grp].append(float((margin * w).sum() + (annuity * w * 0.4).sum()) / n)
            kpis["revenue_per_account"][grp].append(float((value * w).sum()) / n)
            store[i] = np.bincount(months[w], weights=(value + annuity)[w], minlength=6)[:6].cumsum() / n

    def summ(v: list[float]) -> dict[str, float]:
        a = np.array(v)
        return {"mean": round(float(a.mean()), 4), "p5": round(float(np.percentile(a, 5)), 4),
                "p95": round(float(np.percentile(a, 95)), 4)}

    out: dict[str, Any] = {"assumptions": {"action_rate": action_rate, "uplift_scale": uplift_scale, "runs": runs,
                                           "uplift_by_kind": {k: v * uplift_scale for k, v in UPLIFT.items()},
                                           "treatment_accounts": n_t, "control_accounts": n_c}, "kpis": {}}
    for k, d in kpis.items():
        t, c = summ(d["treatment"]), summ(d["control"])
        diff = np.array(d["treatment"]) - np.array(d["control"])
        out["kpis"][k] = {"treatment": t, "control": c,
                          "uplift": {"mean": round(float(diff.mean()), 4), "p5": round(float(np.percentile(diff, 5)), 4),
                                     "p95": round(float(np.percentile(diff, 95)), 4)},
                          "uplift_pct": round(100 * float(diff.mean()) / max(1e-9, c["mean"]), 1)}
    out["monthly"] = [{"month": m + 1, "treatment": round(float(monthly_t[:, m].mean())),
                       "control": round(float(monthly_c[:, m].mean())),
                       "t_lo": round(float(np.percentile(monthly_t[:, m], 5))),
                       "t_hi": round(float(np.percentile(monthly_t[:, m], 95)))} for m in range(6)]
    gp = out["kpis"]["gp_per_account"]
    out["decision"] = decide(gp["uplift"]["p5"], out["kpis"]["arr_per_account"]["uplift_pct"],
                             out["kpis"]["solution_attach_rate"]["uplift_pct"])
    return out


GATES = [
    {"month": 2, "gate": "Adoption", "metric": "≥ 70% of routed opportunities accepted within SLA; ≥ 60% weekly active reps",
     "if_fail": "Fix workflow fit (WhatsApp/ERP integration) before judging the model"},
    {"month": 3, "gate": "Signal quality", "metric": "Back-test precision@5 holds within 20% on live data; < 15% 'not relevant' feedback",
     "if_fail": "Retrain with rep feedback labels; tighten thresholds"},
    {"month": 4, "gate": "Leading revenue", "metric": "Treatment pipeline (₹) ≥ 1.3× control; ≥ 10 solution proposals",
     "if_fail": "Narrow to the 2 best-performing solution templates"},
    {"month": 6, "gate": "Scale / stop", "metric": "GP per account uplift > 0 at 90% confidence AND ARR uplift ≥ 25%",
     "if_fail": "Stop: keep data unification + routing, retire recommendations"},
]


def decide(gp_uplift_p5: float, arr_uplift_pct: float, sol_uplift_pct: float) -> dict[str, Any]:
    if gp_uplift_p5 > 0 and arr_uplift_pct >= 25:
        verdict, msg = "scale", "Gross-profit uplift is positive at 90% confidence and annuity grows ≥25% — roll out to all branches."
    elif gp_uplift_p5 > 0:
        verdict, msg = "extend", "GP uplift is real but annuity is below target — extend 3 months with annuity-first playbooks."
    else:
        verdict, msg = "stop", "No confident GP uplift — stop recommendations, keep the unified data layer."
    return {"verdict": verdict, "message": msg, "gates": GATES, "solution_uplift_pct": sol_uplift_pct}
