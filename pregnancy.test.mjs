import test from 'node:test';
import assert from 'node:assert/strict';
import {pregnancyTier} from './pregnancy.mjs';

test('pregnancy tier uses working-age PM and eight months for progression',()=>{
  const common={familySize:2,pmPerson:20000,pmWorking:22000};
  assert.equal(pregnancyTier({...common,income12:480001}).status,'income-too-high');
  assert.equal(pregnancyTier({...common,income12:450000}).tier,50);
  assert.equal(pregnancyTier({...common,income12:380000}).tier,75);
  assert.equal(pregnancyTier({...common,income12:0}).tier,100);
  assert.equal(pregnancyTier({...common,income12:0}).monthly,22000);
});

test('unknown income cannot become a pregnancy award',()=>{
  assert.equal(pregnancyTier({income12:null,familySize:2,pmPerson:20000,pmWorking:22000}).status,'unknown');
});
