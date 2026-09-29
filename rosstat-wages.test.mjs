import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedRegionalWage} from './rosstat-wages.mjs';

test('only reviewed final data with publication month can fill the alimony wage',()=>{
  const base={years:{'2026':{regions:{'Кемеровская область':110000},preliminary:false,final_confirmed:true,publication_month:'2027-03',source:'rosstat'}}};
  assert.equal(confirmedRegionalWage(base,2026,'42','Кемеровская область-Кузбасс').amount,110000);
  assert.equal(confirmedRegionalWage({...base,years:{'2026':{...base.years['2026'],preliminary:true}}},2026,'42','Кемеровская область-Кузбасс').status,'unknown');
  assert.equal(confirmedRegionalWage({...base,years:{'2026':{...base.years['2026'],publication_month:null}}},2026,'42','Кемеровская область-Кузбасс').status,'unknown');
  assert.equal(confirmedRegionalWage(base,2026,'95','Херсонская область').status,'unknown');
});
