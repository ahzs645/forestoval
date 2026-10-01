#!/usr/bin/env node
/** Read-only repository adapter. --write changes this KIT, never either checkout. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const help = `Usage: node tools/import_sources.mjs [--forestoval /path/to/forestoval] [--pofbc /path/to/PofBC] [--write]\nWithout --write: validate and describe imports. With --write: replace kit assets, then rerun build_vectors.py.\nNo repository is edited. Only use checkouts whose JavaScript you trust.`;
const opt={write:false};
for(let i=0;i<args.length;i++) {
 const a=args[i];
 if(a==='--help'){console.log(help);process.exit(0);}
 if(a==='--write'){opt.write=true;continue;}
 if(!['--forestoval','--pofbc'].includes(a)||!args[i+1]||args[i+1].startsWith('--')) throw new Error(help);
 opt[a.slice(2)]=path.resolve(args[++i]);
}
if(!opt.forestoval&&!opt.pofbc) {console.log(help);process.exit(1);}
const sha = s => createHash('sha256').update(s).digest('hex');
const commit = p => { try{return execFileSync('git',['-C',p,'rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{return null;} };
const provenance={mode:opt.write?'write-kit-assets':'dry-run',recordedAt:new Date().toISOString(),repositories:[]};
if(opt.forestoval) {
 const art=JSON.parse(await fs.readFile(path.join(opt.forestoval,'bc-ministry-primitives-v5/data/art.json'),'utf8'));
 const expected=JSON.parse(await fs.readFile(path.join(opt.forestoval,'bc-ministry-primitives-v5/data/art-sha256.json'),'utf8'));
 const checks=Object.fromEntries(Object.entries(expected).map(([k,v])=>[k,typeof art[k]==='string'&&sha(art[k])===v]));
 if(Object.values(checks).some(v=>!v))throw new Error('forestoval ART does not match its own committed manifest. No asset was written.');
 provenance.repositories.push({name:'ahzs645/forestoval',commit:commit(opt.forestoval),checks});
 if(opt.write)await fs.writeFile(path.join(root,'assets/forestoval-art.json'),JSON.stringify(art,null,2));
}
if(opt.pofbc) {
 const sourcePath=path.join(opt.pofbc,'src/assets/markup.js');
 const js=await fs.readFile(sourcePath,'utf8');
 // This documented generated file is self-contained JS. Import from a data URL
 // avoids relying on the caller's package.json module mode.
 const {PROVINCIAL_MARK:m}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 if(!m||typeof m.inner!=='string'||!Number.isFinite(m.viewBox?.width)||!Number.isFinite(m.viewBox?.height))throw new Error('PofBC PROVINCIAL_MARK interface changed; inspect the export before proceeding.');
 if(/<(?:script|image|foreignObject)\b/i.test(m.inner))throw new Error('Unexpected active or raster content in provincial mark.');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.viewBox.width} ${m.viewBox.height}"><title>Provincial crest imported from PofBC</title><desc>Unchanged PROVINCIAL_MARK.inner, one-ink presentation.</desc><g fill="#ffffff">${m.inner}</g></svg>`;
 provenance.repositories.push({name:'ahzs645/PofBC',commit:commit(opt.pofbc),file:'src/assets/markup.js',sha256:sha(js),method:'Unmodified PROVINCIAL_MARK.inner; white presentation group only.'});
 if(opt.write)await fs.writeFile(path.join(root,'assets/provincial-crest.svg'),svg);
}
if(opt.write) await fs.writeFile(path.join(root,'reports/local-import-provenance.json'),JSON.stringify(provenance,null,2));
console.log(JSON.stringify(provenance,null,2));
console.log(opt.write?'Imported into the kit only. Rebuild vectors and previews.':'Dry run only. Add --write to update kit assets.');
