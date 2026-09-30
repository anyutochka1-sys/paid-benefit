import test from 'node:test';
import assert from 'node:assert/strict';
import {newbornShortcut} from './newborn.mjs';

const base={birthDate:'2026-03-15',applicationDate:'2026-09-15',sameRecipient:true,olderAwards:[{childId:'older',tier:75,endsOn:'2026-11-30',decisionDate:'2026-01-20'}]};
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
test('unknown recipient is not presented as simplified approval',()=>{
  assert.equal(newbornShortcut({...base,sameRecipient:undefined}).status,'unknown');
});
test('pregnancy award starts newborn payment in the month after birth',()=>{
  assert.equal(newbornShortcut({...base,motherPregnancyBenefit:true}).startMonth,'2026-04');
});

test('latest decision controls size and expiry, regardless of input order',()=>{
  const newer={childId:'newer',tier:50,endsOn:'2026-10-31',decisionDate:'2026-08-01'};
  const result=newbornShortcut({...base,olderAwards:[newer,...base.olderAwards]});
  assert.equal(result.tier,50);
  assert.equal(result.endsOn,'2026-10-31');
});
test('an incomplete active award cannot be silently skipped in favour of another',()=>{
  for(const missing of ['tier','endsOn','decisionDate']) {
    const incomplete={childId:'second',tier:100,endsOn:'2026-12-31',decisionDate:'2026-08-01'};
    delete incomplete[missing];
    assert.equal(newbornShortcut({...base,olderAwards:[...base.olderAwards,incomplete]}).status,'unknown');
  }
});
test('future decisions and expired awards do not choose the newborn size',()=>{
  const future={childId:'future',tier:100,endsOn:'2027-09-30',decisionDate:'2026-09-16'};
  const expired={childId:'expired',endsOn:'2026-09-14'};
  assert.equal(newbornShortcut({...base,olderAwards:[...base.olderAwards,future,expired]}).tier,75);
});
test('conflicting decisions on the same day require review',()=>{
  const conflict={...base.olderAwards[0],childId:'second',tier:100};
  assert.equal(newbornShortcut({...base,olderAwards:[...base.olderAwards,conflict]}).status,'unknown');
  assert.equal(newbornShortcut({...base,olderAwards:[...base.olderAwards,{...conflict,tier:75}]}).tier,75);
});
