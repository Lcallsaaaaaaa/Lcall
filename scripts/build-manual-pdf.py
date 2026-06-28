# -*- coding: utf-8 -*-
"""マニュアルHTMLを開いてA4 PDFを生成する（クライアント用＋開発スタッフ用）。
verify=True の項目は検証用ビューポート撮影も行う。"""
import os, pathlib
from playwright.sync_api import sync_playwright

DOCDIR = pathlib.Path(r"C:\Users\sames\Desktop\lcall\docs\manual")

JOBS = [
    ("index.html", "LCall-使い方マニュアル.pdf", None),
    ("dev-setup.html", "LCall-導入設定マニュアル（開発スタッフ向け）.pdf", None),
    ("sales.html", "LCall-料金・サービスご案内.pdf", "#s5"),
]

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 900, "height": 1100}, device_scale_factor=2)
    for html_name, pdf_name, verify_sel in JOBS:
        html = (DOCDIR / html_name).as_uri()
        pdf = str(DOCDIR / pdf_name)
        pg.goto(html, wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(700)
        if verify_sel:
            pg.screenshot(path=str(DOCDIR / "img" / "_verify-cover.png"))
            pg.eval_on_selector(verify_sel, "el => el.scrollIntoView()")
            pg.wait_for_timeout(400)
            pg.screenshot(path=str(DOCDIR / "img" / "_verify-section.png"))
        pg.emulate_media(media="print")
        pg.pdf(path=pdf, format="A4", print_background=True, prefer_css_page_size=True)
        pg.emulate_media(media="screen")
        print("PDF:", pdf_name, os.path.getsize(pdf), "bytes")
    b.close()
