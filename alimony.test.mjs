import test from 'node:test';
import assert from 'node:assert/strict';
import {alimonyForApplication} from './alimony.mjs';

test('informal arrangement for one child uses 1/4 regional wage only after divorce',()=>{
  const r=alimonyForApplication({maritalStatus:'divorced',arrangement:'informal',childrenForAlimony:1,officialWage:100000,wageFinal:true,declaredMonthly:0,divorceMonth:'2026-02'},'2026-09');
  assert.equal(r.minimumMonthly,25000);
  assert.equal(r.eligibleMonths.length,6);
  assert.equal(r.amount,150000);
});
test('court decision uses actual receipts even below wage floor',()=>{
  const r=alimonyForApplication({maritalStatus:'divorced',arrangement:'court',receivedByMonth:{'2026-02':1000}},'2026-09');
  assert.equal(r.amount,1000);
});
test('no final Rosstat wage is unknown, not silently estimated from preliminary',()=>{
  assert.equal(alimonyForApplication({maritalStatus:'divorced',arrangement:'notary',childrenForAlimony:2,officialWage:100000,wageFinal:false,declaredMonthly:5000,divorceMonth:'2025-01'},'2026-09').status,'unknown');
});
