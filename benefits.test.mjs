import test from 'node:test';
import assert from 'node:assert/strict';
import {childBenefitIncome} from './benefits.mjs';

const children=[{id:'a',birthDate:'2020-03-01'},{id:'b',birthDate:'2023-04-01'}];
const payments=Array.from({length:12},(_,i)=>({childId:'a',month:`${i<5?'2025':'2026'}-${String(i<5?i+8:i-4).padStart(2,'0')}`,amount:19243}));
test('previous payments on a child who has died are excluded even when filing for a sibling',()=>{
  const family=[{...children[0],deathDate:'2026-02-01'},children[1]];
  assert.equal(childBenefitIncome(payments,family,['b'],'2026-09').total,0);
});
test('19 243 each month is excluded when renewing the same child',()=>{
  const result=childBenefitIncome(payments,children,['a'],'2026-09');
  assert.equal(result.total,0);
  assert.equal(result.excluded.length,12);
});
test('the same benefit counts when applying only for a sibling',()=>{
  const result=childBenefitIncome(payments,children,['b'],'2026-09');
  assert.equal(result.total,19243*12);
  assert.equal(result.included.length,12);
});
test('pregnancy application counts an existing child award even if child renewal excludes it',()=>{
  const pregnant=childBenefitIncome(payments,children,[],'2026-09');
  const childRenewal=childBenefitIncome(payments,children,['a'],'2026-09');
  assert.deepEqual([pregnant.total,childRenewal.total],[230916,0]);
});
test('payments on two children split according to selected application',()=>{
  const result=childBenefitIncome([...payments,{childId:'b',month:'2026-07',amount:10000}],children,['a'],'2026-09');
  assert.equal(result.total,10000);
});
test('joint filing excludes prior award, separate filing for new child includes it',()=>{
  const joint=childBenefitIncome(payments,children,['a','b'],'2026-09');
  const newChild=childBenefitIncome(payments,children,['b'],'2026-09');
  const oldChild=childBenefitIncome(payments,children,['a'],'2026-09');
  assert.deepEqual([joint.total,newChild.total,oldChild.total],[0,230916,0]);
});
test('a benefit on a child who turned 17 is excluded even for a sibling filing',()=>{
  const older=[{id:'a',birthDate:'2009-09-10'},children[1]];
  const paid=[{childId:'a',month:'2026-07',amount:19243}];
  assert.equal(childBenefitIncome(paid,older,['b'],'2026-09','2026-09-09').total,19243);
  assert.equal(childBenefitIncome(paid,older,['b'],'2026-09','2026-09-10').total,0);
});
test('missing child link never silently removes an amount',()=>{
  const result=childBenefitIncome([{childId:'unknown',month:'2026-07',amount:19243}],children,['a'],'2026-09');
  assert.equal(result.total,null);
});
