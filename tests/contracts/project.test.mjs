import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import Handlebars from 'handlebars';import {compilePack,extractPack} from '@foundryvtt/foundryvtt-cli';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),manifest=read('system.json');
const docs=dir=>fs.readdirSync(dir,{recursive:true}).filter(n=>n.endsWith('.json')).map(n=>read(path.join(dir,n)));
test('manifest, npm metadata, local assets and imported modules are consistent',()=>{
 const pkg=read('package.json'),lock=read('package-lock.json');assert.equal(pkg.version,manifest.version);assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);
 for(const file of [...manifest.esmodules,...manifest.styles,...manifest.languages.map(l=>l.path)])assert.ok(fs.existsSync(file),file);
 for(const name of fs.readdirSync('scripts').filter(n=>n.endsWith('.mjs'))){const source=fs.readFileSync('scripts/'+name,'utf8');for(const match of source.matchAll(/(?:from\s*|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g))assert.ok(fs.existsSync(path.resolve('scripts',match[2])),name+': '+match[2]);}
});
test('every Handlebars template compiles, including nested panels',()=>{for(const name of fs.readdirSync('templates').filter(n=>n.endsWith('.hbs')))assert.doesNotThrow(()=>Handlebars.precompile(fs.readFileSync('templates/'+name,'utf8')),name);});
test('all compendium documents have unique ids, valid folders, action links and local icons',()=>{
 const packs=new Map(manifest.packs.map(p=>[p.name,new Map(docs('pack-sources/'+p.name).map(d=>[d._id,d]))]));
 for(const pack of manifest.packs){const source=docs('pack-sources/'+pack.name),byId=packs.get(pack.name);assert.equal(byId.size,source.length,pack.name+' duplicate ids');
 for(const d of source){assert.match(d._id,/^[A-Za-z0-9]{16}$/);assert.ok(d.name?.trim());assert.equal(d._key,`${d.type==='Item'?'!folders!':'!items!'}${d._id}`);
 if(d.folder)assert.equal(byId.get(d.folder)?.type,'Item',d.name+' folder');
 if(d.img?.startsWith('systems/FUS/'))assert.ok(fs.existsSync(d.img.slice('systems/FUS/'.length)),d.img);
 for(const link of d.system?.actionLinks??[]){const m=/^Compendium\.FUS\.([^.]+)\.Item\.([^.]+)$/.exec(link.uuid);assert.ok(m,link.uuid);assert.equal(packs.get(m[1])?.get(m[2])?.type,'action',d.name+' dangling Action');}
 if(d.type==='weapon'){assert.ok(d.system.maximum>=d.system.optimal);assert.ok(d.system.resourceCurrent<=d.system.resourceMax);}
 }
 }
});
test('checked-in LevelDB packs match source documents, and clean rebuilds round-trip',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fus-packs-'));
 const canonical=d=>JSON.parse(JSON.stringify(d));const index=dir=>new Map(docs(dir).map(d=>[d._id,canonical(d)]));
 try{for(const pack of manifest.packs){const source=index('pack-sources/'+pack.name),checked=path.join(temp,pack.name+'-checked'),rebuilt=path.join(temp,pack.name+'-rebuilt'),extracted=path.join(temp,pack.name+'-extracted');
 await extractPack(pack.path,checked,{documentType:'Item'});const actual=index(checked);assert.deepEqual(actual,source,pack.name+' checked-in runtime is stale');
 await compilePack('pack-sources/'+pack.name,rebuilt);await extractPack(rebuilt,extracted,{documentType:'Item'});assert.deepEqual(index(extracted),source,pack.name+' rebuild mismatch');
 }}finally{fs.rmSync(temp,{recursive:true,force:true});}
});
