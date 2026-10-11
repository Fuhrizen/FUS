// Local-only static server for the public browser harness; never starts Foundry.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(),types={'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.hbs':'text/plain'};
http.createServer((req,res)=>{let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(url.startsWith('/icons/')){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="#668"/></svg>');return;}
 url=url.replace(/^\/systems\/FUS\//,'/');const file=path.resolve(root,'.'+url);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');res.end(fs.readFileSync(file));
}).listen(4173,'127.0.0.1');
