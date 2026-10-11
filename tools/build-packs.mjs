// Run after installing @foundryvtt/foundryvtt-cli into a local tooling prefix:
// FUS_PACK_CLI=/absolute/path/to/node_modules/@foundryvtt/foundryvtt-cli/index.mjs node tools/build-packs.mjs
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
execFileSync('python3',[path.join(root,'tools/extract-action-packs.py')],{stdio:'inherit'});
const {compilePack}=await import(process.env.FUS_PACK_CLI?pathToFileURL(process.env.FUS_PACK_CLI).href:'@foundryvtt/foundryvtt-cli');
for(const name of ['baseline','medieval','modern','sci-fi','actions'])await compilePack(path.join(root,'pack-sources',name),path.join(root,'packs',name));
