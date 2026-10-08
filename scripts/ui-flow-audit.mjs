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
let paths=0;
const seed=await boot();const keys=[...seed.window.document.querySelectorAll('.source-picker input:not(#no-income)')].map(el=>el.value);seed.window.close();
for(const key of keys){
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,`.source-picker input[value="${key}"]`,true,'change');
 const direct=d.querySelector(`[data-income-target="${key}"]`);assert.ok(visible(direct),key+' direct button');direct.click();
 const expected={employment:'salary',maternity:'maternity',childBenefit:'benefits',alimony:'alimony'}[key]||'extra-income';assert.equal(d.body.dataset.question,expected,key);
 const field={employment:'.regular-amount',maternity:'#maternity-payments .amount',childBenefit:'.benefit-from',alimony:'#marital-status',childIncome:'#child-income-entries .amount',deposit:'#deposits input'}[key]||'#extra-entries .amount';
 // Alimony needs the family-status question first when that has not been answered.
 if(key==='alimony')set(w,'#marital-status','never');
 assert.ok(visible(d.querySelector(key==='alimony'?'#alimony-monthly':field)),key+' amount visible');
 section(d,3);d.getElementById('next').click();assert.equal(d.body.dataset.question,expected,key+' next');
 section(d,7);const actions=[...d.querySelectorAll('#completion-check .review-link')];assert.ok(actions.length,key+' result actions');
 for(const button of [...d.querySelectorAll('[data-answer-target]')])assert.ok(d.querySelector(button.dataset.answerTarget),key+' valid result selector '+button.dataset.answerTarget);
 set(w,`input[value="${key}"]`,false,'change');section(d,3);assert.equal(d.querySelector(`[data-income-target="${key}"]`),null);assert.equal(d.querySelector('.source-picker input[value="'+key+'"]').checked,false);
 dom.window.close();paths++;
}
for(const mode of ['period','monthly','total']){
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,'input[value="employment"]',true,'change');set(w,'#income-mode',mode);d.getElementById('next').click();assert.equal(d.body.dataset.question,'salary');d.getElementById('next').click();assert.equal(d.body.dataset.question,'salary','empty '+mode+' must be reviewed');assert.equal(d.getElementById('step-review').hidden,false);
 section(d,7);const selector=mode==='total'?'.total-amount':mode==='monthly'?'[data-income-month]':'.regular-amount';const action=[...d.querySelectorAll('#completion-check .review-link')].find(b=>b.textContent.includes('Заявитель:')&&b.textContent.includes(mode==='total'?'первый расчётный':'зарплату'));assert.ok(action,'top salary action '+mode);action.click();assert.equal(d.body.dataset.question,'salary');assert.ok(visible(d.querySelector(selector)));assert.ok(d.activeElement.matches(selector),'salary field focused '+mode);
 set(w,'#save-draft',true,'change');w.dispatchEvent(new w.Event('pagehide'));const restored=await boot(w.localStorage.getItem('anna-benefit-draft-v1'));const rd=restored.window.document;section(rd,3);rd.getElementById('next').click();assert.equal(rd.body.dataset.question,'salary');assert.ok(visible(rd.querySelector(selector)),'restored '+mode);restored.window.close();dom.window.close();paths++;
}
// Selection order cannot skip selected steps; no-income clears all selected sources.
{
 const dom=await boot(),w=dom.window,d=w.document;start(w);
 for(const key of ['deposit','childBenefit','maternity','employment','pension'])set(w,`input[value="${key}"]`,true,'change');
 const screens=['salary','maternity','benefits','extra-income'];d.getElementById('next').click();
 for(const expected of screens){assert.equal(d.body.dataset.question,expected);d.getElementById('next').click();if(d.body.dataset.question===expected){const skip=[...d.getElementById('step-review').querySelectorAll('button')].find(b=>b.textContent==='Продолжить, заполню позже');assert.ok(skip,expected);skip.click();}}
 assert.equal(d.body.dataset.question,'care');section(d,3);set(w,'#no-income',true,'change');assert.equal(d.querySelectorAll('[data-income-target]').length,0);d.getElementById('next').click();assert.equal(d.body.dataset.question,'care');dom.window.close();paths++;
}
// Every asset selection must reveal its matching inputs and result recovery path.
for(const kind of ['apartment','house','garden','nonresidential','garage','land','car','vehicle']){
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,'#no-income',true,'change');set(w,'#pm-region','63');set(w,'#marital-status','never');set(w,`#asset-${kind}`,true);section(d,5);d.getElementById('next').click();
 assert.equal(d.body.dataset.question,kind==='car'?'vehicles':kind==='vehicle'?'other-vehicles':'property',kind+' asset step');
 const selector=kind==='car'?'#cars .hp':kind==='vehicle'?'#other-vehicles .type':kind==='land'?'#properties .hectares':'#properties .share';assert.ok(visible(d.querySelector(selector)),kind+' asset input');
 section(d,7);if(kind==='car'||kind==='land'){const action=d.querySelector(`#completion-check [data-answer-target="${kind==='car'?'#cars':'#properties'}"]`);assert.ok(action,kind+' missing result action');action.click();assert.ok(visible(d.querySelector(selector)),kind+' recovery');}
 set(w,'#assets-none',true);section(d,5);d.getElementById('next').click();assert.equal(d.body.dataset.question,'citizenship',kind+' deselection');dom.window.close();paths++;
}
// Pregnancy-only, baby and combined entry paths expose their corresponding fields.
for(const goal of ['baby','pregnant','both','children']){
 const dom=await boot(),w=dom.window,d=w.document;d.querySelector(`[data-goal=${goal}]`).click();section(d,2);
 assert.equal(d.body.dataset.question,goal==='pregnant'?'pregnancy':goal==='children'?'children-list':d.querySelector('#children > .form-row').dataset.childId,goal+' family path');
 assert.ok(visible(d.querySelector(goal==='pregnant'?'#weeks':goal==='children'?'#add-child':'#children .birth')),goal+' visible field');
 section(d,7);for(const action of d.querySelectorAll('[data-answer-target]'))assert.ok(d.querySelector(action.dataset.answerTarget),goal+' target');dom.window.close();paths++;
}
// A known blocker must not hide links for other, still missing answers.
{
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,'input[value="employment"]',true,'change');set(w,'#applicant-citizen','no');section(d,7);
 const salary=d.querySelector('#results [data-answer-target*="regular-amount"]');assert.ok(salary,'salary recovery even alongside blocker');salary.click();assert.equal(d.body.dataset.question,'salary');assert.ok(visible(d.activeElement));dom.window.close();paths++;
}
// Complete the ordinary route without skipping a single required question.
for(const mode of ['period','monthly','total'])for(const married of [false,true]){
 const dom=await boot(),w=dom.window,d=w.document,next=()=>d.getElementById('next').click();
 d.querySelector('[data-goal=children]').click();set(w,'#pm-region','63');next();assert.equal(d.body.dataset.question,'family');set(w,'#marital-status',married?'married':'never');if(married)set(w,'#spouse-status','ordinary');next();assert.equal(d.body.dataset.question,'month');set(w,'#start','2026-10');next();d.getElementById('add-child').click();
 for(const [cls,value] of [['birth','2021-01-10'],['citizen','yes'],['applicant-rights','intact'],['second-parent-status','recorded'],['award-recipient','none']])set(w,'#children .'+cls,value);
 next();assert.equal(d.body.dataset.question,'children-finish');next();assert.equal(d.body.dataset.question,'income-sources');set(w,'input[value="employment"]',true,'change');next();assert.equal(d.body.dataset.question,'salary');set(w,'#income-mode',mode);
 for(const person of d.querySelectorAll('.income-person')){
  const put=(el,value)=>{el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
  if(mode==='period'){put(person.querySelector('.regular-amount'),'25000');put(person.querySelector('.regular-from'),'2025-09');put(person.querySelector('.regular-to'),'2026-08');}
  else if(mode==='total')put(person.querySelector('.total-amount'),'300000');
  else for(const el of person.querySelectorAll('[data-income-month]'))if(el.dataset.incomeMonth>='2025-09'&&el.dataset.incomeMonth<='2026-08')put(el,'25000');
 }
 next();assert.equal(d.body.dataset.question,'care');next();assert.equal(d.body.dataset.question,'assets');set(w,'#assets-none',true);next();assert.equal(d.body.dataset.question,'citizenship');d.querySelector('section[data-question="citizenship"] .quick-confirm button').click();assert.equal(d.body.dataset.question,'address');set(w,'#residence-basis','permanent');next();assert.equal(d.body.dataset.question,'prior');next();assert.equal(d.body.dataset.question,'result');
 assert.equal(d.querySelector('[data-result-month="2026-10"] [data-answer-target*="income-people"]'),null,'filled first salary no missing '+mode);
 for(const button of d.querySelectorAll('[data-answer-target]'))assert.ok(d.querySelector(button.dataset.answerTarget),'complete flow existing selector');dom.window.close();paths++;
}
// Exercise every recovery link in a combined incomplete form, including collapsed fields.
{
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,'#pm-region','63');set(w,'#marital-status','married');
 for(const key of keys)set(w,`input[value="${key}"]`,true,'change');set(w,'#asset-car',true);set(w,'#asset-land',true);section(d,7);
 const targets=[...new Set([...d.querySelectorAll('[data-answer-target]')].map(button=>button.dataset.answerTarget))];
 for(const selector of targets){section(d,7);const button=[...d.querySelectorAll('[data-answer-target]')].find(button=>button.dataset.answerTarget===selector);assert.ok(button,selector);button.click();const field=d.querySelector(selector);assert.ok(visible(field),'recovery target visible '+selector);assert.notEqual(d.body.dataset.question,'result','recovery left result '+selector);}
 dom.window.close();paths++;
}
console.log(`PASS ${paths} UI paths: every source, direct and next navigation, deselection, three salary modes, draft restoration, mixed order, no-income and existing result targets`);
