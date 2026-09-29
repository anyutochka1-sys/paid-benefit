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

test('unknown next-year PM cannot be presented as approved', () => {
  assert.equal(assessMonth({ familySizeByMonth:{ '2027-01':3 }, pmByYear:{ 2026:{perCapita:20000} } }, '2027-01').status, 'unknown');
});
