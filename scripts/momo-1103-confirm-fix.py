from pathlib import Path

path = Path('firebase-momo.js')
text = path.read_text(encoding='utf-8')

old = '''  const ok = window.confirm(
    "Replace your existing cloud copy with the Momo data currently on this device?

This overwrites the previous cloud backup. Receipt photos and custom wallpaper images stay on this device and are not uploaded."
  );'''
new = '''  const ok = window.confirm(
    "Replace your existing cloud copy with the Momo data currently on this device?\\n\\nThis overwrites the previous cloud backup. Receipt photos and custom wallpaper images stay on this device and are not uploaded."
  );'''

assert old in text, 'Expected malformed manual cloud-upload prompt was not found.'
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
