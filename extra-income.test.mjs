import test from 'node:test';
import assert from 'node:assert/strict';
import {additionalIncomeForApplication,foreignRateDate} from './extra-income.mjs';

test('tax-year rental income is spread across the five overlapping months',()=>{
  const r=additionalIncomeForApplication([{personIndex:0,type:'rent',taxYear:2025,amount:120000}],'2026-09');
  assert.equal(r.status,'known');
  assert.equal(r.amount,50000);
  assert.equal(r.byPerson.get(0)['2025-08'].qualifying,0);
});

test('monthly pension qualifies for adult minimum while unrelated benefits do not',()=>{
  const r=additionalIncomeForApplication([
    {personIndex:0,type:'pension',from:'2026-01',to:'2026-03',amount:10000},
    {personIndex:0,type:'otherBenefit',benefitKind:'counted',from:'2026-01',to:'2026-03',amount:5000}
  ],'2026-09');
  assert.equal(r.amount,45000);
  assert.equal(r.byPerson.get(0)['2026-02'].qualifying,10000);
});

test('social contract and monthly maternity-capital payment are excluded under paragraph 53',()=>{
  const entries=[
    {personIndex:0,type:'otherBenefit',benefitKind:'socialContract',from:'2026-01',to:'2026-01',amount:90000},
    {personIndex:0,type:'otherBenefit',benefitKind:'maternityCapitalMonthly',from:'2026-01',to:'2026-03',amount:15000},
    {personIndex:0,type:'pension',from:'2026-01',to:'2026-03',amount:10000}
  ];
  const result=additionalIncomeForApplication(entries,'2026-09');
  assert.equal(result.status,'known');
  assert.equal(result.amount,30000);
  assert.equal(result.excluded.reduce((sum,item)=>sum+item.amount,0),135000);
});

test('an unspecified other benefit cannot silently enter or leave household income',()=>{
  const entry={personIndex:0,type:'otherBenefit',from:'2026-01',to:'2026-01',amount:50000};
  const result=additionalIncomeForApplication([entry],'2026-09');
  assert.equal(result.status,'unknown');
  assert.equal(result.amount,null);
});

test('employer birth aid excludes only the verified tax-free part paid in the first year',()=>{
  const base={personIndex:0,type:'otherBenefit',benefitKind:'employerBirthAid',from:'2026-03',to:'2026-03',amount:120000};
  const verified=additionalIncomeForApplication([{...base,birthAidFirstYear:true,taxExemptAmount:100000}],'2026-09');
  assert.equal(verified.amount,20000);
  assert.equal(verified.excluded[0].amount,100000);
  assert.equal(additionalIncomeForApplication([{...base,birthAidFirstYear:false}],'2026-09').amount,120000);
  assert.equal(additionalIncomeForApplication([base],'2026-09').status,'unknown');
  assert.equal(additionalIncomeForApplication([{...base,birthAidFirstYear:true}],'2026-09').status,'unknown');
  assert.equal(additionalIncomeForApplication([{...base,birthAidFirstYear:true,taxExemptAmount:130000}],'2026-09').status,'unknown');
  assert.equal(additionalIncomeForApplication([{...base,birthAidFirstYear:true,taxExemptAmount:100000,to:'2026-04'}],'2026-09').status,'unknown');
});

test('foreign income uses the CBR rate on the last day of the twelfth lookback month',()=>{
  assert.equal(foreignRateDate('2026-09'),'2026-07-31');
  assert.equal(foreignRateDate('2026-10'),'2026-08-31');
  const entry={personIndex:0,type:'foreignEarned',from:'2026-05',to:'2026-07',amount:100,currency:'USD',rublesPerUnit:80,rateDate:'2026-07-31'};
  const september=additionalIncomeForApplication([entry],'2026-09');
  assert.equal(september.amount,24000);
  assert.equal(september.byPerson.get(0)['2026-06'].qualifying,8000);
  const october=additionalIncomeForApplication([entry],'2026-10');
  assert.equal(october.status,'unknown');
  assert.match(october.issues[0],/2026-08-31/);
  assert.equal(additionalIncomeForApplication([{...entry,rateDate:'2026-08-31',rublesPerUnit:81}],'2026-10').amount,24300);
});

test('income of an excluded spouse is omitted from the household',()=>{
  const entries=[{personIndex:1,type:'pension',from:'2025-08',to:'2026-07',amount:15000}];
  assert.equal(additionalIncomeForApplication(entries,'2026-09',[1]).amount,0);
});

test('unusual point 47 payments enter income but only eligible types satisfy 8 MROT',()=>{
  const period={personIndex:0,from:'2025-08',to:'2025-08',amount:10000};
  const entries=['guardianReward','successorPayment','publicDuty','judgeAllowance','serviceSeverance','academicMedical']
    .map(type=>({...period,type}));
  const result=additionalIncomeForApplication(entries,'2026-09');
  assert.equal(result.status,'known');
  assert.equal(result.amount,60000);
  assert.equal(result.byPerson.get(0)['2025-08'].qualifying,30000);
  assert.equal(result.byPerson.get(0)['2025-09'],undefined);
});

test('securities use proceeds less expenses, missing expenses keeps result unknown',()=>{
  const entry={personIndex:0,type:'securities',taxYear:2025,amount:120000,expenses:48000};
  assert.equal(additionalIncomeForApplication([entry],'2026-09').amount,30000);
  assert.equal(additionalIncomeForApplication([{...entry,expenses:null}],'2026-09').status,'unknown');
});
