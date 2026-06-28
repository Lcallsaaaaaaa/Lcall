# -*- coding: utf-8 -*-
"""スタンドアロン公開サイト（lcall-site）の表示確認。"""
import os
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8090"
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "lcall-site", "_preview"))
os.makedirs(OUT, exist_ok=True)

PAGES = [("/", "index"), ("/legal/tokushoho", "tokushoho"), ("/legal/company", "company"),
         ("/legal/privacy", "privacy"), ("/legal/terms", "terms"), ("/legal/refund", "refund")]

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_context(viewport={"width": 1200, "height": 900}, device_scale_factor=2, reduced_motion="reduce").new_page()
    pg.set_default_timeout(60000)
    for path, name in PAGES:
        pg.goto(BASE + path, wait_until="load")
        pg.wait_for_timeout(700)
        print(path, "->", pg.url, pg.title())
        pg.screenshot(path=os.path.join(OUT, name + ".png"), full_page=True)
    b.close()
