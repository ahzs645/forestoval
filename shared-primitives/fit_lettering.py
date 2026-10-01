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
(python -m pip install -r ../requirements.txt && python -m playwright install chromium).
Set CHROMIUM=/path/to/chromium to use an existing browser. Unknown ids are an error.
"""
import json, os, socket, subprocess, sys, time, urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
SITE = HERE / 'site'
OUT = HERE / 'lettering-fit.json'
TIMEOUT = 30 * 60  # seconds for the whole fit


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def vite_command(port):
    """The site's own Vite (never a download through npx). The site is an npm
    workspace member, so it is normally installed in the workspace root."""
    name = 'vite.cmd' if os.name == 'nt' else 'vite'
    vite = next((d / 'node_modules' / '.bin' / name for d in (SITE, SITE.parent) if (d / 'node_modules' / '.bin' / name).exists()), None)
    if not vite: raise SystemExit('Vite is not installed: run npm install in %s first.' % SITE.parent)
    return [str(vite), '--host', '127.0.0.1', '--port', str(port), '--strictPort', '--logLevel', 'error']


def wait_for_server(server, url):
    for _ in range(150):
        if server.poll() is not None: raise SystemExit('Vite exited (code %s) before it served %s' % (server.returncode, url))
        try:
            urllib.request.urlopen(url, timeout=1)
            return
        except OSError:
            time.sleep(0.2)
    raise SystemExit('Vite did not start at %s' % url)


def main():
    only = ','.join(sys.argv[1:])
    port = free_port()
    url = 'http://127.0.0.1:%d/' % port
    server = subprocess.Popen(vite_command(port), cwd=SITE)
    try:
        wait_for_server(server, url)
        with sync_playwright() as p:
            exe = os.environ.get('CHROMIUM')
            browser = p.chromium.launch(**({'executable_path': exe} if exe else {}))
            page = browser.new_page()
            errors = []
            page.on('console', lambda m: m.type == 'error' and print('browser:', m.text))
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(url + 'fit.html' + ('?only=' + only if only else ''))
            # Poll rather than wait blindly: a script that fails to load never
            # sets __fitDone, and the server can die mid-run.
            deadline = time.time() + TIMEOUT
            while not page.evaluate('window.__fitDone === true'):
                if errors: raise SystemExit('The fit page failed: ' + errors[0])
                if server.poll() is not None: raise SystemExit('Vite exited during the fit (code %s)' % server.returncode)
                if time.time() > deadline: raise SystemExit('The fit did not finish within %d minutes' % (TIMEOUT // 60))
                page.wait_for_timeout(1000)
            print(page.inner_text('#log').rstrip())
            error = page.evaluate('window.__fitError')
            fits = page.evaluate('window.__fit')
            browser.close()
        if error:
            raise SystemExit(error)
        if not fits:
            raise SystemExit('The fit page finished without a result')
        merged = json.loads(OUT.read_text(encoding='utf-8')) if only and OUT.exists() else {}
        merged.update(fits)
        OUT.write_text(json.dumps(merged, indent=1) + '\n', encoding='utf-8')
        print('Wrote %s (%d recreations)' % (OUT.name, len(merged)))
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == '__main__':
    main()
