import test from 'node:test';
import assert from 'node:assert/strict';
import {childIncomeForApplication} from './child-income.mjs';

const child={id:'c',role:'child',birthDate:'2010-03-15',educationStatus:'school',educationFrom:'2025-09',educationTo:'2026-05'};
const family={included:[child],unanswered:[]};
const income=[{childId:'c',type:'employment',from:'2026-01',to:'2026-03',amount:10000}];

test('minor wage is excluded after six months of school within lookback',()=>{
  const r=childIncomeForApplication(income,[child],family,'2026-09');
  assert.equal(r.amount,0);assert.equal(r.excluded.length,3);
});
test('short school period counts child earnings, while other income always counts',()=>{
  const short={...child,educationFrom:'2026-01',educationTo:'2026-04'};
  const r=childIncomeForApplication([...income,{childId:'c',type:'other',from:'2026-02',to:'2026-02',amount:5000}],[short],{included:[short],unanswered:[]},'2026-09');
  assert.equal(r.amount,35000);
});
test('missing education history prevents a false exclusion or inclusion',()=>{
  const noSchool={...child,educationFrom:'',educationTo:''};
  const r=childIncomeForApplication(income,[noSchool],{included:[noSchool],unanswered:[]},'2026-09');
  assert.equal(r.status,'unknown');
});
test('excluded family member income does not enter household total',()=>{
  const r=childIncomeForApplication(income,[child],{included:[],unanswered:[]},'2026-09');
  assert.equal(r.amount,0);
});
test('month of eighteenth birthday needs an exact payment date',()=>{
  const adult={...child,birthDate:'2008-02-12'};
  const r=childIncomeForApplication([{childId:'c',type:'employment',from:'2026-02',to:'2026-02',amount:10000}],[adult],{included:[adult],unanswered:[]},'2026-09');
  assert.equal(r.status,'unknown');
});
test('birthday-month wages use the exact receipt date and minor education rule',()=>{
  const adult={...child,birthDate:'2008-02-12'};
  const base={childId:'c',type:'employment',from:'2026-02',to:'2026-02',amount:10000};
  const before=childIncomeForApplication([{...base,receiptDate:'2026-02-11'}],[adult],{included:[adult],unanswered:[]},'2026-09');
  assert.equal(before.status,'known');
  assert.equal(before.amount,0);
  const after=childIncomeForApplication([{...base,receiptDate:'2026-02-12'}],[adult],{included:[adult],unanswered:[]},'2026-09');
  assert.equal(after.amount,10000);
  assert.equal(childIncomeForApplication([{...base,receiptDate:'2026-03-01'}],[adult],{included:[adult],unanswered:[]},'2026-09').status,'unknown');
});

test('malformed saved months and impossible birthday receipt dates stay unknown',()=>{
 const base={childId:'c',type:'other',amount:1000,from:'2025-09',to:'2026-08'};
 for(const overrides of [{from:'2025-13'},{to:'2026-00'},{from:'wrong'}])assert.equal(childIncomeForApplication([{...base,...overrides}],[child],family,'2026-10').status,'unknown');
 const badSchool={...child,educationFrom:'2025-13'};assert.equal(childIncomeForApplication(income,[badSchool],{included:[badSchool],unanswered:[]},'2026-09').status,'unknown');
 const birthday={...child,birthDate:'2008-02-12',fullTimeStudent:true};assert.equal(childIncomeForApplication([{childId:'c',type:'employment',amount:10000,from:'2026-02',to:'2026-02',receiptDate:'2026-02-30'}],[birthday],{included:[birthday],unanswered:[]},'2026-09').status,'unknown');
});
