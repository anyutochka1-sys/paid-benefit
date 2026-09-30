import test from 'node:test';
import assert from 'node:assert/strict';
import {childBenefitIncome,expandBenefitPayments} from './benefits.mjs';

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

test('arrears for older child programs are excluded only on that child application',()=>{
  for(const kind of ['decree606','decree175','nonworkingCare']) {
    const paid=[{childId:'a',month:'2026-07',amount:42000,kind,forPastPeriods:true}];
    assert.equal(childBenefitIncome(paid,children,['a'],'2026-09').total,0);
    assert.equal(childBenefitIncome(paid,children,['b'],'2026-09').total,42000);
    assert.equal(childBenefitIncome([{...paid[0],forPastPeriods:false}],children,['a'],'2026-09').total,42000);
    assert.equal(childBenefitIncome([{...paid[0],forPastPeriods:undefined}],children,['a'],'2026-09').total,null);
  }
});
test('previous first child payment and historic 8–17 payment follow their separate exclusions',()=>{
  const first=[{childId:'a',month:'2026-07',amount:20000,kind:'firstChild'}];
  assert.equal(childBenefitIncome(first,children,['a'],'2026-09').total,0);
  assert.equal(childBenefitIncome(first,children,['b'],'2026-09').total,20000);
  const historic=[{...first[0],kind:'oldEightToSeventeen'}];
  assert.equal(childBenefitIncome(historic,children,['b'],'2026-09').total,0);
});
test('ordinary child payment outside the family is excluded on filing date',()=>{
  const paid=[{childId:'a',month:'2026-07',amount:20000,kind:'decree606',forPastPeriods:false}];
  for(const familyStatus of ['stateCare','imprisoned','missing']) {
    const family=[{...children[0],role:'child',familyStatus},children[1]];
    assert.equal(childBenefitIncome(paid,family,['b'],'2026-09').total,0);
  }
});
test('18–22-year-old payment needs a regional basis when the adult child remains in the household',()=>{
  const student={id:'a',role:'child',birthDate:'2008-09-01',married:false,fullTimeStudent:true};
  const paid={childId:'a',month:'2026-07',amount:20000,kind:'decree606',forPastPeriods:false};
  assert.equal(childBenefitIncome([paid],[student,children[1]],['b'],'2026-09').total,null);
  assert.equal(childBenefitIncome([{...paid,regionalPaymentThrough23:false}],[student,children[1]],['b'],'2026-09').total,0);
  assert.equal(childBenefitIncome([{...paid,regionalPaymentThrough23:true}],[student,children[1]],['b'],'2026-09').total,20000);
  assert.equal(childBenefitIncome([{...paid,regionalPaymentThrough23:true}],[{...student,fullTimeStudent:false},children[1]],['b'],'2026-09').total,0);
  assert.equal(childBenefitIncome([{...paid,kind:'unified',forPastPeriods:undefined}],[student,children[1]],['b'],'2026-09').total,0);
});

test('future child benefit receipts need an explicit assumption only when included',()=>{
  const row={childId:'a',kind:'unified',amount:'20000',from:'2026-10',to:'2026-10'};
  const unconfirmed=expandBenefitPayments([row],'2026-12',{knownThrough:'2026-09'});
  assert.equal(childBenefitIncome(unconfirmed.payments,children,['b'],'2026-12').total,null);
  assert.equal(childBenefitIncome(unconfirmed.payments,children,['a'],'2026-12').total,0);
  const forecast=expandBenefitPayments([{...row,projectFuture:true}],'2026-12',{knownThrough:'2026-09'});
  const result=childBenefitIncome(forecast.payments,children,['b'],'2026-12');
  assert.equal(result.total,20000);
  assert.equal(result.included[0].projected,true);
});
test('past receipts remain known and missing amount or period cannot be fabricated',()=>{
  const row={childId:'a',kind:'unified',amount:'20000',from:'2026-07',to:'2026-07'};
  const past=expandBenefitPayments([row],'2026-09',{knownThrough:'2026-09'});
  assert.equal(childBenefitIncome(past.payments,children,['b'],'2026-09').total,20000);
  assert.equal(past.payments[0].projected,false);
  assert.equal(expandBenefitPayments([{...row,to:''}],'2026-09').missing.length,1);
  assert.equal(childBenefitIncome(expandBenefitPayments([{...row,amount:''}],'2026-09').payments,children,['b'],'2026-09').total,null);
});

test('unknown excluded amount does not block the same child but still blocks a sibling application',()=>{
  const paid=[{childId:'a',kind:'unified',month:'2026-07',amount:null}];
  const renewal=childBenefitIncome(paid,children,['a'],'2026-09');
  assert.equal(renewal.total,0);
  assert.equal(renewal.excluded.length,1);
  assert.equal(renewal.excluded[0].amount,null);
  assert.deepEqual(renewal.missing,[]);
  assert.equal(childBenefitIncome(paid,children,['b'],'2026-09').total,null);
});
test('known sibling amount remains countable alongside an unknown excluded amount',()=>{
  const paid=[{childId:'a',kind:'unified',month:'2026-07',amount:null},{childId:'b',kind:'unified',month:'2026-07',amount:10000}];
  assert.equal(childBenefitIncome(paid,children,['a'],'2026-09').total,10000);
});
test('negative amounts remain invalid even on an excluded benefit',()=>{
  const paid=[{childId:'a',kind:'unified',month:'2026-07',amount:-1}];
  assert.equal(childBenefitIncome(paid,children,['a'],'2026-09').total,null);
});
