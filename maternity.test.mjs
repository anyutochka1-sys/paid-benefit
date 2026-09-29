import test from 'node:test';
import assert from 'node:assert/strict';
import {maternityIncomeForApplication} from './maternity.mjs';

const ordinary=[{personIndex:0,amount:250000,startMonth:'2026-01',chargedMonths:5}];
test('one-time maternity payment is divided across five charged months',()=>{
  const march=maternityIncomeForApplication(ordinary,'2026-03');
  assert.equal(march.amount,50000); // February 2025–January 2026
  assert.deepEqual(march.included[0].overlap,['2026-01']);
  assert.equal(maternityIncomeForApplication(ordinary,'2026-07').amount,250000);
});
test('six-month extended leave follows its documented six months',()=>{
  const payment=[{personIndex:0,amount:300000,startMonth:'2026-01',chargedMonths:6}];
  assert.equal(maternityIncomeForApplication(payment,'2026-03').amount,50000);
  assert.equal(maternityIncomeForApplication(payment,'2026-08').amount,300000);
});
test('missing charged period never books full amount in payment month',()=>{
  assert.equal(maternityIncomeForApplication([{amount:250000,startMonth:'2026-01'}],'2026-03').status,'unknown');
});
