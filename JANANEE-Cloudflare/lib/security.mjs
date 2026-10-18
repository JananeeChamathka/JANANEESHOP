const encoder = new TextEncoder();
export const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
export const random = (n = 32) => hex(crypto.getRandomValues(new Uint8Array(n)));
export const digest = async value => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
export async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
}
export function equal(a,b) { if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0; }
export function validPassword(p) { return typeof p==='string'&&p.length>=12&&p.length<=128; }
export function validInvoice(r) {
  const string = (v,n) => typeof v==='string'&&v.length<=n;
  return r&&string(r.id,80)&&/^[\w-]+$/.test(r.id)&&string(r.customer,80)&&r.customer.trim()&&string(r.number,35)&&r.number.trim()&&string(r.date,10)&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&
    (r.customerPhone===undefined||r.customerPhone===''||(string(r.customerPhone,30)&&/^[+0-9 ()-]{7,30}$/.test(r.customerPhone)))&&
    ['customerDetails','shop','tagline','phone','email','location','footer1','footer2','note'].every(k=>string(r[k]??'',200))&&
    [r.discount,r.advance].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12)&&
    Array.isArray(r.items)&&r.items.length>0&&r.items.length<=10&&r.items.every(i=>string(i.name,100)&&i.name.trim()&&string(i.detail,150)&&typeof i.qty==='number'&&i.qty>0&&i.qty<=1e6&&typeof i.price==='number'&&Number.isFinite(i.price)&&i.price>=0&&i.price<=1e12);
}
