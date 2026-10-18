import fs from 'node:fs';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.ttf':'font/ttf','.jpg':'image/jpeg'};
const assets={};
for(const name of fs.readdirSync('invoice-assets')){const ext=name.slice(name.lastIndexOf('.'));if(!types[ext])continue;const binary=['.ttf','.jpg'].includes(ext);assets['/'+name]={type:types[ext],base64:binary,content:fs.readFileSync('invoice-assets/'+name,binary?'base64':'utf8')}}
fs.writeFileSync('lib/generated-assets.mjs','export const assets = '+JSON.stringify(assets)+';\n');
