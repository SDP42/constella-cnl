"""Screenshots of the running prototype for the deck (local API :8000 + web :5173)."""
import asyncio
import json
import sys
import urllib.request
from pathlib import Path

from playwright.async_api import async_playwright

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "img")
OUT.mkdir(exist_ok=True)


def token(p):
    r = urllib.request.Request("http://localhost:8000/api/auth/login", data=json.dumps({"persona": p}).encode(), headers={"content-type": "application/json"}, method="POST")
    return urllib.request.urlopen(r).read().decode()


SHOTS = [  # (persona, path, file, wait_s, scroll_to_selector)
    ("rakesh", "/app/scorecard", "scorecard", 5, None),
    ("rakesh", "/app/territory", "territory", 12, ".maplibregl-map"),
    ("rakesh", "/app/site/1", "sitetwin", 7, None),
    ("rakesh", "/app/command", "command", 6, None),
    ("priya", "/app/inbox", "inbox", 6, None),
    ("priya", "/app/beat", "beat", 12, ".maplibregl-map"),
    ("rakesh", "/app/collections", "collections", 6, None),
    ("rakesh", "/app/learning", "learning", 5, None),
    ("rakesh", "/app/pilot", "pilot", 6, None),
    ("rakesh", "/app/accounts/1", "accounttwin", 7, None),
    ("rakesh", "/app/trust", "trust", 5, None),
    ("rakesh", "/app/dealdesk", "dealdesk", 5, None),
    ("rakesh", "/app/growth", "growth", 7, None),
]


async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel="chrome", args=["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"])
        sess = {p: token(p) for p in {s[0] for s in SHOTS}}
        for persona, path, name, wait, sel in SHOTS:
            ctx = await b.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=1.5)
            await ctx.add_init_script(f"sessionStorage.setItem('constella-session', JSON.stringify({{state: {sess[persona]}, version: 0}}))")
            pg = await ctx.new_page()
            await pg.goto("http://localhost:5173" + path, wait_until="load", timeout=60000)
            await pg.wait_for_timeout(wait * 1000)
            if sel:
                await pg.evaluate(f"document.querySelector('{sel}')?.scrollIntoView({{block:'center'}})")
                await pg.wait_for_timeout(2500)
            await pg.screenshot(path=str(OUT / f"{name}.jpg"), type="jpeg", quality=88)
            print("shot", name, flush=True)
            await ctx.close()
        ctx = await b.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=1.5)
        pg = await ctx.new_page()
        await pg.goto("http://localhost:5173/", wait_until="load")
        await pg.wait_for_timeout(9000)
        await pg.screenshot(path=str(OUT / "landing_hero.jpg"), type="jpeg", quality=88)
        print("shot landing_hero")
        await b.close()


asyncio.run(main())
