"""Read-only check of files eligible for the worker's Git submission."""
from pathlib import Path
import json
import re
import subprocess

LIMIT = 8_388_608
files = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard']).decode().split('\0')
deleted = set(subprocess.check_output(['git', 'ls-files', '--deleted', '-z']).decode().split('\0'))
files = sorted(set(p for p in files if p and p not in deleted and not p.startswith('.imd/')))
for name in files:
    parts = Path(name).parts
    assert not any(p in {'node_modules', '.npm', '.pnpm-store', '.cache', 'out', 'cache', 'broadcast'} for p in parts), f'Generated content: {name}'
    assert not name.startswith('test/scratch/'), 'Scratch files must not be submitted'
    assert not Path(name).is_symlink(), f'Unexpected symlink: {name}'
    assert Path(name).is_file(), f'Missing file: {name}'
for line in subprocess.check_output(['git','ls-files','--stage']).decode().splitlines():
    assert not line.startswith('160000 '), 'Git submodules are not deliverables'
size = sum(Path(p).stat().st_size for p in files)
dist = sum(Path(p).stat().st_size for p in files if p.startswith('dist/'))
assert size <= LIMIT, f'Delivery is {size} bytes (limit {LIMIT})'
assert dist <= 2 * 1024 * 1024, 'Static export exceeds its explicit path budget'
abi_bytes = sum(Path(p).stat().st_size for p in files if p.startswith('docs/abi/'))
source_bytes = size - dist - abi_bytes
assert source_bytes <= 600 * 1024, 'Source/config/docs exceed their explicit path budget'
assert abi_bytes <= 150 * 1024, 'Contract ABI exceeds its explicit path budget'
required = ['VALIDATION.md','dist/index.html','dist/favicon.svg','dist/share.png','README.md','DESIGN.md','REVIEW.md','package-lock.json','docs/abi/WheelhouseRounds.json','src/WheelhouseRounds.sol','test/WheelhouseRounds.t.sol']
for name in required:
    assert name in files, f'Required output is missing or ignored: {name}'
html = Path('dist/index.html').read_text()
for asset in re.findall(r'(?:src|href)="([^"#]+)"',html):
    if asset.startswith(('http:','https:','data:')): continue
    assert asset.startswith('./'), f'Asset URL must be relative: {asset}'
    assert (Path('dist')/asset).is_file(), f'Missing asset: {asset}'
for metadata in ['<title>','name="description"','rel="icon"','property="og:title"','property="og:image"']:
    assert metadata in html, f'Missing metadata: {metadata}'
abi = json.loads(Path('docs/abi/WheelhouseRounds.json').read_text())
assert any(i.get('name') == 'predict' for i in abi)
assert any(i.get('name') == 'settle' for i in abi)
assert Path('dist/share.png').read_bytes()[:8] == b'\x89PNG\r\n\x1a\n'
print(json.dumps({'eligible_files':len(files),'submission_bytes':size,'static_export_bytes':dist,'source_config_docs_bytes':source_bytes,'contract_abi_bytes':abi_bytes,'limit_bytes':LIMIT,'remaining_bytes':LIMIT-size,'required_outputs':'present and not ignored','relative_assets':'valid','abi':'valid JSON'},indent=2))
