from pathlib import Path
from html.parser import HTMLParser
import re, subprocess, sys, hashlib

ROOT = Path('.')
EXPECTED_VERSION = '1.5.0'
FILES = ['app.js','firebase-momo.js','index.html','service-worker.js','styles.css']

for name in FILES:
    path = ROOT / name
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f'Missing or empty release file: {name}')

app = (ROOT/'app.js').read_text(encoding='utf-8')
fb = (ROOT/'firebase-momo.js').read_text(encoding='utf-8')
html = (ROOT/'index.html').read_text(encoding='utf-8')
sw = (ROOT/'service-worker.js').read_text(encoding='utf-8')
css = (ROOT/'styles.css').read_text(encoding='utf-8')

checks = {
    'index version meta': f'content="{EXPECTED_VERSION}"' in html,
    'app version header': f'Momo {EXPECTED_VERSION}' in app,
    'service-worker version': f'"{EXPECTED_VERSION}"' in sw,
    'database schema unchanged': 'const DB_VERSION = 4;' in app,
    'what-new modal': 'id="momoWhatsNewModal"' in html,
    'refresh banner': 'id="appUpdateBanner"' in html and 'id="applyAppUpdate"' in html,
    'refresh label': 'Refreshing…' in html,
    'release note storage': 'momo_last_seen_update_version' in html,
    'controller version handshake page': 'GET_MOMO_VERSION' in html,
    'controller version handshake worker': 'GET_MOMO_VERSION' in sw,
    'explicit skip-waiting': 'SKIP_WAITING' in html and 'SKIP_WAITING' in sw,
    'network-only update probe': 'momo_update_check' in html and 'momo_update_check' in sw,
    'stable shell cache-first': 'Keep the currently active Momo shell stable until the user accepts' in sw,
    'push listener retained': 'self.addEventListener("push"' in sw,
    'notification click retained': 'self.addEventListener("notificationclick"' in sw,
    'large activity batching': 'ACTIVITY_RENDER_BATCH = 50' in app,
    'activity search debounce': 'FILTER_INPUT_DEBOUNCE_MS = 140' in app,
    'recurring batching': 'RECURRING_RENDER_BATCH = 60' in app,
    'planned batching': 'PLANNED_RENDER_BATCH = 60' in app,
    'receipt batching': 'RECEIPT_RENDER_BATCH = 48' in app,
    'payable batching': 'PAYABLE_RENDER_BATCH = 60' in app,
    'home recent scan': 'function getRecentExpenses' in app,
    'search lookup maps': 'const tripLookup =' in app and 'const budgetLookup =' in app,
    'content visibility': 'content-visibility: auto' in css,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Release QA failed: ' + ', '.join(failed))

for token in ['momo-notifications','notificationAuth','notificationDb','signInWithPopup','signInAnonymously']:
    if token not in fb:
        raise SystemExit(f'Firebase auth regression: missing {token}')

expected_firebase_blob = '663519f3dcae4390f43b323a0409b33280e0ac59'
actual_firebase_blob = subprocess.check_output(['git','hash-object','firebase-momo.js'], text=True).strip()
if actual_firebase_blob != expected_firebase_blob:
    raise SystemExit(f'firebase-momo.js changed unexpectedly: {actual_firebase_blob}')

class IdParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = {}
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids[attrs['id']] = self.ids.get(attrs['id'], 0) + 1
    handle_startendtag = handle_starttag

parser = IdParser(); parser.feed(html)
dups = {k:v for k,v in parser.ids.items() if v > 1}
if dups:
    raise SystemExit(f'Duplicate HTML ids: {dups}')

blocks = re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', html, re.I|re.S)
for i, block in enumerate(blocks):
    if not block.strip():
        continue
    temp = ROOT / f'.momo-inline-qa-{i}.js'
    temp.write_text(block, encoding='utf-8')
    try:
        proc = subprocess.run(['node','--check',str(temp)], capture_output=True, text=True)
        if proc.returncode:
            raise SystemExit(f'Inline script {i} syntax error:\n{proc.stderr}')
    finally:
        temp.unlink(missing_ok=True)

print(f'MOMO_RELEASE_QA_OK version={EXPECTED_VERSION} ids={len(parser.ids)}')
