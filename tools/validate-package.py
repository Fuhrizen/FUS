"""Verify that the installable release contains exactly the runtime payload."""
from pathlib import Path
import json,zipfile,hashlib
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'system.json').read_text());version=manifest['version']
archive=root/'dist'/f'FUS-{version}.zip'
with zipfile.ZipFile(archive) as z:
 names=z.namelist()
 assert len(names)==len(set(names)), 'Duplicate ZIP entries'
 assert all(n.startswith('FUS/') and '..' not in Path(n).parts for n in names), 'Unsafe ZIP paths'
 assert z.testzip() is None, 'ZIP CRC validation failed'
 bundled=json.loads(z.read('FUS/system.json'))
 assert bundled==manifest==json.loads((root/'dist/system.json').read_text()), 'Manifest mismatch'
 expected={'FUS/system.json','FUS/README.md'}
 for folder in ['scripts','templates','styles','lang','packs','assets']:
  for p in (root/folder).rglob('*'):
   if p.is_file() and p.name not in ['LOCK','LOG','LOG.old']:expected.add('FUS/'+p.relative_to(root).as_posix())
 assert set(names)==expected, f'Unexpected/missing runtime files: {set(names)^expected}'
 for n in expected-{'FUS/system.json'}:assert z.read(n)==(root/n.removeprefix('FUS/')).read_bytes(), f'Stale file: {n}'
 for pack in manifest['packs']:assert 'FUS/'+pack['path']+'/CURRENT' in names, f'Missing pack: {pack["name"]}'
 digest=hashlib.sha256(archive.read_bytes()).hexdigest()
 (archive.parent/'SHA256SUMS').write_text(f'{digest}  {archive.name}\n')
 print(f'Validated {archive.name}: {len(names)} runtime files; SHA256 {digest}')
