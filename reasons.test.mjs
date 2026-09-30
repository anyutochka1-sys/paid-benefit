import test from 'node:test';
import assert from 'node:assert/strict';
import {minimumIncomeTest,assessMonth} from './engine.mjs';

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


test('missing, reversed and malformed reason periods cannot become a definite failure',()=>{
  for(const period of [{},{start:'2026-01'},{start:'2026-06',end:'2026-01'},{start:'2026-13',end:'2026-14'}]) {
    const result=minimumIncomeTest({reasons:[{type:'pregnancy',...period}]},'2026-09',27093);
    assert.equal(result.creditedMonths,0);
    assert.equal(result.exempt,false);
    assert.equal(result.uncertain,true);
    assert.ok(result.warnings.length);
  }
});

test('uncertain reasons do not erase confirmed income or an independent exemption',()=>{
  const reasons=[{type:'careUnderThree',start:'2026-01'}];
  const income={'2026-01':[{type:'employment',amount:216744}]};
  assert.equal(minimumIncomeTest({reasons,income},'2026-09',27093).passed,true);
  assert.equal(minimumIncomeTest({reasons,singleParent:true},'2026-09',27093).exempt,true);
});

test('valid periods outside the income window have no effect; unsupported relevant reasons require review',()=>{
  assert.equal(minimumIncomeTest({reasons:[{type:'careUnderThree',start:'2024-01',end:'2024-12'}]},'2026-09',27093).uncertain,false);
  assert.equal(minimumIncomeTest({reasons:[{type:'unrecognized',start:'2026-01',end:'2026-06'}]},'2026-09',27093).uncertain,true);
});

test('completing a period replaces review with a confirmed exemption',()=>{
  const base={familySizeByMonth:{'2026-09':1},pmByYear:{2026:{perCapita:20000}},assetsChecked:true,citizenshipChecked:true,alimonyChecked:true,regionalRulesChecked:true};
  const incomplete=assessMonth({...base,adults:[{reasons:[{type:'careUnderThree',start:'2025-08'}]}]},'2026-09');
  assert.equal(incomplete.status,'needs-review');
  assert.deepEqual(incomplete.blockers,[]);
  const completed=assessMonth({...base,adults:[{reasons:[{type:'careUnderThree',start:'2025-08',end:'2026-07'}]}]},'2026-09');
  assert.equal(completed.status,'preliminary-eligible');
});
