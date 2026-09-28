#!/usr/bin/env python3
"""Build the dependency-free standalone studio from readable source files.

Reference images are stored once, as files (most in ../shared-primitives/references);
data/references.json names them and this build inlines them as data URLs, so the
built page still works opened straight from disk."""
from pathlib import Path
import argparse, base64, json, re
ROOT=Path(__file__).resolve().parent
TOKENS={'STUDIO_CSS':'src/studio.css','PRIMITIVES_JS':'src/primitives.js','ENGINE_JS':'src/engine.js','STUDIO_JS':'src/studio.js','ART_JSON':'data/art.json','REFERENCE_JSON':'data/references.json'}
MIME={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}
def references():
    """data/references.json with each `file` swapped for an inline `src` data URL."""
    refs=json.loads((ROOT/'data/references.json').read_text(encoding='utf-8'))
    for key,ref in refs.items():
        path=ROOT/ref['file']
        if path.suffix.lower() not in MIME:raise SystemExit('%s: unsupported reference type %s'%(key,path.name))
        if not path.is_file():raise SystemExit('%s: missing reference %s'%(key,path))
        src='data:%s;base64,%s'%(MIME[path.suffix.lower()],base64.b64encode(path.read_bytes()).decode())
        refs[key]={('src' if k=='file' else k):(src if k=='file' else v) for k,v in ref.items()}
    return refs
def source(token):
    name=TOKENS[token]
    if token=='REFERENCE_JSON':text=json.dumps(references(),ensure_ascii=False,separators=(',',':'))
    else:text=(ROOT/name).read_text(encoding='utf-8')
    if token=='ENGINE_JS':
        # Use the generated authoritative profile, without a second numeric copy.
        shared=ROOT.parent/'shared-primitives'
        profile=json.loads((shared/'layout.json').read_text(encoding='utf-8'))['tab']
        text=('globalThis.BCTabProfile='+json.dumps(profile,separators=(',',':'))+';\n'
              +(shared/'tab-layout.js').read_text(encoding='utf-8')+'\n'+text)
    if name.endswith('.json'):
        if token!='REFERENCE_JSON':text=json.dumps(json.loads(text),ensure_ascii=False,separators=(',',':'))
        return text.replace('</','<\\/')
    if name.endswith('.js'):return re.sub(r'</(script)',r'<\\/\1',text,flags=re.I)
    if re.search(r'</style',text,re.I):raise SystemExit(name+' contains </style, which would end the style element early')
    return text
def build(dest=None):
    html=(ROOT/'src/studio.html').read_text(encoding='utf-8')
    for token in TOKENS:
        n=html.count('/*'+token+'*/')
        if n!=1:raise SystemExit('src/studio.html has %d /*%s*/ placeholders; expected exactly 1'%(n,token))
    # One pass, so text inside an inserted source is never itself expanded.
    parts={token:source(token) for token in TOKENS}
    html=re.sub(r'/\*('+'|'.join(TOKENS)+r')\*/',lambda m:parts[m.group(1)],html)
    dest=Path(dest) if dest else ROOT/'bc-ministry-primitives-v5.html'
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(html,encoding='utf-8')
    print(dest)
    return dest
if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--out',type=Path,help='where to write the page (default: bc-ministry-primitives-v5.html here)')
    build(ap.parse_args().out)
