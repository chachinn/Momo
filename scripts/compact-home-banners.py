from pathlib import Path
import re

CSS_PATCH = r'''

/* ========================================
   MOMO 1.7.1 — COMPACT HOME INTRO BANNERS
   Keeps the same soft visual identity while
   giving the money dashboard more room above
   the fold on phones.
======================================== */

.momo-home-welcome {
  min-height: 150px;
  margin-bottom: 14px;
  padding: 16px 18px;
  grid-template-columns: minmax(0, 1fr) 70px;
  border-radius: 25px;
}

.momo-home-welcome h1 {
  margin: 5px 0 5px;
  font-size: clamp(34px, 9.2vw, 42px);
  line-height: 0.95;
  letter-spacing: -0.04em;
}

.momo-home-welcome p:last-child {
  max-width: 235px;
  font-size: 11px;
  line-height: 1.4;
}

.momo-welcome-peach {
  width: 66px;
  height: 66px;
}

.momo-welcome-peach .welcome-peach-icon {
  --icon-size: 3.35rem;
}

.momo-origin-card {
  margin: 0 0 15px;
  padding: 11px 13px;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 10px;
  border-radius: 19px;
}

.momo-origin-icon {
  width: 38px;
  height: 38px;
  border-radius: 13px;
}

.momo-origin-peach-icon {
  --icon-size: 1.65rem;
}

.momo-origin-card .momo-section-kicker {
  margin-bottom: 2px;
  font-size: 8px;
}

.momo-origin-card h2 {
  margin: 0 0 2px;
  font-size: 14px;
  line-height: 1.24;
}

.momo-origin-card p:last-child {
  font-size: 9.5px;
  line-height: 1.4;
}

@media (max-width: 375px) {
  .momo-home-welcome {
    min-height: 142px;
    padding: 15px 16px;
    grid-template-columns: minmax(0, 1fr) 62px;
  }

  .momo-home-welcome h1 {
    font-size: clamp(31px, 9.6vw, 38px);
  }

  .momo-welcome-peach {
    width: 60px;
    height: 60px;
  }

  .momo-welcome-peach .welcome-peach-icon {
    --icon-size: 3rem;
  }

  .momo-origin-card {
    padding: 10px 12px;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 9px;
  }

  .momo-origin-icon {
    width: 36px;
    height: 36px;
  }
}
'''

styles = Path('styles.css')
index = Path('index.html')
app = Path('app.js')
sw = Path('service-worker.js')

styles_text = styles.read_text()
assert 'MOMO 1.7.1 — COMPACT HOME INTRO BANNERS' not in styles_text, 'compact banner patch already present'
assert '.momo-home-welcome' in styles_text, 'home welcome styles missing'
assert '.momo-origin-card' in styles_text, 'origin card styles missing'
styles.write_text(styles_text.rstrip() + CSS_PATCH + '\n')

index_text = index.read_text()
old_index = '<meta name="momo-app-version" content="1.7.0">'
new_index = '<meta name="momo-app-version" content="1.7.1">'
assert old_index in index_text, 'index version marker missing'
index.write_text(index_text.replace(old_index, new_index, 1))

app_text = app.read_text()
old_app = '// Momo 1.7.0 — Peach Jars + Payday Planner + Subscription Center + Payables'
new_app = '// Momo 1.7.1 — Compact home banners + Peach Jars + Payday Planner + Subscription Center + Payables'
assert old_app in app_text, 'app version comment missing'
app.write_text(app_text.replace(old_app, new_app, 1))

sw_text = sw.read_text()
old_sw_comment = '// Momo 1.7.0 — update notes + large-list stability + push reminders + network-first PWA shell'
new_sw_comment = '// Momo 1.7.1 — compact home banners + update notes + large-list stability + push reminders + network-first PWA shell'
assert old_sw_comment in sw_text, 'service-worker version comment missing'
sw_text = sw_text.replace(old_sw_comment, new_sw_comment, 1)
assert '  "1.7.0";' in sw_text, 'service-worker APP_VERSION missing'
sw_text = sw_text.replace('  "1.7.0";', '  "1.7.1";', 1)
sw.write_text(sw_text)

css = styles.read_text()
html = index.read_text()
sw_final = sw.read_text()

assert css.count('MOMO 1.7.1 — COMPACT HOME INTRO BANNERS') == 1
assert 'min-height: 150px;' in css
assert 'grid-template-columns: 38px minmax(0, 1fr);' in css
assert 'content="1.7.1"' in html
assert '"1.7.1";' in sw_final
assert css.count('{') == css.count('}'), 'unbalanced CSS braces'

ids = re.findall(r'\bid="([^"]+)"', html)
duplicates = sorted({value for value in ids if ids.count(value) > 1})
assert not duplicates, f'duplicate HTML ids: {duplicates}'

print('Momo 1.7.1 compact banner patch verified.')
