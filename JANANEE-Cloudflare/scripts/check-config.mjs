import fs from 'node:fs';
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
if(config.d1_databases[0].database_id==='00000000-0000-4000-8000-000000000000')throw Error('Create jananee-db in Cloudflare and replace the placeholder database_id in wrangler.jsonc before deploying.');
