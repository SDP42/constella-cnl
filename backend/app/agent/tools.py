"""Tools the copilot can call. Each one reuses the API layer, so RBAC, territory scoping and
PII masking apply to the agent exactly as they apply to the logged-in user."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from fastapi import HTTPException
from sqlmodel import Session, select

from app.agent import rag
from app.api import accounts as acc_api
from app.api import opportunities as opp_api
from app.api import platform as plat_api
from app.api.schemas import ComposeIn, PilotIn
from app.core.security import Principal
from app.data import catalog as C
from app.models import Account


def _schema(props: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {"type": "object", "properties": props, "required": required, "additionalProperties": False}


TOOL_SPECS: list[dict[str, Any]] = [
    {"name": "search_accounts", "description": "Find partner accounts by name or city. Returns ids to use with other tools.",
     "input_schema": _schema({"query": {"type": "string", "description": "Name or city fragment"}}, ["query"])},
    {"name": "get_account_twin",
     "description": "Unified cross-division view of one account: wallet share, what it buys from each division, "
                    "top whitespace categories with model probability, solution coverage and open opportunities.",
     "input_schema": _schema({"account_id": {"type": "integer"}}, ["account_id"])},
    {"name": "list_open_opportunities",
     "description": "Open opportunities visible to the current user, ranked by value-at-stake. Optionally filter to one account.",
     "input_schema": _schema({"account_id": {"type": "integer", "description": "Account id, or 0 for all accounts"},
                              "limit": {"type": "integer"}}, ["account_id", "limit"])},
    {"name": "compose_solution",
     "description": "Build a bill of materials for a solution template for an account (skips components already owned). "
                    "solution_id is one of: " + ", ".join(s["id"] for s in C.SOLUTIONS),
     "input_schema": _schema({"account_id": {"type": "integer"}, "solution_id": {"type": "string"}}, ["account_id", "solution_id"])},
    {"name": "shape_deal",
     "description": "Compare as-is, phased and Device-as-a-Service shapes for an opportunity against the partner's credit headroom.",
     "input_schema": _schema({"opportunity_id": {"type": "integer"}}, ["opportunity_id"])},
    {"name": "search_playbooks",
     "description": "Search internal sales playbooks, routing contract, credit policy and data rules.",
     "input_schema": _schema({"query": {"type": "string"}}, ["query"])},
    {"name": "get_today_actions", "description": "The current user's ranked 'today's 10 actions' (deals, SLA breaches, reorders, churn calls, scheme slabs).",
     "input_schema": _schema({}, [])},
    {"name": "credit_worklist", "description": "Partners with overdue exposure and credit grade, ranked for collections, plus grade distribution.",
     "input_schema": _schema({"limit": {"type": "integer"}}, ["limit"])},
    {"name": "bi_summary", "description": "Revenue trend, 6-month forecast, brand-business share vs 40% FY29 target and anomalies.",
     "input_schema": _schema({}, [])},
    {"name": "scheme_slabs", "description": "Partners closest to the next brand-scheme rebate slab (₹ gap and rebate gained).",
     "input_schema": _schema({"limit": {"type": "integer"}}, ["limit"])},
    {"name": "annuity_summary", "description": "Annuity ARR, net revenue retention, attach rate and renewals due in 90 days.",
     "input_schema": _schema({}, [])},
    {"name": "simulate_pilot",
     "description": "Project the 6-month pilot (treatment vs randomised control) for a given rep action rate (0-1).",
     "input_schema": _schema({"action_rate": {"type": "number"}}, ["action_rate"])},
]


def _compact_twin(t: dict[str, Any]) -> dict[str, Any]:
    a = t["account"]
    owned = [c for c in t["categories"] if c["owned"]]
    ws = sorted([c for c in t["categories"] if not c["owned"] and c["probability"]], key=lambda c: -c["probability"])[:6]
    return {
        "account": {k: a[k] for k in ("id", "name", "type", "vertical", "city", "tier", "gstin", "spend_12m",
                                      "est_annual_tech_spend", "wallet_share", "credit_headroom")},
        "owner": t["owner"],
        "buys_by_division": [{"division": d["name"], "spend": d["spend"], "categories": d["categories_owned"]} for d in t["divisions"]],
        "owned_categories": [c["label"] for c in owned],
        "top_whitespace": [{"category": c["label"], "division": c["division"], "probability": c["probability"],
                            "peer_adoption": c["peer_adoption"]} for c in ws],
        "solutions": [{"id": s["id"], "name": s["name"], "fit": s["fit"], "coverage": s["coverage"]} for s in t["solutions"][:4]],
        "open_opportunities": [{"id": o["id"], "title": o["title"], "kind": o["kind"], "value": o["est_value"],
                                "probability": o["probability"], "status": o["status"],
                                "lead": (o["lead_rep"] or {}).get("name"), "why": o["why"][:3]}
                               for o in t["opportunities"][:5]],
        "recent_signals": [x["title"] for x in t["signals"][:5]],
    }


def run_tool(name: str, args: dict[str, Any], s: Session, p: Principal) -> dict[str, Any]:
    try:
        if name == "search_accounts":
            q = str(args["query"]).lower()
            rows = [a for a in s.exec(select(Account)).all() if q in a.name.lower() or q in a.city.lower()]
            return {"results": [{"id": a.id, "name": a.name, "city": a.city, "type": a.account_type.value} for a in rows[:10]]}
        if name == "get_account_twin":
            return _compact_twin(acc_api.account_twin(int(args["account_id"]), s, p))
        if name == "list_open_opportunities":
            r = opp_api.list_opportunities(s, p, None, None, None, None, (args.get("account_id") or None), True, False, "score",
                                           int(args.get("limit") or 8), 0)
            return {"total": r["total"], "items": [{"id": o["id"], "account": o["account"]["name"], "title": o["title"],
                                                    "kind": o["kind"], "value": o["est_value"], "p": o["probability"],
                                                    "status": o["status"], "sla_breached": o["sla_breached"],
                                                    "cost_of_delay_per_day": o["cost_of_delay"]["per_day"]} for o in r["items"]]}
        if name == "compose_solution":
            r = plat_api.compose(ComposeIn(account_id=int(args["account_id"]), solution_id=str(args["solution_id"])), s, p)
            return {"solution": r["solution"]["name"], "totals": r["totals"],
                    "lines": [{k: l_[k] for k in ("label", "brand", "qty", "amount", "division", "already_owned")} for l_ in r["lines"]],
                    "annuity": r["annuity"]}
        if name == "shape_deal":
            return opp_api.shape_deal(int(args["opportunity_id"]), s, p)
        if name == "search_playbooks":
            return {"results": rag.search(str(args["query"]), k=4)}
        if name == "get_today_actions":
            from app.api import finance as fin_api
            if not p.rep_id:
                return {"error": "Only sales reps have a personal action list."}
            return fin_api.today(p.rep_id, s, p)
        if name == "credit_worklist":
            from app.api import finance as fin_api
            sc = fin_api.credit(s, p, 5)
            return {"grade_distribution": sc["distribution"], "headroom_unlock": sc["headroom_unlock"],
                    "worklist": fin_api.worklist(s, p, int(args.get("limit") or 6))}
        if name == "bi_summary":
            if not p.can("read:all"):
                return {"error": "BI overview is available to the sales head, architects and stewards."}
            from app.api import insights as ins_api
            o = ins_api.bi_overview(s, p)
            return {"kpis": o["kpis"], "next_6m": o["forecast"]["forecast"], "anomalies": o["anomalies"][:3]}
        if name == "scheme_slabs":
            from app.api import finance as fin_api
            return {"items": fin_api.schemes(s, p, int(args.get("limit") or 5))}
        if name == "annuity_summary":
            from app.api import finance as fin_api
            a = fin_api.annuity(s, p)
            return {k: a[k] for k in ("arr", "arr_prev", "nrr", "attach_rate", "renewals_due_90d")} | {"renewals": a["renewals"][:5]}
        if name == "simulate_pilot":
            if not p.can("pilot"):
                return {"error": "Only the sales head can run pilot projections."}
            r = plat_api.pilot(PilotIn(action_rate=float(args["action_rate"]), runs=150), s, p)
            return {"uplift_pct": {k: v["uplift_pct"] for k, v in r["kpis"].items()}, "decision": r["decision"]["verdict"]}
        return {"error": f"unknown tool {name}"}
    except HTTPException as e:
        return {"error": f"{e.status_code}: {e.detail}"}
    except (KeyError, ValueError, TypeError) as e:
        return {"error": f"bad arguments: {e}"}


def as_text(result: dict[str, Any]) -> str:
    return json.dumps(result, default=str)[:12000]


ToolFn = Callable[[str, dict[str, Any], Session, Principal], dict[str, Any]]
