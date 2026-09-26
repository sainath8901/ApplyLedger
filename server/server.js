// Optional local static preview. Authentication and data live in Supabase.
import http from 'node:http';
import {readFileSync} from 'node:fs';
const allowed=new Set(['admin.html','admin.js','auth.js','config.js','style.css','icon128.png']);
const root=new URL('../',import.meta.url);
http.createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname.slice(1)||'admin.html';
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co; img-src 'self'; base-uri 'none'; frame-ancestors 'none'");
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'||!allowed.has(path)){res.writeHead(404);res.end('Not found');return;}
 res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'text/html; charset=utf-8');
 res.end(readFileSync(new URL(path,root)));
}).listen(Number(process.env.PORT||8787),'127.0.0.1',()=>console.log('Admin preview: http://127.0.0.1:'+(process.env.PORT||8787)));
