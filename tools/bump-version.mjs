import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function nextVersion(version, bump) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error('Version must be X.Y.Z');
  const parts = version.split('.').map(Number);
  const index = {major: 0, feature: 1, minor: 2}[bump];
  if (index === undefined) throw new Error('Choose major, feature or minor');
  parts[index]++;
  for (let i=index+1; i<3; i++) parts[i]=0;
  return parts.join('.');
}
export function bumpFiles(root, bump) {
  const read = name => JSON.parse(fs.readFileSync(`${root}/${name}`, 'utf8'));
  const manifest=read('system.json'), pkg=read('package.json'), lock=read('package-lock.json');
  if (manifest.version !== pkg.version || pkg.version !== lock.version || lock.packages[''].version !== pkg.version) throw new Error('Release versions must match');
  if (manifest.manifest !== 'https://github.com/Fuhrizen/FUS/releases/download/beta/system.json') throw new Error('Use the beta channel manifest');
  const version=nextVersion(manifest.version, bump);
  manifest.version=pkg.version=lock.version=lock.packages[''].version=version;
  manifest.download=`https://github.com/Fuhrizen/FUS/releases/download/v${version}/FUS-${version}.zip`;
  for (const [name, data] of [['system.json',manifest],['package.json',pkg],['package-lock.json',lock]]) fs.writeFileSync(`${root}/${name}`, JSON.stringify(data,null,2)+'\n');
  return version;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const request=JSON.parse(fs.readFileSync('tools/beta-release-request.json','utf8'));
  const bump=process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' ? process.env.BUMP : (process.env.BUMP || request.bump);
  const version=bumpFiles('.',bump);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,`version=${version}\n`);
  console.log(`FUS beta: ${bump} → ${version}`);
}
