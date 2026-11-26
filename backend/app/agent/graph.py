"""Constella Copilot — a LangGraph workflow over the revenue platform.

    START -> retrieve (RAG over playbooks) -> plan (llm or offline?) -> act -> guard -> END

* act/llm     : Claude tool-use loop via the official Anthropic SDK (claude-opus-5-5, server-side refusal
                fallback enabled). Tools are the platform's own APIs, executed with the caller's identity,
                so RBAC / territory / PII rules hold for the agent too.
* act/offline : deterministic planner used when no Anthropic credential is configured — keeps the demo
                and CI fully working without network access.
* guard       : masks GSTIN/PAN patterns for roles without `pii:view`, attaches citations and a step trace.
"""

from __future__ import annotations

import os
import re
import time
from typing import Any, TypedDict

from sqlmodel import Session

from app.agent import rag
from app.agent.tools import TOOL_SPECS, as_text, run_tool
from app.core.security import Principal
from app.data import catalog as C

MODEL = "claude-opus-5-5"
MAX_STEPS = 6
GSTIN_RE = re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b")
PAN_RE = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")

ROLE_BRIEF = {
    "rep": "The user is a field sales rep. Be tactical: what to do today, which partner to call, what to pitch, what to say. Prefer get_today_actions, list_open_opportunities, get_account_twin and scheme_slabs.",
    "head": "The user is the national sales head. Be strategic: pipeline health, escalations, forecast vs FY29 goal, where to intervene. Prefer bi_summary, list_open_opportunities, credit_worklist and simulate_pilot.",
    "architect": "The user is a solutions architect. Think in bills of materials, solution templates and deal shape. Prefer compose_solution, shape_deal and get_account_twin.",
    "steward": "The user is the data & RevOps steward. Focus on data quality, unification and model trust. Explain how numbers are computed.",
    "partner": "The user is a channel partner (TechNova). Speak as CNL's single point of contact; only discuss their own proposals.",
}

SYSTEM = """You are Constella Copilot, the revenue co-pilot for Creative Newtech's sales teams (a B2B technology
distributor moving from selling products to selling integrated solutions and annuity services).

How to work:
- Ground every claim in tool results or the retrieved playbook excerpts. If a number is not in a tool result, do not state it.
- Prefer margin and cash velocity over raw revenue: Creative Newtech runs at about 3-4% EBITDA.
- When a deal exceeds credit headroom, check shape_deal before recommending it.
- Name the next concrete action, who owns it, and why now.
- Never reveal GSTIN, PAN or phone numbers; tools already mask them for the user's role.
- Answer in under 220 words with short bullet points and rupee values (₹, lakh/crore)."""


class CopilotState(TypedDict, total=False):
    question: str
    account_id: int | None
    principal: Principal
    session: Session
    retrieved: list[dict[str, Any]]
    mode: str
    steps: list[dict[str, Any]]
    answer: str
    citations: list[dict[str, Any]]
    error: str | None


def llm_available() -> bool:
    mode = os.getenv("CONSTELLA_AGENT_MODE", "auto")
    if mode == "offline":
        return False
    if mode == "llm":
        return True
    return bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"))


# ---------------------------------------------------------------- nodes
def retrieve(state: CopilotState) -> CopilotState:
    return {"retrieved": rag.search(state["question"], k=4),
            "steps": [*state.get("steps", []), {"node": "retrieve", "detail": "Searched playbooks & policies"}]}


def plan(state: CopilotState) -> CopilotState:
    mode = "llm" if llm_available() else "offline"
    return {"mode": mode, "steps": [*state["steps"], {"node": "plan", "detail": f"mode={mode}"}]}


def act_llm(state: CopilotState) -> CopilotState:
    import anthropic  # lazy: only loaded when an API key is configured (keeps the free-tier footprint small)

    client = anthropic.Anthropic()
    s, p = state["session"], state["principal"]
    context = "\n".join(f"[{i + 1}] ({r['title']}) {r['text']}" for i, r in enumerate(state["retrieved"]))
    user = (f"User: {p.name} (role: {p.role}). {ROLE_BRIEF.get(p.role, '')}\n"
            + (f"Focus account id: {state['account_id']}.\n" if state.get("account_id") else "")
            + f"Retrieved playbook excerpts:\n{context or '(none)'}\n\nQuestion: {state['question']}")
    messages: list[dict[str, Any]] = [{"role": "user", "content": user}]
    tools = [{**t, "strict": True} for t in TOOL_SPECS]
    steps = list(state["steps"])
    try:
        for _ in range(MAX_STEPS):
            resp = client.beta.messages.create(
                model=MODEL, max_tokens=16000, system=SYSTEM, tools=tools, messages=messages,
                output_config={"effort": "medium"},
                betas=["server-side-fallback-2026-07-01"], fallbacks="default",
            )
            if resp.stop_reason == "refusal":
                return {"answer": "I can't help with that request.", "steps": steps, "error": "refusal"}
            if resp.stop_reason == "pause_turn":
                messages.append({"role": "assistant", "content": resp.content})
                continue
            tool_uses = [b for b in resp.content if b.type == "tool_use"]
            if resp.stop_reason != "tool_use" or not tool_uses:
                text = "\n".join(b.text for b in resp.content if b.type == "text").strip()
                return {"answer": text, "steps": steps}
            messages.append({"role": "assistant", "content": resp.content})
            results = []
            for tu in tool_uses:
                t0 = time.perf_counter()
                out = run_tool(tu.name, dict(tu.input), s, p)
                steps.append({"node": "tool", "tool": tu.name, "input": dict(tu.input),
                              "ms": round((time.perf_counter() - t0) * 1000), "ok": "error" not in out})
                results.append({"type": "tool_result", "tool_use_id": tu.id, "content": as_text(out),
                                **({"is_error": True} if "error" in out else {})})
            messages.append({"role": "user", "content": results})
        return {"answer": "I ran out of steps before finishing — try a narrower question.", "steps": steps}
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError, anthropic.APIConnectionError) as e:
        steps.append({"node": "act_llm", "detail": f"LLM unavailable ({type(e).__name__}) — falling back to offline planner"})
        return act_offline({**state, "steps": steps})
    except anthropic.RateLimitError:
        steps.append({"node": "act_llm", "detail": "rate limited — falling back to offline planner"})
        return act_offline({**state, "steps": steps})
    except anthropic.APIStatusError as e:
        steps.append({"node": "act_llm", "detail": f"API error {e.status_code} — falling back to offline planner"})
        return act_offline({**state, "steps": steps})


def _fmt(v: float) -> str:
    return f"₹{v / 1e7:.2f} Cr" if v >= 1e7 else f"₹{v / 1e5:.1f} L" if v >= 1e5 else f"₹{v:,.0f}"


def act_offline(state: CopilotState) -> CopilotState:
    """Deterministic planner: keyword intent -> tool sequence -> templated, grounded answer."""
    s, p, q = state["session"], state["principal"], state["question"].lower()
    steps = list(state["steps"])

    def call(name: str, args: dict[str, Any]) -> dict[str, Any]:
        t0 = time.perf_counter()
        out = run_tool(name, args, s, p)
        steps.append({"node": "tool", "tool": name, "input": args, "ms": round((time.perf_counter() - t0) * 1000),
                      "ok": "error" not in out})
        return out

    aid = state.get("account_id")
    if not aid:
        m = re.search(r"#(\d+)|account (\d+)", q)
        if m:
            aid = int(m.group(1) or m.group(2))
    if not aid:
        for word in re.findall(r"[a-z]{4,}", q):
            hits = call("search_accounts", {"query": word})["results"] if word not in ("what", "should", "which", "about",
                                                                                         "account", "today", "pilot", "deal") else []
            if len(hits) == 1:
                aid = hits[0]["id"]
                break
    lines: list[str] = []
    if any(k in q for k in ("today", "my day", "what should i do", "priorit", "plan my")):
        r = call("get_today_actions", {})
        if "error" in r:
            lines.append(r["error"])
        else:
            lines.append(f"**Your top actions for {r['date']}:**")
            for i, a in enumerate(r["actions"][:6], 1):
                lines.append(f"- {i}. {a['title']} — {a['why']}")
            return {"answer": "\n".join(lines), "steps": steps}
    if any(k in q for k in ("credit", "overdue", "collect", "payment", "owe", "dues", "outstanding", "receivable")):
        r = call("credit_worklist", {"limit": 5})
        lines.append(f"**Credit view:** grades {r['grade_distribution']} · {_fmt(r['headroom_unlock'])} of limit could be safely raised for A/B partners.")
        for w in r["worklist"][:5]:
            lines.append(f"- {w['name']} (grade {w['grade']}): {_fmt(w['overdue'])} overdue, {w['payment_days']} days — {w['action']}")
    if any(k in q for k in ("forecast", "fy29", "revenue trend", "brand share", "anomal")):
        r = call("bi_summary", {})
        if "error" in r:
            lines.append(r["error"])
        else:
            k = r["kpis"]
            lines.append(f"**Business pulse:** 12m revenue {_fmt(k['revenue_12m'])} ({k['growth_yoy'] * 100:.0f}% YoY), next 6 months forecast "
                         f"{_fmt(k['next_6m_forecast'])}; brand-business share {k['brand_share_latest'] * 100:.0f}% vs 40% FY29 target.")
    if any(k in q for k in ("scheme", "slab", "rebate")):
        r = call("scheme_slabs", {"limit": 5})
        lines.append("**Closest to the next rebate slab:**")
        for x in r["items"][:5]:
            lines.append(f"- {x['name']}: {_fmt(x['gap'])} more {x['brand']} unlocks {x['next_rebate'] * 100:.1f}% (+{_fmt(x['rebate_gain'])})")
    if any(k in q for k in ("annuity", "renewal", "recurring", "arr")):
        r = call("annuity_summary", {})
        lines.append(f"**Annuity:** ARR {_fmt(r['arr'])} (was {_fmt(r['arr_prev'])}), NRR {r['nrr'] * 100:.0f}%, attach rate {r['attach_rate'] * 100:.0f}%, "
                     f"{r['renewals_due_90d']} renewals due in 90 days.")
    if any(k in q for k in ("pilot", "prove", "uplift", "scale or stop")):
        r = call("simulate_pilot", {"action_rate": 0.65})
        if "error" in r:
            lines.append(r["error"])
        else:
            u = r["uplift_pct"]
            lines += [f"**6-month pilot projection (treatment vs randomised control):** verdict **{r['decision'].upper()}**.",
                      f"- GP per account +{u['gp_per_account']}%, annuity (ARR) per account +{u['arr_per_account']}%",
                      f"- Cross-sell rate +{u['cross_sell_rate']}%, solution attach +{u['solution_attach_rate']}%"]
    if aid:
        t = call("get_account_twin", {"account_id": aid})
        if "error" in t:
            lines.append(f"I can't open account {aid}: {t['error']}")
        else:
            a = t["account"]
            lines.append(f"**{a['name']}** ({a['type'].replace('_', ' ')}, {a['vertical'].replace('_', ' ')}, {a['city']}) — "
                         f"wallet share {a['wallet_share'] * 100:.0f}% of an estimated {_fmt(a['est_annual_tech_spend'])}/yr.")
            silent = [d["division"] for d in t["buys_by_division"] if d["spend"] == 0]
            if silent:
                lines.append(f"- Never bought from: {', '.join(silent)} — invisible to those teams today.")
            for w in t["top_whitespace"][:3]:
                lines.append(f"- Whitespace: {w['category']} ({w['division']}) — {w['probability'] * 100:.0f}% likely next 120 days")
            sol = next((x for x in t["solutions"] if x["fit"] and x["coverage"] < 1), None)
            if sol and any(k in q for k in ("solution", "bundle", "bom", "propose", "next", "what", "pitch")):
                b = call("compose_solution", {"account_id": aid, "solution_id": sol["id"]})
                if "error" not in b:
                    tt = b["totals"]
                    lines.append(f"- **{b['solution']}** gap: {_fmt(tt['hardware'])} hardware at {tt['gp_pct'] * 100:.0f}% GP "
                                 f"+ {_fmt(tt['arr'])}/yr annuity; fits credit: {'yes' if tt['fits_credit'] else 'no'}.")
            if t["open_opportunities"]:
                o = t["open_opportunities"][0]
                lines.append(f"- **Next action:** {o['title']} — {_fmt(o['value'])} at {o['probability'] * 100:.0f}%, "
                             f"lead {o['lead'] or 'unassigned'}. Why: {o['why'][0] if o['why'] else 'model signal'}.")
                if any(k in q for k in ("credit", "daas", "shape", "finance", "afford")):
                    sh = call("shape_deal", {"opportunity_id": o["id"]})
                    if "error" not in sh:
                        lines.append(f"- Deal shaping recommends **{sh['recommended']}** (headroom {_fmt(sh['credit_headroom'])}).")
    if not aid and not lines:
        r = call("list_open_opportunities", {"account_id": 0, "limit": 5})
        lines.append(f"**Your top opportunities by value-at-stake** ({r.get('total', 0)} open):")
        for o in r.get("items", []):
            flag = " ⚠ past SLA" if o["sla_breached"] else ""
            lines.append(f"- #{o['id']} {o['title']} — {_fmt(o['value'])}, p={o['p']:.2f}, "
                         f"costs {_fmt(o['cost_of_delay_per_day'])}/day idle{flag}")
    if state["retrieved"]:
        top = state["retrieved"][0]
        lines.append(f"\n_Playbook ({top['title']}):_ {top['text']}")
    return {"answer": "\n".join(lines), "steps": steps}


def guard(state: CopilotState) -> CopilotState:
    ans = state.get("answer", "")
    if not state["principal"].can("pii:view"):
        ans = GSTIN_RE.sub("[GSTIN masked]", ans)
        ans = PAN_RE.sub("[PAN masked]", ans)
    cites = [{"doc": r["doc"], "title": r["title"], "text": r["text"]} for r in state.get("retrieved", [])]
    return {"answer": ans, "citations": cites,
            "steps": [*state["steps"], {"node": "guard", "detail": "PII scan + citations attached"}]}


def _route(state: CopilotState) -> str:
    return "act_llm" if state["mode"] == "llm" else "act_offline"


def build_graph():
    from langgraph.graph import END, START, StateGraph  # lazy import

    g = StateGraph(CopilotState)
    g.add_node("retrieve", retrieve)
    g.add_node("plan", plan)
    g.add_node("act_llm", act_llm)
    g.add_node("act_offline", act_offline)
    g.add_node("guard", guard)
    g.add_edge(START, "retrieve")
    g.add_edge("retrieve", "plan")
    g.add_conditional_edges("plan", _route, {"act_llm": "act_llm", "act_offline": "act_offline"})
    g.add_edge("act_llm", "guard")
    g.add_edge("act_offline", "guard")
    g.add_edge("guard", END)
    return g.compile()


_GRAPH = None


def get_graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_graph()
    return _GRAPH


ROLE_SUGGESTIONS = {
    "rep": ["What should I do today?", "What should I pitch to TechNova Systems next?", "Which partners are close to a scheme slab?",
            "Who owes us money in my territory?", "Can TechNova afford the classroom deal on credit, or should we DaaS it?"],
    "head": ["How is the business tracking against FY29?", "Would the pilot scale or stop?", "Where is credit risk building up?",
             "How healthy is our annuity book?", "Which opportunities are costing the most to sit idle?"],
    "architect": ["Compose a Smart Classroom for TechNova Systems", "Can TechNova afford the classroom deal on credit, or should we DaaS it?",
                  "What's our playbook for on-prem AI pods?", "Which opportunities are costing the most to sit idle?"],
    "steward": ["How is the twin for TechNova Systems built?", "What are the data handling rules?", "Which opportunities are costing the most to sit idle?"],
    "partner": ["What has CNL proposed for TechNova?", "Can we pay monthly instead of upfront?"],
}

SUGGESTIONS = [
    "What should I pitch to TechNova Systems next?",
    "Which of my opportunities are costing the most to sit idle?",
    "Can TechNova afford the classroom deal on credit, or should we DaaS it?",
    "Would the pilot scale or stop?",
    "What's our playbook for clean-air offices in Delhi?",
]
_ = C
