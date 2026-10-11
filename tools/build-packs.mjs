// Run after installing @foundryvtt/foundryvtt-cli into a local tooling prefix:
// FUS_PACK_CLI=/absolute/path/to/node_modules/@foundryvtt/foundryvtt-cli/index.mjs node tools/build-packs.mjs
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {compilePack}=await import(process.env.FUS_PACK_CLI?pathToFileURL(process.env.FUS_PACK_CLI).href:'@foundryvtt/foundryvtt-cli');
for(const name of ['baseline','medieval','modern','sci-fi'])await compilePack(path.join(root,'pack-sources',name),path.join(root,'packs',name));
