"""Automation engine — the "scale without headcount" layer.

Every rule is WHEN <trigger> IF <conditions> THEN <actions>. Rules are data (editable from the
UI), evaluated synchronously on domain events and by the scheduler. Actions write to an Outbox;
in production the outbox is drained by WhatsApp Business API / SES / webhook workers.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlmodel import Session, select

from app.data import catalog as C
from app.models import (
    OPEN_STATUSES, Account, AutomationRule, InstalledAsset, Opportunity, OppKind, OppStatus, Outbox, SalesRep,
)
from app.routing.engine import sla_due
from app.state import state

DEFAULT_RULES: list[dict[str, Any]] = [
    {"id": "solution_pod", "name": "Auto-form solution pod",
     "description": "When a solution deal above ₹5L is created, brief every assist and the solutions architect in one thread.",
     "trigger": "opp_created", "conditions": {"kind": "solution", "min_value": 500000},
     "actions": [{"type": "notify_pod", "channel": "whatsapp"}, {"type": "notify_role", "role": "architect", "channel": "in_app"}],
     "hours_saved_per_run": 0.75},
    {"id": "sla_nudge", "name": "SLA nudge",
     "description": "When an opportunity misses its SLA, nudge the lead on WhatsApp before it escalates.",
     "trigger": "sla_breach", "conditions": {"max_level": 1},
     "actions": [{"type": "notify_lead", "channel": "whatsapp"}], "hours_saved_per_run": 0.1},
    {"id": "head_escalation", "name": "Head escalation digest",
     "description": "When an opportunity reaches L3, add it to the sales head's escalation digest.",
     "trigger": "sla_breach", "conditions": {"min_level": 3},
     "actions": [{"type": "notify_role", "role": "head", "channel": "email"}], "hours_saved_per_run": 0.2},
    {"id": "win_to_annuity", "name": "Win → annuity chain",
     "description": "When hardware with a service annuity is won, schedule an attach opportunity 21 days after delivery.",
     "trigger": "opp_won", "conditions": {"has_annuity": True},
     "actions": [{"type": "create_annuity_followup", "delay_days": 21}], "hours_saved_per_run": 0.5},
    {"id": "zero_touch_renewal", "name": "Zero-touch renewal",
     "description": "30 days before a filter/AMC/CMS renewal, send the partner a one-tap renewal quote.",
     "trigger": "renewal_due", "conditions": {"days_ahead": 30},
     "actions": [{"type": "send_renewal_quote", "channel": "whatsapp"}], "hours_saved_per_run": 0.4},
    {"id": "competitor_alert", "name": "Competitor price-match",
     "description": "When a captured note mentions a competing distributor, request a price-match approval.",
     "trigger": "signal", "conditions": {"competitor": True},
     "actions": [{"type": "notify_role", "role": "head", "channel": "in_app", "template": "price_match"}],
     "hours_saved_per_run": 0.3},
    {"id": "credit_daasify", "name": "Credit block → DaaS offer",
     "description": "When a new deal exceeds the partner's credit headroom, attach a Device-as-a-Service shape for the rep.",
     "trigger": "opp_created", "conditions": {"fits_credit": False},
     "actions": [{"type": "suggest_daas", "channel": "in_app"}], "hours_saved_per_run": 0.5},
    {"id": "daily_brief", "name": "Morning brief",
     "description": "Every morning at 9:00, send each rep their top-3 actions and SLA risks on WhatsApp.",
     "trigger": "daily", "conditions": {},
     "actions": [{"type": "daily_brief", "channel": "whatsapp"}], "hours_saved_per_run": 0.3},
]


def seed_rules(s: Session) -> None:
    for r in DEFAULT_RULES:
        if not s.get(AutomationRule, r["id"]):
            s.add(AutomationRule(**r))
    s.commit()


def _match(rule: AutomationRule, ctx: dict[str, Any]) -> bool:
    c = rule.conditions or {}
    if "kind" in c and ctx.get("kind") != c["kind"]:
        return False
    if "min_value" in c and ctx.get("value", 0) < c["min_value"]:
        return False
    if "fits_credit" in c and ctx.get("fits_credit", True) != c["fits_credit"]:
        return False
    if "max_level" in c and ctx.get("level", 0) > c["max_level"]:
        return False
    if "min_level" in c and ctx.get("level", 0) < c["min_level"]:
        return False
    if c.get("has_annuity") and not ctx.get("annuity_category"):
        return False
    return not (c.get("competitor") and not ctx.get("competitor"))


def _out(s: Session, rule: AutomationRule, channel: str, to: str, subject: str, body: str,
         opp: Opportunity | None = None, account_id: int | None = None) -> Outbox:
    o = Outbox(ts=state.now, channel=channel, to=to, subject=subject, body=body, rule_id=rule.id,
               opportunity_id=opp.id if opp else None, account_id=account_id or (opp.account_id if opp else None))
    s.add(o)
    return o


def fire(s: Session, trigger: str, opp: Opportunity | None = None, **ctx: Any) -> list[dict[str, Any]]:
    """Evaluate every enabled rule for a trigger; returns what was executed."""
    rules = s.exec(select(AutomationRule).where(AutomationRule.trigger == trigger,
                                                AutomationRule.enabled == True)).all()  # noqa: E712
    reps = {r.id: r for r in s.exec(select(SalesRep)).all()}
    done: list[dict[str, Any]] = []
    if opp is not None:
        ctx.setdefault("kind", opp.kind.value)
        ctx.setdefault("value", opp.est_value)
        ctx.setdefault("level", opp.escalation_level)
        ctx.setdefault("fits_credit", (opp.explanation or {}).get("fits_credit", True))
    for rule in rules:
        if not _match(rule, ctx):
            continue
        for act in rule.actions:
            t = act["type"]
            lead = reps.get(opp.lead_rep_id) if opp and opp.lead_rep_id else None
            if t == "notify_lead" and lead and opp:
                _out(s, rule, act["channel"], lead.name, f"SLA reminder · {opp.title}",
                     f"Hi {lead.name.split()[0]}, '{opp.title}' is past its SLA. Accept or decline in one tap — "
                     f"otherwise it moves to the next rep in 24h.", opp)
            elif t == "notify_pod" and opp:
                names = [reps[a["rep_id"]].name for a in (opp.assists or []) if a.get("rep_id") in reps]
                for n in names + ([lead.name] if lead else []):
                    _out(s, rule, act["channel"], n, f"Solution pod formed · {opp.title}",
                         f"You're in the pod for '{opp.title}' (₹{opp.est_value:,.0f}). Lead: "
                         f"{lead.name if lead else '—'}. Credit split is pre-agreed — reply 'IN' to join the call.", opp)
            elif t == "notify_role":
                target = next((r for r in reps.values() if r.role == act["role"]), None)
                if target:
                    subj = "Price-match approval requested" if act.get("template") == "price_match" else \
                        f"Escalation · {opp.title if opp else ''}"
                    _out(s, rule, act["channel"], target.name, subj,
                         ctx.get("message") or (f"{opp.title} — ₹{opp.est_value:,.0f}, level L{opp.escalation_level}"
                                                if opp else "See signal"), opp, ctx.get("account_id"))
            elif t == "suggest_daas" and opp and lead:
                _out(s, rule, act["channel"], lead.name, "Deal exceeds credit — DaaS shape ready",
                     f"'{opp.title}' is above the partner's credit headroom. Open 'Shape deal' to offer a 36-month "
                     f"Device-as-a-Service plan instead.", opp)
            elif t == "create_annuity_followup" and opp:
                ann = ctx["annuity_category"]
                spec = C.CATEGORIES[ann]
                annual = (opp.closed_value or opp.est_value) * 0.08
                f = Opportunity(account_id=opp.account_id, title=f"Attach {spec['label']} to newly delivered "
                                f"{', '.join(C.CATEGORIES[c]['label'] for c in opp.categories[:2])}",
                                kind=OppKind.RECURRING, categories=[ann], est_value=round(annual, -2),
                                est_margin=round(annual * spec["margin"], -1), est_annuity=round(annual, -2),
                                probability=0.55, score=round(0.55 * annual * spec["margin"] * 3, 2),
                                explanation={"why": [f"Auto-created by rule '{rule.name}' after win #{opp.id}",
                                                     "Attach rates are highest within 30 days of delivery"],
                                             "divisions": ["SVC"], "fits_credit": True},
                                created_at=state.now + timedelta(days=act.get("delay_days", 21)),
                                status=OppStatus.ASSIGNED, lead_rep_id=opp.lead_rep_id, lead_division="SVC",
                                assigned_at=state.now, due_by=sla_due(state.now + timedelta(days=21), False))
                s.add(f)
            elif t == "send_renewal_quote":
                _out(s, rule, act["channel"], ctx.get("partner", "partner"), "Your renewal is due",
                     ctx.get("message", "Your service renewal is due — reply YES to renew at the same price."),
                     account_id=ctx.get("account_id"))
            elif t == "daily_brief":
                _out(s, rule, act["channel"], ctx.get("rep", "rep"), "Your morning brief", ctx.get("message", ""))
            done.append({"rule": rule.id, "action": t})
        rule.runs += 1
        rule.last_run = state.now
        s.add(rule)
    return done


def renewal_job(s: Session) -> int:
    """Scheduler job: find installed base whose annuity renews within 30 days and send quotes."""
    horizon = state.now.date() + timedelta(days=30)
    accs = {a.id: a for a in s.exec(select(Account)).all()}
    n = 0
    sent = {o.account_id for o in s.exec(select(Outbox).where(Outbox.rule_id == "zero_touch_renewal")).all()}
    for asset in s.exec(select(InstalledAsset).where(InstalledAsset.next_service_due != None)).all():  # noqa: E711
        if asset.account_id in sent or not (state.now.date() <= asset.next_service_due <= horizon):
            continue
        acc = accs.get(asset.account_id)
        ann = C.ANNUITY_FOR.get(asset.category)
        if not acc or not ann:
            continue
        fire(s, "renewal_due", account_id=acc.id, partner=acc.name,
             message=f"Hi {acc.name}, {C.CATEGORIES[ann]['label']} for {asset.qty} × {C.CATEGORIES[asset.category]['label']} "
                     f"renews on {asset.next_service_due}. Reply YES to renew — invoice follows automatically.")
        sent.add(acc.id)
        n += 1
    s.commit()
    return n


def daily_brief_job(s: Session) -> int:
    reps = s.exec(select(SalesRep).where(SalesRep.role == "rep")).all()
    opps = s.exec(select(Opportunity).where(Opportunity.in_holdout == False)).all()  # noqa: E712
    n = 0
    for r in reps:
        mine = sorted([o for o in opps if o.lead_rep_id == r.id and o.status in OPEN_STATUSES], key=lambda o: -o.score)
        if not mine:
            continue
        late = sum(1 for o in mine if o.due_by and o.due_by < state.now)
        top = "; ".join(f"{i + 1}) {o.title} (₹{o.est_value / 1e5:.1f}L)" for i, o in enumerate(mine[:3]))
        fire(s, "daily", rep=r.name, message=f"Good morning {r.name.split()[0]} ☀️ Top 3: {top}. "
                                             f"{late} past SLA. {len(mine)} open in total.")
        n += 1
    s.commit()
    return n


def drain_outbox(s: Session) -> int:
    q = s.exec(select(Outbox).where(Outbox.status == "queued")).all()
    for o in q:
        o.status = "sent"  # production: hand off to WhatsApp Business API / SES / webhook worker
        s.add(o)
    s.commit()
    return len(q)
