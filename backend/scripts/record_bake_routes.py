"""Records which GET API calls each demo seat makes while visiting every screen, for the build-time bake.

Needs the local stack (API :8000, web :5173). Writes app/bake_routes.json: {persona: ["/api/...?...", ...]}.
Run:  uv run --with playwright python scripts/record_bake_routes.py
"""
import asyncio
import json
import urllib.request
from pathlib import Path

from playwright.async_api import async_playwright

WEB, API = "http://localhost:5173", "http://localhost:8000"
ROUTES = ["inbox", "command", "accounts", "accounts/1", "solutions", "insights", "brands", "graph", "model", "pilot", "automation", "data",
          "security", "partner", "credit", "dealdesk", "annuity", "growth", "ops", "team", "trust", "territory", "site/1", "learning",
          "scorecard", "beat", "collections"]
PERSONAS = ["priya", "arjun", "rakesh", "meera", "neha", "vikram"]
PURE_POST = ("/api/pilot/simulate", "/api/geo/demand", "/api/ai/intent", "/api/team/commission", "/api/solutions/compose")
OUT = Path(__file__).resolve().parents[1] / "app" / "bake_routes.json"


def login(p):
    r = urllib.request.Request(API + "/api/auth/login", data=json.dumps({"persona": p}).encode(), headers={"content-type": "application/json"}, method="POST")
    return urllib.request.urlopen(r).read().decode()


async def main():
    out = {}
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel="chrome")
        # public landing calls
        ctx = await b.new_context()
        pg = await ctx.new_page()
        seen = set()
        pg.on("response", lambda r: seen.add(r.url.split(WEB)[-1]) if "/api/" in r.url and r.request.method == "GET" and r.status == 200 else None)
        await pg.goto(WEB + "/", wait_until="load")
        await pg.wait_for_timeout(5000)
        out["public"] = sorted(seen)
        await ctx.close()
        for persona in PERSONAS:
            tok = login(persona)
            ctx = await b.new_context(viewport={"width": 1440, "height": 900})
            await ctx.add_init_script(f"sessionStorage.setItem('constella-session', JSON.stringify({{state: {tok}, version: 0}}))")
            pg = await ctx.new_page()
            seen, posts = set(), {}
            pg.on("response", lambda r, s=seen: s.add(r.url.split(WEB)[-1]) if "/api/" in r.url and r.request.method == "GET" and r.status == 200 else None)
            pg.on("response", lambda r, d=posts: d.__setitem__((r.url.split(WEB)[-1], r.request.post_data or ""), 1)
                  if r.request.method == "POST" and r.url.split(WEB)[-1].split("?")[0] in PURE_POST and r.status == 200 else None)
            for rt in ROUTES:
                await pg.goto(f"{WEB}/app/{rt}", wait_until="load")
                await pg.wait_for_timeout(2500)
            out[persona] = sorted(u for u in seen if not u.startswith(("/api/auth", "/api/health"))) + [{"post": p, "body": b} for p, b in sorted(posts)]
            print(persona, len(out[persona]), flush=True)
            await ctx.close()
        await b.close()
    OUT.write_text(json.dumps(out, indent=1) + "\n")
    print("wrote", OUT)


asyncio.run(main())
