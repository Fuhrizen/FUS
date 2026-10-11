import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {nextVersion,bumpFiles} from '../tools/bump-version.mjs';
test('release dropdown increments the selected part and resets lower parts',()=>{
 assert.equal(nextVersion('0.2.9','major'),'1.0.0');
 assert.equal(nextVersion('0.2.9','feature'),'0.3.0');
 assert.equal(nextVersion('0.2.9','minor'),'0.2.10');
 assert.throws(()=>nextVersion('0.2.9','patch'));
 assert.throws(()=>nextVersion('beta','minor'));
});
test('release bump synchronizes manifests, download URL and npm lock metadata',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'fus-release-'));
 try {
  for (const name of ['system.json','package.json','package-lock.json']) fs.copyFileSync(name,path.join(root,name));
  const version=bumpFiles(root,'feature');
  const read=name=>JSON.parse(fs.readFileSync(path.join(root,name)));
  assert.equal(read('system.json').version,version);
  assert.equal(read('package.json').version,version);
  assert.equal(read('package-lock.json').packages[''].version,version);
  assert.equal(read('system.json').download,`https://github.com/Fuhrizen/FUS/releases/download/v${version}/FUS-${version}.zip`);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('automatic collection releases cannot request major without manual approval',async()=>{const {releaseBump}=await import('../tools/bump-version.mjs');assert.equal(releaseBump('push','',{bump:'minor'}),'minor');assert.equal(releaseBump('push','',{bump:'feature'}),'feature');assert.equal(releaseBump('push','',{}),'minor');assert.throws(()=>releaseBump('push','',{bump:'major'}),/approval/);assert.equal(releaseBump('workflow_dispatch','major',{}),'major');});
