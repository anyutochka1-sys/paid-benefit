import test from 'node:test';
import assert from 'node:assert/strict';
import {checkProperty as rawCheckProperty,checkOtherVehicles,checkDepositInterest,depositIncomeForApplication} from './property.mjs';
const context={familySize:4,rural:false,multipleChildren:false,disabledFamilyMember:false,supportVehicle:false};
const checkProperty=(items,ctx)=>rawCheckProperty(items.map(item=>({...item,familyShare:item.familyShare??1})),ctx);
test('unknown ownership share never becomes a definite apartment refusal',()=>{
  const result=rawCheckProperty([{type:'apartment',area:90,familyShare:1},{type:'apartment',area:90}],context);
  assert.equal(result.status,'review');
  assert.equal(rawCheckProperty([{type:'apartment',area:90,familyShare:1},{type:'apartment',area:90,familyShare:1/3}],context).status,'yes');
});
test('one apartment unlimited, two exceed 24 square metres per person only above threshold',()=>{
  assert.equal(checkProperty([{type:'apartment',area:200}],context).status,'yes');
  assert.equal(checkProperty([{type:'apartment',area:48},{type:'apartment',area:48}],context).status,'yes');
  assert.equal(checkProperty([{type:'apartment',area:48},{type:'apartment',area:49}],context).status,'no');
});
test('apartments and houses have separate area limits, not one combined limit',()=>{
  assert.equal(checkProperty([{type:'apartment',area:140},{type:'house',area:250}],context).status,'yes');
  assert.equal(checkProperty([{type:'apartment',area:140},{type:'house',area:100},{type:'house',area:61}],context).status,'no');
  assert.equal(checkProperty([{type:'apartment',area:140},{type:'house',area:100},{type:'house',area:60}],context).status,'yes');
});
test('housing and land exceptions are evaluated per object',()=>{
  assert.equal(checkProperty([{type:'apartment',area:90},{type:'apartment',area:90,uninhabitable:true}],context).status,'yes');
  assert.equal(checkProperty([{type:'land',hectares:.3,farEastHectare:true}],context).status,'yes');
  assert.equal(checkProperty([{type:'land',hectares:.3,agriculturalExcluded:true}],context).status,'yes');
  assert.equal(checkProperty([{type:'apartment',area:90},{type:'apartment',area:90,familyShare:.3}],context).status,'yes');
});
test('rural land has a one-hectare limit and supported land is excluded',()=>{
  assert.equal(checkProperty([{type:'land',hectares:.5}],{...context,rural:undefined}).status,'review');
  assert.equal(checkProperty([{type:'apartment',area:90}],{...context,rural:undefined}).status,'yes');
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
test('interest under the threshold is prorated by months of tax year in window',()=>{
  const r=depositIncomeForApplication([{taxYear:2025,interestForRelevantTaxYear:18000}],{applicationMonth:'2026-09',perCapitaMinimum:20000});
  assert.equal(r.months,5);
  assert.equal(r.amount,7500);
});
test('interest above the threshold counts in full and independently denies',()=>{
  const r=depositIncomeForApplication([{taxYear:2025,interestForRelevantTaxYear:30000}],{applicationMonth:'2026-09',perCapitaMinimum:20000});
  assert.equal(r.method,'full-due-to-threshold');assert.equal(r.amount,30000);assert.equal(r.thresholdStatus,'no');
});
test('closed account avoids threshold but interest still enters prorated income',()=>{
  const r=depositIncomeForApplication([{taxYear:2025,interestForRelevantTaxYear:30000,closedMonth:'2026-03'}],{applicationMonth:'2026-09',perCapitaMinimum:20000});
  assert.equal(r.amount,12500);assert.equal(r.thresholdStatus,'yes');
});
test('ward nominal account is excluded from threshold and income',()=>{
  const r=depositIncomeForApplication([{taxYear:2025,interestForRelevantTaxYear:30000,nominalWardAccount:true}],{applicationMonth:'2026-09',perCapitaMinimum:20000});
  assert.equal(r.amount,0);assert.equal(r.thresholdStatus,'yes');
});
