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
function basic(w){start(w);for(const [id,value] of [['pm-region','63'],['marital-status','married'],['spouse-status','ordinary'],['applicant-citizen','yes'],['applicant-residence','yes'],['applicant-capacity','none'],['residence-basis','permanent']])set(w,'#'+id,value);set(w,'#assets-none',true);const d=w.document;d.getElementById('add-child').click();for(const [cls,value] of [['birth','2021-01-10'],['citizen','yes'],['applicant-rights','intact'],['second-parent-status','recorded'],['award-recipient','none']])set(w,'#children .'+cls,value);set(w,'input[value="employment"]',true,'change');for(const [i,amount] of [[1,25000],[2,19000]]){const q=`.income-person:nth-child(${i}) `;set(w,q+'.regular-amount',String(amount));set(w,q+'.regular-from','2025-09');set(w,q+'.regular-to','2027-08');set(w,q+'.project-future',true);}}
function save(w){set(w,'#save-draft',true,'change');w.dispatchEvent(new w.Event('pagehide'));return w.localStorage.getItem('anna-benefit-draft-v1');}
{
 const dom=await boot(),w=dom.window,d=w.document;basic(w);section(d,3);const choice=d.querySelector('input[value="workingCare"]');assert.ok(visible(choice));assert.match(choice.parentElement.textContent,/до 1,5 лет/);set(w,'input[value="workingCare"]',true,'change');d.querySelector('[data-income-target="workingCare"]').click();const q='#extra-entries [data-income-source="workingCare"] ';assert.ok(visible(d.querySelector(q+'.amount')));assert.equal(visible(d.querySelector(q+'.benefit-kind')),false,'care requires no classification');assert.equal(visible(d.querySelector('#extra-add-type')),false,'one source has no repeat dropdown');assert.ok(d.querySelector('#extra-entries').compareDocumentPosition(d.querySelector('#add-extra'))&w.Node.DOCUMENT_POSITION_FOLLOWING);
 for(const [cls,value] of [['amount','3000'],['from','2025-09'],['to','2026-08']])set(w,q+'.'+cls,value);section(d,7);assert.match(d.querySelector('[data-result-month="2026-10"]').textContent,/564.000 ₽/);assert.equal(d.querySelector('[data-result-month="2026-10"] [data-answer-target*="extra-index"]'),null);paths++;dom.window.close();
}
{
 const dom=await boot(),w=dom.window,d=w.document;basic(w);set(w,'input[value="deposit"]',true,'change');set(w,'#deposits .tax-year','2025');set(w,'#deposits .interest','10000');section(d,7);assert.equal(d.querySelector('[data-result-month="2026-10"] [data-answer-target^="#deposits"]'),null);assert.equal(d.querySelector('#completion-check .current-answers [data-answer-target^="#deposits"]'),null);assert.ok(d.querySelector('#completion-check .future-answers [data-answer-target*="forecast-interest"]'));assert.equal(d.querySelector('#deposits .closed').value,'');paths++;
 const selector='#deposits .form-row:nth-child(1) .forecast-interest';d.querySelector('[data-result-month="2027-01"] [data-answer-target*="forecast-interest"]').click();assert.equal(d.activeElement,d.querySelector(selector));assert.ok(visible(d.activeElement));assert.match(d.activeElement.closest('label').textContent,/2026.*2027/);set(w,selector,'12000');d.querySelector('#result-edit-context button').click();assert.equal(d.querySelector('[data-result-month="2027-01"] [data-answer-target^="#deposits"]'),null);assert.match(d.querySelector('[data-result-month="2027-01"]').textContent,/указанная вами ожидаемая|указанная вами|указанная|указанной|указанная/);assert.equal(d.querySelector('#deposits .interest').value,'10000');assert.equal(d.querySelector('#deposits .tax-year').value,'2025');paths++;
 set(w,selector,'0');assert.equal(d.querySelector('[data-result-month="2027-01"] [data-answer-target^="#deposits"]'),null);const restored=await boot(save(w));assert.equal(restored.window.document.querySelector(selector).value,'0');assert.equal(restored.window.document.querySelector('#deposits .interest').value,'10000');paths++;restored.window.close();
 d.getElementById('add-deposit').click();set(w,'#deposits .form-row:nth-child(2) .tax-year','2025');set(w,'#deposits .form-row:nth-child(2) .interest','5000');section(d,7);const button=d.querySelector('[data-result-month="2027-01"] [data-answer-target*="forecast-interest"]');assert.match(button.dataset.answerTarget,/nth-child\(2\)/);button.click();set(w,button.dataset.answerTarget,'6000');assert.equal(d.querySelector('#deposits .forecast-interest').value,'0');paths++;dom.window.close();
}
{
 const dom=await boot(),w=dom.window,d=w.document;basic(w);set(w,'input[value="otherBenefit"]',true,'change');set(w,'#extra-entries .benefit-kind','workingCare');set(w,'#extra-entries .amount','3000');set(w,'#extra-entries .from','2025-09');set(w,'#extra-entries .to','2026-08');const restored=await boot(save(w));assert.equal(restored.window.document.querySelector('#extra-entries .benefit-kind').value,'workingCare');assert.equal(restored.window.document.querySelector('#extra-entries .amount').value,'3000');paths++;restored.window.close();dom.window.close();
}
console.log(`PASS ${paths} care and deposit forecast paths`);
