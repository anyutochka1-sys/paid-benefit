import {pmFor} from './regional-pm.mjs?v=20261007-29';

// Ordinary receipts arrive for the previous benefit month. The income
// stays in the actual receipt month; early payments and first awards are overrides.
export function benefitMonthForReceipt(month) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))return null;
  const [year,value]=month.split('-').map(Number);
  return value===1?`${year-1}-12`:`${year}-${String(value-1).padStart(2,'0')}`;
}
export function unifiedReceiptSuggestion(entry,month,{region,area}={}) {
  if(entry.kind && entry.kind!=='unified')return null;
  if(![50,75,100].includes(Number(entry.tier)))return null;
  const code=entry.sameRegion==='yes'?region:entry.benefitRegion;
  if(!code || !['yes','no'].includes(entry.sameRegion))return null;
  const benefitMonth=benefitMonthForReceipt(month);if(!benefitMonth)return null;
  const year=Number(benefitMonth.slice(0,4));
  const locality=entry.benefitAreas?.[year]??(entry.sameRegion==='yes'?area:entry.benefitArea);
  const pm=pmFor(year,code,locality);
  return pm.status==='known'?Math.round(pm.child*Number(entry.tier))/100:null;
}

export function receiptContext(entry,context) {
  return JSON.stringify(['previous-benefit-month-v1',entry.sameRegion,entry.sameRegion==='yes'?context.region:entry.benefitRegion,entry.sameRegion==='yes'?context.area:entry.benefitArea,entry.benefitAreas||{},entry.tier,entry.from,entry.to,entry.periodBasis||'receipt']);
}

export function receiptAmount(entry,month,context) {
  if(entry.amountMode!=='automatic')return entry.amount;
  if(Object.hasOwn(entry.receiptOverrides||{},month))return entry.receiptOverrides[month];
  return entry.receiptsConfirmed===true&&entry.confirmedContext===receiptContext(entry,context)?unifiedReceiptSuggestion(entry,month,context):null;
}
