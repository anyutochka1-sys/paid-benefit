import {incomeWindow,monthIndex} from './engine.mjs';

// Decree 2330 p. 49(1): previous year's FINAL Rosstat figure begins to apply
// on the first day of the month after publication. Until then use year - 2.
export function applicableRosstatWage(records, applicationMonth) {
  const year=Number(applicationMonth.slice(0,4));
  for(const candidate of [year-1,year-2]) {
    const record=(records||[]).find(item=>item.year===candidate);
    if(candidate===year-1 && (!record?.publishedMonth || monthIndex(record.publishedMonth)>=monthIndex(applicationMonth))) continue;
    if(record?.final===true && Number.isFinite(record.amount) && record.amount>0 && record.publishedMonth && monthIndex(record.publishedMonth)<monthIndex(applicationMonth))
      return {status:'known',amount:record.amount,year:candidate,publishedMonth:record.publishedMonth};
  }
  return {status:'unknown',reason:`Нужны окончательные данные Росстата за ${year-1} или ${year-2} год и месяц их публикации`};
}

// Decree 2330 p. 49(1), as amended from March 2026. Wage must be official
// FINAL annual Rosstat data that became applicable for the filing month.
export function alimonyForApplication(entry, applicationMonth) {
  const window=incomeWindow(applicationMonth);
  const actual=window.reduce((sum,m)=>sum+(Number(entry.receivedByMonth?.[m])||0),0);
  if(entry.singleParent || entry.maritalStatus!=='divorced') return {status:'known',amount:actual,method:'actual'};
  if(['court','court-order','bailiffs'].includes(entry.arrangement)) return {status:'known',amount:actual,method:entry.arrangement==='bailiffs'?'fssp-actual':'court-actual'};
  if(!['notary','informal'].includes(entry.arrangement)) return {status:'unknown',reason:'Нужно уточнить основание алиментов'};
  const wage=entry.wageRecords?applicableRosstatWage(entry.wageRecords,applicationMonth):
    entry.officialWage>0&&entry.wageFinal===true?{status:'known',amount:entry.officialWage,year:null}:{status:'unknown'};
  if(wage.status!=='known' || !entry.divorceMonth || !Number.isFinite(entry.childrenForAlimony) || entry.childrenForAlimony<1)
    return {status:'unknown',reason:'Нужны дата развода и применимые окончательные данные Росстата'};
  const fraction=entry.childrenForAlimony===1?1/4:entry.childrenForAlimony===2?1/3:1/2;
  const eligibleMonths=window.filter(m=>monthIndex(m)>=monthIndex(entry.divorceMonth));
  const minimum=wage.amount*fraction;
  if(!Number.isFinite(entry.declaredMonthly) && !entry.declaredByMonth)return {status:'unknown',reason:'Укажите ежемесячную сумму алиментов'};
  const monthly=eligibleMonths.map(m=>({month:m,declared:entry.declaredByMonth?.[m]??entry.declaredMonthly}));
  if(monthly.some(v=>!Number.isFinite(v.declared) || v.declared<0))return {status:'unknown',reason:'Уточните алименты по месяцам'};
  return {status:'known',amount:monthly.reduce((sum,v)=>sum+Math.max(v.declared,minimum),0),method:'floor-or-declared',minimumMonthly:minimum,eligibleMonths,wageYear:wage.year};
}

// When actual receipts are reported as one total for several children, only
// documented child-level allocations can separate excluded p. 53(n) receipts.
export function allocatedAlimonyIncome(receivedByMonth, allocationByChild, recipientIds, includedIds, applicationMonth) {
  if(!recipientIds.length || !recipientIds.every(id=>Number.isFinite(allocationByChild[id])&&allocationByChild[id]>=0))
    return {status:'unknown',reason:'Укажите сумму алиментов на каждого ребёнка из перечисленных'};
  const totalByChild=recipientIds.reduce((sum,id)=>sum+allocationByChild[id],0);
  const months=incomeWindow(applicationMonth);
  const positive=months.filter(m=>receivedByMonth[m]>0);
  if(positive.some(m=>!Number.isFinite(receivedByMonth[m])||Math.abs(totalByChild-receivedByMonth[m])>0.01))
    return {status:'unknown',reason:'Суммы по детям должны совпасть с общим ежемесячным поступлением'};
  return {status:'known',method:'allocated-actual',amount:positive.length*includedIds.reduce((sum,id)=>sum+allocationByChild[id],0)};
}
