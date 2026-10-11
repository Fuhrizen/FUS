import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
const manifest=JSON.parse(fs.readFileSync('system.json')),pkg=JSON.parse(fs.readFileSync('package.json'));
if(manifest.version!==pkg.version)throw new Error('system.json and package.json versions must match');
if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(manifest.version))throw new Error('Version must be X.Y.Z');
if(manifest.download!==`https://github.com/Fuhrizen/FUS/releases/download/v${manifest.version}/FUS-${manifest.version}.zip`)throw new Error('Download URL must match this release version');
for(const name of fs.readdirSync('scripts').filter(n=>n.endsWith('.mjs')))execFileSync(process.execPath,['--check',path.join('scripts',name)]);
for(const pack of manifest.packs)if(!fs.existsSync(path.join(pack.path,'CURRENT')))throw new Error(`Missing compiled pack: ${pack.name}`);
console.log(`FUS ${manifest.version}: version, syntax and runtime pack checks passed`);
