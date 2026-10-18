import {validIngredient,lineCostCents} from '../invoice-assets/cost-math.js';
export async function costingRoute(request,db,user,{json,body}){
  const path=new URL(request.url).pathname,method=request.method;
  const list=path==='/api/ingredients'?'ingredients':path==='/api/cake-costings'?'cake_costings':null;
  if(list&&method==='GET'){
    const rows=await db.prepare(`SELECT data,revision FROM ${list} WHERE owner=? ORDER BY updated_at DESC`).bind(user.id).all();
    return json({items:rows.results.map(r=>({item:JSON.parse(r.data),revision:r.revision}))});
  }
  const match=path.match(/^\/api\/(ingredients|cake-costings)\/([\w-]{1,80})$/);if(!match)return null;
  const table=match[1]==='ingredients'?'ingredients':'cake_costings',id=match[2];
  if(method==='DELETE'){
    const revision=Number(request.headers.get('if-match'));if(!Number.isInteger(revision)||revision<1)return json({error:'Record revision required.'},400);
    const row=await db.prepare(`DELETE FROM ${table} WHERE owner=? AND id=? AND revision=? RETURNING id`).bind(user.id,id,revision).first();
    return row?json({ok:true}):json({error:'This record changed. Refresh and try again.'},409);
  }
  if(method!=='PUT')return null;
  const b=await body(request);if(!Number.isInteger(b.revision)||b.revision<0||!b.item||b.item.id!==id)return json({error:'Invalid record.'},400);
  let item;
  if(table==='ingredients'){
    if(!validIngredient(b.item))return json({error:'Enter the ingredient name, purchase quantity, unit and price.'},400);
    item={id,name:b.item.name.trim(),purchaseQuantity:b.item.purchaseQuantity,purchaseUnit:b.item.purchaseUnit,purchasePrice:b.item.purchasePrice};
  }else{
    const c=b.item;if(b.revision!==0)return json({error:'Save a new cake costing to keep the original price record.'},400);
    if(typeof c.invoiceId!=='string'||c.invoiceId!==id)return json({error:'Choose a saved invoice for this cake costing.'},400);
    const invoiceRow=await db.prepare('SELECT data FROM invoices WHERE owner=? AND id=?').bind(user.id,c.invoiceId).first();if(!invoiceRow)return json({error:'This saved invoice is unavailable. Refresh and choose an invoice.'},400);
    const invoice=JSON.parse(invoiceRow.data);
    if(typeof c.name!=='string'||c.name.length>100||typeof c.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||!Number.isFinite(Date.parse(c.date))||new Date(c.date).toISOString().slice(0,10)!==c.date||!Array.isArray(c.lines)||c.lines.length<1||c.lines.length>50)return json({error:'Enter a valid cake costing with at least one ingredient.'},400);
    const rows=await db.prepare('SELECT id,data,revision FROM ingredients WHERE owner=?').bind(user.id).all(),ingredients=new Map(rows.results.map(r=>[r.id,{item:JSON.parse(r.data),revision:r.revision}]));
    const lines=[];let totalCents=0;
    try{for(const line of c.lines){const found=ingredients.get(line.ingredientId);if(!found)throw Error();if(found.revision!==line.ingredientRevision)return json({error:'An ingredient price changed. Open Cake costing again to refresh prices, then save.'},409);const ingredient=found.item,costCents=lineCostCents(ingredient,line.quantity,line.unit);lines.push({ingredientId:line.ingredientId,name:ingredient.name,quantity:line.quantity,unit:line.unit,purchaseQuantity:ingredient.purchaseQuantity,purchaseUnit:ingredient.purchaseUnit,purchasePrice:ingredient.purchasePrice,costCents});totalCents+=costCents;if(!Number.isSafeInteger(totalCents))throw Error()}}catch{return json({error:'Check each ingredient quantity and unit. Refresh if a price was removed.'},400)}
    item={id,invoiceId:c.invoiceId,invoiceNumber:invoice.number,name:c.name.trim()||(invoice.items?.[0]?.name||invoice.number).slice(0,100),date:c.date,lines,totalCents};
  }
  const data=JSON.stringify(item),row=b.revision===0?await db.prepare(`INSERT INTO ${table} (owner,id,data,revision,updated_at) VALUES (?,?,?,1,?) ON CONFLICT(owner,id) DO NOTHING RETURNING revision`).bind(user.id,id,data,Date.now()).first():await db.prepare(`UPDATE ${table} SET data=?,revision=revision+1,updated_at=? WHERE owner=? AND id=? AND revision=? RETURNING revision`).bind(data,Date.now(),user.id,id,b.revision).first();
  return row?json({item,revision:row.revision}):json({error:'This record changed on another device. Refresh and try again.'},409);
}
