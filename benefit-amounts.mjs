import {pmFor} from './regional-pm.mjs?v=20261007-29';

// Suggestions describe the ordinary benefit for a benefit month. The user
// confirms actual receipt months; arrears and double payments are overrides.
export function unifiedReceiptSuggestion(entry,month,{region,area}={}) {
  if(entry.kind && entry.kind!=='unified')return null;
  if(![50,75,100].includes(Number(entry.tier)))return null;
  const code=entry.sameRegion==='yes'?region:entry.benefitRegion;
  if(!code || !['yes','no'].includes(entry.sameRegion))return null;
  const year=Number(month.slice(0,4));
  const locality=entry.benefitAreas?.[year]??(entry.sameRegion==='yes'?area:entry.benefitArea);
  const pm=pmFor(year,code,locality);
  return pm.status==='known'?Math.round(pm.child*Number(entry.tier))/100:null;
}

export function receiptContext(entry,context) {
  return JSON.stringify([entry.sameRegion,entry.sameRegion==='yes'?context.region:entry.benefitRegion,entry.sameRegion==='yes'?context.area:entry.benefitArea,entry.benefitAreas||{},entry.tier,entry.from,entry.to]);
}

export function receiptAmount(entry,month,context) {
  if(entry.amountMode!=='automatic')return entry.amount;
  if(Object.hasOwn(entry.receiptOverrides||{},month))return entry.receiptOverrides[month];
  return entry.receiptsConfirmed===true&&entry.confirmedContext===receiptContext(entry,context)?unifiedReceiptSuggestion(entry,month,context):null;
}
