# -*- coding: utf-8 -*-
"""LCall マニュアル用スクリーンショット撮影。
owner ロールのセッションCookieを生成し、各画面をフルページ撮影して docs/manual/img に保存する。
依存: playwright (domain_check/.venv に導入済みの chromium を使用)。
"""
import base64, hashlib, hmac, json, os, sys, time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
SECRET = b"local-dev-secret-please-change-in-production"
OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "manual", "img")
OUT = os.path.abspath(OUT)
os.makedirs(OUT, exist_ok=True)


def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def make_token() -> str:
    payload = {
        "id": "u_1",
        "email": "owner@lcall.jp",
        "name": "オーナー",
        "role": "owner",
        "exp": int((time.time() + 7 * 24 * 3600) * 1000),
    }
    body = b64url(json.dumps(payload, separators=(",", ":")).encode())
    mac = b64url(hmac.new(SECRET, body.encode(), hashlib.sha256).digest())
    return body + "." + mac


# (path, filename) — owner は全画面が見える
SCREENS = [
    ("/", "dashboard"),
    ("/analytics", "analytics"),
    ("/line-accounts", "line-accounts"),
    ("/distribution", "distribution"),
    ("/ad-codes", "ad-codes"),
    ("/friends", "friends"),
    ("/inbox", "inbox"),
    ("/ai-characters", "ai-characters"),
    ("/message-templates", "message-templates"),
    ("/tags", "tags"),
    ("/broadcasts", "broadcasts"),
    ("/broadcasts/new", "broadcasts-new"),
    ("/scenarios", "scenarios"),
    ("/carousel", "carousel"),
    ("/forms", "forms"),
    ("/surveys", "surveys"),
    ("/landing-pages", "landing-pages"),
    ("/media", "media"),
    ("/billing", "billing"),
    ("/staff", "staff"),
]

results = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=2)
    page = ctx.new_page()
    page.set_default_timeout(120000)

    # 1) ログイン画面（未ログイン状態で撮影）
    try:
        page.goto(BASE + "/login", wait_until="load", timeout=120000)
        page.wait_for_timeout(1500)
        page.screenshot(path=os.path.join(OUT, "login.png"), full_page=True)
        results.append(("login", "ok", os.path.getsize(os.path.join(OUT, "login.png"))))
    except Exception as e:
        results.append(("login", "ERR " + str(e)[:80], 0))

    # 2) owner セッションCookieを付与
    ctx.add_cookies([{
        "name": "lcall_session",
        "value": make_token(),
        "url": BASE,
        "httpOnly": True,
        "sameSite": "Lax",
    }])

    # Cookieが効いているか確認（/ がloginにリダイレクトされないこと）
    page.goto(BASE + "/", wait_until="load", timeout=120000)
    if "/login" in page.url:
        print("AUTH FAILED: redirected to login. token rejected.", file=sys.stderr)
        browser.close()
        sys.exit(2)

    for path, name in SCREENS:
        try:
            page.goto(BASE + path, wait_until="load", timeout=120000)
            page.wait_for_timeout(2200)  # ハイドレーション・チャート描画待ち
            fp = os.path.join(OUT, name + ".png")
            page.screenshot(path=fp, full_page=True)
            results.append((name, "ok", os.path.getsize(fp)))
            print("shot", name, page.url)
        except Exception as e:
            results.append((name, "ERR " + str(e)[:80], 0))
            print("ERR", name, str(e)[:120], file=sys.stderr)

    browser.close()

print("\n=== RESULT ===")
for n, s, sz in results:
    print(f"{n:20} {s:6} {sz}")
