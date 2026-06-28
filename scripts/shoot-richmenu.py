# -*- coding: utf-8 -*-
"""リッチメニュー画面の動作確認＋スクショ（一覧・編集）。"""
import base64, hashlib, hmac, json, os, time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
SECRET = b"local-dev-secret-please-change-in-production"
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "manual", "img"))


def b64url(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def token():
    pl = {"id": "u_1", "email": "owner@lcall.jp", "name": "オーナー", "role": "owner",
          "exp": int((time.time() + 7 * 24 * 3600) * 1000)}
    body = b64url(json.dumps(pl, separators=(",", ":")).encode())
    return body + "." + b64url(hmac.new(SECRET, body.encode(), hashlib.sha256).digest())


def ready():
    for _ in range(60):
        try:
            import urllib.request
            urllib.request.urlopen(BASE + "/login", timeout=3)
            return True
        except Exception:
            time.sleep(1)
    return False


ready()
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=2)
    ctx.add_cookies([{"name": "lcall_session", "value": token(), "url": BASE, "httpOnly": True, "sameSite": "Lax"}])
    pg = ctx.new_page()
    pg.set_default_timeout(120000)

    for path, name in [("/rich-menus", "rich-menus"), ("/rich-menus/new", None), ("/rich-menus/rm_1/edit", "rich-menu-edit")]:
        pg.goto(BASE + path, wait_until="load")
        pg.wait_for_timeout(1800)
        print(path, "->", pg.url)
        if name:
            pg.screenshot(path=os.path.join(OUT, name + ".png"), full_page=True)
    b.close()
