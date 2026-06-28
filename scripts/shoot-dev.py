# -*- coding: utf-8 -*-
"""開発スタッフ向けマニュアル用スクショ: LINEアカウント編集(Webhook URL/AI設定)と新規作成フォーム。"""
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

    # 新規作成フォーム
    pg.goto(BASE + "/line-accounts/new", wait_until="load")
    pg.wait_for_timeout(1800)
    pg.screenshot(path=os.path.join(OUT, "line-account-new.png"), full_page=True)
    print("line-account-new")

    # 既存アカウント編集（Webhook URL / AI自動応答カードが見える）
    pg.goto(BASE + "/line-accounts", wait_until="load")
    pg.wait_for_timeout(1500)
    href = pg.eval_on_selector('a[href*="/line-accounts/"][href$="/edit"]', "el => el.getAttribute('href')")
    pg.goto(BASE + href, wait_until="load")
    pg.wait_for_timeout(2000)
    pg.screenshot(path=os.path.join(OUT, "line-account-edit.png"), full_page=True)
    print("line-account-edit", href)

    b.close()
