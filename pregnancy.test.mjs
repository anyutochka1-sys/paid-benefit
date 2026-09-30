import {applicationDateForMonth} from './engine.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {pregnancyTier,pregnancyAtDate} from './pregnancy.mjs';

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

const anchor={weeks:11,referenceDate:'2026-09-01',forecastThrough:'2026-12-01'};
test('projection crosses 12 weeks on the exact date',()=>{
  assert.equal(pregnancyAtDate({...anchor,applicationDate:'2026-09-07'}).weeks<12,true);
  assert.equal(pregnancyAtDate({...anchor,applicationDate:'2026-09-08'}).weeks,12);
  assert.equal(pregnancyAtDate({...anchor,applicationDate:'2026-10-01'}).status,'forecast');
});
test('future continuation is never silently assumed',()=>{
  assert.equal(pregnancyAtDate({...anchor,forecastThrough:'',applicationDate:'2026-10-01'}).status,'unknown');
  assert.equal(pregnancyAtDate({...anchor,applicationDate:'2026-12-02'}).status,'unknown');
  assert.equal(pregnancyAtDate({...anchor,weeks:'',applicationDate:'2026-09-01'}).status,'unknown');
});
test('actual end overrides forecast and malformed dates stay unknown',()=>{
  assert.equal(pregnancyAtDate({...anchor,endedDate:'2026-10-01',applicationDate:'2026-10-01'}).status,'ended');
  assert.equal(pregnancyAtDate({...anchor,endedDate:'2026-10-01',applicationDate:'2026-09-30'}).status,'forecast');
  assert.equal(pregnancyAtDate({...anchor,endedDate:'2026-02-30',applicationDate:'2026-09-01'}).status,'unknown');
  assert.equal(pregnancyAtDate({...anchor,weeks:42,applicationDate:'2026-09-02'}).status,'unknown');
});

test('pregnancy forecast keeps the actual first filing date in a short month',()=>{
  const referenceDate=applicationDateForMonth('2026-02',31);
  const applicationDate=applicationDateForMonth('2026-03',31);
  const result=pregnancyAtDate({weeks:11,referenceDate,applicationDate,forecastThrough:'2026-03-31'});
  assert.equal(result.status,'forecast');
  assert.equal(result.weeks,11+31/7);
});
