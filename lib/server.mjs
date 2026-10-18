import {bootstrapReady} from './bootstrap.mjs';
import {costingRoute} from './costing.mjs';
import {customerPhone,customerFromInvoice,customerUpsert} from './customers.mjs';
﻿import {shopRoute} from './gallery.mjs';
import { assets } from './generated-assets.mjs';
import { digest, random, passwordHash, equal, validPassword, validInvoice } from './security.mjs';
const COOKIE='__Host-jananee-session',TTL=7*24*60*60*1000;
const headers={ 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin', 'X-Frame-Options':'SAMEORIGIN' };
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json',...extra}});
const redirect=p=>new Response(null,{status:303,headers:{...headers,Location:p}});
const cookie=(v,seconds=TTL/1000)=>`${COOKIE}=${v}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
function asset(path){const a=assets[path];if(!a)return new Response('Not found',{status:404,headers});return new Response(a.base64?Uint8Array.from(atob(a.content),c=>c.charCodeAt(0)):a.content,{headers:{...headers,'Content-Type':a.type}})}
async function body(request){if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('JSON required');const raw=await request.text();if(raw.length>100000)throw Error('Request too large');return JSON.parse(raw)}
async function account(db){return db.prepare('SELECT * FROM accounts ORDER BY created_at LIMIT 1').first()}
async function session(request,db,platform){const match=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));if(!match)return null;const token=match.slice(COOKIE.length+1);if(!/^[a-f0-9]{64}$/.test(token))return null;return db.prepare('SELECT a.id,a.email,s.token_hash FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first()}
async function throttle(db,key,limit=10,window=15*60*1000){const now=Date.now();const row=await db.prepare('INSERT INTO login_attempts (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count').bind(key,now+window,now,now).first();return row.count<=limit}
async function createSession(db,id){const token=random();await db.batch([db.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(Date.now()),db.prepare('INSERT INTO sessions (token_hash,account_id,expires_at) VALUES (?,?,?)').bind(await digest(token),id,Date.now()+TTL)]);return cookie(token)}
export async function handle(request,db,options={}){
  const url=new URL(request.url),path=url.pathname,method=request.method,platform=request.headers.get('oai-authenticated-user-id');
  if(!['GET','HEAD'].includes(method)&&request.headers.get('origin')!==url.origin)return json({error:'Invalid request origin.'},403);
  if(!db)return json({error:'Database unavailable. Please try again later.'},503);
  try{
    if(path==='/login')return redirect('/admin/login');
    if(path==='/admin/login'||path==='/admin/login/')return asset('/login.html');
    if(path==='/auth.css'||path==='/auth.js')return asset(path);
    const currentUser=await session(request,db,platform);
    const shopResult=await shopRoute(request,db,currentUser,options,{json,body,asset,throttle});if(shopResult)return shopResult;
    if(path==='/api/auth/status'&&method==='GET'){const a=await account(db,platform),s=await session(request,db,platform);return json({registered:!!a||bootstrapReady(options),authenticated:!!s,email:s?.email??'',setupAllowed:!!platform&&!!options.ownerEmail&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===options.ownerEmail.toLowerCase(),suggestedEmail:request.headers.get('oai-authenticated-user-email')??''})}
    if(['/api/auth/register','/api/auth/login','/api/auth/reset'].includes(path)&&method==='POST'){
      if(!await throttle(db,'auth:'+await digest(request.headers.get('CF-Connecting-IP')||'local')))return json({error:'Too many attempts. Try again in 15 minutes.'},429,{'Retry-After':'900'});
      const b=await body(request);let email=typeof b.email==='string'?b.email.trim().toLowerCase():'';if(options.loginUsername&&email===options.loginUsername.toLowerCase())email=(options.bootstrapEmail||'').toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof b.password!=='string'||b.password.length>128)return json({error:'Enter a valid email and password.'},400);
      let a=await account(db,platform),initialRecovery,bootstrapHash;
      if(path==='/api/auth/login'&&!a&&bootstrapReady(options)&&email===options.bootstrapEmail.toLowerCase()){
        bootstrapHash=await passwordHash(b.password,options.bootstrapSalt);
        if(equal(bootstrapHash,options.bootstrapHash)){
          const id=crypto.randomUUID(),code=random(20);
          try{await db.prepare('INSERT INTO accounts (id,platform_id,email,salt,password_hash,recovery_hash,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,'configured-shop-admin',email,options.bootstrapSalt,options.bootstrapHash,await digest(code),Date.now()).run();initialRecovery=code}catch{}
          a=await account(db,platform);
        }
      }
      if(path==='/api/auth/register'){
        if(bootstrapReady(options))return json({error:'The admin login is already configured. Sign in with your username and password.'},409);
        if(!platform||!options.ownerEmail||request.headers.get('oai-authenticated-user-email')?.toLowerCase()!==options.ownerEmail.toLowerCase())return json({error:'Only the shop owner can create the administrator account.'},403);
        if(a)return json({error:'An account already exists. Please sign in.'},409);
        if(!validPassword(b.password))return json({error:'Use a password with 12â€“128 characters.'},400);
        const salt=random(16),recovery=random(20),id=crypto.randomUUID();
        try{await db.prepare('INSERT INTO accounts (id,platform_id,email,salt,password_hash,recovery_hash,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,platform,email,salt,await passwordHash(b.password,salt),await digest(recovery),Date.now()).run()}catch{return json({error:'Account already created. Sign in instead.'},409)}
        return json({ok:true,recoveryCode:recovery},200,{'Set-Cookie':await createSession(db,id)});
      }
      if(path==='/api/auth/reset'){
        if(!validPassword(b.password)||typeof b.recoveryCode!=='string'||b.recoveryCode.length>100)return json({error:'Enter your recovery code and a new password of 12â€“128 characters.'},400);
        if(!a||a.email!==email||!equal(await digest(b.recoveryCode.trim().toLowerCase()),a.recovery_hash))return json({error:'Email or recovery code is incorrect.'},401);
        const salt=random(16),recovery=random(20),hash=await passwordHash(b.password,salt);
        const result=await db.prepare('UPDATE accounts SET salt=?,password_hash=?,recovery_hash=? WHERE id=? AND recovery_hash=? RETURNING id').bind(salt,hash,await digest(recovery),a.id,a.recovery_hash).first();
        if(!result)return json({error:'This recovery code has already been used.'},409);
        await db.prepare('DELETE FROM sessions WHERE account_id=?').bind(a.id).run();
        return json({ok:true,recoveryCode:recovery},200,{'Set-Cookie':await createSession(db,a.id)});
      }
      // Derive a hash even for an incorrect email to reduce timing differences.
      const hash=bootstrapHash&&a?.salt===options.bootstrapSalt?bootstrapHash:await passwordHash(b.password,a?.salt??'00000000000000000000000000000000');
      if(!a||a.email!==email||!equal(hash,a.password_hash))return json({error:'Email or password is incorrect.'},401);
      return json({ok:true,...(initialRecovery?{recoveryCode:initialRecovery}:{})},200,{'Set-Cookie':await createSession(db,a.id)});
    }
    const user=await session(request,db,platform);
    if(!user)return path.startsWith('/api/')?json({error:'Please sign in again.'},401):redirect('/admin/login');
    const costingResult=await costingRoute(request,db,user,{json,body});if(costingResult)return costingResult;
    if(path==='/api/auth/logout'&&method==='POST'){await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.token_hash).run();return json({ok:true},200,{'Set-Cookie':cookie('',0)})}
    if(path==='/api/auth/password'&&method==='POST'){
      if(!await throttle(db,'auth:'+await digest(request.headers.get('CF-Connecting-IP')||'local')))return json({error:'Too many attempts. Try again in 15 minutes.'},429);
      const b=await body(request),a=await account(db,platform);
      if(!validPassword(b.password)||typeof b.currentPassword!=='string'||b.currentPassword.length>128)return json({error:'Use a new password with 12â€“128 characters.'},400);
      if(!equal(await passwordHash(b.currentPassword,a.salt),a.password_hash))return json({error:'Current password is incorrect.'},401);
      const salt=random(16);await db.batch([db.prepare('UPDATE accounts SET salt=?,password_hash=? WHERE id=?').bind(salt,await passwordHash(b.password,salt),a.id),db.prepare('DELETE FROM sessions WHERE account_id=?').bind(a.id)]);
      return json({ok:true},200,{'Set-Cookie':await createSession(db,a.id)});
    }
    if(path==='/api/invoices'&&method==='GET'){const rows=await db.prepare('SELECT data,revision FROM invoices WHERE owner=? ORDER BY updated_at DESC').bind(user.id).all();return json({invoices:rows.results.map(r=>({invoice:JSON.parse(r.data),revision:r.revision})),email:user.email})}
    if(path==='/api/expenses'&&method==='GET'){
      const rows=await db.prepare('SELECT data,revision FROM expenses WHERE owner=? ORDER BY json_extract(data,\'$.date\') DESC,updated_at DESC').bind(user.id).all();
      return json({expenses:rows.results.map(r=>({expense:JSON.parse(r.data),revision:r.revision}))});
    }
    const expenseItem=path.match(/^\/api\/expenses\/([\w-]{1,80})$/);
    if(expenseItem&&method==='PUT'){
      const b=await body(request),e=b.expense;
      if(!e||e.id!==expenseItem[1]||typeof e.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date))||new Date(e.date).toISOString().slice(0,10)!==e.date||typeof e.description!=='string'||!e.description.trim()||e.description.length>160||typeof e.amount!=='number'||!Number.isFinite(e.amount)||e.amount<=0||e.amount>1e9||Math.abs(e.amount*100-Math.round(e.amount*100))>0.00001||!Number.isInteger(b.revision)||b.revision<0)return json({error:'Enter a valid date, expense description and amount greater than zero (up to two decimal places).'},400);
      const data=JSON.stringify({id:e.id,date:e.date,description:e.description.trim(),amount:Math.round(e.amount*100)/100});
      const row=b.revision===0?await db.prepare('INSERT INTO expenses (owner,id,data,revision,updated_at) VALUES (?,?,?,1,?) ON CONFLICT(owner,id) DO NOTHING RETURNING revision').bind(user.id,e.id,data,Date.now()).first():await db.prepare('UPDATE expenses SET data=?,revision=revision+1,updated_at=? WHERE owner=? AND id=? AND revision=? RETURNING revision').bind(data,Date.now(),user.id,e.id,b.revision).first();
      return row?json({revision:row.revision}):json({error:'This expense changed on another device. Refresh before editing again.'},409);
    }
    if(expenseItem&&method==='DELETE'){
      const revision=Number(request.headers.get('if-match'));if(!Number.isInteger(revision)||revision<1)return json({error:'Expense revision required.'},400);
      const row=await db.prepare('DELETE FROM expenses WHERE owner=? AND id=? AND revision=? RETURNING id').bind(user.id,expenseItem[1],revision).first();
      return row?json({ok:true}):json({error:'This expense changed on another device. Refresh and try again.'},409);
    }
    if(path==='/api/customers/sync'&&method==='POST'){
      const rows=await db.prepare('SELECT data,updated_at FROM invoices WHERE owner=? ORDER BY updated_at DESC').bind(user.id).all();
      const contacts=new Map();
      for(const row of rows.results){const c=customerFromInvoice(JSON.parse(row.data),row.updated_at);if(c&&!contacts.has(c.phone))contacts.set(c.phone,c)}
      const values=[...contacts.values()];
      for(let i=0;i<values.length;i+=50)await db.batch(values.slice(i,i+50).map(c=>db.prepare(customerUpsert).bind(user.id,c.phone,c.name,c.updatedAt)));
      return json({ok:true,matched:values.length});
    }
    if(path==='/api/customers'&&method==='GET'){
      const rows=await db.prepare('SELECT name,phone,updated_at FROM customers WHERE owner=? ORDER BY updated_at DESC, name COLLATE NOCASE').bind(user.id).all();
      return json({customers:rows.results});
    }
    const item=path.match(/^\/api\/invoices\/([\w-]{1,80})$/);
    if(item&&method==='PUT'){
      const b=await body(request);if(!validInvoice(b.invoice)||b.invoice.id!==item[1]||!Number.isInteger(b.revision)||b.revision<0)return json({error:'Invalid invoice details.'},400);
      const phone=customerPhone(b.invoice);
      if(b.invoice.customerPhone&&!phone)return json({error:'Enter a valid customer phone number with 7 to 15 digits.'},400);
      if(phone)b.invoice.customerPhone=phone;
      const duplicate=await db.prepare("SELECT id FROM invoices WHERE owner=? AND json_extract(data,'$.number')=? AND id<>?").bind(user.id,b.invoice.number,item[1]).first();if(duplicate)return json({error:'Invoice number already exists.'},409);
      const row=b.revision===0?await db.prepare('INSERT INTO invoices (owner,id,data,revision,updated_at) VALUES (?,?,?,1,?) ON CONFLICT(owner,id) DO NOTHING RETURNING revision').bind(user.id,item[1],JSON.stringify(b.invoice),Date.now()).first():await db.prepare('UPDATE invoices SET data=?,revision=revision+1,updated_at=? WHERE owner=? AND id=? AND revision=? RETURNING revision').bind(JSON.stringify(b.invoice),Date.now(),user.id,item[1],b.revision).first();
      return row?json({revision:row.revision}):json({error:'This invoice changed on another device. Refresh saved invoices before saving.'},409);
    }
    if(item&&method==='DELETE'){const revision=Number(request.headers.get('if-match'));if(!Number.isInteger(revision)||revision<1)return json({error:'Invoice revision required.'},400);const row=await db.prepare('DELETE FROM invoices WHERE owner=? AND id=? AND revision=? RETURNING id').bind(user.id,item[1],revision).first();return row?json({ok:true}):json({error:'Invoice changed on another device. Refresh and try again.'},409)}
    if(path.startsWith('/api/'))return json({error:'Not found.'},404);
    if(method!=='GET'&&method!=='HEAD')return new Response('Method not allowed',{status:405,headers});
    return asset(path==='/admin'||path==='/admin/'?'/index.html':path);
  }catch(error){console.error('Request failed',path,error instanceof SyntaxError?'Invalid JSON':'Server error');return json({error:'Unable to complete this request. Please try again.'},500)}
}

