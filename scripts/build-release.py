"""Create an offline release ZIP without supplied source photographs.

python scripts/build-release.py --output <new-release.zip>
Original files are never removed or changed. Existing ZIPs are not overwritten.
"""
from pathlib import Path
import argparse, hashlib, json, zipfile

ROOT = Path(__file__).resolve().parents[1]
REFERENCE_PHOTOS = {
    '참고자료/적 카드/20261011_230854.jpg',
    '참고자료/적 카드/20261011_230907.jpg',
    '참고자료/화기/20261011_230950.jpg',
    '참고자료/화기/20261011_231000.jpg',
}
RUNTIME_DOCUMENTS = {
    'docs/guides/WEAPON_VISUAL_GUIDE.txt',
    'docs/guides/ENEMY_VISUAL_GUIDE.txt',
    'docs/audits/legacy/WEAPON_REFERENCE_REVIEW.txt',
    'docs/rules/checklist/RULES_CHECKLIST.xlsx',
    'docs/verification/legacy/VERIFICATION_v085.txt',
}
IGNORED_PARTS = {'.git', 'node_modules', '__pycache__', '.pytest_cache', 'qa-fixtures', 'qa-fixtures-enemies', 'qa-fixtures-map-v0810'}

def included(relative):
    p = Path(relative)
    rel = p.as_posix()
    if any(part in IGNORED_PARTS for part in p.parts): return False
    if p.parts[0] == 'docs': return rel in RUNTIME_DOCUMENTS
    if p.parts[0] in {'참고자료', '.github', 'scripts', 'tests', 'test-results', 'dist', 'outputs', 'work', 'unity-port'}: return False
    if rel in {'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', '.gitignore', '.gitattributes', 'scripts/test-ci.cjs'}: return False
    if rel == 'qa-load.html' or p.suffix.lower() in {'.zip', '.pyc'}: return False
    if rel.startswith('campaigns/long-hunt/images/'): return False
    if rel.startswith('components/images/'): return False
    return True

def build(destination):
    destination = Path(destination).resolve()
    if destination.exists(): raise RuntimeError('Existing output is preserved; choose a new ZIP path.')
    data = json.loads((ROOT/'components/supplied-components.json').read_text(encoding='utf-8-sig'))
    present = [photo for photo in data['photos'] if (ROOT/photo['path']).exists()]
    if present and len(present) != len(data['photos']):
        raise RuntimeError('Developer source-photo set is incomplete.')
    for photo in data['photos']:
        if photo['path'] not in REFERENCE_PHOTOS: raise RuntimeError('Non-canonical source-photo path.')
        if not present: continue
        raw = (ROOT/photo['path']).read_bytes()
        if len(raw) != photo['bytes'] or hashlib.sha256(raw).hexdigest() != photo['sha256']:
            raise RuntimeError('Source photo differs from its recorded provenance: '+photo['path'])
    files = {p.relative_to(ROOT).as_posix():p for p in ROOT.rglob('*') if p.is_file() and included(p.relative_to(ROOT))}
    if any(p.is_symlink() for p in files.values()): raise RuntimeError('Symlinks are not included in a release.')
    expected = {rel:hashlib.sha256(p.read_bytes()).hexdigest() for rel,p in files.items()}
    destination.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(destination,'x',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for rel,p in sorted(files.items()): z.write(p,'bloodborne-solo/'+rel)
    with zipfile.ZipFile(destination) as z:
        if set(z.namelist()) != {'bloodborne-solo/'+rel for rel in files}: raise RuntimeError('ZIP inventory mismatch.')
        for rel,digest in expected.items():
            if hashlib.sha256(z.read('bloodborne-solo/'+rel)).hexdigest() != digest: raise RuntimeError('ZIP hash mismatch: '+rel)
    return {'files':len(files),'sourcePhotos':0,'validatedDeveloperSourcePhotos':len(present),'legacyRootPhotos':0}

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    print(json.dumps(build(args.output)))
