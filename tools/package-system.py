"""Build an installable system ZIP and release manifest from checked-in runtime files."""
from pathlib import Path
import json,re,zipfile
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'system.json').read_text())
version=manifest['version']
if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)',version):raise ValueError('Use X.Y.Z for every release version')
output=ROOT/'dist';output.mkdir(exist_ok=True)
manifest_bytes=(json.dumps(manifest,indent=2)+'\n').encode()
(output/'system.json').write_bytes(manifest_bytes)
archive=output/f'FUS-{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('FUS/system.json',manifest_bytes)
 for filename in ['README.md']:
  z.write(ROOT/filename,'FUS/'+filename)
 for dirname in ['scripts','templates','styles','lang','packs']:
  for p in sorted((ROOT/dirname).rglob('*')):
   if p.is_file() and p.name not in ['LOCK','LOG','LOG.old']:
    z.write(p,'FUS/'+p.relative_to(ROOT).as_posix())
print(archive)
