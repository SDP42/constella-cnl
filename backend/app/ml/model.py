"""Next-best-category propensity model + honest back-test.

Technique (justification in docs/MODEL.md):
  * Candidate generation is *explainable* (co-purchase lift, item-item cosine, peer adoption,
    solution coverage, intent notes, seasonality).
  * A gradient-boosted tree (sklearn HistGradientBoosting) learns how to weigh those signals
    against account context (size, recency, credit, silo membership). Trees handle the
    non-linear interactions (e.g. "seasonal AND in North AND owns no purifier") without
    hand-tuning, train in seconds on CPU and stay explainable via reason codes.
  * Evaluated with a time-split back-test: features at T-120d, labels = what the account
    actually bought in the next 120 days. Compared against three baselines.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

from app.data import catalog as C
from app.ml.features import CATEGORICAL, FEATURES, snapshot

FEATURE_LABELS = {
    "cf_score": "Similar accounts' baskets", "rule_lift": "Co-purchase lift", "rule_conf": "Rule confidence",
    "peer_adoption": "Peer adoption", "solution_coverage": "Solution already part-built",
    "vertical_fit": "Industry fit", "div_affinity": "Channel-type fit", "owns_division": "Already buys this division",
    "n_categories": "Basket breadth", "n_divisions": "Divisions engaged", "recency_days": "Days since last order",
    "frequency_12m": "Orders (12m)", "log_monetary_12m": "Spend (12m)", "growth_ratio": "Spend momentum",
    "log_employees": "Company size", "credit_headroom": "Credit headroom", "avg_payment_days": "Payment days",
    "season": "Seasonal window", "intent": "Intent in notes", "annuity_base": "Installed base present",
    "cat_margin": "Category margin", "cat_wc_days": "Category cash cycle", "type_code": "Partner type",
    "vertical_code": "Industry",
}


@dataclass
class TrainedModel:
    clf: HistGradientBoostingClassifier
    metrics: dict[str, Any]
    importances: dict[str, float]
    medians: dict[str, float]
    iqr: dict[str, float]
    ctx: dict = field(default_factory=dict)


def _make_clf() -> HistGradientBoostingClassifier:
    mask = [f in CATEGORICAL for f in FEATURES]
    return HistGradientBoostingClassifier(
        max_iter=260, learning_rate=0.06, max_leaf_nodes=24, min_samples_leaf=30,
        l2_regularization=0.5, categorical_features=mask, random_state=7,
    )


def _ece(y: np.ndarray, p: np.ndarray, bins: int = 10) -> float:
    """Expected calibration error over equal-width probability bins."""
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(p, edges) - 1, 0, bins - 1)
    err = 0.0
    for b in range(bins):
        m = idx == b
        if m.any():
            err += m.mean() * abs(float(p[m].mean()) - float(y[m].mean()))
    return round(float(err), 4)


def _ranking_metrics(df: pd.DataFrame, score_col: str, k: int) -> dict[str, float]:
    precs, recs, ndcgs, hits = [], [], [], []
    for _, g in df.groupby("account_id"):
        pos = g["label"].sum()
        if pos == 0:
            continue
        top = g.nlargest(k, score_col)
        rel = top["label"].values
        precs.append(rel.sum() / k)
        recs.append(rel.sum() / pos)
        hits.append(1.0 if rel.sum() > 0 else 0.0)
        dcg = float((rel / np.log2(np.arange(2, len(rel) + 2))).sum())
        ideal = np.ones(int(min(pos, k)))
        idcg = float((ideal / np.log2(np.arange(2, len(ideal) + 2))).sum())
        ndcgs.append(dcg / idcg if idcg else 0.0)
    return {
        f"precision@{k}": round(float(np.mean(precs)), 4) if precs else 0.0,
        f"recall@{k}": round(float(np.mean(recs)), 4) if recs else 0.0,
        f"ndcg@{k}": round(float(np.mean(ndcgs)), 4) if ndcgs else 0.0,
        f"hit_rate@{k}": round(float(np.mean(hits)), 4) if hits else 0.0,
        "accounts_evaluated": len(precs),
    }


def train_and_evaluate(tx: pd.DataFrame, accounts: pd.DataFrame, interactions: pd.DataFrame,
                       now: date, horizon: int, k: int = 5) -> tuple[TrainedModel, pd.DataFrame]:
    eval_cut = now - timedelta(days=horizon)
    train_cut = eval_cut - timedelta(days=horizon)
    train_df, _ = snapshot(tx, accounts, interactions, train_cut, horizon)
    eval_df, _ = snapshot(tx, accounts, interactions, eval_cut, horizon)

    raw = _make_clf().fit(train_df[FEATURES], train_df["label"])
    eval_df["p_raw"] = raw.predict_proba(eval_df[FEATURES])[:, 1]
    # isotonic calibration (3-fold, inside the training window only) so probabilities mean what they say
    clf = CalibratedClassifierCV(_make_clf(), method="isotonic", cv=3).fit(train_df[FEATURES], train_df["label"])
    eval_df["p_model"] = clf.predict_proba(eval_df[FEATURES])[:, 1]
    # baselines
    eval_df["p_popularity"] = eval_df["peer_adoption"]
    eval_df["p_cf"] = eval_df["cf_score"]
    eval_df["p_rules"] = eval_df["rule_lift"] * eval_df["rule_conf"]

    y = eval_df["label"]
    metrics: dict[str, Any] = {
        "train_cutoff": str(train_cut), "eval_cutoff": str(eval_cut), "horizon_days": horizon,
        "train_pairs": int(len(train_df)), "eval_pairs": int(len(eval_df)),
        "train_positive_rate": round(float(train_df["label"].mean()), 4),
        "eval_positive_rate": round(float(y.mean()), 4),
        "models": {},
    }
    for name, col in [("constella_gbm", "p_model"), ("popularity", "p_popularity"),
                      ("item_cf", "p_cf"), ("association_rules", "p_rules")]:
        m = {
            "auc": round(float(roc_auc_score(y, eval_df[col])), 4),
            "avg_precision": round(float(average_precision_score(y, eval_df[col])), 4),
        }
        m.update(_ranking_metrics(eval_df, col, k))
        metrics["models"][name] = m
    metrics["brier"] = round(float(brier_score_loss(y, eval_df["p_model"])), 4)
    metrics["brier_uncalibrated"] = round(float(brier_score_loss(y, eval_df["p_raw"])), 4)
    metrics["ece"] = _ece(y.values, eval_df["p_model"].values)
    metrics["ece_uncalibrated"] = _ece(y.values, eval_df["p_raw"].values)

    # value-weighted accuracy: of all gross profit partners actually generated in new categories in the test window,
    # how much sits in each method's top-k per partner? (Constella ranks by p × category gross profit.)
    gp_unit = eval_df["category"].map(lambda c: C.CATEGORIES[c]["price"] * C.CATEGORIES[c]["margin"])
    eval_df["gp_real"] = eval_df["label"] * gp_unit
    eval_df["s_value"] = eval_df["p_model"] * gp_unit
    total_gp = float(eval_df["gp_real"].sum()) or 1.0
    vc = {}
    for name, col in [("constella_value_ranked", "s_value"), ("constella_probability_ranked", "p_model"), ("popularity", "p_popularity")]:
        got = sum(float(g.nlargest(k, col)["gp_real"].sum()) for _, g in eval_df.groupby("account_id"))
        vc[name] = round(got / total_gp, 4)
    metrics["gp_capture@5"] = vc
    metrics["gp_capture_lift_vs_popularity"] = round(vc["constella_value_ranked"] / max(1e-9, vc["popularity"]), 2)

    # calibration (deciles)
    eval_df["bin"] = pd.qcut(eval_df["p_model"].rank(method="first"), 10, labels=False)
    calib = eval_df.groupby("bin").agg(pred=("p_model", "mean"), actual=("label", "mean"), n=("label", "size"))
    metrics["calibration"] = [{"bin": int(i), "predicted": round(float(r.pred), 4),
                               "actual": round(float(r.actual), 4), "n": int(r.n)} for i, r in calib.iterrows()]
    # lift curve: share of all future purchases captured in top x% of scored pairs
    srt = eval_df.sort_values("p_model", ascending=False)
    cum = srt["label"].cumsum() / max(1, srt["label"].sum())
    metrics["gain_curve"] = [{"pct_pairs": p, "pct_captured": round(float(cum.iloc[int(len(srt) * p / 100) - 1]), 4)}
                             for p in (5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100)]
    base = metrics["models"]["popularity"][f"precision@{k}"] or 1e-9
    metrics["lift_vs_popularity"] = round(metrics["models"]["constella_gbm"][f"precision@{k}"] / base, 2)

    # per-category accuracy
    per_cat = []
    for cat, g in eval_df.groupby("category"):
        if g["label"].nunique() < 2:
            continue
        per_cat.append({"category": cat, "auc": round(float(roc_auc_score(g["label"], g["p_model"])), 3),
                        "positives": int(g["label"].sum())})
    metrics["per_category"] = sorted(per_cat, key=lambda x: -x["positives"])

    sample = eval_df.sample(min(6000, len(eval_df)), random_state=1)
    pi = permutation_importance(clf, sample[FEATURES], sample["label"], scoring="average_precision",
                                n_repeats=3, random_state=1)
    imp = {f: max(0.0, float(v)) for f, v in zip(FEATURES, pi.importances_mean, strict=True)}
    tot = sum(imp.values()) or 1.0
    imp = {f: round(v / tot, 4) for f, v in sorted(imp.items(), key=lambda kv: -kv[1])}
    metrics["feature_importance"] = [{"feature": f, "label": FEATURE_LABELS[f], "importance": v} for f, v in imp.items()]

    # final model: train on both windows (more recent data) for live scoring
    full = pd.concat([train_df, eval_df[train_df.columns]], ignore_index=True)
    final = CalibratedClassifierCV(_make_clf(), method="isotonic", cv=3).fit(full[FEATURES], full["label"])
    med = full[FEATURES].median().to_dict()
    q = full[FEATURES].quantile([0.25, 0.75])
    iqr = {f: float(max(1e-6, q.loc[0.75, f] - q.loc[0.25, f])) for f in FEATURES}
    return TrainedModel(final, metrics, imp, med, iqr), eval_df


def reason_codes(row: pd.Series, model: TrainedModel, top: int = 4) -> list[dict[str, Any]]:
    """Local explanation: global importance x standardised deviation from the median."""
    out = []
    for f, w in model.importances.items():
        if f in CATEGORICAL or w <= 0:
            continue
        dev = (float(row[f]) - model.medians[f]) / model.iqr[f]
        if f in ("recency_days", "avg_payment_days", "cat_wc_days"):
            dev = -dev  # lower is better
        contrib = float(np.clip(dev, -3, 3) * w)
        if abs(contrib) > 1e-4:
            out.append({"feature": f, "label": FEATURE_LABELS[f], "value": round(float(row[f]), 3),
                        "contribution": round(contrib, 4)})
    out.sort(key=lambda x: -abs(x["contribution"]))
    return out[:top]
