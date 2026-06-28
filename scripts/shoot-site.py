# -*- coding: utf-8 -*-
"""公開サイト（Stripe審査用）の表示確認＋スクショ。認証不要ページ。"""
import os, time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "manual", "img"))

PAGES = [
    ("/service", "site-service"),
    ("/legal/company", "site-company"),
    ("/legal/tokushoho", "site-tokushoho"),
    ("/legal/privacy", "site-privacy"),
    ("/legal/terms", "site-terms"),
    ("/legal/refund", "site-refund"),
]

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    # reduced-motion を有効にすると Reveal は即時表示（フルページ撮影で全要素が見える）
    pg = b.new_context(
        viewport={"width": 1200, "height": 900}, device_scale_factor=2, reduced_motion="reduce"
    ).new_page()
    pg.set_default_timeout(120000)
    for path, name in PAGES:
        pg.goto(BASE + path, wait_until="load")
        pg.wait_for_timeout(1200)
        print(path, "->", pg.url)
        pg.screenshot(path=os.path.join(OUT, name + ".png"), full_page=True)
    b.close()
