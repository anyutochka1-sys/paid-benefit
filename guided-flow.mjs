// A presentation layer over the existing controls; their draft keys and models stay intact.
export function createGuidedFlow({steps,showSection,render,sourceEnabled,parents,nodes,currentSection,addChild}) {
  const document=parents.basic.ownerDocument,window=document.defaultView;
  const $=id=>document.getElementById(id),groups=[];
  let active=null,painting=false;
  const field=id=>$(id)?.closest('label');
  function group(section,id,title,parent,elements,{when=()=>true,required=[]}={}) {
    const el=document.createElement('section');el.className='question-card';el.dataset.question=id;
    const heading=document.createElement('h2');heading.textContent=title;el.append(heading);
    elements.filter(Boolean).forEach(node=>{if(section===6&&node.tagName==='H2')node.hidden=true;el.append(node)});parent.append(el);
    const item={section,id,title,el,when,required};groups.push(item);return item;
  }
  const goalWrap=document.createElement('div');goalWrap.className='goal-choices';
  const goal=$('family-goal');goalWrap.append(goal);
  const icons={baby:'<circle cx="16" cy="16" r="10"/><path d="M12 15h.01M20 15h.01M12 20q4 4 8 0M16 6q5 1 1 5"/>',pregnant:'<path d="M16 26C3 18 2 10 9 7q5-2 7 3 2-5 7-3c7 3 6 11-7 19Z"/>',children:'<circle cx="11" cy="10" r="4"/><circle cx="23" cy="14" r="3"/><path d="M3 27v-6q0-6 8-6t8 6v6M20 21q8-3 9 6"/>'};
  for(const [value,title,detail] of [['baby','Я недавно родила','Расчёт для малыша и семьи'],['pregnant','Я беременна','Расчёт пособия по беременности'],['children','Оформляю на детей','Первое назначение или продление']]) {
    const button=document.createElement('button');button.type='button';button.className='goal-choice';button.dataset.goal=value;
    button.innerHTML=`<span class="choice-icon"><svg viewBox="0 0 32 32" aria-hidden="true">${icons[value]}</svg></span><span><strong>${title}</strong><small>${detail}</small></span><span aria-hidden="true">›</span>`;
    button.onclick=()=>{goal.value=value;goal.dispatchEvent(new window.Event('input',{bubbles:true}));if(value==='pregnant'){$('pregnancy-applying').checked=true;$('pregnancy-applying').dispatchEvent(new window.Event('input',{bubbles:true}))}if(value==='baby'&&!$('children').children.length)addChild();render();goTo(nextAfter('goal'));};goalWrap.append(button);
  }
  group(0,'goal','Что хотите рассчитать?',parents.basic,[goalWrap],{when:()=>!goal.value});
  group(0,'region','В каком регионе будете подавать?',parents.basic,[parents.basic.querySelector('.demo-pm')],{required:['#pm-region','#pm-area']});
  group(0,'family','Расскажите о вашей семье',parents.basic,[field('marital-status'),field('spouse-status')],{required:['#marital-status','#spouse-status']});
  const familyMore=document.createElement('details');familyMore.className='optional-details';familyMore.innerHTML='<summary>Многодетность или инвалидность в семье</summary>';familyMore.append(field('large-family'),field('disability'));groups.at(-1).el.append(familyMore);
  group(0,'month','Когда планируете подать заявление?',parents.basic,[field('start'),$('day').closest('details'),$('forecast-settings')],{required:['#start']});

  const childrenHeading=parents.children.querySelector('.section-heading');
  group(1,'children-list','Добавьте детей вашей семьи',parents.children,[$('add-child')],{when:()=>!$('children').children.length&&!$('pregnancy-applying').checked});
  const childMore=document.createElement('div');childMore.className='children-more';
  const addMore=document.createElement('button');addMore.type='button';addMore.className='remove';addMore.textContent='+ Ещё один ребёнок';addMore.onclick=addChild;childMore.append(addMore);
  group(1,'children-finish','Все дети добавлены?',parents.children,[childMore,nodes.applicationChoice,$('newborn-explanation'),$('mother-pregnancy-benefit').closest('label'),nodes.pregnancyPanel],{when:()=>!!$('children').children.length});
  group(1,'pregnancy','Расскажите о беременности',parents.children,[],{when:()=>$('pregnancy-applying').checked&&!$('children').children.length,required:['#pregnancy-registered','#weeks']});
  // The same pregnancy controls move to the appropriate visible question.

  const primary=nodes.sourceSection.querySelector('.source-grid');
  const other=nodes.sourceSection.querySelector('details .source-grid');
  const common=new Set(['employment','childBenefit','otherBenefit','maternity','alimony','deposit']);
  nodes.sourceSection.querySelectorAll('input[type=checkbox]:not(#no-income)').forEach(box=>{(common.has(box.value)?primary:other).append(box.closest('label'))});
  nodes.sourceSection.querySelector('h3').textContent='Какие деньги поступали в семью?';
  nodes.sourceSection.querySelector('legend').textContent='Отметьте всё, что было в нужные месяцы';
  group(2,'income-sources','Какие доходы были у вашей семьи?',parents.income,[nodes.periodNote,nodes.sourceSection,nodes.leaveHelp]);
  group(2,'salary','Сколько начисляли вам и супругу?',parents.income,[field('income-mode'),$('income-people')],{when:()=>sourceEnabled.has('employment'),required:['.regular-amount','.regular-from','.regular-to']});
  group(2,'maternity','Сколько получили декретных?',parents.income,[nodes.maternitySection],{when:()=>sourceEnabled.has('maternity')});
  group(2,'benefits','Какие пособия получали на детей?',parents.income,[nodes.benefitsSection],{when:()=>sourceEnabled.has('childBenefit')});
  group(2,'alimony','Расскажите об алиментах',parents.income,[nodes.alimonySection],{when:()=>$('marital-status').value==='divorced'||sourceEnabled.has('alimony')});
  group(2,'extra-income','Уточним остальные поступления',parents.income,[nodes.extraSection,nodes.childIncomeSection,$('deposit-section')],{when:()=>[...sourceEnabled].some(key=>!['employment','maternity','childBenefit','alimony'].includes(key))});

  group(3,'care','Почему не работали в нужные месяцы?',parents.reasons,[$('care-helper'),$('add'),$('reasons')]);
  group(4,'assets','Что есть в собственности у семьи?',parents.property,[nodes.assetPicker]);
  group(4,'property','Уточним вашу недвижимость',parents.property,[$('properties'),nodes.propertyAdds,field('rural')],{when:()=>[...document.querySelectorAll('.asset-choice:checked')].some(box=>!['asset-car','asset-vehicle'].includes(box.id))});
  group(4,'vehicles','Уточним транспорт семьи',parents.cars,[$('add-car'),$('cars'),field('support-car')],{when:()=>$('asset-car').checked});
  group(4,'other-vehicles','Расскажите об остальном транспорте',parents.property,[$('vehicle-fields')],{when:()=>$('asset-vehicle').checked});
  group(5,'citizenship','Проверим основные условия',parents.conditions,[nodes.conditionsQuick,field('applicant-citizen'),field('applicant-residence'),field('applicant-capacity'),$('capacity-dates')],{required:['#applicant-citizen','#applicant-residence','#applicant-capacity']});
  group(5,'address','По какому адресу будете подавать?',parents.conditions,[field('residence-basis'),field('address-proof')],{required:['#residence-basis','#address-proof']});
  group(5,'prior','Переходите с другой выплаты?',parents.conditions,[field('prior-measure'),nodes.priorSupportPanel,$('renewal-help')],{required:['#prior-measure']});
  group(6,'result','Ваш предварительный результат',parents.result,[...parents.result.children]);

  // Retain uncommon controls and source explanations within the relevant question.
  for(const [section,step] of steps.entries())for(const panel of step.panels){
    const extras=[...panel.children].filter(el=>!el.classList.contains('question-card')&&!el.querySelector('.question-card')&&el.id!=='children'&&el.tagName!=='H2'&&el!==childrenHeading);
    if(!extras.length)continue;const candidates=groups.filter(item=>item.section===section&&panel.contains(item.el));const last=section===2?groups.find(item=>item.id==='income-sources'):candidates.at(-1);if(!last)continue;
    const details=document.createElement('details');details.className='optional-details';details.innerHTML='<summary>Дополнительные обстоятельства и пояснения</summary>';extras.forEach(el=>details.append(el));last.el.append(details);
  }
  const intro=document.createElement('p');intro.className='guided-intro';intro.textContent='Ответьте на короткие вопросы. Покажем только то, что относится к вашей семье.';parents.basic.closest('.panel').before(intro);
  function childItems(){return [...$('children').children].map((el,i)=>({section:1,id:el.dataset.childId,title:el.querySelector('.child-name').value||`Ребёнок ${i+1}`,el,when:()=>true,required:['.birth','.citizen','.award-recipient','.applicant-rights','.student','.married']}))}
  function screens(){const list=groups.filter(item=>item.when());const where=list.findIndex(item=>item.id==='children-finish');if(where>=0)list.splice(where,0,...childItems());return list}
  function nextAfter(id){const list=screens();const index=list.findIndex(item=>item.id===id);return list[Math.max(0,index+1)]}
  function isVisibleField(el){if(!el||el.disabled)return false;for(let node=el;node&&node!==active.el.parentElement;node=node.parentElement)if(node.hidden)return false;return true}
  function requiredMissing(){const issue=[];for(const selector of active.required||[])for(const el of active.el.querySelectorAll(selector)){if(!isVisibleField(el))continue;if(el.matches('.applicant-rights')&&el.closest('.form-row').querySelector('.child-role').value==='ward')continue;if(!el.value||['unknown'].includes(el.value)||!el.validity.valid)issue.push(el)}return issue}
  function advance(){const list=screens(),index=list.findIndex(item=>item.id===active.id);goTo(list[Math.min(index+1,list.length-1)])}
  function next(){const issue=requiredMissing();let message='';if(active.id==='income-sources'&&!sourceEnabled.size&&!$('no-income').checked)message='Отметьте поступления или подтвердите, что их не было.';if(active.id==='assets'&&!$('assets-none').checked&&!document.querySelector('.asset-choice:checked'))message='Отметьте собственность семьи или её отсутствие.';
    if(!issue.length&&!message){advance();return;}
    const box=$('step-review');box.replaceChildren();box.hidden=false;const heading=document.createElement('h3');heading.textContent='Осталось уточнить';box.append(heading);const text=document.createElement('p');text.textContent=message||'Ответьте на выделенные вопросы. Можно продолжить и вернуться позже.';box.append(text);
    issue.forEach(el=>{el.setAttribute('aria-invalid','true');el.classList.add('field-invalid');const button=document.createElement('button');button.type='button';button.className='review-link';button.textContent=el.closest('label')?.firstChild?.textContent?.trim()||'Заполните ответ';button.onclick=()=>{for(let parent=el.parentElement;parent&&parent!==active.el;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;el.focus();el.scrollIntoView({block:'center',behavior:'smooth'})};box.append(button)});
    const skip=document.createElement('button');skip.type='button';skip.className='remove';skip.textContent='Продолжить, заполню позже';skip.onclick=advance;box.append(skip);box.scrollIntoView({block:'center',behavior:'smooth'});
  }
  function paint(){if(painting||!active)return;painting=true;showSection(active.section);
    const pregnancy=groups.find(item=>item.id==='pregnancy');const finish=groups.find(item=>item.id==='children-finish');(pregnancy.when()?pregnancy.el:finish.el).append(nodes.pregnancyPanel);
    for(const item of [...groups,...childItems()])item.el.hidden=item.id!==active.id;
    // Preserve the inner hidden states of conditional fields.
    steps.forEach((step,i)=>step.panels.forEach(panel=>panel.hidden=i!==active.section||![...groups,...childItems()].some(item=>item.id===active.id&&panel.contains(item.el))));
    const list=screens(),index=list.findIndex(item=>item.id===active.id);const sectionItems=list.filter(item=>item.section===active.section);
    const counter=$('progress').querySelector('.step-counter');if(counter)counter.textContent=`${steps[active.section].title} · ${sectionItems.findIndex(item=>item.id===active.id)+1} из ${sectionItems.length}`;
    const links=$('progress').querySelector('.step-links');if(links){const menu=document.createElement('details');menu.className='section-menu';menu.innerHTML='<summary>Перейти к другому разделу</summary>';menu.append(links);$('progress').append(menu)}
    const track=document.createElement('div');track.className='progress-track';track.setAttribute('aria-hidden','true');const fill=document.createElement('span');fill.style.width=((active.section+1)/steps.length*100)+'%';track.append(fill);$('progress').prepend(track);
    $('step-help').hidden=true;intro.hidden=active.id!=='goal';$('back').hidden=index===0;$('next').hidden=active.section===6||active.id==='goal';$('next').textContent=list[index+1]?.section===6?'Показать результат':'Продолжить';$('next').onclick=next;$('back').onclick=()=>goTo(list[Math.max(0,index-1)]);
    document.body.dataset.question=active.id;$('guided-question').value=active.id;painting=false;
  }
  function goTo(item){if(!item)return;active=item;paint();window.scrollTo({top:0,behavior:'smooth'})}
  function refresh(){if(painting)return;const list=screens();const item=list.find(item=>item.id===active?.id)||list.find(item=>item.section===active?.section)||list[0];if(item){active=item;paint()}}
  const api={get painting(){return painting},refresh,selectSection(section){goTo(screens().find(item=>item.section===section))},revealField(el){const item=screens().find(item=>item.el.contains(el));if(item){active=item;paint()}},childAdded(row){active={section:1,id:row.dataset.childId,el:row};}};
  goTo(screens().find(item=>item.id===$('guided-question').value)||screens().find(item=>item.section===currentSection)||screens()[0]);return api;
}
