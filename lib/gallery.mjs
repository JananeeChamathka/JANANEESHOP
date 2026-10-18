import {shopDefaults,initialCakes} from './gallery-defaults.mjs';
const text=(v,n)=>typeof v==='string'&&v.length<=n;
export async function settings(db){const row=await db.prepare('SELECT data,revision FROM shop_settings WHERE id=?').bind('main').first();return{settings:row?{...shopDefaults,...JSON.parse(row.data)}:shopDefaults,revision:row?.revision??0}}
export async function gallery(db){const rows=await db.prepare('SELECT data,revision FROM products').all();const merged=new Map(initialCakes.map(p=>[p.id,{...p,revision:0}]));for(const r of rows.results){const p=JSON.parse(r.data);merged.set(p.id,{...p,revision:r.revision})}return [...merged.values()].sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name))}
export async function shopRoute(request,db,user,options,{json,body,asset}){
  const path=new URL(request.url).pathname,method=request.method;
  const publicFiles=['/gallery.css','/collage.css','/gallery.js','/chocolate-cake.jpg','/yellow-swirl-cake.jpg','/pink-rose-cake.jpg'];
  if(method==='GET'&&(path==='/'||publicFiles.includes(path)))return asset(path==='/'?'/gallery.html':path);
  if(path==='/api/gallery'&&method==='GET')return json({settings:(await settings(db)).settings,cakes:(await gallery(db)).filter(p=>p.active).map(({revision,...p})=>p)});
  if(path==='/api/orders'||path==='/api/shop')return json({error:'Not found. Please contact our shop for enquiries.'},404);
  if(path.startsWith('/media/')&&method==='GET'){
    if(!/^\/media\/[a-f0-9-]+\.(jpg|png|webp)$/.test(path))return json({error:'Not found'},404);
    const object=await options.bucket?.get(path.slice(7));if(!object)return json({error:'Not found'},404);
    return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType??'image/jpeg','Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'}});
  }
  if(!path.startsWith('/api/admin/'))return null;
  if(!user)return json({error:'Administrator login required.'},401);
  if(path==='/api/admin/gallery'&&method==='GET')return json({cakes:await gallery(db)});
  const item=path.match(/^\/api\/admin\/gallery\/([\w-]{1,80})$/);
  if(item&&method==='PUT'){
    const b=await body(request),p=b.cake;if(!p||p.id!==item[1]||!text(p.name,100)||!p.name.trim()||!text(p.description,700)||!text(p.category,50)||!p.category.trim()||!text(p.image,200)||!(/^\/media\/[a-f0-9-]+\.(jpg|png|webp)$/.test(p.image)||['/chocolate-cake.jpg','/yellow-swirl-cake.jpg','/pink-rose-cake.jpg'].includes(p.image))||typeof p.active!=='boolean'||typeof p.featured!=='boolean'||!Number.isInteger(p.sortOrder)||p.sortOrder<0||p.sortOrder>9999||!Number.isInteger(b.revision)||b.revision<0)return json({error:'Check the cake details and upload an image.'},400);
    const row=b.revision===0?await db.prepare('INSERT INTO products (id,data,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING RETURNING revision').bind(p.id,JSON.stringify(p),Date.now()).first():await db.prepare('UPDATE products SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? RETURNING revision').bind(JSON.stringify(p),Date.now(),p.id,b.revision).first();return row?json(row):json({error:'Cake changed elsewhere. Reload before saving.'},409);
  }
  if(path==='/api/admin/images'&&method==='POST'){
    const type=request.headers.get('content-type'),ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};if(!ext[type]||!options.bucket)return json({error:'Upload a JPG, PNG or WebP image.'},400);
    const reader=request.body?.getReader();if(!reader)return json({error:'Image is empty.'},400);let size=0,chunks=[];while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>5*1024*1024){await reader.cancel();return json({error:'Image must be smaller than 5 MB.'},413)}chunks.push(r.value)}const buffer=new Uint8Array(size);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length}
    const valid=type==='image/jpeg'?buffer[0]===255&&buffer[1]===216:type==='image/png'?buffer.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':new TextDecoder().decode(buffer.slice(0,4))==='RIFF'&&new TextDecoder().decode(buffer.slice(8,12))==='WEBP';if(!valid)return json({error:'The file is not a valid image.'},400);
    const key=crypto.randomUUID()+'.'+ext[type];await options.bucket.put(key,buffer,{httpMetadata:{contentType:type}});return json({url:'/media/'+key});
  }
  if(path==='/api/admin/settings'&&method==='GET')return json(await settings(db));
  if(path==='/api/admin/settings'&&method==='PUT'){
    const b=await body(request),s=b.settings;if(!s||!['name','tagline','headline','description','phone','email','location','contactText'].every(k=>text(s[k],k==='description'?500:100))||!s.name.trim()||!s.headline.trim()||!/^\+?[\d ()-]{7,30}$/.test(s.phone)||s.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)||!Number.isInteger(b.revision)||b.revision<0)return json({error:'Check shop settings and contact number.'},400);
    const row=b.revision===0?await db.prepare('INSERT INTO shop_settings (id,data,revision) VALUES (?,?,1) ON CONFLICT(id) DO NOTHING RETURNING revision').bind('main',JSON.stringify(s)).first():await db.prepare('UPDATE shop_settings SET data=?,revision=revision+1 WHERE id=? AND revision=? RETURNING revision').bind(JSON.stringify(s),'main',b.revision).first();return row?json(row):json({error:'Settings changed elsewhere. Reload before saving.'},409);
  }
  return json({error:'Not found.'},404);
}
