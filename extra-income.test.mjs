import test from 'node:test';
import assert from 'node:assert/strict';
import {additionalIncomeForApplication} from './extra-income.mjs';

test('tax-year rental income is spread across the five overlapping months',()=>{
  const r=additionalIncomeForApplication([{personIndex:0,type:'rent',taxYear:2025,amount:120000}],'2026-09');
  assert.equal(r.status,'known');
  assert.equal(r.amount,50000);
  assert.equal(r.byPerson.get(0)['2025-08'].qualifying,0);
});

test('monthly pension qualifies for adult minimum while unrelated benefits do not',()=>{
  const r=additionalIncomeForApplication([
    {personIndex:0,type:'pension',from:'2026-01',to:'2026-03',amount:10000},
    {personIndex:0,type:'otherBenefit',from:'2026-01',to:'2026-03',amount:5000}
  ],'2026-09');
  assert.equal(r.amount,45000);
  assert.equal(r.byPerson.get(0)['2026-02'].qualifying,10000);
});

test('income of an excluded spouse is omitted from the household',()=>{
  const entries=[{personIndex:1,type:'pension',from:'2025-08',to:'2026-07',amount:15000}];
  assert.equal(additionalIncomeForApplication(entries,'2026-09',[1]).amount,0);
});
