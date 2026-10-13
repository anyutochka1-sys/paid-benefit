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
function focusTarget(el){return el?.classList.contains('month-model')?el.closest('.month-picker').querySelector('.month-picker-month'):el;}
function visible(el){if(!el)return false;for(let node=el;node;node=node.parentElement){if(node.hidden)return false;if(node.tagName==='DETAILS'&&!node.open&&!node.querySelector('summary')?.contains(el))return false;}return true;}
function section(d,n){d.querySelector(`.step-links button:nth-child(${n})`).click();if(n===3)d.querySelector('.selected-income-details').open=true;}
function start(w){const d=w.document;d.querySelector('[data-goal=children]').click();section(d,3);}
let paths=0;
const seed=await boot();const keys=[...seed.window.document.querySelectorAll('.source-picker input:not(#no-income)')].map(el=>el.value);seed.window.close();
for(const key of keys){
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,`.source-picker input[value="${key}"]`,true,'change');
 const direct=d.querySelector(`[data-income-target="${key}"]`);assert.ok(visible(direct),key+' direct button');direct.click();
 const expected={employment:'salary',maternity:'maternity',childBenefit:'benefits',alimony:'alimony',deposit:'deposits',childIncome:'child-income'}[key]||'extra-income';assert.equal(d.body.dataset.question,expected,key);
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
 const screens=['salary','maternity','benefits','extra-income','deposits'];d.getElementById('next').click();
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
 next();assert.equal(d.body.dataset.question,'care');next();assert.equal(d.body.dataset.question,'assets');set(w,'#assets-none',true);next();assert.equal(d.body.dataset.question,'citizenship');d.querySelector('section[data-question="citizenship"] .quick-confirm button').click();assert.equal(d.body.dataset.question,'address');set(w,'#residence-basis','permanent');next();assert.equal(d.body.dataset.question,'result');next();assert.equal(d.body.dataset.question,'result');
 assert.equal(d.querySelector('[data-result-month="2026-10"] .result-answers [data-answer-target*="income-people"]'),null,'filled first salary no missing '+mode);
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
// Individual earnings never cross between spouses; one incomplete recipient does not obscure the other.
{
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,'#pm-region','63');set(w,'#marital-status','married');set(w,'#spouse-status','ordinary');set(w,'input[value="employment"]',true,'change');
 for(const [index,amount] of [[1,'30000'],[2,'0']]){const q=`#income-people .income-person:nth-child(${index}) `;set(w,q+'.regular-amount',amount);set(w,q+'.regular-from','2025-09');set(w,q+'.regular-to','2026-08');}
 set(w,'input[value="selfEmployed"]',true,'change');const q='#extra-entries [data-income-source="selfEmployed"] ';set(w,q+'.person','1');section(d,7);
 const checks=()=>[...d.querySelectorAll('[data-result-month="2026-10"] .individual-income-check')];
 assert.equal(checks().length,2);assert.ok(visible(checks()[0]));assert.match(checks()[0].textContent,/360.000.*Дохода достаточно/);assert.match(checks()[1].textContent,/нужно уточнить/);paths++;
 set(w,q+'.amount','1000');set(w,q+'.from','2025-09');set(w,q+'.to','2026-08');assert.match(checks()[1].textContent,/12.000.*Дохода недостаточно/);assert.match(checks()[0].textContent,/360.000.*Дохода достаточно/);paths++;
 set(w,q+'.person','0');assert.match(checks()[0].textContent,/372.000.*Дохода достаточно/);assert.match(checks()[1].textContent,/0 ₽.*Дохода недостаточно/);paths++;
 set(w,q+'.person','1');set(w,q+'.amount','30000');assert.match(checks()[1].textContent,/360.000.*Дохода достаточно/);paths++;
 set(w,'input[value="selfEmployed"]',false,'change');set(w,'input[value="otherBenefit"]',true,'change');const b='#extra-entries [data-income-source="otherBenefit"] ';set(w,b+'.person','1');set(w,b+'.benefit-kind','counted');set(w,b+'.amount','50000');set(w,b+'.from','2025-09');set(w,b+'.to','2026-08');assert.match(checks()[1].textContent,/0 ₽.*Дохода недостаточно/);paths++;
 // An explicitly absent salary fills missing period controls too.
 set(w,'#income-people .income-person:nth-child(2) .regular-from','');set(w,'#income-people .income-person:nth-child(2) .regular-to','');d.querySelector('#income-people .income-person:nth-child(2) .salary-zero').click();assert.equal(d.querySelector('#income-people .income-person:nth-child(2) .regular-from').value,'2025-09');assert.equal(d.querySelector('#income-people .income-person:nth-child(2) .regular-to').value,'2026-08');paths++;
 dom.window.close();
}
// Reasons selected from a person's result are assigned only to that person.
{
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,'#pm-region','63');set(w,'#marital-status','married');set(w,'#spouse-status','ordinary');set(w,'input[value="employment"]',true,'change');
 d.getElementById('add-child').click();set(w,'#children .birth','2024-01-10');
 for(let i=1;i<=2;i++){const q=`#income-people .income-person:nth-child(${i}) `;set(w,q+'.regular-amount','0');set(w,q+'.regular-from','2025-09');set(w,q+'.regular-to','2026-08');}
 const checks=()=>[...d.querySelectorAll('[data-result-month="2026-10"] .individual-income-check')];
 section(d,7);checks()[0].querySelector('[data-answer-target="#reason-person"]').click();assert.equal(d.body.dataset.question,'care');assert.equal(d.querySelector('#reason-person').value,'0');assert.equal(d.querySelectorAll('.reason').length,0,'navigation must not invent a reason');d.getElementById('add').click();assert.equal(d.querySelector('.reason .person').value,'0');
 set(w,'.reason .type','careUnderThree','change');set(w,'.reason .from','2025-09');set(w,'.reason .to','2026-08');d.querySelector('#result-edit-context button').click();assert.equal(d.body.dataset.question,'result');assert.match(checks()[0].textContent,/не применяется/);assert.match(checks()[1].textContent,/216.744.*недостаточно/);paths++;
 checks()[1].querySelector('[data-answer-target="#reason-person"]').click();assert.equal(d.querySelector('#reason-person').value,'1');assert.equal(d.querySelector('#care-person').value,'1');d.getElementById('add').click();assert.equal(d.querySelector('.reason:last-child .person').value,'1');assert.equal(d.querySelector('.reason:first-child .person').value,'0');paths++;
 d.querySelector('.reason:last-child .remove').click();section(d,7);checks()[1].querySelector('[data-answer-target*="income-people"]').click();assert.equal(d.body.dataset.question,'salary');assert.ok(d.querySelector('.income-person:nth-child(2)').contains(d.activeElement));paths++;
 set(w,'#income-mode','monthly');d.querySelector('.income-person:nth-child(2) details').open=false;section(d,7);checks()[1].querySelector('[data-answer-target*="income-people"]').click();assert.equal(d.querySelector('.income-person:nth-child(2) details').open,true);assert.ok(visible(d.activeElement));paths++;
 set(w,'#save-draft',true,'change');w.dispatchEvent(new w.Event('pagehide'));const restored=await boot(w.localStorage.getItem('anna-benefit-draft-v1'));const rd=restored.window.document;assert.equal(rd.querySelector('.reason .person').value,'0');assert.equal(rd.querySelector('.reason .type').value,'careUnderThree');restored.window.close();dom.window.close();paths++;
}
// Recovery must focus the unanswered field, including an invalid 2027 assumption.
{
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,'#pm-region','63');set(w,'#marital-status','never');set(w,'#applicant-citizen','yes');set(w,'#residence-basis','temporary');section(d,7);
 for(const selector of ['#applicant-residence','#address-proof']){
  const button=d.querySelector(`[data-result-month="2026-10"] [data-answer-target="${selector}"]`);assert.ok(button,'missing answer '+selector);button.click();assert.equal(d.activeElement,focusTarget(d.querySelector(selector)));assert.ok(visible(d.activeElement));section(d,7);paths++;
 }
 for(const [field,value] of [['#forecast-mrot-growth',''],['#forecast-pm-growth','']]){
  set(w,'#forecast-pm-growth','0');set(w,'#forecast-mrot-growth','0');set(w,field,value);section(d,7);
  const button=d.querySelector(`[data-result-month="2027-01"] [data-answer-target="${field}"]`);assert.ok(button,'invalid forecast '+field);assert.match(button.textContent,/Можно поставить 0/);button.click();assert.equal(d.activeElement,focusTarget(d.querySelector(field)));assert.ok(visible(d.activeElement));set(w,field,'0');d.querySelector('#result-edit-context button').click();assert.equal(d.body.dataset.question,'result');assert.equal(d.querySelector(`[data-result-month="2027-01"] [data-answer-target="${field}"]`),null);paths++;
 }
 dom.window.close();
}
// Alimony recovery must preserve the payer and reject a reversed receipt period.
{
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,'#pm-region','63');set(w,'#marital-status','never');set(w,'input[value="alimony"]',true,'change');
 for(let i=1;i<=2;i++){d.getElementById('add-child').click();set(w,`#children .form-row:nth-child(${i}) .birth`,'2024-01-10');set(w,`#children .form-row:nth-child(${i}) .citizen`,'yes');}
 set(w,'#alimony-received','yes');
 const recover=selector=>{section(d,7);const button=d.querySelector(`[data-result-month="2026-10"] .result-answers [data-answer-target="${selector}"]`);assert.ok(button,'alimony missing '+selector);button.click();assert.ok(visible(d.querySelector(selector)));assert.equal(d.activeElement,focusTarget(d.querySelector(selector)));paths++;};
 recover('#alimony-monthly');set(w,'#alimony-monthly','-1');recover('#alimony-monthly');set(w,'#alimony-monthly','10000');recover('#alimony-from');set(w,'#alimony-from','2026-08');recover('#alimony-to');set(w,'#alimony-to','2025-09');recover('#alimony-to');assert.match(d.querySelector('#result-edit-context').textContent,/октябрь 2026/);set(w,'#alimony-from','2025-09');set(w,'#alimony-to','2026-08');section(d,7);assert.equal(d.querySelector('[data-result-month="2026-10"] .result-answers [data-answer-target="#alimony-to"]'),null);paths++;
 section(d,3);d.querySelector('.add-obligation').click();
 // Pick the second child's labelled control; this removes that child from the first payer.
 d.querySelectorAll('#alimony-obligations .obligation-children input')[1].click();
 set(w,'#alimony-obligations .kind','court');recover('#alimony-obligations .obligation-rows > .form-row:nth-child(1) .monthly');set(w,'#alimony-obligations .monthly','5000');recover('#alimony-obligations .obligation-rows > .form-row:nth-child(1) .from');set(w,'#alimony-obligations .from','2025-09');recover('#alimony-obligations .obligation-rows > .form-row:nth-child(1) .to');
 dom.window.close();
}
// A complete first additional receipt must not capture an edit for the second receipt.
{
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,'#pm-region','63');set(w,'input[value="pension"]',true,'change');
 set(w,'#extra-entries .amount','1000');set(w,'#extra-entries .from','2025-09');set(w,'#extra-entries .to','2026-08');d.getElementById('add-extra').click();
 const prefix='#extra-entries [data-extra-index="1"]';
 for(const [field,value] of [['.amount','2000'],['.from','2025-09'],['.to','2026-08']]){
  section(d,7);const button=d.querySelector(`[data-result-month="2026-10"] [data-answer-target='${prefix} ${field}']`);assert.ok(button,'second entry '+field);button.click();assert.equal(d.activeElement,focusTarget(d.querySelector(prefix+' '+field)));assert.ok(visible(d.activeElement));set(w,prefix+' '+field,value);paths++;
 }
 section(d,7);assert.equal(d.querySelector(`[data-result-month="2026-10"] [data-answer-target^='${prefix}']`),null);dom.window.close();paths++;
}
// Recovery for a second maternity payment must never focus the completed first payment.
{
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,'#pm-region','63');set(w,'input[value="maternity"]',true,'change');
 set(w,'#maternity-payments .amount','250000');set(w,'#maternity-payments .start','2026-01');d.getElementById('add-maternity').click();const prefix='#maternity-payments [data-maternity-index="1"]';
 const recover=field=>{section(d,7);const button=d.querySelector(`[data-result-month="2026-10"] [data-answer-target='${prefix} ${field}']`);assert.ok(button,'second maternity '+field);button.click();assert.equal(d.activeElement,focusTarget(d.querySelector(prefix+' '+field)));assert.ok(visible(d.activeElement));paths++;};
 recover('.amount');set(w,prefix+' .amount','100000');recover('.start');set(w,prefix+' .start','2026-03');set(w,prefix+' .months','2.5');recover('.months');set(w,prefix+' .months','5');d.querySelector('#result-edit-context button').click();assert.equal(d.querySelector(`[data-result-month="2026-10"] [data-answer-target^='${prefix}']`),null);paths++;dom.window.close();
}
// Each child's benefit has its own period, recipient and manual amount recovery.
{
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,'#pm-region','63');set(w,'input[value="childBenefit"]',true,'change');
 for(let i=1;i<=2;i++){d.getElementById('add-child').click();set(w,`#children .form-row:nth-child(${i}) .birth`,'2024-01-10');set(w,`#children .form-row:nth-child(${i}) .citizen`,'yes');}
 set(w,'#children .form-row:nth-child(2) .applying',false,'change');
 const first='#benefits [data-benefit-index="0"]',second='#benefits [data-benefit-index="1"]';
 set(w,first+' .benefit-amount-mode','manual');set(w,first+' .benefit-child',d.querySelector('#children .form-row').dataset.childId);set(w,first+' .benefit-from','2025-08');set(w,first+' .benefit-to','2026-07');set(w,first+' .benefit-amount','1000');d.getElementById('add-benefit').click();set(w,second+' .benefit-amount-mode','manual');
 const recover=field=>{section(d,7);const button=d.querySelector(`[data-result-month="2026-10"] [data-answer-target='${second} ${field}']`);assert.ok(button,'second benefit '+field);button.click();assert.equal(d.activeElement,focusTarget(d.querySelector(second+' '+field)));assert.ok(visible(d.activeElement));paths++;};
 recover('.benefit-from');set(w,second+' .benefit-from','2025-08');recover('.benefit-to');set(w,second+' .benefit-to','2025-07');recover('.benefit-to');set(w,second+' .benefit-to','2026-07');recover('.benefit-child');set(w,second+' .benefit-child',d.querySelector('#children .form-row:nth-child(2)').dataset.childId);recover('.benefit-amount');set(w,second+' .benefit-amount','2000');d.querySelector('#result-edit-context button').click();assert.equal(d.querySelector(`[data-result-month="2026-10"] [data-answer-target^='${second}']`),null);paths++;
 set(w,second+' .benefit-amount-mode','automatic');set(w,second+' .benefit-same-region','yes');set(w,second+' .benefit-tier','100');recover('.benefit-receipts-confirmed');set(w,second+' .benefit-receipts-confirmed',true);section(d,7);assert.equal(d.querySelector(`[data-result-month="2026-10"] [data-answer-target^='${second}']`),null);paths++;
 section(d,3);d.querySelector(`[data-income-target="childBenefit"]`).click();set(w,second+' [data-receipt-month="2025-09"]','');recover('[data-receipt-month="2025-09"]');set(w,second+' [data-receipt-month="2025-09"]','19000');d.querySelector('#result-edit-context button').click();assert.equal(d.querySelector(`[data-result-month="2026-10"] [data-answer-target^='${second}']`),null);paths++;dom.window.close();
}
// Reloading a result correction keeps its exact field and forecast month.
{
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,'#pm-region','63');set(w,'input[value="maternity"]',true,'change');
 set(w,'#maternity-payments .amount','250000');set(w,'#maternity-payments .start','2026-01');d.getElementById('add-maternity').click();section(d,7);
 const target='#maternity-payments [data-maternity-index="1"] .amount';
 d.querySelector(`[data-result-month="2027-01"] [data-answer-target='${target}']`).click();set(w,'#save-draft',true,'change');w.dispatchEvent(new w.Event('pagehide'));
 const raw=w.localStorage.getItem('anna-benefit-draft-v1');const restored=await boot(raw),rw=restored.window,rd=rw.document;
 assert.equal(rd.body.dataset.question,'maternity');assert.equal(rd.activeElement,focusTarget(rd.querySelector(target)));assert.ok(visible(rd.activeElement));assert.match(rd.querySelector('#result-edit-context').textContent,/январь 2027/);assert.equal(rd.querySelector('#maternity-payments .amount').value,'250000');paths++;
 set(rw,target,'100000');set(rw,'#maternity-payments [data-maternity-index="1"] .start','2026-03');rd.querySelector('#result-edit-context button').click();assert.ok(rd.querySelector('[data-result-month="2027-01"] details').open);rw.dispatchEvent(new rw.Event('pagehide'));
 const returned=await boot(rw.localStorage.getItem('anna-benefit-draft-v1'));assert.equal(returned.window.document.body.dataset.question,'result');assert.ok(!returned.window.document.querySelector('#result-edit-context'));assert.equal(returned.window.document.querySelector(target).value,'100000');paths++;returned.window.close();restored.window.close();
 section(d,2);w.dispatchEvent(new w.Event('pagehide'));const elsewhere=await boot(w.localStorage.getItem('anna-benefit-draft-v1'));assert.equal(elsewhere.window.document.body.dataset.question,d.body.dataset.question);assert.ok(!elsewhere.window.document.querySelector('#result-edit-context'));paths++;elsewhere.window.close();
 for(const mutate of [data=>delete data.resultEdit,data=>data.resultEdit.selector='[',data=>data.maternityPayments.pop(),data=>data.resultEdit.month='2035-01']){
  const data=JSON.parse(raw);mutate(data);const legacy=await boot(JSON.stringify(data));assert.equal(legacy.window.document.querySelector('#maternity-payments .amount').value,'250000');assert.ok(!legacy.window.document.querySelector('#result-edit-context'));paths++;legacy.window.close();
 }
 dom.window.close();
}
// A saved spouse correction does not invent reasons or switch the recipient.
{
 const dom=await boot(),w=dom.window,d=w.document;start(w);set(w,'#pm-region','63');set(w,'#marital-status','married');set(w,'#spouse-status','ordinary');set(w,'input[value="employment"]',true,'change');d.getElementById('add-child').click();set(w,'#children .birth','2024-01-10');section(d,7);
 d.querySelectorAll('[data-result-month="2027-01"] .individual-income-check')[1].querySelector('[data-answer-target="#reason-person"]').click();set(w,'#save-draft',true,'change');w.dispatchEvent(new w.Event('pagehide'));
 const restored=await boot(w.localStorage.getItem('anna-benefit-draft-v1')),rd=restored.window.document;assert.equal(rd.querySelector('#reason-person').value,'1');assert.equal(rd.querySelector('#care-person').value,'1');assert.equal(rd.querySelectorAll('.reason').length,0);assert.match(rd.querySelector('#result-edit-context').textContent,/для супруга.*январь 2027/);assert.ok(visible(rd.activeElement));rd.getElementById('add').click();assert.equal(rd.querySelector('.reason .person').value,'1');paths++;restored.window.close();dom.window.close();
}
console.log(`PASS ${paths} UI paths: every source, direct and next navigation, deselection, three salary modes, draft restoration, mixed order, no-income and existing result targets`);
