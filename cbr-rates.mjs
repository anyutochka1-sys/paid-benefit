import {foreignRateDate} from './extra-income.mjs';

// Requested month-end and effective publication date are different on weekends.
export function officialRate(table, applicationMonth, currency) {
  const date=foreignRateDate(applicationMonth);
  const record=table?.dates?.[date], rate=record?.rates?.[currency];
  if(table?.source!=='https://www.cbr.ru/scripts/XML_daily.asp' || !rate
    || !Number.isFinite(rate.rublesPerUnit) || rate.rublesPerUnit<=0
    || !Number.isInteger(rate.nominal) || rate.nominal<=0
    || !Number.isFinite(rate.value) || Math.abs(rate.value/rate.nominal-rate.rublesPerUnit)>1e-10
    || !/^\d{4}-\d{2}-\d{2}$/.test(record.effectiveDate))return null;
  const delay=(Date.parse(date)-Date.parse(record.effectiveDate))/86400000;
  if(!Number.isFinite(delay)||delay<0||delay>14)return null;
  return {rateDate:date,rublesPerUnit:rate.rublesPerUnit,effectiveDate:record.effectiveDate};
}

export function withOfficialRates(entries, applicationMonth, table) {
  return entries.map(entry=>{
    if(!['foreignEarned','foreignOther'].includes(entry.type)||entry.currency==='RUB')return entry;
    const official=officialRate(table,applicationMonth,entry.currency);
    return official?{...entry,...official}:entry;
  });
}
