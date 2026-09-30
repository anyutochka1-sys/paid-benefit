import test from 'node:test';
import assert from 'node:assert/strict';
import {minimumIncomeTest} from './engine.mjs';

test('imprisonment of the applicant credits documented months of absence',()=>{
  const reason={type:'incarceration',start:'2025-08',end:'2026-05'};
  const result=minimumIncomeTest({reasons:[reason]},'2026-09',27093);
  assert.equal(result.creditedMonths,10);
  assert.equal(result.exempt,true);
});

test('a short treatment period does not count as the continuous long treatment exception',()=>{
  const result=minimumIncomeTest({reasons:[{type:'treatment',start:'2026-01',end:'2026-03'}]},'2026-09',27093);
  assert.equal(result.creditedMonths,0);
  assert.ok(result.warnings.length);
});

test('sole parent status exempts the applicant from the minimum earnings test',()=>{
  const result=minimumIncomeTest({singleParent:true},'2026-09',27093);
  assert.equal(result.exempt,true);
  assert.equal(result.minimum,0);
});

test('adult care credits months before the July 2026 change',()=>{
  const reasons=[{type:'careDisabledAdult',start:'2025-06',end:'2026-05'}];
  const result=minimumIncomeTest({reasons,applicationDate:'2026-07-20'},'2026-07',27093);
  assert.equal(result.exempt,true);
});

test('from 21 July 2026 adult care needs eligible family relationship',()=>{
  const reason={type:'careDisabledAdult',start:'2025-06',end:'2026-05'};
  const unknown=minimumIncomeTest({reasons:[reason],applicationDate:'2026-07-21'},'2026-07',27093);
  assert.equal(unknown.creditedMonths,0);
  assert.equal(unknown.uncertain,true);
  const outsider=minimumIncomeTest({reasons:[{...reason,careRelationship:'ineligible'}],applicationDate:'2026-07-21'},'2026-07',27093);
  assert.equal(outsider.creditedMonths,0);
  assert.equal(outsider.uncertain,false);
  const family=minimumIncomeTest({reasons:[{...reason,careRelationship:'eligible'}],applicationDate:'2026-07-21'},'2026-07',27093);
  assert.equal(family.exempt,true);
});
