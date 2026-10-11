import fs from 'node:fs';import {spawnSync} from 'node:child_process';
fs.mkdirSync('reports',{recursive:true});
const files=fs.readdirSync('tests').filter(n=>n.endsWith('.test.mjs')).sort().map(n=>'tests/'+n);
const result=spawnSync(process.execPath,['--test','--test-timeout=60000','--test-reporter=spec','--test-reporter-destination=stdout','--test-reporter=junit','--test-reporter-destination=reports/unit.xml',...files],{stdio:'inherit'});
if(result.error)throw result.error;process.exit(result.status??1);
