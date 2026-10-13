// Integration checks for the mobile questionnaire, run with JSDOM_MODULE.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pmFor} from '../regional-pm.mjs';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'jsdom');
const root=new URL('../',import.meta.url);
async function boot(saved,source=root){
  const code=fs.readFileSync(new URL('ui.mjs',source),'utf8');
  const dom=new JSDOM(fs.readFileSync(new URL('index.html',source),'utf8'),{url:'https://example.com',runScripts:'outside-only'}),w=dom.window;
  for(const match of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)';/g)){
    const mod=await import(new URL(match[2].split('?')[0],source));for(const name of match[1].split(',').map(s=>s.trim()))w[name]=mod[name];
  }
  w.fetch=()=>Promise.reject(new Error('offline audit'));w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  if(saved)w.localStorage.setItem('anna-benefit-draft-v1',saved);
  w.eval(code.replace(/^import .*?;$/gm,''));return dom;
}
function set(w,selector,value,event='input'){
  const el=w.document.querySelector(selector);assert.ok(el,selector);
  if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event(event,{bubbles:true}));
}
function month(w,selector,value){
  const input=w.document.querySelector(selector);assert.ok(input,selector);
  const proxy=input.closest('.month-picker');assert.ok(proxy,'month control is enhanced: '+selector);
  const [year,month]=value.split('-');
  set(w,selector+' ~ .month-picker-year',year,'change');
  set(w,selector+' ~ .month-picker-month',month,'change');
  assert.equal(input.value,value);
  assert.equal(proxy.querySelector('.month-picker-month').selectedOptions[0].textContent,
    ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][Number(month)-1]);
}
function next(d){d.getElementById('next').click();assert.equal(d.getElementById('step-review').hidden,true,'complete answers must advance without review: '+d.body.dataset.question+' '+d.getElementById('step-review').textContent);}
function section(d,n){d.querySelector(`.step-links button:nth-child(${n})`).click();}
function save(w){set(w,'#save-draft',true,'change');w.dispatchEvent(new w.Event('pagehide'));return w.localStorage.getItem('anna-benefit-draft-v1');}
function visible(el){for(let node=el;node;node=node.parentElement)if(node.hidden)return false;return !!el;}
function child(w,index,birth){
  const prefix=`#children .form-row:nth-child(${index}) `;
  for(const [cls,value] of [['child-name','Тестовый ребёнок '+index],['birth',birth],['citizen','yes'],['award-recipient','none']])set(w,prefix+'.'+cls,value);
  w.document.querySelector(prefix+'.quick-confirm button').click();
}
let checks=0;
const dom=await boot(),w=dom.window,d=w.document;
d.querySelector('[data-goal=baby]').click();assert.equal(d.body.dataset.question,'region');
set(w,'#pm-region','63');next(d);set(w,'#marital-status','married');set(w,'#spouse-status','ordinary');next(d);
month(w,'#start','2026-10');next(d);child(w,1,'2024-11-20');next(d);
d.querySelector('.children-more button').click();child(w,2,'2021-01-10');next(d);next(d);
assert.equal(d.body.dataset.question,'income-sources');
for(const key of ['employment','workingCare','deposit'])set(w,`input[value="${key}"]`,true,'change');
next(d);assert.equal(d.body.dataset.question,'salary');
for(const [i,amount] of [[1,0],[2,35000]]){
  const q=`.income-person:nth-child(${i}) `;set(w,q+'.regular-amount',String(amount));
  month(w,q+'.regular-from','2025-09');month(w,q+'.regular-to','2026-08');
}
next(d);if(d.body.dataset.question==='salary-spouse')next(d);assert.equal(d.body.dataset.question,'extra-income');
const care='#extra-entries [data-income-source="workingCare"] ';
assert.ok(visible(d.querySelector(care+'.amount')));assert.equal(visible(d.querySelector('#deposit-section')),false);
set(w,care+'.amount','15000');month(w,care+'.from','2025-09');month(w,care+'.to','2026-08');next(d);
assert.equal(d.body.dataset.question,'deposits');set(w,'#deposits .tax-year','2025');set(w,'#deposits .interest','1000');
next(d);assert.equal(d.body.dataset.question,'care');
d.getElementById('care-helper').open=true;set(w,'#care-child',d.querySelector('#children .form-row').dataset.childId);
month(w,'#care-from','2025-09');month(w,'#care-to','2026-08');d.getElementById('add-care-period').click();next(d);
assert.equal(d.body.dataset.question,'assets');set(w,'#asset-house',true);set(w,'#asset-apartment',true);next(d);
assert.equal(d.body.dataset.question,'property');assert.equal(d.querySelector('#properties .form-row:not([hidden]) .type').value,'apartment','apartment comes before a house even if selected later');
assert.equal(visible(d.querySelector('#properties .form-row:not([hidden]) .area')),true,'area is visible for every apartment');set(w,'#properties .form-row:not([hidden]) .area','55');next(d);
assert.equal(d.querySelector('#properties .form-row:not([hidden]) .type').value,'house');assert.equal(visible(d.querySelector('#properties .form-row:not([hidden]) .area')),true);set(w,'#properties .form-row:not([hidden]) .area','90');next(d);
assert.equal(d.body.dataset.question,'property-summary');next(d);assert.equal(d.body.dataset.question,'citizenship');
d.querySelector('section[data-question=citizenship] .quick-confirm button').click();set(w,'#residence-basis','permanent');next(d);
assert.equal(d.body.dataset.question,'result');
const result=d.querySelector('[data-result-month="2026-10"]');assert.match(result.textContent,/Предварительный расчёт готов/);
assert.ok(result.querySelector('.individual-income-checks').closest('details.result'));assert.equal(result.querySelector('details.result').open,false);
assert.equal(result.querySelector('.result-answers'),null,'complete first-month questionnaire must not ask for missing answers');
const pm=pmFor(2026,'63');
assert.match(result.textContent,new RegExp(pm.child.toLocaleString('ru-RU').replace(/\u00a0/g,'.')));
assert.equal(d.querySelector('.comparison-calendar').open,false,'future months are opt-in details');
assert.equal(d.querySelector('[data-result-month="2027-01"] [data-answer-target^="#deposits"]')?.dataset.answerTarget,'#deposits .form-row:nth-child(1) .forecast-interest');
checks++;
// Drafts retain the ISO model values and synthetic zero, not presentation-only selects.
const saved=save(w),draft=JSON.parse(saved);
assert.equal(draft.rows.deposits[0].fields.length,6,'presentation-only month selects are excluded from persisted fields');
const restored=await boot(saved),rd=restored.window.document;
assert.equal(rd.querySelector('.regular-amount').value,'0');assert.equal(rd.querySelector('.regular-from').value,'2025-09');
assert.equal(rd.querySelector('#deposits .interest').value,'1000');assert.equal(rd.querySelector('#deposits .closed').value,'');
section(rd,1);rd.getElementById('next').click();rd.getElementById('next').click();
assert.equal(rd.querySelector('#start').closest('.month-picker').querySelector('.month-picker-month').selectedOptions[0].textContent,'Октябрь');
checks++;
// Empty month is still unknown: a partially chosen month cannot pass validation.
month(w,'#start','2026-10');section(d,1);d.getElementById('next').click();d.getElementById('next').click();
set(w,'#start ~ .month-picker-year','','change');d.getElementById('next').click();assert.equal(d.body.dataset.question,'month');assert.equal(d.getElementById('step-review').hidden,false);
assert.equal(d.querySelector('#start').value,'');checks++;
// Common land controls must survive deleting a land object.
set(w,'#start','2026-10');set(w,'#asset-land',true);section(d,5);d.getElementById('next').click();
while(d.querySelector('#properties .form-row:not([hidden]) .type')?.value!=='land')next(d);
set(w,'#rural','city');set(w,'#properties .form-row:not([hidden]) .hectares','0.1');d.querySelector('#properties .form-row:not([hidden]) .remove').click();assert.ok(d.getElementById('rural'));checks++;
// A saved previous-version questionnaire must still recover all months and amounts.
if(process.env.BASELINE_ROOT){
  const baseline=new URL(process.env.BASELINE_ROOT.endsWith('/')?process.env.BASELINE_ROOT:process.env.BASELINE_ROOT+'/');
  const originalResult=await boot(saved,baseline);const before=originalResult.window.document.querySelector('[data-result-month="2026-10"] .result-amount')?.textContent;const after=rd.querySelector('[data-result-month="2026-10"] .result-amount')?.textContent;assert.ok(before);assert.equal(after,before,'mobile refactor preserves the same calculated percentage and ruble amount');originalResult.window.close();
  const old=await boot(undefined,baseline),ow=old.window,od=ow.document;
  od.querySelector('[data-goal=children]').click();set(ow,'#start','2026-10');set(ow,'#pm-region','63');set(ow,'#marital-status','never');
  set(ow,'input[value="deposit"]',true,'change');set(ow,'#deposits .tax-year','2025');set(ow,'#deposits .interest','1234');set(ow,'#deposits .closed','2026-02');set(ow,'#deposits .forecast-interest','0');
  const upgraded=await boot(save(ow)),ud=upgraded.window.document;
  for(const [selector,value] of [['#start','2026-10'],['#deposits .interest','1234'],['#deposits .closed','2026-02'],['#deposits .forecast-interest','0']])assert.equal(ud.querySelector(selector).value,value);
  old.window.close();upgraded.window.close();checks++;
}
// Fractional area, ownership and money must remain valid and survive reload.
{
 const fractional=await boot(),fw=fractional.window,fd=fw.document;
 fd.querySelector('[data-goal=children]').click();set(fw,'#pm-region','63');set(fw,'#asset-apartment',true);section(fd,5);next(fd);
 set(fw,'#properties .area','0');fd.getElementById('next').click();assert.equal(fd.body.dataset.question,'property');assert.equal(fd.querySelector('#properties .area').validity.valid,false);set(fw,'#properties .area','55.5');set(fw,'#properties .share','66.67');
 assert.equal(fd.querySelector('#properties .area').validity.valid,true);assert.equal(fd.querySelector('#properties .share').validity.valid,true);next(fd);assert.equal(fd.body.dataset.question,'property-summary');
 set(fw,'input[value="pension"]',true,'change');section(fd,3);next(fd);
 set(fw,'#extra-entries .amount','15000.25');month(fw,'#extra-entries .from','2026-08');month(fw,'#extra-entries .to','2025-09');
 assert.equal(fd.querySelector('#extra-entries .amount').validity.valid,true);fd.getElementById('next').click();assert.equal(fd.body.dataset.question,'extra-income');assert.match(fd.getElementById('step-review').textContent,/раньше первого/);
 month(fw,'#extra-entries .from','2025-09');month(fw,'#extra-entries .to','2026-08');next(fd);assert.equal(fd.body.dataset.question,'care');
 fd.getElementById('add').click();month(fw,'#reasons .from','2026-08');month(fw,'#reasons .to','2025-09');fd.getElementById('next').click();assert.equal(fd.body.dataset.question,'care');assert.match(fd.getElementById('step-review').textContent,/раньше первого/);
 const loaded=await boot(save(fw)),ld=loaded.window.document;assert.equal(ld.querySelector('#properties .area').value,'55.5');assert.equal(ld.querySelector('#properties .share').value,'66.67');assert.equal(ld.querySelector('#extra-entries .amount').value,'15000.25');loaded.window.close();fractional.window.close();checks++;
}
// Printing expands every detail and restores the client's compact view afterwards.
{
 section(rd,7);const details=[...rd.querySelectorAll('#results details')];assert.ok(details.length);const before=details.map(el=>el.open);
 restored.window.print=()=>{assert.ok(details.every(el=>el.open),'print contains full explanations');restored.window.dispatchEvent(new restored.window.Event('afterprint'));};
 rd.getElementById('print-results').click();assert.deepEqual(details.map(el=>el.open),before);checks++;
}
dom.window.close();restored.window.close();console.log(`PASS ${checks} complete mobile and draft regression scenarios`);
