import test from 'node:test';
import assert from 'node:assert/strict';
import {largeFamilyGrace} from './large-family-grace.mjs';

const base={applicationMonth:'2026-09',perCapita:21000,pmPerson:20000,isLargeFamily:true,usedBefore:false,awardEndMonths:['2026-07']};
test('one-time extension applies inside three months after award ends',()=>{
  assert.equal(largeFamilyGrace(base).status,'eligible');
  assert.equal(largeFamilyGrace({...base,applicationMonth:'2026-10'}).tier,50);
  assert.equal(largeFamilyGrace({...base,applicationMonth:'2026-11'}).status,'no');
});
test('income boundary is inclusive, prior use excludes, unknown prior use stays unknown',()=>{
  assert.equal(largeFamilyGrace({...base,perCapita:22000}).status,'eligible');
  assert.equal(largeFamilyGrace({...base,perCapita:22001}).status,'no');
  assert.equal(largeFamilyGrace({...base,usedBefore:true}).status,'no');
  assert.equal(largeFamilyGrace({...base,usedBefore:undefined}).status,'unknown');
});
