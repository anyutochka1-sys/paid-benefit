import test from 'node:test';
import assert from 'node:assert/strict';
import {awardConflict} from './award-conflict.mjs';

test('current award of another representative blocks without residence decision',()=>{
  assert.equal(awardConflict({awardRecipient:'other',awardEnd:'2026-12-31',courtResidence:false},'2026-09').status,'block');
  assert.equal(awardConflict({awardRecipient:'other',awardEnd:'2026-12-31',courtResidence:true},'2026-09').status,'court-exception');
});
test('renewal in final month and joint renewal exception',()=>{
  const child={awardRecipient:'self',awardEnd:'2026-09-30'};
  assert.equal(awardConflict(child,'2026-09').status,'renewal');
  assert.equal(awardConflict({...child,awardEnd:'2027-03-31'},'2026-09').status,'review');
  assert.equal(awardConflict({...child,awardEnd:'2027-03-31'},'2026-09',{jointRenewal:true}).status,'renewal');
});
