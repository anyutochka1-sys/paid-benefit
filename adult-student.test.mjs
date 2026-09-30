import test from 'node:test';
import assert from 'node:assert/strict';
import {adultStudentChecks} from './adult-student.mjs';

const student={id:'c',role:'child',birthDate:'2004-01-01',fullTimeStudent:true,educationFrom:'2025-08',educationTo:'2026-07'};
const family={included:[student]};

test('adult student with ten study months satisfies the individual income exception',()=>{
  const [check]=adultStudentChecks([student],family,[],'2026-09','2026-09-01',27093);
  assert.equal(check.status,'yes');
  assert.ok(check.creditedMonths>=10);
});

test('missing study dates and no income leave adult child criterion open',()=>{
  const child={...student,educationFrom:'',educationTo:''};
  const [check]=adultStudentChecks([child],{included:[child]},[],'2026-09','2026-09-01',27093);
  assert.equal(check.status,'unknown');
});

test('enough entered earnings confirm minimum, but a birthday in window needs review',()=>{
  const child={...student,educationFrom:'',educationTo:''};
  const entries=[{childId:'c',type:'employment',amount:30000,from:'2025-08',to:'2026-07'}];
  assert.equal(adultStudentChecks([child],{included:[child]},entries,'2026-09','2026-09-01',27093)[0].status,'yes');
  const young={...child,birthDate:'2008-03-15'};
  assert.equal(adultStudentChecks([young],{included:[young]},entries,'2026-09','2026-09-01',27093)[0].status,'unknown');
});
