#!/usr/bin/env python3
"""Build the dependency-free standalone studio from readable source files."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
TOKENS={'STUDIO_CSS':'src/studio.css','PRIMITIVES_JS':'src/primitives.js','ENGINE_JS':'src/engine.js','STUDIO_JS':'src/studio.js','ART_JSON':'data/art.json','REFERENCE_JSON':'data/references.json'}
def build():
    html=(ROOT/'src/studio.html').read_text(encoding='utf-8')
    for token,name in TOKENS.items():
        text=(ROOT/name).read_text(encoding='utf-8')
        if name.endswith('.json'):
            text=json.dumps(json.loads(text),ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
        elif name.endswith('.js'):
            text=text.replace('</script','<\\/script')
        html=html.replace('/*'+token+'*/',text)
    dest=ROOT/'bc-ministry-primitives-v5.html'
    dest.write_text(html,encoding='utf-8')
    print(dest)
    return dest
if __name__=='__main__':build()
