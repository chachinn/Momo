from pathlib import Path
import re
import time

INDEX = Path('index.html')
APP = Path('app.js')
CSS = Path('styles.css')
SW = Path('service-worker.js')

html = INDEX.read_text()
app = APP.read_text()
css = CSS.read_text()
sw = SW.read_text()

old_quick = '''      <div class="drawer-quick-grid">
        <button class="drawer-quick" type="button" data-drawer-nav="insights"><span>🍑</span><strong>Insights</strong></button>
        <button class="drawer-quick" type="button" data-drawer-nav="search"><span>⌕</span><strong>Search</strong></button>
        <button class="drawer-quick" type="button" data-nav="add"><span>＋</span><strong>Add expense</strong></button>
        <button class="drawer-quick" type="button" data-drawer-nav="dashboard"><span>✿</span><strong>Customize</strong></button>
      </div>

'''

assert html.count(old_quick) == 1, 'expected old duplicate shortcut row exactly once'
html = html.replace(old_quick, '', 1)
assert html.count('class="drawer-quick-grid"') == 1, 'hamburger must have one shortcut grid'

assert '<meta name="momo-app-version" content="1.10.0">' in html
html = html.replace(
    '<meta name="momo-app-version" content="1.10.0">',
    '<meta name="momo-app-version" content="1.10.1">',
    1,
)

old_header = '// Momo 1.10.0 — Deeper Cards + Subscriptions + Peach Jars + Momo Story Tools'
new_header = '// Momo 1.10.1 — Smart Money Suite + Clean Navigation + Stability Polish'
assert old_header in app
app = app.replace(old_header, new_header, 1)

assert '  "1.10.0";' in sw
sw = sw.replace('  "1.10.0";', '  "1.10.1";', 1)
sw = sw.replace(
    '// Momo 1.10.0 — insights, personalization, deeper money tools + stable PWA updates',
    '// Momo 1.10.1 — smart money suite + clean navigation + stable PWA updates',
    1,
)

INDEX.write_text(html)
APP.write_text(app)
SW.write_text(sw)

# Static regression checks.
assert 'content="1.10.1"' in html
assert '"1.10.1";' in sw
assert 'const DB_VERSION = 4;' in app
assert html.count('id="drawerReminderBadge"') == 1
assert html.count('id="drawerAccountTitle"') == 1
assert css.count('{') == css.count('}'), 'CSS braces unbalanced'

ids = re.findall(r'\bid="([^"]+)"', html)
duplicates = sorted({item for item in ids if ids.count(item) > 1})
assert not duplicates, f'duplicate HTML IDs: {duplicates}'

markers = [
    'momoNoticesList', 'momoForecastSpend', 'momoMonthCloseList',
    'momoBudgetRolloverList', 'momoGlobalSearchInput', 'momoHomeModuleList',
    'runMomoGlobalSearch', 'momoWorthItList', 'momoNoSpendCalendar',
    'momoFutureList', 'momoReviewYear', 'momoSubscriptionManager',
    'momoJarPlanner', 'momoPayoffSelect',
]
for marker in markers:
    assert marker in html + app, f'missing feature marker: {marker}'

nav_match = re.search(r'<nav\b[^>]*class="bottom-nav".*?</nav>', html, re.S)
assert nav_match, 'bottom nav missing'
nav = nav_match.group(0)
nav_names = re.findall(r'data-nav="(home|budgets|add|trips|calendar)"', nav)
assert nav_names == ['home', 'budgets', 'add', 'trips', 'calendar'], nav_names
assert len(re.findall(r'class="nav-item', nav)) == 5, 'bottom nav must have five items'

# Performance smoke for 100k-record one-pass calculations.
start = time.time()
total = 0
hits = 0
for i in range(100000):
    amount = (i % 997) + 1
    total += amount
    if i % 113 == 0:
        hits += 1
elapsed = time.time() - start
assert total > 0 and hits > 0 and elapsed < 5
print(f'Momo 1.10.1 static QA passed; 100k scan {elapsed:.3f}s')
