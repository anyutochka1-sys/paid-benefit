import {incomeWindow} from './engine.mjs';
// A presentation layer over the existing controls; their draft keys and models stay intact.
export function createGuidedFlow({steps,showSection,render,sourceEnabled,parents,nodes,currentSection,addChild,onScreenChange=()=>{},missingIncomeRows=()=>[]}) {
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
  for(const [value,title,detail] of [['baby','Я недавно родила','Расчёт для малыша и семьи'],['pregnant','Я беременна','Расчёт пособия по беременности'],['both','Беременна и оформляю на детей','Одна анкета — два расчёта'],['children','Оформляю на детей','Первое назначение или продление']]) {
    const button=document.createElement('button');button.type='button';button.className='goal-choice';button.dataset.goal=value;
    button.innerHTML=`<span class="choice-icon"><svg viewBox="0 0 32 32" aria-hidden="true">${icons[value==='both'?'pregnant':value]}</svg></span><span><strong>${title}</strong><small>${detail}</small></span><span aria-hidden="true">›</span>`;
    button.onclick=()=>{goal.value=value;goal.dispatchEvent(new window.Event('input',{bubbles:true}));$('pregnancy-applying').checked=['pregnant','both'].includes(value);$('pregnancy-applying').dispatchEvent(new window.Event('input',{bubbles:true}));if(['baby','both'].includes(value)&&!$('children').children.length)addChild();render();goTo(nextAfter('goal'));};goalWrap.append(button);
  }
  group(0,'goal','Что хотите рассчитать?',parents.basic,[goalWrap],{when:()=>!goal.value||active?.id==='goal'});
  group(0,'region','В каком регионе будете подавать?',parents.basic,[parents.basic.querySelector('.demo-pm')],{required:['#pm-region','#pm-area']});
  group(0,'family','Расскажите о вашей семье',parents.basic,[field('marital-status'),field('spouse-status')],{required:['#marital-status','#spouse-status']});
  const familyMore=document.createElement('details');familyMore.className='optional-details';familyMore.innerHTML='<summary>Многодетность или инвалидность в семье</summary>';familyMore.append(field('large-family'),field('disability'));groups.at(-1).el.append(familyMore);
  group(0,'month','Когда планируете подать заявление?',parents.basic,[field('start'),$('day').closest('details'),$('forecast-settings')],{required:['#start']});

  const childrenHeading=parents.children.querySelector('.section-heading');
  group(1,'children-list','Добавьте детей вашей семьи',parents.children,[$('add-child')],{when:()=>!$('children').children.length&&!$('pregnancy-applying').checked});
  const childMore=document.createElement('div');childMore.className='children-more';
  const addMore=document.createElement('button');addMore.type='button';addMore.className='remove';addMore.textContent='+ Ещё один ребёнок';addMore.onclick=addChild;childMore.append(addMore);
  group(1,'children-finish','Все дети добавлены?',parents.children,[childMore,nodes.applicationChoice,$('newborn-explanation'),$('mother-pregnancy-benefit').closest('label'),nodes.pregnancyPanel],{when:()=>!!$('children').children.length,required:['#pregnancy-registered','#weeks']});
  const childSummary=document.createElement('div');childSummary.className='child-summary';groups.find(item=>item.id==='children-finish').el.querySelector('h2').after(childSummary);
  function paintChildSummary(){childSummary.replaceChildren();for(const item of childItems()){const button=document.createElement('button');button.type='button';button.className='review-link';button.textContent=item.title+' — проверить ответы';button.onclick=()=>goTo(item);childSummary.append(button);}}
  const pregnancyMore=document.createElement('details');pregnancyMore.className='optional-details';pregnancyMore.innerHTML='<summary>Дополнительно: расчёт пособия по беременности</summary>';groups.at(-1).el.append(pregnancyMore);
  group(1,'pregnancy','Расскажите о беременности',parents.children,[],{when:()=>$('pregnancy-applying').checked&&!$('children').children.length,required:['#pregnancy-registered','#weeks']});
  const addPregnancyChildren=document.createElement('button');addPregnancyChildren.type='button';addPregnancyChildren.className='remove';addPregnancyChildren.textContent='Также оформить пособие на детей';addPregnancyChildren.onclick=()=>{goal.value='both';addChild();render()};groups.at(-1).el.append(addPregnancyChildren);
  // The same pregnancy controls move to the appropriate visible question.

  const primary=nodes.sourceSection.querySelector('.source-grid');
  const other=nodes.sourceSection.querySelectorAll('.source-grid')[1];
  const common=new Set(['employment','childBenefit','workingCare','otherBenefit','maternity','alimony','deposit']);
  nodes.sourceSection.querySelectorAll('input[type=checkbox]:not(#no-income)').forEach(box=>{(common.has(box.value)?primary:other).append(box.closest('label'))});
  primary.prepend(primary.querySelector('input[value="maternity"]').closest('label'));
  nodes.sourceSection.querySelector('h3').textContent='Какие деньги поступали в семью?';
  nodes.sourceSection.querySelector('legend').textContent='Отметьте всё, что было в нужные месяцы';
  const rareIncome=document.createElement('details');rareIncome.className='rare-income';rareIncome.innerHTML='<summary>Другие доходы: самозанятость, пенсия, аренда и прочие</summary>';const rareFields=other.closest('fieldset');rareFields.before(rareIncome);rareIncome.append(rareFields);

  group(2,'income-sources','Какие доходы были у вашей семьи?',parents.income,[nodes.periodNote,nodes.sourceSection,nodes.leaveHelp]);
  group(2,'salary','Сколько начисляли вам и супругу?',parents.income,[field('income-mode'),$('income-people')],{when:()=>sourceEnabled.has('employment'),required:['.regular-amount','.regular-from','.regular-to','.total-amount','[data-income-month]']});
  const salaryMode=document.createElement('details');salaryMode.className='optional-details salary-mode';salaryMode.innerHTML='<summary>Зарплата менялась? Выбрать другой способ ввода</summary>';salaryMode.append(field('income-mode'));groups.find(item=>item.id==='salary').el.insertBefore(salaryMode,$('income-people'));
  group(2,'maternity','Сколько получили по беременности и родам (БиР)?',parents.income,[nodes.maternitySection],{when:()=>sourceEnabled.has('maternity'),required:['.amount','.start','.months']});
  group(2,'benefits','Какие пособия получали на детей?',parents.income,[nodes.benefitsSection],{when:()=>sourceEnabled.has('childBenefit'),required:['.benefit-child','.benefit-amount','.benefit-from','.benefit-to','.benefit-same-region','.benefit-region','.benefit-area','.benefit-tier','[data-receipt-month]']});
  group(2,'alimony','Расскажите об алиментах',parents.income,[nodes.alimonySection],{when:()=>$('marital-status').value==='divorced'||sourceEnabled.has('alimony'),required:['#alimony-monthly','#alimony-from','#alimony-to','#alimony-kind','#divorce-month']});
  group(2,'extra-income','Введите суммы по остальным выбранным доходам',parents.income,[nodes.extraSection],{when:()=>[...sourceEnabled].some(key=>!['employment','maternity','childBenefit','alimony','deposit','childIncome'].includes(key)),required:['#deposits .tax-year','#deposits .interest','#extra-entries .amount','#extra-entries .from','#extra-entries .to','#extra-entries .tax-year','#extra-entries .benefit-kind','#extra-entries .business-basis','#extra-entries .business-expenses','#extra-entries .currency','#extra-entries .rate-date','#extra-entries .rate','#child-income-entries .child','#child-income-entries .amount','#child-income-entries .from','#child-income-entries .to']});

  group(2,'deposits','Сколько процентов выплатил банк?',parents.income,[$('deposit-section')],{when:()=>sourceEnabled.has('deposit'),required:['#deposits .tax-year','#deposits .interest']});
  group(2,'child-income','Был ли доход у детей?',parents.income,[nodes.childIncomeSection],{when:()=>sourceEnabled.has('childIncome'),required:['.child','.amount','.from','.to']});

  const alimonyPrerequisite=document.createElement('div');alimonyPrerequisite.className='hint';
  const familyButton=document.createElement('button');familyButton.type='button';familyButton.className='review-link';familyButton.textContent='Указать семейное положение для ввода алиментов';familyButton.onclick=()=>goTo(groups.find(item=>item.id==='family'));alimonyPrerequisite.append(familyButton);groups.find(item=>item.id==='alimony').el.append(alimonyPrerequisite);
  const selectedIncome=document.createElement('div');selectedIncome.className='selected-income';
  const selectedDetails=document.createElement('details');selectedDetails.className='selected-income-details';selectedDetails.innerHTML='<summary>Перейти к суммам выбранных доходов</summary>';selectedDetails.append(selectedIncome);groups.find(item=>item.id==='income-sources').el.append(selectedDetails);
  function paintIncomeChoices(){
    alimonyPrerequisite.hidden=!!$('marital-status').value;selectedIncome.replaceChildren();
    selectedDetails.hidden=!sourceEnabled.size;if(!sourceEnabled.size)return;
    const title=document.createElement('h3');title.textContent='Выбрано — заполните суммы';selectedIncome.append(title);
    const targets={employment:'salary',maternity:'maternity',childBenefit:'benefits',alimony:'alimony',deposit:'deposits',childIncome:'child-income'};
    for(const key of sourceEnabled){
      const box=[...nodes.sourceSection.querySelectorAll('input')].find(el=>el.value===key);
      const button=document.createElement('button');button.type='button';button.className='review-link';button.dataset.incomeTarget=key;
      button.textContent='Заполнить: '+(box?.closest('label')?.textContent.trim()||key);
      button.onclick=()=>{const target=key==='employment'?$('income-people'):key==='maternity'?$('maternity-payments'):key==='childBenefit'?$('benefits'):key==='deposit'?$('deposits'):key==='childIncome'?$('child-income-entries'):key==='alimony'?nodes.alimonySection:[...$('extra-entries').children].find(row=>row.dataset.incomeSource===key);const item=screens().find(item=>item.el===target||item.el.contains(target)||target?.contains(item.el));goTo(item||groups.find(item=>item.id===(targets[key]||'extra-income')));target?.scrollIntoView({block:'center',behavior:'auto'});target?.querySelector('input:not([type=checkbox]),select')?.focus();};selectedIncome.append(button);
    }
  }
  const careIntro=document.createElement('p');careIntro.className='hint';careIntro.textContent='Если да, укажите причину: например, уход за ребёнком, беременность или учёба. Если таких месяцев не было, продолжайте.';
  group(3,'care','Были месяцы без заработка?',parents.reasons,[careIntro,$('care-helper'),field('reason-person'),$('add'),$('reasons')],{required:['.from','.to']});
  group(4,'assets','Что есть в собственности у семьи?',parents.property,[nodes.assetPicker]);
  group(4,'property','Уточним вашу недвижимость',parents.property,[$('properties'),nodes.propertyAdds,field('rural')],{when:()=>[...document.querySelectorAll('.asset-choice:checked')].some(box=>!['asset-car','asset-vehicle'].includes(box.id)),required:['#properties .share','#properties .area','#properties .hectares']});
  group(4,'vehicles','Уточним транспорт семьи',parents.cars,[$('add-car'),$('cars'),field('support-car')],{when:()=>$('asset-car').checked,required:['#cars .year','#cars .hp']});
  group(4,'other-vehicles','Расскажите об остальном транспорте',parents.property,[$('vehicle-fields')],{when:()=>$('asset-vehicle').checked,required:['#other-vehicles .year']});
  const conditionDetails=document.createElement('details');conditionDetails.className='optional-details';conditionDetails.innerHTML='<summary>Есть отличия или хочу проверить ответы</summary>';conditionDetails.append(field('applicant-citizen'),field('applicant-residence'),field('applicant-capacity'),$('capacity-dates'));
  group(5,'citizenship','Проверим основные условия',parents.conditions,[nodes.conditionsQuick,conditionDetails],{required:['#applicant-citizen','#applicant-residence','#applicant-capacity']});
  const conditionButton=nodes.conditionsQuick.querySelector('button'),confirmConditions=conditionButton.onclick;conditionButton.textContent='Да, всё верно';conditionButton.onclick=()=>{confirmConditions();if(!requiredMissing().length)advance();else conditionDetails.open=true;};
  group(5,'address','По какому адресу будете подавать?',parents.conditions,[field('residence-basis'),field('address-proof')],{required:['#residence-basis','#address-proof']});
  const legacy=document.createElement('details');legacy.className='optional-details';legacy.innerHTML='<summary>Переход со старой выплаты на единое пособие</summary><p>Этот раздел нужен только если вы получаете выплату из прежней системы и заменяете её единым пособием. Сравним старую и новую ежемесячные суммы. При обычном продлении единого пособия заполнять этот раздел не нужно: сведения о действующем едином пособии укажите в карточке ребёнка.</p>';
  legacy.append(field('prior-measure'),nodes.priorSupportPanel);
  const priorSelect=legacy.querySelector('#prior-measure');if(!priorSelect.value)priorSelect.value='no';
  legacy.open=['yes','unknown'].includes(priorSelect.value);
  group(5,'prior','Продление и особые условия',parents.conditions,[$('renewal-help'),legacy],{when:()=>$('large-family').checked||['yes','unknown'].includes(priorSelect.value)});
  const oldConditionEntry=document.createElement('details');oldConditionEntry.className='optional-details';oldConditionEntry.innerHTML='<summary>Особые условия или сохранённая прежняя выплата</summary>';groups.find(item=>item.id==='address').el.append(oldConditionEntry);oldConditionEntry.append(legacy);
  group(6,'result','Ваш предварительный результат',parents.result,[...parents.result.children]);

  // Retain uncommon controls and source explanations within the relevant question.
  for(const [section,step] of steps.entries())for(const panel of step.panels){
    const extras=[...panel.children].filter(el=>!el.classList.contains('question-card')&&!el.querySelector('.question-card')&&el.id!=='children'&&el.tagName!=='H2'&&el!==childrenHeading);
    if(!extras.length)continue;const candidates=groups.filter(item=>item.section===section&&panel.contains(item.el));const last=section===2?groups.find(item=>item.id==='income-sources'):candidates.at(-1);if(!last)continue;
    const details=document.createElement('details');details.className='optional-details';details.innerHTML='<summary>Дополнительные обстоятельства и пояснения</summary>';extras.forEach(el=>details.append(el));last.el.append(details);
  }
  let nextPropertyId=1;
  const intro=document.createElement('p');intro.className='guided-intro';intro.textContent='Ответьте на короткие вопросы. Покажем только то, что относится к вашей семье.';parents.basic.closest('.panel').before(intro);
  function childItems(){return [...$('children').children].map((el,i)=>({section:1,id:el.dataset.childId,title:el.querySelector('.child-name').value||`Ребёнок ${i+1}`,el,when:()=>true,required:['.birth','.citizen','.award-recipient','.applicant-rights','.student','.married']}))}
  function propertyItems(){
    const order=['apartment','house','land','garage','garden','nonresidential'];
    return [...$('properties').children].filter(row=>$('asset-'+row.querySelector('.type').value)?.checked).sort((a,b)=>order.indexOf(a.querySelector('.type').value)-order.indexOf(b.querySelector('.type').value)).map((el,index)=>{
      el.dataset.propertyId ||= 'property-'+nextPropertyId++;
      const type=el.querySelector('.type').selectedOptions[0].textContent;
      return {section:4,id:index===0?'property':el.dataset.propertyId,title:type,el,required:['.owner','.share','.area','.hectares',...(el.querySelector('.type').value==='land'?['#rural']:[])]};
    });
  }
  function salaryItems(){return [...$('income-people').children].map((el,index)=>({section:2,id:index===0?'salary':'salary-spouse',title:index===0?'Ваша зарплата':'Зарплата супруга',el,required:['.regular-amount','.regular-from','.regular-to','.total-amount','[data-income-month]']}))}
  function extraItems(){return [...$('extra-entries').children].filter(row=>sourceEnabled.has(row.dataset.incomeSource)).map((el,index)=>({section:2,id:index===0?'extra-income':'extra-income-'+index,title:el.dataset.incomeSource==='workingCare'?'Пособие по уходу до 1,5 лет — для работающих':([...nodes.sourceSection.querySelectorAll('input')].find(box=>box.value===el.dataset.incomeSource)?.closest('label').textContent.trim()||'Дополнительный доход'),el,required:['.amount','.from','.to','.tax-year','.benefit-kind','.business-basis','.business-expenses','.currency','.rate-date','.rate']}))}
  function screens(){
    const list=groups.filter(item=>item.when());
    const childrenIndex=list.findIndex(item=>item.id==='children-finish');if(childrenIndex>=0)list.splice(childrenIndex,0,...childItems());
    const propertyIndex=list.findIndex(item=>item.id==='property'),properties=propertyItems();
    if(propertyIndex>=0&&properties.length)list.splice(propertyIndex,1,...properties,{...groups.find(item=>item.id==='property'),id:'property-summary',title:'Все объекты недвижимости добавлены?',required:[]});
    const salaryIndex=list.findIndex(item=>item.id==='salary');if(salaryIndex>=0)list.splice(salaryIndex,1,...salaryItems());
    const extraIndex=list.findIndex(item=>item.id==='extra-income'),extras=extraItems();if(extraIndex>=0&&extras.length)list.splice(extraIndex,1,...extras);
    return list;
  }
  function nextAfter(id){const list=screens();const index=list.findIndex(item=>item.id===id);return list[Math.max(0,index+1)]}
  function isVisibleField(el){if(!el||el.disabled)return false;for(let node=el;node&&node!==active.el.parentElement;node=node.parentElement)if(node.hidden)return false;return true}
  function requiredMissing(){const issue=[],salaryMonths=new Set($('start').value?incomeWindow($('start').value):[]);for(const selector of active.required||[])for(const el of active.el.querySelectorAll(selector)){if(!isVisibleField(el))continue;if(el.dataset.incomeMonth&&salaryMonths.size&&!salaryMonths.has(el.dataset.incomeMonth))continue;if(el.matches('.applicant-rights')&&el.closest('.form-row').querySelector('.child-role').value==='ward')continue;if(!el.value||['unknown'].includes(el.value)||!el.validity.valid)issue.push(el)}return issue}
  function advance(){const list=screens(),index=list.findIndex(item=>item.id===active.id);goTo(list[Math.min(index+1,list.length-1)])}
  function next(){const issue=requiredMissing();let message='';const empty=missingIncomeRows().filter(item=>active.el.contains(document.querySelector(item.selector)));if(empty.length)message=empty.map(item=>item.label).join('. ');if(active.id==='income-sources'&&!sourceEnabled.size&&!$('no-income').checked)message='Отметьте поступления или подтвердите, что их не было.';if(active.id==='assets'&&!$('assets-none').checked&&!document.querySelector('.asset-choice:checked'))message='Отметьте собственность семьи или её отсутствие.';
    if(active.el.closest('#properties')&&active.el.querySelector('.type').value==='land'&&!$('rural').value)issue.push($('rural'));
    if(active.id==='alimony'&&!$('marital-status').value){message='Сначала укажите семейное положение: от него зависят вопросы об алиментах.';}
    if(['salary','salary-spouse'].includes(active.id)&&$('income-mode').value==='period'){for(const row of active.el.querySelectorAll('.form-row')){const from=row.querySelector('.regular-from'),to=row.querySelector('.regular-to');if(from.value&&to.value&&from.value>to.value){issue.push(to);message='Последний месяц зарплаты не может быть раньше первого.';}}}
    for(const row of [...(active.el.matches('.form-row,.reason')?[active.el]:[]),...active.el.querySelectorAll('.form-row,.reason')]){
      const from=row.querySelector('input.from'),to=row.querySelector('input.to');
      if(from&&to&&isVisibleField(from)&&isVisibleField(to)&&from.value&&to.value&&from.value>to.value){issue.push(to);message='Последний месяц периода не может быть раньше первого.';}
    }
    if(active.id==='alimony'){
      const from=$('alimony-from'),to=$('alimony-to');
      if(isVisibleField(from)&&isVisibleField(to)&&from.value&&to.value&&from.value>to.value){issue.push(to);message='Последний месяц поступления алиментов не может быть раньше первого.';}
    }
    if(active.id==='maternity'&&!$('maternity-payments').children.length)message='Добавьте выплату декретных или снимите её выбор в разделе доходов.';
    if(active.id==='benefits'){
      if(!$('benefits').children.length)message='Добавьте пособие или снимите его выбор в разделе доходов.';
      for(const row of $('benefits').children){
        const from=row.querySelector('.benefit-from'),to=row.querySelector('.benefit-to');
        if(from?.value&&to?.value&&from.value>to.value){issue.push(to);message='Последний месяц получения не может быть раньше первого.';}
        const confirmation=row.querySelector('.benefit-receipts-confirmed');
        if(confirmation&&!confirmation.checked){issue.push(confirmation);message ||= 'Проверьте суммы по месяцам и подтвердите, что они совпадают с поступлениями.';}
      }
    }
    if(!issue.length&&!message){advance();return;}
    const box=$('step-review');box.replaceChildren();box.hidden=false;const heading=document.createElement('h3');heading.textContent='Осталось уточнить';box.append(heading);const text=document.createElement('p');text.textContent=message||'Ответьте на выделенные вопросы. Можно продолжить и вернуться позже.';box.append(text);
    issue.forEach(el=>{el.setAttribute('aria-invalid','true');el.classList.add('field-invalid');if(el.classList.contains('month-model')){el.closest('.month-picker').classList.add('field-invalid');el.closest('.month-picker').querySelectorAll('select').forEach(select=>select.setAttribute('aria-invalid','true'));}const button=document.createElement('button');button.type='button';button.className='review-link';button.textContent=el.closest('label')?.firstChild?.textContent?.trim()||'Заполните ответ';button.onclick=()=>{for(let parent=el.parentElement;parent&&parent!==active.el;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;el.focus();el.scrollIntoView({block:'center',behavior:'auto'})};box.append(button)});
    const skip=document.createElement('button');skip.type='button';skip.className='remove';skip.textContent='Продолжить, заполню позже';skip.onclick=advance;box.append(skip);box.scrollIntoView({block:'center',behavior:'auto'});
  }
  function paint(){if(painting||!active)return;painting=true;showSection(active.section);paintIncomeChoices();paintChildSummary();
    const pregnancy=groups.find(item=>item.id==='pregnancy');const finish=groups.find(item=>item.id==='children-finish');pregnancyMore.hidden=['pregnant','both'].includes(goal.value);(pregnancy.when()?pregnancy.el:['pregnant','both'].includes(goal.value)?finish.el:pregnancyMore).append(nodes.pregnancyPanel);
    const allItems=[...groups,...childItems(),...propertyItems(),...extraItems(),...salaryItems()];
    for(const el of new Set(allItems.map(item=>item.el)))el.hidden=el!==active.el&&!el.contains(active.el);
    const propertyGroup=groups.find(item=>item.id==='property');
    nodes.propertyAdds.hidden=active.el!==propertyGroup.el;
    const rural=field('rural');propertyGroup.el.append(rural);
    rural.hidden=active.el.closest('#properties')?active.el.querySelector('.type').value!=='land':!$('asset-land').checked;
    for(const id of ['property','extra-income','salary']){const parent=groups.find(item=>item.id===id);parent.el.querySelector('h2').textContent=parent.el.contains(active.el)?active.title:parent.title;}
    if(active.el.closest('#properties'))active.el.querySelector('.asset-row-title').hidden=true;
    const addControls=nodes.extraSection.querySelector('.extra-add-controls');if(addControls)addControls.hidden=!nodes.extraSection.contains(active.el)&&active.el!==groups.find(item=>item.id==='extra-income').el;
    if(['yes','unknown'].includes(priorSelect.value))groups.find(item=>item.id==='prior').el.append(legacy);else oldConditionEntry.append(legacy);
    document.body.classList.toggle('inside-wizard',active.id!=='goal');
    // Preserve the inner hidden states of conditional fields.
    steps.forEach((step,i)=>step.panels.forEach(panel=>panel.hidden=i!==active.section||!panel.contains(active.el)));
    const list=screens(),index=list.findIndex(item=>item.id===active.id);const sectionItems=list.filter(item=>item.section===active.section);
    const counter=$('progress').querySelector('.step-counter');if(counter)counter.textContent=`${steps[active.section].title} · вопрос ${Math.max(0,sectionItems.findIndex(item=>item.id===active.id))+1} из ${sectionItems.length}`;
    const links=$('progress').querySelector('.step-links');if(links){const menu=document.createElement('details');menu.className='section-menu';menu.innerHTML='<summary>Перейти к другому разделу</summary>';menu.append(links);const changeGoal=document.createElement('button');changeGoal.type='button';changeGoal.className='remove';changeGoal.textContent='Изменить мою ситуацию';changeGoal.onclick=()=>{goal.value='';goTo(groups.find(item=>item.id==='goal'))};menu.append(changeGoal);$('progress').append(menu)}
    const track=document.createElement('div');track.className='progress-track';track.setAttribute('aria-hidden','true');const fill=document.createElement('span');fill.style.width=((index+1)/list.length*100)+'%';track.append(fill);$('progress').prepend(track);
    $('step-help').hidden=true;intro.hidden=active.id!=='goal';$('back').hidden=index===0;$('next').hidden=active.section===6||active.id==='goal';$('next').textContent=active.id==='income-sources'&&sourceEnabled.size?'Далее: суммы доходов':list[index+1]?.section===6?'Показать результат':'Продолжить';$('next').onclick=next;$('back').onclick=()=>goTo(list[Math.max(0,index-1)]);
    document.body.dataset.question=active.id;$('guided-question').value=active.id;onScreenChange(active.id);painting=false;
  }
  function goTo(item){if(!item)return;active=item;paint();window.scrollTo({top:0,behavior:'auto'});const heading=active.el.querySelector('h2,h3')||active.el;heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true})}
  function refresh(){if(painting)return;const list=screens();const item=list.find(item=>item.id===active?.id)||list.find(item=>item.section===active?.section)||list[0];if(item){active=item;paint()}}
  const api={get painting(){return painting},refresh,selectSection(section){goTo(screens().find(item=>item.section===section))},revealField(el){const item=screens().find(item=>item.el===el||item.el.contains(el)||el?.contains(item.el));if(item){active=item;paint()}},childAdded(row){active={section:1,id:row.dataset.childId,el:row};}};
  goTo(screens().find(item=>item.id===$('guided-question').value)||screens().find(item=>item.section===currentSection)||screens()[0]);return api;
}
