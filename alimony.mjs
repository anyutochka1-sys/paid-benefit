import {incomeWindow,monthIndex} from './engine.mjs';

// Decree 2330 p. 49(1), as amended from March 2026. Wage must be official
// FINAL annual Rosstat data that became applicable for the filing month.
export function alimonyForApplication(entry, applicationMonth) {
  const window=incomeWindow(applicationMonth);
  const actual=window.reduce((sum,m)=>sum+(Number(entry.receivedByMonth?.[m])||0),0);
  if(entry.singleParent || entry.maritalStatus!=='divorced') return {status:'known',amount:actual,method:'actual'};
  if(entry.arrangement==='court') return {status:'known',amount:actual,method:'court-actual'};
  if(!['notary','informal'].includes(entry.arrangement)) return {status:'unknown',reason:'Нужно уточнить основание алиментов'};
  if(!entry.officialWage || entry.wageFinal!==true || !entry.divorceMonth || !Number.isFinite(entry.childrenForAlimony) || entry.childrenForAlimony<1)
    return {status:'unknown',reason:'Нужны дата развода и применимые окончательные данные Росстата'};
  const fraction=entry.childrenForAlimony===1?1/4:entry.childrenForAlimony===2?1/3:1/2;
  const eligibleMonths=window.filter(m=>monthIndex(m)>=monthIndex(entry.divorceMonth));
  const minimum=entry.officialWage*fraction;
  if(!Number.isFinite(entry.declaredMonthly) && !entry.declaredByMonth)return {status:'unknown',reason:'Укажите ежемесячную сумму алиментов'};
  const monthly=eligibleMonths.map(m=>({month:m,declared:entry.declaredByMonth?.[m]??entry.declaredMonthly}));
  if(monthly.some(v=>!Number.isFinite(v.declared) || v.declared<0))return {status:'unknown',reason:'Уточните алименты по месяцам'};
  return {status:'known',amount:monthly.reduce((sum,v)=>sum+Math.max(v.declared,minimum),0),method:'floor-or-declared',minimumMonthly:minimum,eligibleMonths};
}
