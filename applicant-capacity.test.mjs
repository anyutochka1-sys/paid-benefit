import test from 'node:test';
import assert from 'node:assert/strict';
import {applicantCapacity} from './applicant-capacity.mjs';
const child={id:'a',applying:true,role:'child',applicantRights:'intact'};
const base={status:'limited',decisionDate:'2026-10-01',children:[child]};
test('court restriction respects effective and restoration dates',()=>{
 assert.equal(applicantCapacity(base,'2026-09-30').status,'clear');
 assert.equal(applicantCapacity(base,'2026-10-01').status,'exception');
 assert.equal(applicantCapacity({...base,restoredDate:'2026-11-01'},'2026-11-01').status,'clear');
});
test('incapacity with intact parental rights is not automatic refusal',()=>{
 for(const status of ['limited','incapable'])assert.equal(applicantCapacity({...base,status},'2026-10-02').status,'exception');
});
test('rights are checked separately per child and unselected children ignored',()=>{
 const result=applicantCapacity({...base,children:[child,{...child,id:'b',applicantRights:'lost'},{...child,id:'c',applying:false,applicantRights:'restricted'}]},'2026-10-02');
 assert.equal(result.status,'block');assert.deepEqual(result.children.map(c=>c.status),['exception','block']);
});
test('pregnancy has a separate bar while child exception remains',()=>{
 const result=applicantCapacity({...base,pregnancyApplying:true},'2026-10-02');
 assert.equal(result.pregnancy.status,'block');assert.equal(result.children[0].status,'exception');
});
test('unanswered facts, guardian role and invalid dates stay unknown',()=>{
 for(const patch of [{status:''},{decisionDate:''},{decisionDate:'2026-02-30'},{restoredDate:'2026-09-01'},{children:[{...child,applicantRights:''}]},{children:[{...child,role:'ward'}]}])
  assert.equal(applicantCapacity({...base,...patch},'2026-10-02').status,'unknown');
 assert.equal(applicantCapacity({status:'none'},'2026-10-02').status,'clear');
});
