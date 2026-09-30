import test from 'node:test';
import assert from 'node:assert/strict';
import {ageAt,includedFamily,childCanApply,applicantParentalRights,checkCars,fourChildCarStatus,applicationChildren} from './family-assets.mjs';

test('parental-rights refusal concerns this applicant and this child, not the other parent',()=>{
  const child={role:'child',applying:true,secondParentStatus:'deprived-rights'};
  assert.equal(applicantParentalRights({...child,applicantRights:'intact'}).status,'clear');
  assert.equal(applicantParentalRights({...child,applicantRights:'restricted'}).status,'block');
  assert.equal(applicantParentalRights({...child,applicantRights:'lost'}).status,'block');
  assert.equal(applicantParentalRights(child).status,'unknown');
  assert.equal(applicantParentalRights({...child,role:'ward'}).status,'not-applicable');
  assert.equal(applicantParentalRights({...child,applying:false}).status,'not-applicable');
});

test('age changes on birthday, including child application cut-off at 17',()=>{
  assert.equal(ageAt('2009-10-01','2026-09-30'),16);
  assert.equal(childCanApply({birthDate:'2009-10-01',russianCitizen:true,livesInRussia:true},'2026-10-01').status,'no');
});
test('full-time unmarried 22-year-old counts, married and 23-year-old do not',()=>{
  const child={role:'child',birthDate:'2004-10-01',married:false,fullTimeStudent:true};
  assert.equal(includedFamily([child],'2026-09-29').included.length,1);
  assert.equal(includedFamily([{...child,married:true}],'2026-09-29').included.length,0);
  assert.equal(includedFamily([child],'2027-10-01').included.length,0);
});
test('imprisoned spouse is excluded from family size under paragraph 46',()=>{
  const people=[{role:'applicant'},{role:'spouse',familyStatus:'imprisoned'}];
  assert.equal(includedFamily(people,'2026-09-29').included.length,1);
  assert.equal(includedFamily(people,'2026-09-29').excluded.length,1);
  assert.equal(includedFamily([{...people[0]},{role:'spouse',familyStatus:'ordinary'}],'2026-09-29').included.length,2);
  assert.equal(includedFamily([{...people[0]},{role:'spouse',familyStatus:'unknown'}],'2026-09-29').unanswered.length,1);
});
test('a child who died before filing cannot be included or claimed',()=>{
  const child={role:'child',birthDate:'2024-02-01',deathDate:'2026-02-01',married:false,russianCitizen:true,livesInRussia:true};
  assert.equal(includedFamily([child],'2026-09-29').excluded.length,1);
  assert.equal(childCanApply(child,'2026-09-29').status,'no');
});
test('ward in state care remains in family, while own child in state care is excluded',()=>{
  const base={birthDate:'2018-02-01',married:false,familyStatus:'stateCare',russianCitizen:true,livesInRussia:true};
  assert.equal(includedFamily([{...base,role:'ward'}],'2026-09-29').included.length,1);
  assert.equal(includedFamily([{...base,role:'child'}],'2026-09-29').excluded.length,1);
  assert.equal(childCanApply({...base,role:'child'},'2026-09-29').status,'no');
});
test('married child is outside the household and cannot be claimed',()=>{
  const child={role:'child',birthDate:'2010-02-01',married:true,russianCitizen:true,livesInRussia:true};
  assert.equal(includedFamily([child],'2026-09-29').excluded.length,1);
  assert.equal(childCanApply(child,'2026-09-29').status,'no');
});
test('powerful car cutoff is 250 hp, and five-year cutoff is inclusive',()=>{
  const context={applicationYear:2026,multipleChildren:false,disabledFamilyMember:false,supportVehicle:false,fourOrMoreChildren:false};
  assert.equal(checkCars([{manufactureYear:2021,horsepower:250}],context).status,'no');
  assert.equal(checkCars([{manufactureYear:2020,horsepower:250}],context).status,'yes');
  assert.equal(checkCars([{manufactureYear:2021,horsepower:249}],context).status,'yes');
});
test('two cars allowed for qualifying family, but not three',()=>{
  const context={applicationYear:2026,multipleChildren:true,disabledFamilyMember:false,supportVehicle:false,fourOrMoreChildren:false};
  assert.equal(checkCars([{manufactureYear:2015,horsepower:80},{manufactureYear:2016,horsepower:90}],context).status,'yes');
  assert.equal(checkCars([{manufactureYear:2015,horsepower:80},{manufactureYear:2016,horsepower:90},{manufactureYear:2017,horsepower:70}],context).status,'no');
});
test('powerful car counts included minors only and reviews a possible fourth adult student',()=>{
  const children=[0,1,2,3].map(i=>({id:String(i),role:'child',birthDate:'2015-01-01',married:false}));
  const applicationDate='2026-09-01';
  const assets={applicationYear:2026,multipleChildren:false,disabledFamilyMember:false,supportVehicle:false};
  const powerful=[{manufactureYear:2024,horsepower:250,acquiredWithFourChildren:true}];
  const included=includedFamily(children,applicationDate);
  assert.equal(checkCars(powerful,{...assets,...fourChildCarStatus(children,included,applicationDate)}).status,'yes');
  const withExcluded=[...children.slice(0,3),{...children[3],married:true}];
  const excluded=includedFamily(withExcluded,applicationDate);
  assert.equal(checkCars(powerful,{...assets,...fourChildCarStatus(withExcluded,excluded,applicationDate)}).status,'no');
  const adult={...children[3],birthDate:'2006-01-01',fullTimeStudent:true};
  const withStudentChildren=[...children.slice(0,3),adult];
  const withStudent=includedFamily(withStudentChildren,applicationDate);
  assert.equal(checkCars(powerful,{...assets,...fourChildCarStatus(withStudentChildren,withStudent,applicationDate)}).status,'unknown');
});

test('requested children with missing facts remain in review beside a confirmed sibling',()=>{
  const good={id:'a',role:'child',applying:true,birthDate:'2020-01-01',married:false,russianCitizen:true,livesInRussia:true};
  const incomplete={...good,id:'b',russianCitizen:undefined};
  const result=applicationChildren([good,incomplete,{...incomplete,id:'c',applying:false}],'2026-09-01');
  assert.equal(result.requested.length,2);
  assert.deepEqual(result.selected.map(child=>child.id),['a']);
  assert.equal(result.review,true);
  assert.equal(result.blocked,false);
  assert.equal(applicationChildren([good,{...incomplete,russianCitizen:true}],'2026-09-01').review,false);
});
test('a selected child becomes unavailable on the exact seventeenth birthday',()=>{
  const child={id:'a',applying:true,birthDate:'2009-09-10',married:false,russianCitizen:true,livesInRussia:true};
  assert.equal(applicationChildren([child],'2026-09-09').selected.length,1);
  assert.equal(applicationChildren([child],'2026-09-10').blocked,true);
  assert.equal(applicationChildren([{...child,applying:false}],'2026-09-10').blocked,false);
});
test('future birth is excluded from family size and application until the birth date',()=>{
  const child={id:'a',role:'child',birthDate:'2026-10-01',married:false,russianCitizen:true,livesInRussia:true};
  assert.equal(includedFamily([child],'2026-09-30').included.length,0);
  assert.equal(childCanApply(child,'2026-09-30').status,'no');
  assert.equal(includedFamily([child],'2026-10-01').included.length,1);
  assert.equal(childCanApply(child,'2026-10-01').status,'yes');
});
test('missing marital status cannot silently confirm a child application',()=>{
  const child={birthDate:'2020-01-01',russianCitizen:true,livesInRussia:true};
  assert.equal(childCanApply(child,'2026-09-01').status,'unknown');
  assert.equal(childCanApply({...child,married:false},'2026-09-01').status,'yes');
});

test('missing or unrecognized spouse status stays unresolved instead of being included',()=>{
  for(const familyStatus of [undefined,'','unknown','unrecognized']) {
    const family=includedFamily([{role:'applicant'},{role:'spouse',familyStatus}],'2026-09-01');
    assert.equal(family.included.length,1);
    assert.equal(family.unanswered.length,1);
    assert.equal(family.excluded.length,0);
  }
});
