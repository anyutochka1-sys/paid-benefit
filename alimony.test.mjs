import test from 'node:test';
import assert from 'node:assert/strict';
import {alimonyForApplication,applicableRosstatWage} from './alimony.mjs';

test('new final Rosstat year applies only from month after official publication',()=>{
  const wageRecords=[
    {year:2024,amount:80000,publishedMonth:'2025-05',final:true},
    {year:2025,amount:100000,publishedMonth:'2026-06',final:true}
  ];
  assert.deepEqual([applicableRosstatWage(wageRecords,'2026-05').year,applicableRosstatWage(wageRecords,'2026-06').year,applicableRosstatWage(wageRecords,'2026-07').year],[2024,2024,2025]);
  const base={maritalStatus:'divorced',arrangement:'informal',childrenForAlimony:1,divorceMonth:'2025-01',declaredMonthly:0,wageRecords};
  assert.equal(alimonyForApplication(base,'2026-06').minimumMonthly,20000);
  assert.equal(alimonyForApplication(base,'2026-07').minimumMonthly,25000);
  assert.equal(alimonyForApplication({...base,wageRecords:[wageRecords[1]]},'2026-06').status,'unknown');
});

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
test('court order and FSSP case use received amount without regional floor',()=>{
  for(const arrangement of ['court-order','bailiffs']) {
    const r=alimonyForApplication({maritalStatus:'divorced',arrangement,receivedByMonth:{'2026-02':800}},'2026-09');
    assert.equal(r.amount,800);
  }
});
test('never married and remarried applicants have no imputed floor but actual receipts count',()=>{
  for(const maritalStatus of ['never','married']) {
    const r=alimonyForApplication({maritalStatus,arrangement:'informal',receivedByMonth:{'2026-02':5000}},'2026-09');
    assert.equal(r.amount,5000);
    assert.equal(r.method,'actual');
  }
});
test('notarial agreement amount counts even when actual transfers are zero',()=>{
  const r=alimonyForApplication({maritalStatus:'divorced',arrangement:'notary',childrenForAlimony:1,officialWage:80000,wageFinal:true,declaredMonthly:40000,receivedByMonth:{},divorceMonth:'2026-06'},'2026-09');
  assert.equal(r.amount,80000);
});
test('no final Rosstat wage is unknown, not silently estimated from preliminary',()=>{
  assert.equal(alimonyForApplication({maritalStatus:'divorced',arrangement:'notary',childrenForAlimony:2,officialWage:100000,wageFinal:false,declaredMonthly:5000,divorceMonth:'2025-01'},'2026-09').status,'unknown');
});
test('higher actual informal payments count only in months received',()=>{
  const r=alimonyForApplication({maritalStatus:'divorced',arrangement:'informal',childrenForAlimony:1,officialWage:80000,wageFinal:true,declaredMonthly:0,declaredByMonth:{'2026-07':35000},divorceMonth:'2026-06'},'2026-09');
  assert.equal(r.amount,20000+35000);
});
