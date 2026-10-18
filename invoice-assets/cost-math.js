export const units={g:{group:'weight',factor:1},kg:{group:'weight',factor:1000},ml:{group:'volume',factor:1},l:{group:'volume',factor:1000},pcs:{group:'count',factor:1}};
export function validIngredient(item){return item&&typeof item.name==='string'&&!!item.name.trim()&&item.name.length<=100&&typeof item.purchaseUnit==='string'&&Object.hasOwn(units,item.purchaseUnit)&&typeof item.purchaseQuantity==='number'&&Number.isFinite(item.purchaseQuantity)&&item.purchaseQuantity>0&&item.purchaseQuantity<=1e6&&typeof item.purchasePrice==='number'&&Number.isFinite(item.purchasePrice)&&item.purchasePrice>0&&item.purchasePrice<=1e9&&Math.abs(item.purchasePrice*100-Math.round(item.purchasePrice*100))<0.00001}
export function lineCostCents(ingredient,quantity,unit){
  if(!validIngredient(ingredient)||typeof quantity!=='number'||!Number.isFinite(quantity)||quantity<=0||quantity>1e6||typeof unit!=='string'||!Object.hasOwn(units,unit)||units[unit].group!==units[ingredient.purchaseUnit].group)throw Error('Choose a valid ingredient, quantity and matching unit.');
  const cents=Math.round(ingredient.purchasePrice*100*(quantity*units[unit].factor)/(ingredient.purchaseQuantity*units[ingredient.purchaseUnit].factor));
  if(!Number.isSafeInteger(cents)||cents>1e14)throw Error('This quantity is too large.');
  return cents;
}
