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
