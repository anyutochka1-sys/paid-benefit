// Run with npm-installed jsdom, or JSDOM_MODULE pointing to its API module.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'jsdom');
const root=new URL('../',import.meta.url);
async function boot(saved){
 const code=fs.readFileSync(new URL('ui.mjs',root),'utf8');
 const dom=new JSDOM(fs.readFileSync(new URL('index.html',root),'utf8'),{url:'https://example.com',runScripts:'outside-only'}),w=dom.window;
 for(const match of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)';/g)){
  const mod=await import(new URL(match[2].split('?')[0],root));for(const name of match[1].split(',').map(s=>s.trim()))w[name]=mod[name];
 }
 w.fetch=()=>Promise.reject(new Error('offline audit'));w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 if(saved)w.localStorage.setItem('anna-benefit-draft-v1',saved);
 w.eval(code.replace(/^import .*?;$/gm,''));return dom;
}
function set(w,selector,value,event='input'){const el=w.document.querySelector(selector);assert.ok(el,selector);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event(event,{bubbles:true}));}
function visible(el){if(!el)return false;for(let node=el;node;node=node.parentElement){if(node.hidden)return false;if(node.tagName==='DETAILS'&&!node.open&&!node.querySelector('summary')?.contains(el))return false;}return true;}
function section(d,n){d.querySelector(`.step-links button:nth-child(${n})`).click();}
function start(w){const d=w.document;d.querySelector('[data-goal=children]').click();section(d,3);}
import {pmRegions,pmFor} from '../regional-pm.mjs';
import {pmZones} from '../pm-zones.mjs';
import {ADDITIONAL_TYPES} from '../extra-income.mjs';
let paths=0;
function child(w){const d=w.document;d.getElementById('add-child').click();for(const [cls,value] of [['birth','2021-01-10'],['citizen','yes'],['applicant-rights','intact'],['second-parent-status','recorded'],['award-recipient','none']])set(w,'#children .'+cls,value);}
function basic(w,region,area=''){start(w);set(w,'#pm-region',region);if(area)set(w,'#pm-area',area);set(w,'#marital-status','married');set(w,'#spouse-status','ordinary');child(w);set(w,'#assets-none',true);set(w,'#applicant-citizen','yes');set(w,'#applicant-residence','yes');set(w,'#applicant-capacity','none');set(w,'#residence-basis','permanent');}
const cases=process.argv.includes('--regressions')?[]:pmRegions(2026);
if(cases.length){
 const dom=await boot(),w=dom.window,d=w.document;basic(w,'63');
 set(w,'input[value="employment"]',true,'change');set(w,'input[value="selfEmployed"]',true,'change');
 for(const [i,amount] of [[1,25000],[2,19000]]){const q=`.income-person:nth-child(${i}) `;set(w,q+'.regular-amount',String(amount));set(w,q+'.regular-from','2025-09');set(w,q+'.regular-to','2026-08');}
 const extra='#extra-entries [data-income-source="selfEmployed"] ';set(w,extra+'.person','1');set(w,extra+'.amount','1000');set(w,extra+'.from','2025-09');set(w,extra+'.to','2026-08');section(d,7);
 for(const region of cases){
  set(w,'#pm-region',region.code);const zones=pmZones(2026,region.code);
  for(const zone of zones.length?zones:[{value:''}]){if(zone.value)set(w,'#pm-area',zone.value);const pm=pmFor(2026,region.code,zone.value),card=d.querySelector('[data-result-month="2026-10"]');assert.ok(card.textContent.includes(pm.person.toLocaleString('ru-RU')+' ₽ на человека'),region.name+' PM');assert.match(card.textContent,/540.000 ₽/);const checks=card.querySelectorAll('.individual-income-check');assert.match(checks[0].textContent,/300.000.*Дохода достаточно/);assert.match(checks[1].textContent,/240.000.*Дохода достаточно/);paths++;}
  if(['24','63','77','78','54','10','11','14','28','29','38','70','87','90'].includes(region.code))for(const status of ['imprisoned','ordinary']){set(w,'#spouse-status',status);const card=d.querySelector('[data-result-month="2026-10"]');assert.equal(card.querySelectorAll('.individual-income-check').length,status==='ordinary'?2:1);assert.match(card.textContent,status==='ordinary'?/540.000 ₽/:/300.000 ₽/);paths++;}
  for(const button of d.querySelectorAll('[data-answer-target]'))assert.ok(d.querySelector(button.dataset.answerTarget),region.code+' target '+button.dataset.answerTarget);
  console.log('REGION',region.code,region.name,'PASS');
 }
 // The same salary combined with every other source preserves per-person earnings.
 set(w,'#pm-region','63');set(w,'input[value="selfEmployed"]',false,'change');
 let previous='';
 for(const [type,definition] of Object.entries(ADDITIONAL_TYPES)){
  if(previous)set(w,`input[value="${previous}"]`,false,'change');set(w,`input[value="${type}"]`,true,'change');previous=type;
  const q=`#extra-entries [data-income-source="${type}"] `;set(w,q+'.person','1');set(w,q+'.amount','1000');
  if(definition.period==='annual')set(w,q+'.tax-year','2025');else{set(w,q+'.from','2025-09');set(w,q+'.to','2026-08');}
  if(type==='otherBenefit')set(w,q+'.benefit-kind','counted');if(type==='business')set(w,q+'.business-basis','usnGross');if(type==='securities')set(w,q+'.expenses','0');if(type.startsWith('foreign'))set(w,q+'.currency','RUB');
  const expected=definition.period==='annual'?1000*4/12:12000,card=d.querySelector('[data-result-month="2026-10"]');const checks=card.querySelectorAll('.individual-income-check');assert.ok(checks[0].textContent.includes('300'+String.fromCharCode(160)+'000 ₽'),type+' applicant');assert.ok(checks[1].textContent.includes((228000+(definition.qualifies?expected:0)).toLocaleString('ru-RU')+' ₽'),type+' spouse');assert.ok(card.textContent.includes((528000+expected).toLocaleString('ru-RU')+' ₽'),type+' family');paths++;
 }
 dom.window.close();
}
// A spouse's excluded income cannot remain through maternity or create recovery links.
{
 const dom=await boot(),w=dom.window,d=w.document;basic(w,'63');set(w,'input[value="maternity"]',true,'change');set(w,'#maternity-payments .person','1');set(w,'#maternity-payments .amount','100000');set(w,'#maternity-payments .start','2026-01');section(d,7);
 const card=()=>d.querySelector('[data-result-month="2026-10"]');assert.match(card().textContent,/БиР за вошедшие месяцы: 100.000 ₽/);
 for(const [field,value] of [['#spouse-status','imprisoned'],['#spouse-status','ordinary'],['#marital-status','never'],['#marital-status','married']]){set(w,field,value);const counted=d.querySelector('#marital-status').value==='married'&&d.querySelector('#spouse-status').value==='ordinary';assert.match(card().textContent,counted?/БиР за вошедшие месяцы: 100.000 ₽/:/БиР за вошедшие месяцы: 0 ₽/);paths++;}
 set(w,'#spouse-status','imprisoned');set(w,'#maternity-payments .amount','');d.getElementById('add-maternity').click();assert.ok(card().querySelector(`[data-answer-target*='maternity-index="1"']`));assert.equal(card().querySelector(`[data-answer-target*='maternity-index="0"']`),null);paths++;dom.window.close();
}
// A territorial choice for a previous region remains editable after selection.
{
 const dom=await boot(),w=dom.window,d=w.document;basic(w,'63');set(w,'input[value="childBenefit"]',true,'change');const q='#benefits ';set(w,q+'.benefit-same-region','no');set(w,q+'.benefit-region','24');set(w,q+'.benefit-tier','100');set(w,q+'.benefit-from','2026-01');set(w,q+'.benefit-to','2026-04');
 const zones=pmZones(2026,'24');set(w,q+'.benefit-area',zones[0].value);assert.ok(d.querySelector(q+'.benefit-area'),'area picker stays editable');const other=zones.find(z=>z.child!==zones[0].child);set(w,q+'.benefit-area',other.value);assert.equal(Number(d.querySelector(q+'[data-receipt-month="2026-02"]').value),other.child);paths++;dom.window.close();
}
// Missing income for a person outside the family cannot become an action to complete.
{
 const dom=await boot(),w=dom.window,d=w.document;basic(w,'24',pmZones(2026,'24')[0].value);set(w,'#spouse-status','imprisoned');set(w,'input[value="selfEmployed"]',true,'change');set(w,'#extra-entries .person','1');set(w,'input[value="pension"]',true,'change');section(d,7);
 const card=d.querySelector('[data-result-month="2026-10"]');assert.equal(card.querySelector(`[data-answer-target*='extra-index="0"']`),null);assert.ok(card.querySelector(`[data-answer-target*='extra-index="1"']`));paths++;dom.window.close();
}
// Years outside the supported calculation must not offer an ineffective 2027 toggle.
{
 const dom=await boot(),w=dom.window,d=w.document;basic(w,'63');set(w,'#no-income',true,'change');
 for(const [start,month] of [['2027-10','2028-01'],['2025-10','2025-10']]){set(w,'#start',start);section(d,7);const card=d.querySelector(`[data-result-month="${month}"]`);assert.ok(card.querySelector('[data-answer-target="#start"]'));assert.equal(card.querySelector('[data-answer-target="#forecast-enabled"]'),null);card.querySelector('[data-answer-target="#start"]').click();assert.equal(d.body.dataset.question,'month');assert.ok(visible(d.querySelector('#start')));paths++;}
 dom.window.close();
}
console.log(`PASS ${paths} regional and family matrix paths`);
