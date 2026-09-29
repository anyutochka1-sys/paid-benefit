import test from 'node:test';
import assert from 'node:assert/strict';
import {newbornShortcut} from './newborn.mjs';

const base={birthDate:'2026-03-15',applicationDate:'2026-09-15',olderAwards:[{childId:'older',tier:75,endsOn:'2026-11-30',decisionDate:'2026-01-20'}]};
test('at six months the newborn inherits older award through its expiry',()=>{
  assert.deepEqual(newbornShortcut(base),{status:'simplified',tier:75,startMonth:'2026-03',endsOn:'2026-11-30',sourceChildId:'older',reason:'Размер и срок по последнему решению на старшего ребёнка, без оценки дохода и имущества'});
});
test('one day after six months requires ordinary assessment',()=>{
  assert.equal(newbornShortcut({...base,applicationDate:'2026-09-16'}).status,'ordinary');
});
test('without an active older award or same recipient there is no shortcut',()=>{
  assert.equal(newbornShortcut({...base,applicationDate:'2026-12-01'}).status,'ordinary');
  assert.equal(newbornShortcut({...base,sameRecipient:false}).status,'ordinary');
});
test('pregnancy award starts newborn payment in the month after birth',()=>{
  assert.equal(newbornShortcut({...base,motherPregnancyBenefit:true}).startMonth,'2026-04');
});
