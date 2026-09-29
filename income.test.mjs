import test from 'node:test';
import assert from 'node:assert/strict';
import {incomeForMonth,childTier} from './income.mjs';
import {incomeWindow} from './engine.mjs';

test('a bonus leaving the lookback window changes a three-month forecast',()=>{
  const months=Object.fromEntries(new Set([...incomeWindow('2026-09'),...incomeWindow('2026-12')]).values().map(m=>[m,0]));
  months['2025-08']=300000;
  const p={label:'Родитель',mode:'monthly',months};
  assert.equal(incomeForMonth([p],'2026-09').total,300000);
  assert.equal(incomeForMonth([p],'2026-12').total,0);
});
test('aggregate entry is valid only for its selected window',()=>{
  const p={label:'Родитель',mode:'total',baseApplicationMonth:'2026-09',total:300000};
  assert.equal(incomeForMonth([p],'2026-09').total,300000);
  assert.equal(incomeForMonth([p],'2026-12').total,null);
});
test('blank forecast is unknown, explicitly entered zero is known',()=>{
  const months=Object.fromEntries(incomeWindow('2026-09').map(m=>[m,0]));
  const p={label:'Родитель',mode:'monthly',months};
  assert.equal(incomeForMonth([p],'2026-09').total,0);
  assert.equal(incomeForMonth([p],'2026-10').total,null);
});
test('estimate can change from 50 to 100 when a bonus leaves the window',()=>{
  const args={familySize:3,childrenApplying:1,pmPerson:20000,pmChild:19000};
  assert.equal(childTier({...args,income12:630000}).tier,50);
  assert.equal(childTier({...args,income12:300000}).tier,100);
});
