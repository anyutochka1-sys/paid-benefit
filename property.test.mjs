import test from 'node:test';
import assert from 'node:assert/strict';
import {checkProperty,checkOtherVehicles,checkDepositInterest} from './property.mjs';
const context={familySize:4,rural:false,multipleChildren:false,disabledFamilyMember:false,supportVehicle:false};
test('one apartment unlimited, two exceed 24 square metres per person only above threshold',()=>{
  assert.equal(checkProperty([{type:'apartment',area:200}],context).status,'yes');
  assert.equal(checkProperty([{type:'apartment',area:48},{type:'apartment',area:48}],context).status,'yes');
  assert.equal(checkProperty([{type:'apartment',area:48},{type:'apartment',area:49}],context).status,'no');
});
test('rural land has a one-hectare limit and supported land is excluded',()=>{
  assert.equal(checkProperty([{type:'land',hectares:.5}],context).status,'no');
  assert.equal(checkProperty([{type:'land',hectares:.5}],{...context,rural:true}).status,'yes');
  assert.equal(checkProperty([{type:'land',hectares:.5,supported:true}],context).status,'yes');
});
test('old motorboat ignored; two recent boats fail',()=>{
  const c={applicationYear:2026};
  assert.equal(checkOtherVehicles([{type:'boat',manufactureYear:2020},{type:'boat',manufactureYear:2025}],c).status,'yes');
  assert.equal(checkOtherVehicles([{type:'boat',manufactureYear:2021},{type:'boat',manufactureYear:2025}],c).status,'no');
});
test('deposit interest is compared in full, except accounts closed six months before filing',()=>{
  const account={interestForRelevantTaxYear:30000};
  assert.equal(checkDepositInterest([account],{applicationMonth:'2026-09',perCapitaMinimum:20000}).status,'no');
  assert.equal(checkDepositInterest([{...account,closedMonth:'2026-03'}],{applicationMonth:'2026-09',perCapitaMinimum:20000}).status,'yes');
});
