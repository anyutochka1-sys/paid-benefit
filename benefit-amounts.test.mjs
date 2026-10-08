import test from 'node:test';import assert from 'node:assert/strict';
import {unifiedReceiptSuggestion,receiptAmount,receiptContext,benefitMonthForReceipt} from './benefit-amounts.mjs';
import {expandBenefitPayments} from './benefits.mjs';
import {confirmedRegionalWage} from './rosstat-wages.mjs';
import fs from 'node:fs';
const context={region:'24',area:'город Красноярск'};
const entry={kind:'unified',amountMode:'automatic',sameRegion:'yes',tier:100,from:'2025-12',to:'2026-01'};
test('ordinary receipts use the prior benefit month and keep the same city despite renamed label',()=>{assert.equal(unifiedReceiptSuggestion(entry,'2025-12',context),18066);assert.equal(unifiedReceiptSuggestion(entry,'2026-01',context),18066);assert.equal(unifiedReceiptSuggestion({...entry,tier:75},'2025-12',context),13549.5);});
test('actual receipts require confirmation; explicit zero, double payment and blank override survive',()=>{assert.equal(receiptAmount(entry,'2025-12',context),null);assert.equal(receiptAmount({...entry,receiptsConfirmed:true,confirmedContext:receiptContext(entry,context)},'2025-12',context),18066);for(const amount of [0,36132,''])assert.equal(receiptAmount({...entry,receiptOverrides:{'2025-12':amount}},'2025-12',context),amount);assert.equal(receiptAmount({amount:'123'},'2025-12',context),'123');});
test('another region and an unpublished future year never use current region or invented historical values',()=>{assert.equal(unifiedReceiptSuggestion({...entry,sameRegion:'no',benefitRegion:'77'},'2025-12',context),20663);assert.equal(unifiedReceiptSuggestion(entry,'2027-02',context),null);assert.equal(unifiedReceiptSuggestion({...entry,sameRegion:''},'2025-12',context),null);});
test('expanded income sums indexed receipts separately, including explicit corrections',()=>{const result=expandBenefitPayments([{...entry,receiptsConfirmed:true,confirmedContext:receiptContext(entry,context)}],'2026-03',{amountForMonth:(e,m)=>receiptAmount(e,m,context)});assert.deepEqual(result.payments.map(p=>p.amount),[18066,18066]);});
test('final SFR regional salary snapshot differs from preliminary workbook and uses May availability',()=>{const table=JSON.parse(fs.readFileSync(new URL('./data/rosstat-wages.json',import.meta.url)));assert.equal(confirmedRegionalWage(table,2025,'24','Красноярский край').amount,106698);assert.equal(confirmedRegionalWage(table,2024,'24','Красноярский край').amount,95026.1);assert.equal(confirmedRegionalWage(table,2025,'77','г. Москва').amount,181776.8);assert.equal(confirmedRegionalWage(table,2025,'24','Красноярский край').publishedMonth,'2026-05');});

test('changing the family region invalidates confirmation without overwriting actual corrections',()=>{assert.equal(receiptAmount({...entry,receiptsConfirmed:true,confirmedContext:receiptContext(entry,context)},'2025-12',{region:'77',area:''}),null)});


test('January uses December rate, February uses indexed January rate; 2027 January is still known',()=>{
  assert.equal(benefitMonthForReceipt('2026-01'),'2025-12');assert.equal(benefitMonthForReceipt('2026-02'),'2026-01');assert.equal(benefitMonthForReceipt('bad'),null);
  assert.equal(unifiedReceiptSuggestion(entry,'2026-02',context),19294);
  assert.equal(unifiedReceiptSuggestion({...entry,tier:50},'2026-01',context),9033);
  assert.equal(unifiedReceiptSuggestion({...entry,tier:75},'2026-02',context),14470.5);
  assert.equal(unifiedReceiptSuggestion(entry,'2027-01',context),19294);
  assert.equal(unifiedReceiptSuggestion({...entry,benefitAreas:{2025:'город Норильск',2026:'город Красноярск'}},'2026-01',context),26883);
});
test('early December receipts, zero January and first-award actual corrections stay in their receipt months',()=>{
  const payment={...entry,receiptsConfirmed:true,confirmedContext:receiptContext(entry,context),receiptOverrides:{'2025-12':36132,'2026-01':0}};
  const expanded=expandBenefitPayments([payment],'2026-03',{amountForMonth:(e,m)=>receiptAmount(e,m,context)});
  assert.deepEqual(expanded.payments.map(p=>[p.month,p.amount]),[['2025-12',36132],['2026-01',0]]);
  assert.equal(receiptAmount({...entry,receiptOverrides:{'2026-01':19294}},'2026-01',context),19294);
  const oldContext=JSON.stringify([entry.sameRegion,context.region,context.area,{},entry.tier,entry.from,entry.to]);
  assert.equal(receiptAmount({...entry,receiptsConfirmed:true,confirmedContext:oldContext},'2026-01',context),null);
});
