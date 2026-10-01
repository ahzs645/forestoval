#!/usr/bin/env python3
"""Structural export tests; not a claim of photographic fidelity or embroidery readiness."""
from pathlib import Path
import hashlib,json,re
from lxml import etree as E
ROOT=Path(__file__).resolve().parents[1]
def main():
 ps=json.loads((ROOT/'data/presets.json').read_text());report={'scope':'Structural vector integrity, not fidelity approval','files':[]};all_ids=set()
 for variant in ['editable','outlined']:
  for p in ps:
   f=ROOT/'svg'/variant/(p['id']+'.svg');root=E.parse(str(f)).getroot();els=list(root.iter());ids=[n.get('id') for n in els if n.get('id')]
   assert len(ids)==len(set(ids)),f'Duplicate IDs: {f}'
   assert not any(E.QName(n).localname in ['image','script','foreignObject'] for n in els),f'Unexpected raster/active content: {f}'
   if variant=='outlined':assert not any(E.QName(n).localname=='text' for n in els),f'Text in outlined master: {f}'
   refs=[]
   for n in els:
    for k,v in n.attrib.items():
     refs.extend(re.findall(r'url\(#([^\)]+)\)',v))
     if E.QName(k).localname=='href':
      assert v.startswith('#'),f'External reference in {f}'
      refs.append(v[1:])
   assert set(refs)<=set(ids),f'Broken reference: {f}'
   if variant=='outlined':
    assert not(all_ids&set(ids)),f'Inline-preview ID collision {f}'
    all_ids.update(ids)
   report['files'].append({'file':str(f.relative_to(ROOT)),'idCount':len(ids),'referenceCount':len(refs),'pathCount':sum(E.QName(e).localname=='path' for e in els),'valid':True})
 inv=json.loads((ROOT/'data/source-inventory.json').read_text());assert len(inv)==59;assert len({s['sourceId'] for s in inv})==59
 art=json.loads((ROOT/'assets/forestoval-art.json').read_text());checks=json.loads((ROOT/'reports/upstream-art-verification.json').read_text())['checks'];report['originalArtMatches']={k:hashlib.sha256(art[k].encode()).hexdigest()==v['expected'] for k,v in checks.items()}
 # Local source imports may intentionally update art. Record drift rather than hiding it.
 for fp in ROOT.rglob('*'):
  assert fp.suffix.lower() not in ['.ttf','.otf','.woff','.woff2','.eot'],f'Font binary must not be distributed: {fp}'
 fits=json.loads((ROOT/'reports/text-fit.json').read_text());report['textRunsFitTheirAvailableLength']=all(r['width']<=r['available']+.01 for rows in fits.values() for r in rows)
 assert report['textRunsFitTheirAvailableLength'];report['sourceCount']=len(inv);report['svgCount']=len(report['files']);report['passed']=True
 (ROOT/'reports/validation.json').write_text(json.dumps(report,indent=2));print(f'PASS: {report["svgCount"]} SVGs, 59 source records, valid internal references, no raster or font binaries.')
if __name__=='__main__':main()
