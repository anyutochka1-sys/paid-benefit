import test from 'node:test';
import assert from 'node:assert/strict';
import {incomeForMonth,childTier,regularIncomeMonths} from './income.mjs';
import {incomeWindow} from './engine.mjs';

test('one steady salary fills specified months and zeros outside its period',()=>{
  const months=regularIncomeMonths({regularAmount:25000,regularFrom:'2026-01',regularTo:'2026-06'},'2026-09');
  assert.equal(months['2026-01'],25000);
  assert.equal(months['2026-07'],0);
  assert.equal(incomeForMonth([{label:'Мать',mode:'monthly',months}],'2026-09').total,150000);
  assert.deepEqual(regularIncomeMonths({regularAmount:null,regularFrom:'2026-01',regularTo:'2026-06'},'2026-09'),{});
});
test('future steady salary needs an explicit projection assumption',()=>{
  const person={regularAmount:25000,regularFrom:'2025-08',regularTo:'2027-06'};
  const cautious=regularIncomeMonths(person,'2026-12',{knownThrough:'2026-09'});
  assert.equal(cautious['2026-09'],25000);
  assert.equal(cautious['2026-10'],undefined);
  assert.equal(regularIncomeMonths(person,'2026-12',{knownThrough:'2026-09',projectFuture:true})['2026-10'],25000);
});

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
