import test from 'node:test';
import assert from 'node:assert/strict';
import {pmRegions,pmFor} from './regional-pm.mjs';
import {pmZones} from './pm-zones.mjs';
import {childTier,regularIncomeMonths,incomeForMonth} from './income.mjs';
import {unifiedReceiptSuggestion} from './benefit-amounts.mjs';
import {incomeWindow} from './engine.mjs';
import {additionalIncomeForApplication,ADDITIONAL_TYPES} from './extra-income.mjs';
let combinations=0;
for(const region of pmRegions(2026))test(`region matrix: ${region.code} ${region.name}`,()=>{
 for(const year of [2025,2026])for(const zone of pmZones(year,region.code).length?pmZones(year,region.code):[{value:''}]){
  const pm=pmFor(year,region.code,zone.value);if(year===2025&&region.code==='199'){assert.equal(pm.status,'unknown');continue;}assert.equal(pm.status,'known');
  for(const size of [2,3,5])for(const children of [1,size-1])for(const offset of [0,-1,1])for(const fraction of [0,.5,.75]){
   const income12=Math.max(0,pm.person*12*size-fraction*pm.child*children*12+offset*12*size),perCapita=income12/12/size,r=childTier({income12,familySize:size,childrenApplying:children,pmPerson:pm.person,pmChild:pm.child});
   if(perCapita>pm.person){assert.equal(r.status,'income-too-high');}
   else {const after50=(income12+12*.5*pm.child*children)/(12*size),after75=(income12+12*.75*pm.child*children)/(12*size);assert.equal(r.status,'estimate');assert.equal(r.tier,after75<=pm.person?100:after50<=pm.person?75:50);assert.equal(r.monthlyPerChild,pm.child*r.tier/100);}
   combinations++;
  }
  for(const tier of [50,75,100])for(const month of [`${year}-02`,`${year}-12`,`${year+1}-01`]){assert.equal(unifiedReceiptSuggestion({tier,sameRegion:'yes'},month,{region:region.code,area:zone.value}),Math.round(pm.child*tier)/100);combinations++;}
 }
});
test('salary periods and two-person sums agree across moving windows',()=>{
 for(let i=1;i<=12;i++)for(const amount of [0,18000,35000.25]){
  const month=`2026-${String(i).padStart(2,'0')}`,person={regularAmount:amount,regularFrom:'2025-09',regularTo:'2026-08'};
  const expected=incomeWindow(month).filter(m=>m>=person.regularFrom&&m<=person.regularTo).length*amount;
  const months=regularIncomeMonths(person,month,{knownThrough:'2026-12'});assert.equal(incomeForMonth([{label:'A',months},{label:'B',months}],month).total,2*expected);combinations++;
 }
});
test('every additional source keeps recipient, qualifying income and annual overlap separate',()=>{
 for(const [type,definition] of Object.entries(ADDITIONAL_TYPES))for(let i=1;i<=12;i++){
  const month=`2026-${String(i).padStart(2,'0')}`;
  const entry={type,personIndex:1,amount:120000,expenses:0,taxYear:2025,from:'2025-01',to:'2026-12',benefitKind:'counted',businessBasis:'usnGross',currency:'RUB'};
  const r=additionalIncomeForApplication([entry],month);assert.equal(r.status,'known',type);
  const expected=definition.period==='annual'?incomeWindow(month).filter(m=>m.startsWith('2025')).length*10000:incomeWindow(month).filter(m=>m>='2025-01'&&m<='2026-12').length*120000;assert.equal(r.amount,expected,type);assert.equal(r.byPerson.has(0),false);assert.equal(Object.values(r.byPerson.get(1)||{}).reduce((s,v)=>s+v.qualifying,0),definition.qualifies?expected:0,type);assert.equal(additionalIncomeForApplication([entry],month,[1]).amount,0,type);combinations++;
 }
});
test('matrix coverage count',()=>{assert.ok(combinations>10000);console.log('MATRIX combinations',combinations);});
