# -*- coding: utf-8 -*-
"""追加スクショ: チャット個別スレッド(3ペイン)と顧客詳細。"""
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


with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=2)
    ctx.add_cookies([{"name": "lcall_session", "value": token(), "url": BASE, "httpOnly": True, "sameSite": "Lax"}])
    pg = ctx.new_page()
    pg.set_default_timeout(120000)

    # チャット個別スレッド
    pg.goto(BASE + "/inbox", wait_until="load")
    pg.wait_for_timeout(1500)
    href = pg.eval_on_selector('a[href*="/inbox?f="]', "el => el.getAttribute('href')")
    pg.goto(BASE + href, wait_until="load")
    pg.wait_for_timeout(2200)
    pg.screenshot(path=os.path.join(OUT, "inbox-thread.png"), full_page=True)
    print("inbox-thread", href)

    # 顧客詳細
    pg.goto(BASE + "/friends", wait_until="load")
    pg.wait_for_timeout(1500)
    fhref = pg.eval_on_selector('a[href^="/friends/"]', "el => el.getAttribute('href')")
    pg.goto(BASE + fhref, wait_until="load")
    pg.wait_for_timeout(2000)
    pg.screenshot(path=os.path.join(OUT, "friend-detail.png"), full_page=True)
    print("friend-detail", fhref)

    b.close()
