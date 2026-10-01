#!/usr/bin/env python3
"""Validate the selected Kabel Black OTF and stage it at fonts/Kabel-Black.otf."""
import argparse
import base64
import binascii
import hashlib
import json
import os
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('font', type=Path, nargs='?', help='Path to your selected Kabel-Black.otf')
    parser.add_argument('--check', action='store_true', help='Validate the existing local input without copying')
    parser.add_argument('--from-env', metavar='NAME', help='Decode the font from a build-environment variable (never printed)')
    args = parser.parse_args()
    if sum([args.font is not None, args.check, args.from_env is not None]) != 1:
        parser.error('choose exactly one of a font path, --check, or --from-env NAME')
    manifest = json.loads((ROOT / 'data/kabel-black-font.json').read_text())
    destination = ROOT / 'fonts' / manifest['file']
    source = destination if args.check else args.font
    try:
        if args.from_env:
            value = os.environ.get(args.from_env, '')
            if not value.strip():
                raise ValueError('The selected environment variable is empty.')
            data = base64.b64decode(''.join(value.split()), validate=True)
        else:
            data = source.expanduser().read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if digest != manifest['sha256']:
            raise ValueError('Not the selected Kabel-Black.otf. Expected SHA-256 ' + manifest['sha256'] + '; received ' + digest)
        if not args.check and (source is None or source.expanduser().resolve() != destination.resolve()):
            destination.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as temp:
                temp.write(data)
                temporary = Path(temp.name)
            try:
                os.replace(temporary, destination)
            finally:
                temporary.unlink(missing_ok=True)
        print('Validated selected OTF: ' + str(destination))
        print('Rebuild to use it in the site/studio.')
    except (OSError, ValueError, binascii.Error) as exc:
        parser.exit(1, str(exc) + '\n')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
