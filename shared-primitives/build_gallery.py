#!/usr/bin/env python3
"""Copy the supplied reference images into references/ and register each one
to the recreation it belongs to (gallery.json), for the site's Recreations tab.

Registration = the rectangle, in the recreation's own coordinates, that the
reference image is drawn into. Three sources, in order of preference:
  v5      the rectangle the v5 studio already recorded (data/references.json),
          matched to the file by its SHA-256 in data/reference-provenance.json
  bbox    the image's visible outline (alpha, or non-white on opaque images)
          fitted by height to the known outline of the crest it shows
  none    kept as an alternate or context image without an overlay

Run extract_primitives.py first (this reads its manifest.json and layout.json).
Needs Pillow for the bbox fits.

The source can be the original folder of supplied images or references/ itself
(files are matched by content, not name). The new folder is built beside the
old one and only swapped in once everything has been read and registered, so a
failed run leaves references/ and gallery.json as they were.
"""
import argparse, hashlib, json, re, shutil, tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
V5 = HERE.parent / 'bc-ministry-primitives-v5'

# SHA-256 prefix -> (recreation id, role, registration, note)
# Registration: ('v5', references.json key) | ('bbox', target outline) | None
FILES = {
    '3121015fd6e9453b': ('long-ministry', 'primary', ('v5', 'wildlife-long'), 'Small raster.'),
    '0137827e538a5a6b': ('long-wildfire', 'primary', ('v5', 'wildlife-long-ribbon'), ''),
    '0d95864a904e7872': ('long-wildfire', 'alternate', ('bbox', 'frame+ribbon'), 'Smaller copy on white.'),
    '773a802ac186fb9d': ('forests', 'primary', ('bbox', 'frame'), ''),
    '141ff4fb9d852846': ('forests-wildfire', 'primary', ('bbox', 'frame+ribbon'), ''),
    '16125633930e359c': ('forests-wildfire', 'alternate', ('bbox', 'frame+ribbon'), 'Smaller copy.'),
    '80737ce18c38be7f': ('forest-service-mono', 'primary', ('bbox', 'frame'), 'Very small raster (69 × 88 px).'),
    '0bd6a56dfbd26e00': ('wildfire-management', 'primary', ('v5', 'wildfire-management'), 'Photograph of an embroidered patch.'),
    '228ad8ccd01e9718': ('wildfire-management', 'alternate', None, 'Greyscale photograph of the same patch.'),
    'd2899a886954c77e': ('fire-control', 'primary', ('v5', 'fire-control'), 'Photograph; the v5 studio excluded it from calibration as distorted.'),
    'bc36bf4f8a6ac2dd': ('parks', 'primary', ('v5', 'parks'), 'Photograph of an embroidered patch.'),
    '5de4b946c57a24a9': ('airtanker', 'primary', ('v5', 'airtanker'), 'Photograph of a decal.'),
    'b35dc3b09b95a059': ('bcts-wildlife', 'primary', ('v5', 'bcts-wildlife'), ''),
    '3e8e2c6df39770d2': ('bcts-wildlife', 'alternate', None, 'Screenshot of the same lockup.'),
    '9a4b652dbf8fb583': ('bcts-wildlife', 'context', None, 'Banner showing the logo in use.'),
    '187cf7240aac64fd': ('bcts-tree', 'primary', ('v5', 'bcts-tree'), 'Supplied vector.'),
    '8c9db6a9a369ad0d': ('bcts-tree', 'alternate', None, 'Illustrator export of the same lockup.'),
    '4c13727f165fb7c4': ('bcts-district', 'primary', ('v5', 'bcts-district'), ''),
    '454ab05bff1d00f9': ('bcts-stacked-words', 'primary', ('v5', 'bcts-stack'), ''),
    '2666a7698cef9172': ('bcts-wordmark', 'primary', ('v5', 'bcts-only'), ''),
    '7c9068f058238cc8': ('branch-strip', 'primary', ('v5', 'branch-strip'), 'Supplied vector.'),
}


def content_box(manifest, file):
    """Artwork bounds of a generated piece (its viewBox minus the 6-unit pad)."""
    x, y, w, h = map(float, next(m for m in manifest if m['file'] == file)['viewBox'].split())
    return (x + 6, y + 6, x + w - 6, y + h - 6)


def visible_box(path):
    im = Image.open(path)
    if im.mode == 'P': im = im.convert('RGBA')
    if im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] < 250:
        mask = im.getchannel('A').point(lambda a: 255 if a > 24 else 0)
    else:
        grey = im.convert('L')
        mask = grey.point(lambda v: 255 if v < 232 else 0)
    box = mask.getbbox()
    if not box: raise SystemExit('%s: no visible outline to fit (blank image?)' % path.name)
    return im.size, box


def fit(size, box, target):
    """Uniform scale by height; centre the visible outline on the target."""
    (bx0, by0, bx1, by1), (tx0, ty0, tx1, ty1) = box, target
    s = (ty1 - ty0) / (by1 - by0)
    x = (tx0 + tx1) / 2 - (bx0 + bx1) / 2 * s
    y = ty0 - by0 * s
    aspect = ((bx1 - bx0) / (by1 - by0)) / ((tx1 - tx0) / (ty1 - ty0))
    return {'x': x, 'y': y, 'w': size[0] * s, 'h': size[1] * s}, aspect


def svg_size(path):
    head = re.search(r'<svg[^>]*>', path.read_text(encoding='utf-8', errors='replace')).group(0)
    vb = re.search(r'viewBox="([^"]+)"', head).group(1).split()
    # Plain or px sizes only; other units (pt, mm, %) fall back to the viewBox.
    w, h = re.search(r'\swidth="([\d.]+)(?:px)?"', head), re.search(r'\sheight="([\d.]+)(?:px)?"', head)
    return (float(w.group(1)) if w else float(vb[2]), float(h.group(1)) if h else float(vb[3]))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('source', type=Path, help='folder of supplied reference images (or references/ to re-register the current copies)')
    args = ap.parse_args()
    if not args.source.is_dir(): ap.error('%s is not a folder' % args.source)

    manifest = json.loads((HERE / 'manifest.json').read_text(encoding='utf-8'))
    layout = json.loads((HERE / 'layout.json').read_text(encoding='utf-8'))
    v5refs = json.loads((V5 / 'data/references.json').read_text(encoding='utf-8'))
    provenance = json.loads((V5 / 'data/reference-provenance.json').read_text(encoding='utf-8'))
    known = {p['sha256']: k for k, p in provenance.items()}

    frame = content_box(manifest, 'bc-ministry-v5/crest/frame.svg')
    ribbon = content_box(manifest, 'bc-ministry-v5/tabs/service-ribbon.svg')
    targets = {'frame': frame, 'frame+ribbon': (min(frame[0], ribbon[0]), frame[1], max(frame[2], ribbon[2]), max(frame[3], ribbon[3]))}
    to_air = layout['airtanker-operations']['crestTransform']

    out_dir = HERE / 'references'
    # Rerunning on references/ itself keeps the supplied file names on record.
    previous = HERE / 'gallery.json'
    originals = {e['sha256']: e['original'] for e in json.loads(previous.read_text(encoding='utf-8'))['references']} if previous.exists() else {}
    stage = Path(tempfile.mkdtemp(prefix='references-', dir=HERE))
    try:
        entries, unmatched = register(args.source, stage, originals, v5refs, known, targets, to_air)
    except BaseException:
        shutil.rmtree(stage)
        raise
    old = out_dir.with_name('references-old')
    if old.exists(): shutil.rmtree(old)
    if out_dir.exists(): out_dir.rename(old)
    stage.rename(out_dir)
    if old.exists(): shutil.rmtree(old)

    gallery = {'references': entries, 'unmatched': unmatched}
    (HERE / 'gallery.json').write_text(json.dumps(gallery, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    for e in entries:
        print('%-22s %-9s %-34s %s' % (e['id'], e['role'], e['original'][:34], e['method']))
    if unmatched: print('Not in the table (skipped):', ', '.join(unmatched))
    print('%d references copied to %s' % (len(entries), out_dir))
    # The v5 studio reads most of its reference images from references/ too.
    missing = [k for k, r in v5refs.items() if not (V5 / r['file']).is_file()]
    if missing: raise SystemExit('The v5 studio\'s data/references.json now points at missing files for: ' + ', '.join(missing))


def register(source, out_dir, originals, v5refs, known, targets, to_air):
    """Copy each recognised image into out_dir and register it. Entries follow
    the FILES table's order, so the result does not depend on file names."""
    order = list(FILES)
    found, unmatched = [], []
    for path in sorted(source.iterdir()):
        if not path.is_file() or path.name.startswith('.'): continue
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        if sha[:16] in FILES: found.append((order.index(sha[:16]), path, sha))
        else: unmatched.append(path.name)
    found.sort(key=lambda f: f[0])
    seen = {}
    for _, path, sha in found:
        if sha in seen: raise SystemExit('%s and %s are the same image' % (seen[sha], path.name))
        seen[sha] = path.name
    entries, counts = [], {}
    for _, path, sha in found:
        rid, role, how, note = FILES[sha[:16]]
        n = counts[(rid, role)] = counts.get((rid, role), 0) + 1
        name = rid + ('' if role == 'primary' else '-%s%d' % ('alt' if role == 'alternate' else 'context', n)) + path.suffix.lower()
        shutil.copyfile(path, out_dir / name)
        size = svg_size(path) if path.suffix.lower() == '.svg' else Image.open(path).size
        entry = {'id': rid, 'role': role, 'file': 'references/' + name, 'original': originals.get(sha, path.name), 'sha256': sha,
                 'width': size[0], 'height': size[1], 'registration': None, 'method': 'none', 'note': note}
        if how and how[0] == 'v5':
            ref = v5refs[how[1]]
            if known.get(sha) not in (None, how[1]): raise SystemExit('%s: provenance says %s, table says %s' % (path.name, known[sha], how[1]))
            if abs(ref['w'] - size[0]) > 0.01 or abs(ref['h'] - size[1]) > 0.01:
                raise SystemExit('%s is %s × %s but v5 registered %s at %s × %s' % (path.name, *size, how[1], ref['w'], ref['h']))
            entry['registration'] = dict(ref['registration'])
            entry['method'] = 'v5 studio registration (%s)' % ('matched by SHA-256' if known.get(sha) else 'matched by exact SVG size')
        elif how and how[0] == 'bbox':
            size, box = visible_box(path)
            entry['registration'], aspect = fit(size, box, targets[how[1]])
            entry['method'] = 'fitted: visible outline → %s, uniform scale by height (width ratio %.3f)' % (how[1].replace('+', ' + '), aspect)
        if rid == 'airtanker' and entry['registration']:
            r = entry['registration']; a, _, _, d, e, f = to_air
            entry['registration'] = {'x': a*r['x'] + e, 'y': d*r['y'] + f, 'w': a*r['w'], 'h': d*r['h']}
            entry['method'] += ', carried into the airtanker layout with the shared-crest transform'
        if entry['registration']:
            entry['registration'] = {k: round(v, 4) for k, v in entry['registration'].items()}
        entries.append(entry)
    return entries, unmatched


if __name__ == '__main__':
    main()
