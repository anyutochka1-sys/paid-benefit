import test from 'node:test';
import assert from 'node:assert/strict';
import {officialRate,withOfficialRates} from './cbr-rates.mjs';
import {additionalIncomeForApplication} from './extra-income.mjs';
const record=(rublesPerUnit)=>({effectiveDate:'2026-08-29',rates:{JPY:{nominal:100,value:rublesPerUnit*100,rublesPerUnit}}});
const table={source:'https://www.cbr.ru/scripts/XML_daily.asp',dates:{'2026-08-31':record(.5),'2026-07-31':{...record(.4),effectiveDate:'2026-07-31'}}};
const entry={personIndex:0,type:'foreignOther',from:'2026-05',to:'2026-06',amount:100,currency:'JPY',rateDate:'2026-07-31',rublesPerUnit:2};
test('each application uses its own official month-end rate and divides nominal',()=>{
  const entries=withOfficialRates([entry],'2026-10',table);
  assert.equal(additionalIncomeForApplication(entries,'2026-10').amount,100);
  assert.equal(additionalIncomeForApplication(withOfficialRates([entry],'2026-09',table),'2026-09').amount,80);
  assert.equal(entry.rublesPerUnit,2);
});
test('unpublished future rates do not inherit previous official rates',()=>{
  assert.equal(officialRate(table,'2027-01','JPY'),null);
  assert.equal(additionalIncomeForApplication(withOfficialRates([entry],'2027-01',table),'2027-01').status,'unknown');
});
test('RUB and unknown currencies preserve manual fallback',()=>{
  const rub={...entry,currency:'RUB'};
  assert.equal(withOfficialRates([rub],'2026-10',table)[0],rub);
  assert.equal(officialRate(table,'2026-10','XXX'),null);
  assert.equal(additionalIncomeForApplication(withOfficialRates([entry],'2026-09',null),'2026-09').amount,400);
});
test('reject stale effective date or inconsistent nominal',()=>{
  const invalid=structuredClone(table);
  invalid.dates['2026-08-31'].rates.JPY.nominal=1;
  assert.equal(officialRate(invalid,'2026-10','JPY'),null);
  invalid.dates['2026-08-31']=record(.5);
  invalid.dates['2026-08-31'].effectiveDate='2026-07-31';
  assert.equal(officialRate(invalid,'2026-10','JPY'),null);
});
