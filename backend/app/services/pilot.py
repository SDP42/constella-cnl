"""6-month pilot design + Monte-Carlo projection with a randomised control group.

Design
  * 20% of accounts (stratified by partner type) are a HOLDOUT: Constella still scores them,
    but nothing is routed. Difference-in-differences vs the treatment group = attributable uplift.
  * Attribution: an order is credited to Constella only if it (a) matches the opportunity's
    categories, (b) lands after the opportunity was assigned, (c) within 120 days. Lead/assist
    credit follows the routing contract. Uplift is reported at group level, so "would have bought
    anyway" is netted out by the control group.

Projection (until real pilot data exists)
  natural conversion in 6 months:  q = 1 - (1 - p)^(180/120)           (isotonic-calibrated model probability)
  treated conversion:              q' = q + action_rate * (1 - q) * uplift_kind * q
  run N simulations -> mean + 90% interval for every KPI, per month.
"""

from __future__ import annotations

from typing import Any

import numpy as np

UPLIFT = {"cross_sell": 0.9, "upsell": 0.6, "solution": 1.3, "recurring": 1.8}
# Assumptions, not measurements — the pilot exists to replace them with observed values.
UPLIFT_RATIONALE = {
    "cross_sell": "Proactive outreach on a scored whitespace roughly doubles a low natural conversion rate; directional evidence: "
                  "McKinsey reports next-best-action programmes in B2B distribution lifting bookings (mckinsey.com distribution blog).",
    "upsell": "Smaller lift: the partner already buys the category, so the natural rate is higher and outreach adds less.",
    "solution": "Bundling removes the coordination cost of buying from several divisions; one PO and one owner is the main lever.",
    "recurring": "Largest lift: annuity attach is near zero today because nobody owns the offer (Avaus: hardware buyers' next-best "
                 "offer is usually the service); a zero-touch renewal playbook reaches every installed unit.",
}


def _metrics(win: np.ndarray, mask: np.ndarray, acc_ids: np.ndarray, n: int, is_x, is_sol, value, margin, annuity) -> dict[str, float]:
    w = win & mask
    return {
        "cross_sell_rate": len(set(acc_ids[w & is_x])) / n,
        "solution_attach_rate": len(set(acc_ids[w & is_sol])) / n,
        "arr_per_account": float((annuity * w).sum()) / n,
        "gp_per_account": float((margin * w).sum() + (annuity * w * 0.4).sum()) / n,
        "revenue_per_account": float((value * w).sum()) / n,
    }


def simulate(opps: list[dict[str, Any]], accounts: dict[int, dict[str, Any]], action_rate: float = 0.65,
             uplift_scale: float = 1.0, runs: int = 300, seed: int = 11) -> dict[str, Any]:
    """Treatment vs a control-calibrated counterfactual (difference-in-differences style).

    For each run the SAME random draws decide (a) what treatment partners buy with Constella (q_t) and
    (b) what they would have bought anyway (q) — common random numbers remove group-composition noise.
    The holdout group then measures how far reality sits from the model's natural rate (observed ÷ expected);
    that ratio scales the counterfactual. Uplift = treatment − calibrated counterfactual.
    """
    rng = np.random.default_rng(seed)
    if not opps:
        return {}
    p = np.array([o["probability"] for o in opps])
    q = 1 - (1 - p) ** 1.5  # 120-day probability → 6-month horizon
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
    month_p = np.where(is_rec, 0.35, np.where(is_sol, 0.15, 0.22))
    args = (acc_ids, None, is_x, is_sol, value, margin, annuity)

    # expected natural outcome of the control group (for its observed/expected calibration ratio)
    exp_c = {k: 0.0 for k in ("cross_sell_rate", "solution_attach_rate", "arr_per_account", "gp_per_account", "revenue_per_account")}
    for _ in range(60):
        m = _metrics(rng.random(len(opps)) < q, hold, acc_ids, n_c, is_x, is_sol, value, margin, annuity)
        for k in exp_c:
            exp_c[k] += m[k] / 60

    keys = list(exp_c)
    T = {k: [] for k in keys}
    CF = {k: [] for k in keys}
    UP = {k: [] for k in keys}
    monthly_t, monthly_c = np.zeros((runs, 6)), np.zeros((runs, 6))
    for i in range(runs):
        u = rng.random(len(opps))
        win_t = u < q_t          # treatment partners, worked by Constella
        win_cf = u < q           # the same partners, had nothing changed
        ctrl = _metrics(u < q, hold, acc_ids, n_c, is_x, is_sol, value, margin, annuity)
        t = _metrics(win_t, ~hold, acc_ids, n_t, is_x, is_sol, value, margin, annuity)
        cf = _metrics(win_cf, ~hold, acc_ids, n_t, is_x, is_sol, value, margin, annuity)
        for k in keys:
            ratio = float(np.clip(ctrl[k] / exp_c[k], 0.5, 1.5)) if exp_c[k] > 0 else 1.0
            T[k].append(t[k])
            CF[k].append(cf[k] * ratio)
            UP[k].append(t[k] - cf[k] * ratio)
        months = np.minimum(5, rng.geometric(month_p) - 1)
        mt, mc = win_t & ~hold, win_cf & ~hold
        monthly_t[i] = np.bincount(months[mt], weights=(value + annuity)[mt], minlength=6)[:6].cumsum() / n_t
        monthly_c[i] = np.bincount(months[mc], weights=(value + annuity)[mc], minlength=6)[:6].cumsum() / n_t

    def summ(v: list[float]) -> dict[str, float]:
        a = np.array(v)
        return {"mean": round(float(a.mean()), 4), "p5": round(float(np.percentile(a, 5)), 4),
                "p95": round(float(np.percentile(a, 95)), 4)}

    out: dict[str, Any] = {"assumptions": {"action_rate": action_rate, "uplift_scale": uplift_scale, "runs": runs,
                                           "uplift_by_kind": {k: v * uplift_scale for k, v in UPLIFT.items()},
                                           "uplift_rationale": UPLIFT_RATIONALE,
                                           "treatment_accounts": n_t, "control_accounts": n_c,
                                           "method": "treatment vs control-calibrated counterfactual on common random numbers"},
                           "kpis": {}}
    for k in keys:
        t, c, d = summ(T[k]), summ(CF[k]), summ(UP[k])
        out["kpis"][k] = {"treatment": t, "control": c, "uplift": d,
                          "uplift_pct": round(100 * d["mean"] / max(1e-9, c["mean"]), 1)}
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
