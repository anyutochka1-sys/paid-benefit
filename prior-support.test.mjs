import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePriorSupport} from './prior-support.mjs';
const entry={target:'child:1',kind:'firstChildOld',name:'Региональная выплата',incomeAssessed:'yes',monthly:10000,from:'2026-01',to:'2026-10'};
const base={answer:'yes',complete:true,entries:[entry],targets:['child:1'],knownTargets:['child:1','child:2','applicant'],applicationMonth:'2026-09',newMonthly:10000};
test('strictly lower amount blocks, equality and larger amount pass',()=>{
 assert.equal(comparePriorSupport({...base,newMonthly:9999.99}).status,'block');
 assert.equal(comparePriorSupport(base).status,'clear');
 assert.equal(comparePriorSupport({...base,newMonthly:10000.01}).status,'clear');
});
test('sum same-recipient support, ignore unrelated child and applicant',()=>{
 const result=comparePriorSupport({...base,entries:[entry,{...entry,name:'Вторая мера',monthly:2000},{...entry,target:'child:2',monthly:90000},{...entry,target:'applicant',monthly:90000}]});
 assert.equal(result.oldMonthly,12000);assert.equal(result.status,'block');
});
test('expiration, future period and non-means-tested support do not block',()=>{
 assert.equal(comparePriorSupport({...base,applicationMonth:'2026-10'}).oldMonthly,10000);
 assert.equal(comparePriorSupport({...base,applicationMonth:'2026-11',newMonthly:null}).oldMonthly,0);
 assert.equal(comparePriorSupport({...base,applicationMonth:'2025-12'}).oldMonthly,0);
 assert.equal(comparePriorSupport({...base,entries:[{...entry,incomeAssessed:'no'}]}).oldMonthly,0);
});
test('missing amount, unknown kind, incomplete list and removed recipient stay unknown',()=>{
 for(const patch of [{answer:''},{complete:false},{entries:[]},{newMonthly:null},{entries:[{...entry,monthly:null}]},{entries:[{...entry,incomeAssessed:''}]},{entries:[{...entry,target:'child:deleted'}]},{entries:[{...entry,from:'2026-13'}]}])
  assert.equal(comparePriorSupport({...base,...patch}).status,'unknown');
});
test('simultaneous pregnancy and child applications do not produce premature refusal',()=>{
 assert.equal(comparePriorSupport({...base,jointContextUnresolved:true,newMonthly:1000}).status,'unknown');
});
test('currency rounding is to kopecks and no answer has explicit zero',()=>{
 assert.equal(comparePriorSupport({...base,newMonthly:9999.999}).status,'clear');
 assert.equal(comparePriorSupport({answer:'no'}).oldMonthly,0);
});

test('unified renewal is not automatically classified as a replaced old payment; regional type needs review',()=>{
 assert.equal(comparePriorSupport({...base,entries:[{...entry,kind:'unified'}]}).oldMonthly,0);
 assert.equal(comparePriorSupport({...base,entries:[{...entry,kind:'regionalOther'}]}).status,'unknown');
});
