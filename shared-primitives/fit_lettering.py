#!/usr/bin/env python3
"""Fit each recreation's lettering to its reference image; write lettering-fit.json.

The fitting runs in a real browser so the text is laid out with the same fonts
and SVG text engine the site uses (site/src/fit.ts). This script starts a
temporary Vite server for site/, opens site/fit.html in headless Chromium,
waits for the result and saves it. Run build_gallery.py first.

  python fit_lettering.py              # all recreations
  python fit_lettering.py long-ministry
  python fit_lettering.py long-wildfire forests-wildfire   # several

Needs: npm install in site/, and Playwright with Chromium
(python -m pip install playwright && python -m playwright install chromium).
"""
import json, socket, subprocess, sys, time, urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
SITE = HERE / 'site'
OUT = HERE / 'lettering-fit.json'


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def main():
    only = ','.join(sys.argv[1:])
    port = free_port()
    server = subprocess.Popen(['npx', 'vite', '--host', '127.0.0.1', '--port', str(port), '--strictPort', '--logLevel', 'error'], cwd=SITE)
    try:
        url = 'http://127.0.0.1:%d/' % port
        for _ in range(150):
            try:
                urllib.request.urlopen(url, timeout=1)
                break
            except OSError:
                time.sleep(0.2)
        else:
            raise SystemExit('Vite did not start on port %d' % port)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.on('console', lambda m: m.type == 'error' and print('browser:', m.text))
            page.goto(url + 'fit.html' + ('?only=' + only if only else ''))
            page.wait_for_function('window.__fitDone === true', timeout=30 * 60 * 1000)
            print(page.inner_text('#log').rstrip())
            error = page.evaluate('window.__fitError')
            fits = page.evaluate('window.__fit')
            browser.close()
        if error:
            raise SystemExit(error)
        merged = json.loads(OUT.read_text()) if only and OUT.exists() else {}
        merged.update(fits)
        OUT.write_text(json.dumps(merged, indent=1) + '\n', encoding='utf-8')
        print('Wrote %s (%d recreations)' % (OUT.name, len(merged)))
    finally:
        server.terminate()


if __name__ == '__main__':
    main()
