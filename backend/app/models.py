"""Unified customer data model (the "Account Twin").

Every account carries four families of data, as asked in PS1 step 1:
  * purchases          -> Transaction, InstalledAsset
  * product relations  -> Product, SolutionTemplate (component graph)
  * business signals   -> Signal, Account firmographics / credit
  * interactions       -> Interaction, OpportunityEvent
Raw per-division records (SourceRecord) are resolved into one golden Account.
"""

from datetime import date
from enum import StrEnum
from typing import Any

from pydantic import NaiveDatetime
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class AccountType(StrEnum):
    SUB_DISTRIBUTOR = "sub_distributor"
    RESELLER = "reseller"
    SYSTEM_INTEGRATOR = "system_integrator"
    ENTERPRISE = "enterprise"
    RETAILER = "retailer"


class OppStatus(StrEnum):
    NEW = "new"
    ASSIGNED = "assigned"
    ACCEPTED = "accepted"
    CONTACTED = "contacted"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"
    NURTURE = "nurture"


OPEN_STATUSES = {
    OppStatus.NEW,
    OppStatus.ASSIGNED,
    OppStatus.ACCEPTED,
    OppStatus.CONTACTED,
    OppStatus.PROPOSAL,
    OppStatus.NEGOTIATION,
}


class OppKind(StrEnum):
    CROSS_SELL = "cross_sell"
    UPSELL = "upsell"
    SOLUTION = "solution"
    RECURRING = "recurring"


# ---------------------------------------------------------------- organisation


class Division(SQLModel, table=True):
    code: str = Field(primary_key=True)  # EB, FMSG, FMCT, HON, SVC
    name: str
    description: str
    color: str


class SalesRep(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    email: str
    division_code: str = Field(foreign_key="division.code", index=True)
    region: str = Field(index=True)
    role: str = "rep"  # rep | head | architect | steward
    capacity: int = 25  # max concurrent open opportunities
    persona_key: str | None = Field(default=None, index=True)
    avatar_hue: int = 200


# ---------------------------------------------------------------- catalogue


class Product(SQLModel, table=True):
    sku: str = Field(primary_key=True)
    name: str
    brand: str = Field(index=True)
    category: str = Field(index=True)
    division_code: str = Field(foreign_key="division.code", index=True)
    unit_price: float
    margin_pct: float
    wc_days: int  # working-capital cycle (inventory + credit) in days
    quadrant: int  # CNL's own margin x cycle quadrant (1 = best)
    is_recurring: bool = False
    recurring_period_months: int | None = None


class SolutionTemplate(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    tagline: str
    verticals: list[str] = Field(sa_column=Column(JSON))
    # [{category, role, required, qty_per_100_emp}]
    components: list[dict[str, Any]] = Field(sa_column=Column(JSON))
    annuity: list[dict[str, Any]] = Field(sa_column=Column(JSON))
    icon: str = "boxes"


# ---------------------------------------------------------------- accounts


class Account(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    gstin: str | None = Field(default=None, index=True)
    pan: str | None = None
    account_type: AccountType
    vertical: str = Field(index=True)
    city: str
    region: str = Field(index=True)
    employees: int
    est_annual_tech_spend: float  # wallet estimate (INR)
    credit_limit: float
    credit_used: float
    avg_payment_days: int
    tier: str = "silver"  # platinum | gold | silver | bronze
    owner_rep_id: int | None = Field(default=None, foreign_key="salesrep.id")
    in_holdout: bool = False  # pilot control group
    data_quality: float = 1.0
    lat: float = 0.0
    lng: float = 0.0


class SourceRecord(SQLModel, table=True):
    """A raw record as it lives in one division's ERP/CRM before unification."""

    id: int | None = Field(default=None, primary_key=True)
    division_code: str = Field(index=True)
    system: str  # tally | sap_b1 | zoho | excel
    raw_name: str
    raw_gstin: str | None = None
    phone: str | None = None
    pincode: str | None = None
    city: str | None = None
    account_id: int | None = Field(default=None, foreign_key="account.id", index=True)
    match_confidence: float = 0.0
    match_rule: str | None = None
    truth_account_id: int | None = None  # synthetic ground truth, used only to score the resolver


class Transaction(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="account.id", index=True)
    sku: str = Field(foreign_key="product.sku", index=True)
    division_code: str = Field(index=True)
    category: str = Field(index=True)
    tx_date: date = Field(index=True)
    qty: int
    amount: float
    gross_margin: float
    rep_id: int | None = None


class InstalledAsset(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="account.id", index=True)
    sku: str
    category: str
    installed_on: date
    qty: int
    next_service_due: date | None = None


class Interaction(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="account.id", index=True)
    rep_id: int | None = None
    channel: str  # call | whatsapp | visit | email
    ts: NaiveDatetime
    note: str
    sentiment: float = 0.0


# ---------------------------------------------------------------- intelligence


class Signal(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="account.id", index=True)
    kind: str = Field(index=True)
    title: str
    strength: float
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    source: str
    created_at: NaiveDatetime


class Opportunity(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="account.id", index=True)
    title: str
    kind: OppKind = Field(index=True)
    categories: list[str] = Field(sa_column=Column(JSON))
    skus: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    solution_id: str | None = None
    est_value: float
    est_margin: float
    est_annuity: float = 0.0  # annual recurring value
    probability: float
    score: float = Field(index=True)  # value-at-stake
    explanation: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    signal_ids: list[int] = Field(default_factory=list, sa_column=Column(JSON))
    status: OppStatus = Field(default=OppStatus.NEW, index=True)
    lead_rep_id: int | None = Field(default=None, foreign_key="salesrep.id", index=True)
    lead_division: str | None = None
    assists: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: NaiveDatetime
    assigned_at: NaiveDatetime | None = None
    accepted_at: NaiveDatetime | None = None
    due_by: NaiveDatetime | None = None
    escalation_level: int = 0
    closed_value: float | None = None
    closed_at: NaiveDatetime | None = None
    in_holdout: bool = False


class OpportunityEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    opportunity_id: int = Field(foreign_key="opportunity.id", index=True)
    ts: NaiveDatetime
    actor: str
    kind: str
    detail: str
    meta: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))


class ModelRun(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: NaiveDatetime
    metrics: dict[str, Any] = Field(sa_column=Column(JSON))


class AuditLog(SQLModel, table=True):
    """Append-only trail of every mutating call and every sensitive read."""

    id: int | None = Field(default=None, primary_key=True)
    ts: NaiveDatetime = Field(index=True)
    actor: str
    role: str
    method: str
    path: str
    status: int
    ip: str
    detail: str | None = None


class AutomationRule(SQLModel, table=True):
    """No-code automation: WHEN <trigger> IF <conditions> THEN <actions>."""

    id: str = Field(primary_key=True)
    name: str
    description: str
    trigger: str = Field(index=True)  # opp_created | sla_breach | opp_won | signal | renewal_due | daily
    conditions: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    actions: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    enabled: bool = True
    runs: int = 0
    last_run: NaiveDatetime | None = None
    hours_saved_per_run: float = 0.25


class Outbox(SQLModel, table=True):
    """Messages the automation layer sends (WhatsApp Business API / email / webhooks in production)."""

    id: int | None = Field(default=None, primary_key=True)
    ts: NaiveDatetime = Field(index=True)
    channel: str  # whatsapp | email | webhook | in_app
    to: str
    subject: str
    body: str
    status: str = "queued"  # queued | sent | failed
    rule_id: str | None = Field(default=None, index=True)
    opportunity_id: int | None = None
    account_id: int | None = None


class JobRun(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    job: str = Field(index=True)
    started_at: NaiveDatetime
    finished_at: NaiveDatetime | None = None
    status: str = "ok"
    summary: str = ""


class DealRequest(SQLModel, table=True):
    """Deal desk: a discount / special-price request with an approval matrix and audit trail."""

    id: int | None = Field(default=None, primary_key=True)
    opportunity_id: int = Field(foreign_key="opportunity.id", index=True)
    requested_by: str
    requested_role: str
    discount_pct: float
    reason: str
    status: str = Field(default="pending", index=True)  # pending | approved | rejected | auto_approved
    approver_role: str
    decided_by: str | None = None
    decided_at: NaiveDatetime | None = None
    created_at: NaiveDatetime
    waterfall: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))


class Feedback(SQLModel, table=True):
    """Rep feedback on a recommendation — labels for retraining and the pilot's 'signal quality' gate."""

    id: int | None = Field(default=None, primary_key=True)
    opportunity_id: int = Field(foreign_key="opportunity.id", index=True)
    actor: str
    useful: bool
    reason: str | None = None
    kind: str
    ts: NaiveDatetime


class ErasureRequest(SQLModel, table=True):
    """DPDP Act 2023 data-principal request (erasure / correction) and its handling status."""

    id: int | None = Field(default=None, primary_key=True)
    account_id: int
    contact: str
    request: str  # erasure | correction | access
    status: str = "completed"
    handled_by: str
    ts: NaiveDatetime
    note: str | None = None
