from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
root = Path(__file__).resolve().parents[1]
files = ['manifest.json','background.js','core.js','auth.js','config.js','content.js','dashboard.html','dashboard.js','popup.html','popup.js','admin.html','admin.js','style.css','icon128.png']
manifest = json.loads((root/'manifest.json').read_text(encoding='utf-8'))
# The store assigns its own identity; keep the development key in local installs only.
manifest.pop('key', None)
out = root/'release'
out.mkdir(exist_ok=True)
with ZipFile(out/'ApplyLedger-store.zip','w',ZIP_DEFLATED) as archive:
    for name in files:
        if name == 'manifest.json': archive.writestr(name,json.dumps(manifest,indent=2))
        else: archive.write(root/name,name)
print('Packaged version '+manifest['version'])
