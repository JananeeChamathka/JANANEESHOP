export function customerPhone(invoice) {
  const details=invoice.customerDetails?.trim()||'';
  const raw=invoice.customerPhone||(/^[+0-9 ()-]{7,30}$/.test(details)?details:'');
  let phone=raw.replace(/[^0-9]/g,'');
  if(phone.startsWith('0094')&&phone.length===13)phone='0'+phone.slice(4);
  if(phone.startsWith('94')&&phone.length===11)phone='0'+phone.slice(2);
  return phone.length>=7&&phone.length<=15?phone:'';
}
export function customerFromInvoice(invoice,updatedAt) {
  const phone=customerPhone(invoice),name=invoice.customer?.trim();
  return phone&&name?{phone,name,updatedAt}:null;
}
export const customerUpsert='INSERT INTO customers (owner,phone,name,updated_at) VALUES (?,?,?,?) ON CONFLICT(owner,phone) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at WHERE excluded.updated_at>customers.updated_at';
