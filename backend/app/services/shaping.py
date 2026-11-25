"""Deal shaping — "DaaS-ify": turn a credit-blocked hardware deal into an annuity.

CNL runs at ~3-4% EBITDA and is working-capital constrained (its own Quadrant model ranks
products by margin x cash cycle). A big solution deal that exceeds the partner's credit
headroom is usually dropped. Constella offers three shapes instead:

  A. As-is          — one PO, one invoice, normal credit terms
  B. Phased         — split into tranches that each fit inside the credit headroom
  C. Device-as-a-Service — a financing partner (NBFC) funds the hardware; the partner pays a
                      monthly fee for 36 months covering hardware + AMC + CMS/warranty.
                      CNL earns hardware margin upfront + a service annuity, and the
                      receivable risk sits with the financier.
"""

from __future__ import annotations

import math
from typing import Any

FINANCE_RATE = 0.145  # annual cost of funds charged by the NBFC partner (assumption)
TENURE_MONTHS = 36
SERVICE_UPLIFT = 0.012  # monthly service layer as % of hardware value (AMC + CMS + warranty)
SERVICE_MARGIN = 0.38


def emi(principal: float, annual_rate: float, months: int) -> float:
    r = annual_rate / 12
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)


def shape(value: float, margin: float, annuity: float, credit_headroom: float, wc_days: float) -> dict[str, Any]:
    fits = value <= credit_headroom
    a = {
        "id": "as_is", "name": "As-is", "fits_credit": fits,
        "upfront_value": round(value), "cnl_margin_upfront": round(value * margin),
        "annual_recurring": round(annuity), "cash_cycle_days": round(wc_days),
        "note": "Single PO on standard credit" if fits else "Exceeds credit headroom — would be blocked by credit control",
    }
    tranches = max(1, math.ceil(value / max(1.0, credit_headroom))) if credit_headroom > 0 else 4
    tranches = min(tranches, 6)
    b = {
        "id": "phased", "name": f"Phased ({tranches} tranches)", "fits_credit": credit_headroom > 0,
        "upfront_value": round(value / tranches), "cnl_margin_upfront": round(value * margin),
        "annual_recurring": round(annuity), "cash_cycle_days": round(wc_days + 20 * (tranches - 1)),
        "tranches": tranches, "note": f"Each tranche ≈ ₹{value / tranches:,.0f} released as the previous one is paid",
    }
    hw_emi = emi(value, FINANCE_RATE, TENURE_MONTHS)
    svc = value * SERVICE_UPLIFT
    monthly = hw_emi + svc
    c = {
        "id": "daas", "name": "Device-as-a-Service (36 mo)", "fits_credit": True,
        "upfront_value": 0, "monthly_fee": round(monthly), "cnl_margin_upfront": round(value * margin),
        "annual_recurring": round(svc * 12 + annuity), "cash_cycle_days": 7,
        "tcv": round(monthly * TENURE_MONTHS),
        "cnl_annuity_margin_3y": round(svc * TENURE_MONTHS * SERVICE_MARGIN + annuity * 3 * 0.4),
        "note": "NBFC funds hardware at 14.5% p.a.; CNL is paid on delivery and keeps the service annuity",
    }
    best = max([a, b, c], key=lambda x: (x["fits_credit"], x["cnl_margin_upfront"] / max(1, x["cash_cycle_days"])
                                          + x["annual_recurring"] * 0.4))
    return {"options": [a, b, c], "recommended": best["id"], "credit_headroom": round(credit_headroom),
            "assumptions": {"finance_rate": FINANCE_RATE, "tenure_months": TENURE_MONTHS,
                            "service_uplift_monthly": SERVICE_UPLIFT, "service_margin": SERVICE_MARGIN}}
