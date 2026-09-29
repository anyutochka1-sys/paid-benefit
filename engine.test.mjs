import test from 'node:test';
import assert from 'node:assert/strict';
import { incomeWindow, minimumIncomeTest, assessMonth } from './engine.mjs';

test('September application counts August to July, leaving August out', () => {
  const w = incomeWindow('2026-09');
  assert.equal(w[0], '2025-08');
  assert.equal(w.at(-1), '2026-07');
});

test('four officially registered unemployment months reduce 8 MROT to 8/12', () => {
  const adult = { reasons: [{ type:'unemployment', registered:true, start:'2026-01', end:'2026-04' }] };
  const result = minimumIncomeTest(adult, '2026-09', 27093);
  assert.equal(result.minimum, 144496);
  assert.equal(result.creditedMonths, 4);
  assert.equal(minimumIncomeTest({ ...adult, reasons:[{ ...adult.reasons[0], registered:false }] }, '2026-09', 27093).minimum, 216744);
});

test('unemployment credit is capped at six months and overlapping reasons do not double count', () => {
  const result = minimumIncomeTest({ reasons:[
    { type:'unemployment', registered:true, start:'2025-08', end:'2026-07' },
    { type:'careUnderThree', start:'2025-08', end:'2025-09' }
  ] }, '2026-09', 27093);
  assert.equal(result.creditedMonths, 6);
});

test('pregnancy of twelve weeks on application date overrides minimum', () => {
  assert.equal(minimumIncomeTest({ pregnancyWeeksAtApplication:12 }, '2026-09', 27093).minimum, 0);
});

test('qualifying salary must be tested for each adult, child benefits cannot satisfy 8 MROT',()=>{
  const window=incomeWindow('2026-09');
  const salary={income:Object.fromEntries(window.map(m=>[m,[{type:'employment',amount:18000}]]))};
  const childBenefits={income:Object.fromEntries(window.map(m=>[m,[{type:'childBenefit',amount:19243}]]))};
  const applicant=minimumIncomeTest(salary,'2026-09',27093);
  const spouse=minimumIncomeTest(childBenefits,'2026-09',27093);
  assert.equal(applicant.earned,216000);
  assert.equal(applicant.passed,false);
  assert.equal(spouse.earned,0);
  assert.equal(spouse.passed,false);
});

test('unknown next-year PM cannot be presented as approved', () => {
  assert.equal(assessMonth({ familySizeByMonth:{ '2027-01':3 }, pmByYear:{ 2026:{perCapita:20000} } }, '2027-01').status, 'unknown');
});
