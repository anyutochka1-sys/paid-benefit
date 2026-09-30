import test from 'node:test';
import assert from 'node:assert/strict';
import {familyAssets} from './asset-owners.mjs';

test('property of an included adult student child counts, excluded child does not',()=>{
  const members={included:[{role:'applicant'},{id:'a',role:'child'}],excluded:[{person:{id:'b',role:'child'}}],unanswered:[]};
  const result=familyAssets([{owner:'child:a',type:'apartment'},{owner:'child:b',type:'house'}],members);
  assert.deepEqual(result.items.map(x=>x.type),['apartment']);
  assert.equal(result.needsReview,false);
});

test('ward-owned assets are excluded by property tests, but ordinary interest remains separately reviewable',()=>{
  const members={included:[{role:'applicant'},{id:'w',role:'ward'}],excluded:[],unanswered:[]};
  const [car]=familyAssets([{owner:'child:w',manufactureYear:2025}],members).items;
  const [account]=familyAssets([{owner:'child:w',interestForRelevantTaxYear:500}],members,{includeWardIncome:true}).items;
  assert.equal(car.wardOwned,true);
  assert.equal(account.wardOwned,undefined);
});

test('unanswered or deleted child owner cannot silently become applicant ownership',()=>{
  const members={included:[{role:'applicant'}],excluded:[],unanswered:[{person:{id:'a',role:'child'}}]};
  for(const owner of ['child:a','child:deleted']) {
    const result=familyAssets([{owner}],members);
    assert.deepEqual(result.items,[]);
    assert.equal(result.needsReview,true);
  }
});
