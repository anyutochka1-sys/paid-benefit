import { incomeWindow, minimumIncomeTest, monthIndex, monthString, RULES } from './engine.mjs';
import { includedFamily, childCanApply, checkCars, ageAt } from './family-assets.mjs';
import {incomeForMonth,childTier,regularIncomeMonths} from './income.mjs';
import {checkProperty,checkOtherVehicles,checkDepositInterest,depositIncomeForApplication} from './property.mjs';
import {childBenefitIncome} from './benefits.mjs';
import {alimonyForApplication} from './alimony.mjs';
import {soleParentStatus} from './parental-status.mjs';
import {newbornShortcut} from './newborn.mjs';
import {maternityIncomeForApplication} from './maternity.mjs';
import {ADDITIONAL_TYPES,additionalIncomeForApplication} from './extra-income.mjs';
import {childIncomeForApplication} from './child-income.mjs';
import {awardConflict} from './award-conflict.mjs';
import {largeFamilyGrace} from './large-family-grace.mjs';
const $ = id => document.getElementById(id);
const types = [
  ['unemployment','Официальная безработица'], ['pregnancy','Беременность'],
  ['careUnderThree','Уход за ребёнком до 3 лет'],
  ['fullTimeStudent','Очное обучение до 23 лет'],
  ['careDisabledChild','Уход за ребёнком-инвалидом или инвалидом с детства I группы'],
  ['careDisabledAdult','Уход за инвалидом I группы или нуждающимся в уходе пожилым родственником'],
  ['treatment','Непрерывное лечение свыше 3 месяцев'],
  ['military','Военная служба и до 3 месяцев после'],
  ['incarceration','Лишение свободы, арест и до 3 месяцев после'],
  ['indigenous','Традиционная деятельность КМНС'],
  ['pensionRecipient','Получение пенсии (старость, инвалидность, потеря кормильца)']
];
const incomePeople=[{label:'Заявитель',months:{},total:null,incomeType:'employment'}];
let nextChildId=1;
const benefitPayments=[];
const applicationChoice=document.createElement('div');
applicationChoice.innerHTML='<label>Как подаёте на детей?<select id="application-mode"><option value="together">Одним заявлением на всех отмеченных</option><option value="separate">Отдельное заявление на каждого отмеченного</option></select></label><label>На старшего пособие получает тот же человек, который оформляет младшего?<select id="same-recipient"><option value="">Не знаю / не относится</option><option value="yes">Да</option><option value="no">Нет</option></select></label><p class="hint">Для каждого отдельного заявления выплаты на остальных детей могут войти в доход. Даты подачи пока одинаковы; при разных месяцах сравните соответствующие строки календаря.</p>';
$('children').after(applicationChoice);
applicationChoice.querySelector('select').addEventListener('input',render);
applicationChoice.querySelector('#same-recipient').addEventListener('input',render);
const pregnancyChoice=document.createElement('label');pregnancyChoice.className='check';pregnancyChoice.innerHTML='<input id="mother-pregnancy-benefit" type="checkbox"> Мать получала единое пособие по беременности перед рождением младшего';
applicationChoice.after(pregnancyChoice);pregnancyChoice.querySelector('input').addEventListener('input',render);
const benefitsSection=document.createElement('section');
benefitsSection.innerHTML='<div class="section-heading"><h3>Уже получаете единое пособие на ребёнка?</h3><button id="add-benefit" type="button">+ Указать выплату</button></div><p class="hint">Не добавляйте это пособие к зарплате или общей сумме дохода. Укажите ребёнка, сумму и месяцы поступления. Если размер менялся, добавьте отдельный период. При продлении на того же ребёнка прежние выплаты исключаются, при заявлении только на другого — учитываются. Одинаковые выплаты в разных строках не дублируйте.</p><div id="benefits"></div>';
$('income-people').after(benefitsSection);
const alimonySection=document.createElement('section');
alimonySection.innerHTML='<h3>Семейное положение и алименты</h3><label>Семейное положение на дату заявления<select id="marital-status"><option value="">Выберите</option><option value="never">В браке никогда не состояла</option><option value="married">Состою в браке (в том числе повторном)</option><option value="divorced">В разводе, новый брак не заключён</option><option value="widowed">Вдова</option></select></label><label id="spouse-status-field" hidden>Статус нынешнего супруга на дату заявления<select id="spouse-status"><option value="unknown">Уточните</option><option value="ordinary">Входит в состав семьи</option><option value="parentalRightsLost">Лишён / ограничен в правах на ребёнка из заявления</option><option value="stateCare">На полном государственном обеспечении</option><option value="conscript">Служба по призыву / военный курсант без контракта</option><option value="imprisoned">Отбывает лишение свободы</option><option value="forcedTreatment">На принудительном лечении по решению суда</option><option value="custody">Заключён под стражу</option><option value="missing">Признан безвестно отсутствующим / объявлен умершим</option><option value="wanted">Находится в розыске</option></select></label><div id="alimony-fields" hidden><label>Алименты на детей фактически поступали?<select id="alimony-received"><option value="no">Нет</option><option value="yes">Да</option></select></label><div id="alimony-actual-fields" hidden><label>Сумма за месяц, ₽<input id="alimony-monthly" type="number" min="0"></label><label>С какого месяца поступали<input id="alimony-from" type="month"></label><label>По какой месяц включительно<input id="alimony-to" type="month"></label></div><div id="alimony-divorced-fields" hidden><label>Месяц расторжения брака<input id="divorce-month" type="month"></label><label>Основание для алиментов на детей<select id="alimony-kind"><option value="">Выберите</option><option value="court">Есть решение суда</option><option value="court-order">Есть судебный приказ</option><option value="bailiffs">Есть исполнительное производство у приставов</option><option value="notary">Нотариальное соглашение</option><option value="informal">Устная договорённость / не оформлены</option></select></label><label id="notary-amount-field" hidden>Ежемесячная сумма по нотариальному соглашению, ₽<input id="notary-amount" type="number" min="0"></label><p class="hint">Отметьте детей одного алиментного обязательства в их карточках. Если дети от разных вторых родителей, потребуется отдельный расчёт по каждому обязательству. Статус второго родителя укажите в карточке ребёнка. Лишение свободы и лишение родительских прав сами по себе не означают статус единственного родителя.</p><div id="alimony-wage-fields"><label>Применимая окончательная средняя зарплата Росстата в регионе, ₽<input id="alimony-wage" type="number" min="0"></label><label class="check"><input id="alimony-final" type="checkbox"> Проверена окончательная годовая публикация Росстата, действующая в месяц обращения</label></div></div></div><p class="hint">Расчётный минимум алиментов применяется только при статусе «в разводе» и отсутствии судебного акта; новый зарегистрированный брак меняет статус. Если вы никогда не были замужем, минимум не вменяется, но полученные алименты учитываются. Единственный родитель и семейное положение — разные вопросы. Не включайте алименты повторно в зарплату.</p>';
benefitsSection.after(alimonySection);
const maternitySection=document.createElement('section');
maternitySection.innerHTML='<div class="section-heading"><h3>Пособие по беременности и родам (БиР)</h3><button id="add-maternity" type="button">+ Указать выплату</button></div><p class="hint">Вводите всю сумму разовой выплаты отдельно от зарплаты. Она распределяется по месяцам начисления, а не учитывается целиком в месяце поступления. Для обычного периода выставлено 5 месяцев; при продлении уточните срок по документу.</p><div id="maternity-payments"></div>';
benefitsSection.after(maternitySection);
const maternityPayments=[];
const additionalEntries=[];
const sourceEnabled=new Set();
const sourceSection=document.createElement('section');
sourceSection.className='source-picker';
const sourceGroups=[
  ['Чаще всего',[['employment','Зарплата / ГПХ'],['pension','Пенсия / больничный'],['unemploymentBenefit','Пособие по безработице'],['otherBenefit','Другие пособия'],['childBenefit','Единое пособие на детей'],['alimony','Алименты'],['deposit','Проценты по вкладам'],['lottery','Выигрыш в лотерею']]],
  ['Другие поступления',[['childIncome','Доходы детей'],['maternity','Пособие по беременности и родам'],['selfEmployed','Самозанятость'],['business','ИП'],['scholarship','Стипендия'],['military','Денежное довольствие'],['rent','Аренда'],['propertySale','Продажа имущества'],['securities','Ценные бумаги / дивиденды'],['copyright','Авторские выплаты'],['foreignEarned','Заработок за рубежом']]]
];
sourceSection.innerHTML='<h3>Какие поступления были в семье?</h3><p class="hint">Отметьте все виды. Дальше откроются только нужные поля. Если ничего не было, отметьте это отдельно.</p>'+sourceGroups.map(([title,items],index)=>`${index?'<details><summary>Другие виды дохода</summary>':''}<fieldset><legend>${title}</legend><div class="source-grid">${items.map(([key,label])=>`<label class="check"><input type="checkbox" value="${key}"> ${label}</label>`).join('')}</div></fieldset>${index?'</details>':''}`).join('')+'<label class="check"><input id="no-income" type="checkbox"> Никаких поступлений из перечисленных не было</label>';
const incomePanel=$('income-people').closest('.panel');
incomePanel.querySelector('#income-mode').closest('label').before(sourceSection);
const extraSection=document.createElement('section');
extraSection.innerHTML='<div class="section-heading"><h3>Другие доходы</h3><label>Повторить вид<select id="extra-add-type"></select></label><button id="add-extra" type="button">+ Ещё период</button></div><p class="hint">Добавляйте каждый вид отдельно. Ежемесячную сумму укажите для месяцев поступления, а годовую для ИП, аренды, продажи имущества, ценных бумаг и авторских выплат — за налоговый год. Продажу недвижимости вводите по налоговой базе. Не дублируйте зарплату, проценты по вкладам, БиР, алименты и уже указанное единое пособие. Выплаты, исключаемые пунктом 53, сюда не добавляйте. Пенсия по потере кормильца, если её получает учитываемый член семьи, относится к пенсиям.</p><details><summary>Примеры поступлений, которые не нужно добавлять в обычный доход</summary><p class="hint">Маткапитал в предусмотренных законом случаях, помощь по социальному контракту, возврат НДФЛ по вычету, пособие на погребение, отдельная помощь при ЧС и целевые выплаты на лечение ребёнка; пособия и алименты на ребёнка, не входящего в состав семьи. У каждого исключения есть свои условия в пункте 53 — при сомнении оставьте его на проверку.</p></details><div id="extra-entries"></div>';
maternitySection.after(extraSection);
const childIncomeEntries=[];
const childIncomeSection=document.createElement('section');
childIncomeSection.innerHTML='<div class="section-heading"><h3>Доходы детей</h3><button id="add-child-income" type="button">+ Период дохода</button></div><p class="hint">Зарплата несовершеннолетнего и компенсация за государственные/общественные обязанности могут исключаться, если ребёнок учился очно не меньше 6 месяцев расчётного периода (п. 52¹). Другие доходы оцениваются отдельно. Месяцы учёбы укажите в карточке ребёнка.</p><div id="child-income-entries"></div>';
extraSection.after(childIncomeSection);
function renderChildIncomeRows() {
  $('child-income-entries').replaceChildren();
  const childOptions=childData().map((child,index)=>({id:child.id,label:document.querySelector(`[data-child-id="${child.id}"] .child-name`)?.value||`Ребёнок ${index+1}`}));
  childIncomeEntries.forEach((entry,index)=>{
    const row=document.createElement('div');row.className='form-row';
    row.innerHTML='<label>Кто получил<select class="child"><option value="">Выберите ребёнка</option></select></label><label>Вид<select class="type"><option value="employment">Зарплата / ГПХ</option><option value="publicDutyCompensation">Компенсация за государственные обязанности</option><option value="other">Другой учитываемый доход</option></select></label><label>За месяц, ₽<input class="amount" type="number" min="0"></label><label>С месяца<input class="from" type="month"></label><label>По месяц<input class="to" type="month"></label><button class="remove" type="button">Убрать</button>';
    childOptions.forEach(child=>row.querySelector('.child').add(new Option(child.label,child.id)));
    for(const [selector,key] of [['.child','childId'],['.type','type'],['.amount','amount'],['.from','from'],['.to','to']]) {
      const input=row.querySelector(selector);input.value=entry[key]??'';
      input.oninput=()=>{entry[key]=key==='amount'?(input.value===''?null:Number(input.value)):input.value;render()};
    }
    row.querySelector('.remove').onclick=()=>{childIncomeEntries.splice(index,1);renderChildIncomeRows();render()};
    $('child-income-entries').append(row);
  });
}
$('add-child-income').onclick=()=>{childIncomeEntries.push({childId:'',type:'employment',amount:null,from:'',to:''});renderChildIncomeRows();render()};
function renderExtraRows() {
  const typeSelect=$('extra-add-type'),previous=typeSelect.value;typeSelect.replaceChildren();
  [...sourceEnabled].filter(key=>ADDITIONAL_TYPES[key]).forEach(key=>typeSelect.add(new Option(ADDITIONAL_TYPES[key].label,key)));
  if([...typeSelect.options].some(option=>option.value===previous))typeSelect.value=previous;
  $('extra-entries').replaceChildren();
  additionalEntries.forEach((entry,index)=>{
    const row=document.createElement('div');row.className='form-row';
    if(!sourceEnabled.has(entry.type))return;
    row.innerHTML=`<label>Кто получил<select class="person"><option value="0">Заявитель</option><option value="1">Супруг(а)</option></select></label><strong>${ADDITIONAL_TYPES[entry.type].label}</strong><label>Сумма, ₽<input class="amount" type="number" min="0"></label><label class="tax-field">Налоговый год<input class="tax-year" type="number" min="2024" max="2030"></label><label class="from-field">С какого месяца<input class="from" type="month"></label><label class="to-field">По какой месяц включительно<input class="to" type="month"></label><button class="remove" type="button">Убрать</button>`;
    row.querySelector('.person').value=String(entry.personIndex);
    row.querySelector('.amount').value=entry.amount??'';
    row.querySelector('.tax-year').value=entry.taxYear??'';
    row.querySelector('.from').value=entry.from||'';
    row.querySelector('.to').value=entry.to||'';
    const toggle=()=>{const annual=ADDITIONAL_TYPES[entry.type].period==='annual';row.querySelector('.tax-field').hidden=!annual;row.querySelector('.from-field').hidden=annual;row.querySelector('.to-field').hidden=annual};
    for(const [selector,key] of [['.person','personIndex'],['.amount','amount'],['.tax-year','taxYear'],['.from','from'],['.to','to']])
      row.querySelector(selector).oninput=e=>{entry[key]=['personIndex','amount','taxYear'].includes(key)?e.target.value===''?null:Number(e.target.value):e.target.value;toggle();render()};
    row.querySelector('.remove').onclick=()=>{additionalEntries.splice(index,1);renderExtraRows();render()};
    $('extra-entries').append(row);toggle();
  });
}
$('add-extra').onclick=()=>{const type=$('extra-add-type').value;if(!type)return;additionalEntries.push({personIndex:0,type,amount:null,taxYear:null,from:'',to:''});renderExtraRows();render()};
sourceSection.querySelectorAll('input[type="checkbox"]').forEach(box=>box.onchange=()=>{
  if(box.id==='no-income') {
    if(box.checked) sourceSection.querySelectorAll('input:not(#no-income)').forEach(other=>{other.checked=false;sourceEnabled.delete(other.value)});
  } else {
    if(box.checked){sourceEnabled.add(box.value);$('no-income').checked=false;
      if(ADDITIONAL_TYPES[box.value]&&!additionalEntries.some(e=>e.type===box.value))additionalEntries.push({personIndex:0,type:box.value,amount:null,taxYear:null,from:'',to:''});
    } else sourceEnabled.delete(box.value);
  }
  $('income-people').hidden=!sourceEnabled.has('employment');
  $('income-mode').closest('label').hidden=!sourceEnabled.has('employment');
  extraSection.hidden=![...sourceEnabled].some(key=>ADDITIONAL_TYPES[key]);
  childIncomeSection.hidden=!sourceEnabled.has('childIncome');
  benefitsSection.hidden=!sourceEnabled.has('childBenefit');
  maternitySection.hidden=!sourceEnabled.has('maternity');
  if(box.checked&&box.value==='childBenefit'&&!benefitPayments.length){benefitPayments.push({childId:'',amount:'',from:'',to:''});renderBenefitRows()}
  if(box.checked&&box.value==='maternity'&&!maternityPayments.length){maternityPayments.push({personIndex:0,amount:null,startMonth:'',chargedMonths:5});renderMaternityRows()}
  if(box.checked&&box.value==='deposit'&&!$('deposits').children.length)addDeposit();
  if(box.checked&&box.value==='childIncome'&&!childIncomeEntries.length)$('add-child-income').click();
  if(box.checked&&box.value==='alimony'){$('alimony-received').value='yes';refreshMaritalForm()}
  if(box.checked&&box.value==='employment'){
    incomePeople.forEach(person=>{person.regularFrom ||= incomeMonths()[0];person.regularTo ||= incomeMonths().at(-1)});
    renderIncomeForm();
  }
  if($('deposit-section'))$('deposit-section').hidden=!sourceEnabled.has('deposit');
  renderExtraRows();render();
});
$('income-people').hidden=true;$('income-mode').closest('label').hidden=true;extraSection.hidden=true;childIncomeSection.hidden=true;benefitsSection.hidden=true;maternitySection.hidden=true;
if($('deposit-section'))$('deposit-section').hidden=true;
function renderMaternityRows() {
  $('maternity-payments').replaceChildren();
  maternityPayments.forEach((payment,index)=>{
    const row=document.createElement('div');row.className='form-row';
    row.innerHTML='<label>Кто получил<select class="person"><option value="0">Заявитель</option><option value="1">Супруг(а)</option></select></label><label>Вся сумма БиР, ₽<input class="amount" type="number" min="0"></label><label>С какого месяца начислено<input class="start" type="month"></label><label>За сколько месяцев начислено<input class="months" type="number" min="1" max="12"></label><button type="button" class="remove">Убрать</button>';
    row.querySelector('.person').value=String(payment.personIndex);
    row.querySelector('.amount').value=payment.amount??'';
    row.querySelector('.start').value=payment.startMonth;
    row.querySelector('.months').value=payment.chargedMonths;
    for(const [selector,key] of [['.person','personIndex'],['.amount','amount'],['.start','startMonth'],['.months','chargedMonths']])row.querySelector(selector).oninput=e=>{payment[key]=selector==='.start'?e.target.value:e.target.value===''?null:Number(e.target.value);render()};
    row.querySelector('.remove').onclick=()=>{maternityPayments.splice(index,1);renderMaternityRows();render()};
    $('maternity-payments').append(row);
  });
}
$('add-maternity').onclick=()=>{maternityPayments.push({personIndex:0,amount:null,startMonth:'',chargedMonths:5});renderMaternityRows();render()};
let savedSpouse=null;
function refreshMaritalForm() {
  const status=$('marital-status').value;
  $('alimony-fields').hidden=!status;
  $('spouse-status-field').hidden=status!=='married';
  $('alimony-actual-fields').hidden=$('alimony-received').value!=='yes';
  $('alimony-divorced-fields').hidden=status!=='divorced';
  $('alimony-wage-fields').hidden=status!=='divorced'||['court','court-order','bailiffs'].includes($('alimony-kind').value)||soleParentStatus(childData().filter(c=>c.alimonyApplies))==='sole';
  $('notary-amount-field').hidden=status!=='divorced'||$('alimony-kind').value!=='notary';
  if(status==='married' && incomePeople.length===1) {incomePeople.push(savedSpouse||{label:'Супруг(а)',months:{},total:null,incomeType:'employment'});renderIncomeForm()}
  if(status && status!=='married' && incomePeople.length>1) {savedSpouse=incomePeople.pop();renderIncomeForm()}
  $('add-adult').hidden=!!status;
  render();
}
alimonySection.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',refreshMaritalForm));
function incomeMonths() {
  const start=monthIndex($('start').value||'2026-09');
  return Array.from({length:23},(_,i)=>monthString(start-13+i));
}
function renderIncomeForm() {
  const mode=$('income-mode').value;
  $('income-people').replaceChildren();
  incomePeople.forEach((person,index)=>{
    const section=document.createElement('section'); section.className='income-person';
    const title=document.createElement('h3'); title.textContent=person.label; section.append(title);
    person.incomeType='employment';
    const typeHint=document.createElement('p');typeHint.className='hint';typeHint.textContent='Зарплата и вознаграждение по договору ГПХ, начислено до НДФЛ';section.append(typeHint);
    if(mode==='period') {
      const wrapper=document.createElement('div');wrapper.className='form-row';
      wrapper.innerHTML='<label>Одинаковая сумма за месяц, ₽<input class="regular-amount" type="number" min="0"></label><label>С месяца<input class="regular-from" type="month"></label><label>По месяц включительно<input class="regular-to" type="month"></label>';
      for(const [selector,key] of [['.regular-amount','regularAmount'],['.regular-from','regularFrom'],['.regular-to','regularTo']]) {
        const input=wrapper.querySelector(selector);input.value=person[key]??'';
        input.oninput=()=>{person[key]=key==='regularAmount'?(input.value===''?null:Number(input.value)):input.value;render()};
      }
      section.append(wrapper);
    } else if(mode==='total') {
      const label=document.createElement('label'); label.textContent='Начисленные доходы за первый расчётный период, ₽';
      const input=document.createElement('input'); input.type='number'; input.min='0'; input.value=person.total??'';
      input.addEventListener('input',()=>{person.total=input.value===''?null:Number(input.value);render()}); label.append(input); section.append(label);
    } else {
      const details=document.createElement('details'); details.open=index===0;
      const summary=document.createElement('summary'); summary.textContent='Открыть месяцы для ввода'; details.append(summary);
      const grid=document.createElement('div');grid.className='income-grid';
      incomeMonths().forEach(month=>{
        const label=document.createElement('label'); label.textContent=month;
        const input=document.createElement('input'); input.type='number'; input.min='0'; input.placeholder='Не знаю'; input.value=person.months[month]??'';
        input.addEventListener('input',()=>{if(input.value==='')delete person.months[month];else person.months[month]=Number(input.value);render()});
        label.append(input); grid.append(label);
      }); details.append(grid);section.append(details);
    }
    if(index>0) {const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='Убрать';remove.onclick=()=>{incomePeople.splice(index,1);renderIncomeForm();render()};section.append(remove)}
    $('income-people').append(section);
  });
  $('add-adult').disabled=incomePeople.length>1;
}
function addReason() {
  const row = document.createElement('div'); row.className='reason';
  row.innerHTML=`<label>У кого была причина<select class="person"><option value="0">Заявитель</option><option value="1">Супруг(а)</option></select></label><label>Причина<select class="type">${types.map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>С месяца<input class="from" type="month"></label><label>По месяц<input class="to" type="month"></label><label class="check"><input class="registered" type="checkbox"> Состоял(а) на учёте в ЦЗН</label><p class="hint">Для службы и лишения свободы включите в даты не более трёх месяцев после окончания. Основание и период должны подтверждаться документами.</p><button class="remove" type="button">Убрать</button>`;
  row.querySelector('.remove').onclick=()=>{row.remove();render()};
  row.querySelector('.type').onchange=()=>{row.querySelector('.check').hidden=row.querySelector('.type').value!=='unemployment';render()};
  row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',render));
  $('reasons').append(row); row.querySelector('.type').dispatchEvent(new Event('change'));
}
function addChild() {
  const row=document.createElement('div'); row.className='form-row';
  row.dataset.childId=`child-${nextChildId++}`;
  row.innerHTML='<label>Имя или обозначение ребёнка<input class="child-name" type="text" placeholder="Например, старший"></label><label>Ваше отношение к ребёнку<select class="child-role"><option value="child">Родитель / усыновитель</option><option value="ward">Опекун / попечитель</option></select></label><label>Дата рождения<input class="birth" type="date"></label><details><summary>Дополнительные обстоятельства ребёнка</summary><label>Дата смерти, если ребёнок умер<input class="death" type="date"></label><label>Особый статус для состава семьи<select class="child-family-status"><option value="ordinary">Нет</option><option value="stateCare">На полном государственном обеспечении</option><option value="conscript">Военная служба по призыву / курсант без контракта</option><option value="imprisoned">Отбывает лишение свободы</option><option value="forcedTreatment">Принудительное лечение по решению суда</option><option value="custody">Заключён под стражу</option><option value="missing">Признан безвестно отсутствующим / объявлен умершим</option><option value="wanted">Находится в розыске</option></select></label><label>Учёба для проверки дохода несовершеннолетнего<select class="education-status"><option value="">Уточните, если был доход ребёнка</option><option value="school">Школа / колледж / вуз очно</option><option value="none">Не обучался</option><option value="additional">Только дополнительные программы</option></select></label><label>Очная учёба с месяца<input class="education-from" type="month"></label><label>По месяц включительно<input class="education-to" type="month"></label></details><label class="check"><input class="applying" type="checkbox" checked> Подаю на этого ребёнка</label><label class="check"><input class="alimony-applies" type="checkbox" checked> Этот ребёнок входит в указанное ниже алиментное обязательство</label><label>Статус второго родителя этого ребёнка<select class="second-parent-status"><option value="">Уточните</option><option value="recorded">Указан в записи о рождении</option><option value="blank">Не указан в записи о рождении</option><option value="mother-statement">Записан по заявлению матери</option><option value="dead">Умер</option><option value="declared-dead">Объявлен умершим судом</option><option value="missing">Признан безвестно отсутствующим</option><option value="imprisoned">Лишён свободы</option><option value="deprived-rights">Лишён родительских прав</option></select></label><details><summary>Уже назначено пособие на этого ребёнка?</summary><label>Кому назначено сейчас<select class="award-recipient"><option value="unknown">Уточните</option><option value="none">Никому</option><option value="self">Заявителю</option><option value="other">Другому законному представителю</option></select></label><label>Если другому: суд определил место жительства ребёнка с заявителем?<select class="court-residence"><option value="">Уточните</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label>Размер действующего пособия<select class="award-tier"><option value="">Не назначено / не знаю</option><option value="50">50%</option><option value="75">75%</option><option value="100">100%</option></select></label><label>Дата последнего решения<input class="award-decision" type="date"></label><label>Действует по<input class="award-end" type="date"></label></details><label>Очное обучение<select class="student"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label>В браке<select class="married"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label>Гражданин РФ и проживает в России<select class="citizen"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><button class="remove" type="button">Убрать</button>';
  row.querySelector('.remove').onclick=()=>{row.remove();renderBenefitRows();renderChildIncomeRows();render()};
  row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{renderBenefitRows();renderChildIncomeRows();refreshMaritalForm()}));
  $('children').append(row); renderBenefitRows(); renderChildIncomeRows(); render();
}
function renderBenefitRows() {
  const childOptions=[...document.querySelectorAll('#children .form-row')].map((row,i)=>({id:row.dataset.childId,label:row.querySelector('.child-name').value||`Ребёнок ${i+1}`}));
  $('benefits').replaceChildren();
  benefitPayments.forEach((payment,index)=>{
    const row=document.createElement('div');row.className='form-row';
    const select=document.createElement('select');
    const placeholder=new Option('Выберите ребёнка','');select.add(placeholder);
    childOptions.forEach(c=>select.add(new Option(c.label,c.id)));
    select.value=payment.childId;
    select.addEventListener('input',()=>{payment.childId=select.value;render()});
    const childLabel=document.createElement('label');childLabel.textContent='Кому назначено пособие';childLabel.append(select);row.append(childLabel);
    for(const [key,label,type] of [['amount','Сумма в месяц, ₽','number'],['from','С месяца получения','month'],['to','По месяц получения включительно','month']]) {
      const wrapper=document.createElement('label');wrapper.textContent=label;
      const input=document.createElement('input');input.type=type;if(type==='number')input.min='0';input.value=payment[key]??'';
      input.addEventListener('input',()=>{payment[key]=input.value;render()});wrapper.append(input);row.append(wrapper);
    }
    const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='Убрать';remove.onclick=()=>{benefitPayments.splice(index,1);renderBenefitRows();render()};row.append(remove);
    $('benefits').append(row);
  });
}
function benefitRowsForWindow(applicationMonth) {
  const window=incomeWindow(applicationMonth), payments=[],missing=[];
  for(const p of benefitPayments) {
    if(!p.from || !p.to || p.from>p.to) {missing.push('Укажите начало и конец выплаты пособия');continue}
    for(const month of window) if(month>=p.from && month<=p.to)
      payments.push({childId:p.childId,month,amount:p.amount===''?null:Number(p.amount)});
  }
  return {payments,missing};
}
function addCar() {
  const row=document.createElement('div'); row.className='form-row';
  row.innerHTML='<label>Владелец<select class="owner"><option value="applicant">Заявитель / ребёнок в составе семьи</option><option value="spouse">Нынешний супруг</option></select></label><label>Год выпуска<input class="year" type="number" min="1950" max="2030"></label><label>Мощность, л. с.<input class="hp" type="number" min="1"></label><label>Получен при четырёх детях?<select class="acquired"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label class="check"><input class="excluded" type="checkbox"> Под арестом / в розыске / запрет регистрационных действий</label><button class="remove" type="button">Убрать</button>';
  bindRow(row); $('cars').append(row); render();
}
function addProperty() {
  const row=document.createElement('div');row.className='form-row';
  row.innerHTML='<label>Владелец<select class="owner"><option value="applicant">Заявитель / ребёнок в составе семьи</option><option value="spouse">Нынешний супруг</option></select></label><label>Вид<select class="type"><option value="apartment">Квартира</option><option value="house">Дом</option><option value="garden">Садовый дом</option><option value="nonresidential">Нежилое помещение / здание / сооружение</option><option value="garage">Гараж / машино-место</option><option value="land">Участок</option></select></label><label class="area-field">Площадь, м²<input class="area" type="number" min="0"></label><label class="land-field">Площадь, га<input class="hectares" type="number" min="0" step="0.001"></label><label>Доля всей семьи в объекте, %<input class="share" type="number" min="0" max="100" placeholder="100"></label><details><summary>Исключения для этого объекта</summary><label class="check"><input class="supported" type="checkbox"> Предоставлен как целевая господдержка или полностью оплачен ею (без маткапитала)</label><label class="check"><input class="ward-owned" type="checkbox"> Принадлежит подопечному ребёнку</label><label class="check"><input class="excluded" type="checkbox"> Под арестом или запретом регистрации</label><label class="check"><input class="uninhabitable" type="checkbox"> Квартира признана непригодной для проживания</label><label class="check"><input class="severe-illness" type="checkbox"> В квартире живёт член семьи с заболеванием из установленного перечня</label><label class="check"><input class="agricultural" type="checkbox"> Земля сельхозназначения с оборотом по отдельному закону</label><label class="check"><input class="far-east" type="checkbox"> Дальневосточный / арктический гектар</label><label class="check"><input class="auxiliary" type="checkbox"> Хозяйственная постройка на ИЖС / ЛПХ / садовом участке либо общее имущество</label></details><button class="remove" type="button">Убрать</button>';
  bindRow(row); const toggle=()=>{const type=row.querySelector('.type').value;row.querySelector('.area-field').hidden=!['apartment','house'].includes(type);row.querySelector('.land-field').hidden=type!=='land';render()}; row.querySelector('.type').addEventListener('input',toggle);
  $('properties').append(row);toggle();
}
function addOtherVehicle() {
  const row=document.createElement('div');row.className='form-row';
  row.innerHTML='<label>Владелец<select class="owner"><option value="applicant">Заявитель / ребёнок в составе семьи</option><option value="spouse">Нынешний супруг</option></select></label><label>Вид<select class="type"><option value="motorcycle">Мотоцикл</option><option value="boat">Маломерное судно</option><option value="machine">Самоходная машина</option></select></label><label class="year-field">Год выпуска<input class="year" type="number" min="1950" max="2030"></label><label class="check"><input class="excluded" type="checkbox"> Под арестом / в розыске / запрет действий</label><button class="remove" type="button">Убрать</button>';
  bindRow(row); row.querySelector('.type').addEventListener('input',()=>{row.querySelector('.year-field').hidden=row.querySelector('.type').value==='motorcycle';render()});row.querySelector('.year-field').hidden=true;
  $('other-vehicles').append(row);render();
}
function addDeposit() {
  const row=document.createElement('div');row.className='form-row';
  row.innerHTML='<label>Владелец<select class="owner"><option value="applicant">Заявитель / ребёнок в составе семьи</option><option value="spouse">Нынешний супруг</option></select></label><label>Год получения процентов<input class="tax-year" type="number" min="2024" max="2030"></label><label>Выплачено процентов, ₽<input class="interest" type="number" min="0"></label><label>Счёт закрыт в месяце<input class="closed" type="month"></label><label class="check"><input class="nominal" type="checkbox"> Номинальный счёт ребёнка под опекой</label><button class="remove" type="button">Убрать</button>';
  bindRow(row);$('deposits').append(row);render();
}
function bindRow(row) {
  row.querySelector('.remove').onclick=()=>{row.remove();render()};
  row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',render));
}
const yn = value => value==='' ? undefined : value==='yes';
function childData() {
  return [...document.querySelectorAll('#children .form-row')].map(row=>({
    id:row.dataset.childId,role:row.querySelector('.child-role').value,familyStatus:row.querySelector('.child-family-status').value,birthDate:row.querySelector('.birth').value,deathDate:row.querySelector('.death').value,educationStatus:row.querySelector('.education-status').value,educationFrom:row.querySelector('.education-from').value,educationTo:row.querySelector('.education-to').value,
    applying:row.querySelector('.applying').checked,
    alimonyApplies:row.querySelector('.alimony-applies').checked,secondParentStatus:row.querySelector('.second-parent-status').value,
    awardRecipient:row.querySelector('.award-recipient').value,courtResidence:yn(row.querySelector('.court-residence').value),
    awardTier:row.querySelector('.award-tier').value?Number(row.querySelector('.award-tier').value):undefined,
    awardDecision:row.querySelector('.award-decision').value,
    awardEnd:row.querySelector('.award-end').value,
    fullTimeStudent:yn(row.querySelector('.student').value),married:yn(row.querySelector('.married').value),
    russianCitizen:yn(row.querySelector('.citizen').value),livesInRussia:yn(row.querySelector('.citizen').value)
  }));
}
function carData() {
  return [...document.querySelectorAll('#cars .form-row')].map(row=>({
    owner:row.querySelector('.owner').value,manufactureYear:row.querySelector('.year').value ? Number(row.querySelector('.year').value) : undefined,
    horsepower:row.querySelector('.hp').value ? Number(row.querySelector('.hp').value) : undefined,
    acquiredWithFourChildren:yn(row.querySelector('.acquired').value),
    seized:row.querySelector('.excluded').checked
  }));
}
function propertyData() {
  return [...document.querySelectorAll('#properties .form-row')].map(row=>({
    owner:row.querySelector('.owner').value,type:row.querySelector('.type').value,
    area:row.querySelector('.area').value===''?undefined:Number(row.querySelector('.area').value),
    hectares:row.querySelector('.hectares').value===''?undefined:Number(row.querySelector('.hectares').value),
    familyShare:row.querySelector('.share').value===''?undefined:Number(row.querySelector('.share').value)/100,
    supported:row.querySelector('.supported').checked,seized:row.querySelector('.excluded').checked,
    wardOwned:row.querySelector('.ward-owned').checked,
    uninhabitable:row.querySelector('.uninhabitable').checked,
    severeIllnessResidence:row.querySelector('.severe-illness').checked,
    agriculturalExcluded:row.querySelector('.agricultural').checked,
    farEastHectare:row.querySelector('.far-east').checked,
    auxiliaryExcluded:row.querySelector('.auxiliary').checked
  }));
}
function otherVehicleData() {
  return [...document.querySelectorAll('#other-vehicles .form-row')].map(row=>({
    owner:row.querySelector('.owner').value,type:row.querySelector('.type').value,
    manufactureYear:row.querySelector('.year').value===''?undefined:Number(row.querySelector('.year').value),
    seized:row.querySelector('.excluded').checked
  }));
}
function depositData() {
  return [...document.querySelectorAll('#deposits .form-row')].map(row=>({
    owner:row.querySelector('.owner').value,taxYear:row.querySelector('.tax-year').value===''?undefined:Number(row.querySelector('.tax-year').value),
    interestForRelevantTaxYear:row.querySelector('.interest').value===''?undefined:Number(row.querySelector('.interest').value),
    closedMonth:row.querySelector('.closed').value||undefined,
    nominalWardAccount:row.querySelector('.nominal').checked
  }));
}
function render() {
  const start=$('start').value; if (!start) return;
  const sourceComplete=sourceEnabled.size>0||$('no-income').checked;
  const children=childData(), cars=carData(), properties=propertyData(),otherVehicles=otherVehicleData(),deposits=sourceEnabled.has('deposit')?depositData():[];
  const reasons=[...document.querySelectorAll('.reason')].map(row=>({person:Number(row.querySelector('.person').value),type:row.querySelector('.type').value,start:row.querySelector('.from').value,end:row.querySelector('.to').value,registered:row.querySelector('.registered').checked}));
  const output=[];
  for(let i=0;i<12;i++) {
    const month=monthString(monthIndex(start)+i), year=Number(month.slice(0,4));
    const day=String(Math.max(1,Math.min(28,Number($('day').value)||1))).padStart(2,'0');
    const filingDate=`${month}-${day}`;
    const members=includedFamily([{role:'applicant'},...(incomePeople.length>1?[{role:'spouse',familyStatus:$('spouse-status').value}]:[]),...children],filingDate);
    const spouseExcluded=members.excluded.some(x=>x.person.role==='spouse');
    const countedAdults=incomePeople.map((person,index)=>({person,index})).filter(x=>x.index===0||!spouseExcluded);
    const applicable=children.map(child=>childCanApply(child,filingDate));
    const fourOrMoreChildren=children.filter(c=>c.birthDate && ageAt(c.birthDate,filingDate)<18).length>=4;
    const owned=items=>items.filter(item=>!((spouseExcluded||$('marital-status').value!=='married')&&item.owner==='spouse'));
    const carCheck=checkCars(owned(cars),{applicationYear:year,multipleChildren:$('large-family').checked,disabledFamilyMember:$('disability').checked,supportVehicle:$('support-car').checked,fourOrMoreChildren});
    const propertyCheck=checkProperty(owned(properties),{familySize:members.unanswered.length?null:members.included.length,rural:$('rural').value===''?undefined:$('rural').value==='rural',multipleChildren:$('large-family').checked,disabledFamilyMember:$('disability').checked,supportVehicle:$('support-car').checked});
    const otherCheck=checkOtherVehicles(owned(otherVehicles),{applicationYear:year,multipleChildren:$('large-family').checked,disabledFamilyMember:$('disability').checked,supportMotorcycle:$('support-car').checked,supportMachine:$('support-car').checked});
    const countedDeposits=owned(deposits);
    const allDepositsKnown=countedDeposits.filter(d=>!d.nominalWardAccount).every(d=>d.taxYear===year-1 && Number.isFinite(d.interestForRelevantTaxYear));
    const depositCheck=allDepositsKnown&&Number($('pm-person').value)>0?checkDepositInterest(countedDeposits,{applicationMonth:month,perCapitaMinimum:Number($('pm-person').value)}):{status:'unknown'};
    const familyText=`Учтено в этом шаге: ${members.included.length}${members.unanswered.length?' (есть неуточнённые члены семьи)':''}${spouseExcluded?' (супруг исключён по п. 46)':''}. Детей, на которых можно подать: ${applicable.filter(x=>x.status==='yes').length}${applicable.some(x=>x.status==='unknown')?' (есть неуточнённые)':''}. Автомобили: ${carCheck.status==='yes'?'по этим признакам подходят':carCheck.status==='no'?carCheck.reasons.join('; '):'нужны сведения'}. Другая недвижимость: ${propertyCheck.status==='yes'?'по указанным объектам подходит':propertyCheck.status==='no'?propertyCheck.reasons.join('; '):propertyCheck.review?.join('; ')||'нужна проверка'}. Прочая техника: ${otherCheck.status==='yes'?'по указанным объектам подходит':otherCheck.status==='no'?otherCheck.reasons.join('; '):otherCheck.review?.join('; ')||'нужна проверка'}. Вклады: ${depositCheck.status==='yes'?'по порогу процентов подходят':depositCheck.status==='no'?'превышен порог процентов':'нужны данные налогового года/ПМ'}.`;
    const baseMonths=person=>!sourceEnabled.has('employment')?Object.fromEntries(incomeWindow(month).map(m=>[m,0])):$('income-mode').value==='period'?regularIncomeMonths(person,month):person.months;
    const incomeResult=incomeForMonth(countedAdults.map(({person})=>({...person,months:baseMonths(person),total:sourceEnabled.has('employment')?person.total:0,mode:sourceEnabled.has('employment')&&$('income-mode').value==='total'?'total':'monthly',baseApplicationMonth:start})),month);
    const supplemental=additionalIncomeForApplication(additionalEntries.filter(e=>sourceEnabled.has(e.type)),month,spouseExcluded||$('marital-status').value!=='married'?[1]:[]);
    const childEarnings=childIncomeForApplication(sourceEnabled.has('childIncome')?childIncomeEntries:[],children,members,month);
    const selected=children.filter((c,j)=>c.applying && applicable[j].status==='yes');
    const scenarios=$('application-mode').value==='separate'?selected.map(c=>[c]):[selected];
    const jointRenewal=$('application-mode').value==='together'&&selected.some(c=>c.awardRecipient==='self'&&c.awardEnd?.slice(0,7)===month);
    const benefitRows=sourceEnabled.has('childBenefit')?benefitRowsForWindow(month):{payments:[],missing:[]};
    const pmPerson=Number($('pm-person').value),pmChild=Number($('pm-child').value);
    const depositIncome=depositIncomeForApplication(countedDeposits,{applicationMonth:month,perCapitaMinimum:pmPerson});
    const maternityIncome=maternityIncomeForApplication(sourceEnabled.has('maternity')?maternityPayments:[],month);
    const maritalStatus=$('marital-status').value;
    const alimonyFrom=$('alimony-from').value, alimonyTo=$('alimony-to').value;
    const alimonyMonthly=$('alimony-monthly').value;
    const receiving=sourceEnabled.has('alimony')&&$('alimony-received').value==='yes';
    const alimonyChildren=children.filter(c=>c.alimonyApplies && members.included.some(p=>p.id===c.id) && c.birthDate && ageAt(c.birthDate,filingDate)<18 && !(c.deathDate&&c.deathDate<=filingDate) && !c.married);
    const excludedAlimonyChildren=children.some(c=>c.alimonyApplies&&!alimonyChildren.includes(c));
    const secondParent=soleParentStatus(alimonyChildren.map(c=>c.role==='ward'?{...c,secondParentStatus:'blank'}:c));
    const courtAmounts=Object.fromEntries(incomeWindow(month).map(m=>[m,receiving && alimonyFrom && alimonyTo && m>=alimonyFrom && m<=alimonyTo ? Number(alimonyMonthly) : 0]));
    const alimony=maritalStatus?alimonyForApplication({
      maritalStatus,singleParent:maritalStatus==='divorced'&&secondParent==='sole',
      arrangement:$('alimony-kind').value,divorceMonth:$('divorce-month').value,
      childrenForAlimony:alimonyChildren.length,
      declaredMonthly:$('alimony-kind').value==='notary'&&maritalStatus==='divorced'?($('notary-amount').value===''?NaN:Number($('notary-amount').value)):(receiving?(alimonyMonthly===''?NaN:Number(alimonyMonthly)):0),
      declaredByMonth:$('alimony-kind').value==='informal' && receiving && alimonyFrom && alimonyTo && alimonyMonthly!==''?courtAmounts:undefined,
      receivedByMonth:courtAmounts,officialWage:Number($('alimony-wage').value),wageFinal:$('alimony-final').checked
    },month):{status:'unknown',reason:'Укажите семейное положение'};
    if(!alimonyChildren.length && !receiving) {alimony.status='known';alimony.amount=0;alimony.method='no-eligible-child'}
    if(!alimonyChildren.length && receiving) {alimony.status='unknown';alimony.reason='Уточните, кому перечислялись алименты: на ребёнка вне состава семьи они не учитываются'}
    if(receiving && excludedAlimonyChildren) {alimony.status='unknown';alimony.reason='Разделите поступления по детям: алименты на умершего или не входящего в состав семьи ребёнка исключаются'}
    if(receiving && (!alimonyFrom || !alimonyTo || alimonyMonthly==='')) {alimony.status='unknown';alimony.reason='Уточните фактически поступившие алименты и период'}
    if(alimonyChildren.length && maritalStatus==='divorced' && !['court','court-order','bailiffs'].includes($('alimony-kind').value) && !['sole','other'].includes(secondParent)) {alimony.status='unknown';alimony.reason=secondParent==='mixed'?'У детей разные вторые родители: укажите отдельные алиментные обязательства; общий расчёт сейчас недоступен':'Уточните статус второго родителя у детей, указанных в алиментном обязательстве'}
    let scenarioBlocks=false,scenarioComplete=scenarios.length>0&&selected.length>0,shortcutOnly=true;
    const incomeText=scenarios.length?scenarios.map((group,scenarioIndex)=>{
      const awardChecks=group.map(child=>awardConflict(child,month,{jointRenewal}));
      if(awardChecks.some(check=>check.status==='block'))scenarioBlocks=true;
      if(awardChecks.some(check=>['unknown','review'].includes(check.status)))scenarioComplete=false;
      const benefitResult=childBenefitIncome(benefitRows.payments,children,group.map(c=>c.id),month,filingDate);
      const benefitUnknown=[...benefitRows.missing,...benefitResult.missing];
      const combinedIncome=!sourceComplete || incomeResult.total===null || benefitResult.total===null || benefitUnknown.length || alimony.status!=='known' || depositIncome.status!=='known' || maternityIncome.status!=='known' || supplemental.status!=='known' || childEarnings.status!=='known' ? null : incomeResult.total+benefitResult.total+alimony.amount+depositIncome.amount+maternityIncome.amount+supplemental.amount+childEarnings.amount;
      const olderAwards=children.filter(c=>c.awardRecipient==='self'&&c.awardTier && c.awardEnd && c.awardDecision).map(c=>({childId:c.id,tier:c.awardTier,endsOn:c.awardEnd,decisionDate:c.awardDecision}));
      const newborns=group.filter(c=>c.birthDate && c.birthDate<=filingDate).map(c=>({child:c,result:newbornShortcut({birthDate:c.birthDate,applicationDate:filingDate,olderAwards:olderAwards.filter(a=>a.childId!==c.id),sameRecipient:yn($('same-recipient').value),motherPregnancyBenefit:$('mother-pregnancy-benefit').checked})})).filter(x=>x.result.status==='simplified');
      const regularChildren=group.length-newborns.length;
      if(regularChildren)shortcutOnly=false;
      let tier=year===2026 && regularChildren>0 && combinedIncome!==null && pmPerson>0 && pmChild>0 && !members.unanswered.length && !children.some(c=>c.birthDate && ageAt(c.birthDate,filingDate)>=18 && ageAt(c.birthDate,filingDate)<23 && c.fullTimeStudent)
        ?childTier({income12:combinedIncome,familySize:members.included.length,childrenApplying:regularChildren,pmPerson,pmChild}):null;
      const grace=tier?.status==='income-too-high'?largeFamilyGrace({applicationMonth:month,perCapita:tier.base,pmPerson,isLargeFamily:$('large-family').checked,usedBefore:yn($('grace-used').value),awardEndMonths:children.filter(c=>c.awardRecipient==='self'&&c.awardEnd).map(c=>c.awardEnd.slice(0,7))}):null;
      if(grace?.status==='eligible')tier={...tier,status:'estimate',tier:50,grace:true};
      if(regularChildren && tier?.status==='income-too-high'&&grace?.status!=='unknown')scenarioBlocks=true;
      if(regularChildren && (tier?.status!=='estimate'||members.unanswered.length))scenarioComplete=false;
      const childNumber=children.findIndex(c=>c.id===group[0]?.id)+1;
      const label=$('application-mode').value==='separate'?`Заявление на ребёнка ${childNumber} (${scenarioIndex+1} из ${scenarios.length})`:'Общее заявление';
      const benefitText=benefitUnknown.length?`Уточнить пособия: ${benefitUnknown.join('; ')}.`:`Пособия на остальных детей учтены: ${benefitResult.total.toLocaleString('ru-RU')} ₽; исключены для этого заявления: ${benefitResult.excluded.reduce((sum,p)=>sum+p.amount,0).toLocaleString('ru-RU')} ₽.`;
      const newbornText=newborns.length?`Новорождённому по действующему решению на старшего: ${newborns.map(x=>`${x.result.tier}% с ${x.result.startMonth} по ${x.result.endsOn}`).join('; ')}; без новой оценки на этот срок. Далее — обычная оценка.`:'';
      const regularText=regularChildren?`${tier?.grace?'По однократному продлению многодетным — предварительно 50% для остальных детей.':`По обычной оценке ${tier?.status==='estimate'?`предварительная ступень ${tier.tier}% для остальных детей.`:tier?.status==='income-too-high'?`доход выше указанного ПМ; ${grace?.reason||'проверьте однократное продление'}.`:'ступень пока неизвестна.'}`}`:'';
      return `${label}: доход ${combinedIncome===null?'нужны данные':combinedIncome.toLocaleString('ru-RU')+' ₽'}. Действующее назначение: ${awardChecks.map(check=>check.status==='clear'?'нет препятствия':check.status==='renewal'?'можно продлить в последний месяц':check.status==='court-exception'?'учесть решение суда':check.reason).join('; ')}. ${benefitText} Алименты: ${alimony.status==='known'?`${alimony.amount.toLocaleString('ru-RU')} ₽`:'нужны данные ('+alimony.reason+')'}. Доходы детей: ${childEarnings.status==='known'?`${childEarnings.amount.toLocaleString('ru-RU')} ₽`:'уточнить ('+childEarnings.issues.join('; ')+')'}. Дополнительные источники: ${supplemental.status==='known'?`${supplemental.amount.toLocaleString('ru-RU')} ₽`:'уточнить вид, сумму и период'}. Проценты по вкладам в доходе: ${depositIncome.status==='known'?`${depositIncome.amount.toLocaleString('ru-RU')} ₽`:'нужны данные ('+depositIncome.reason+')'}. БиР за вошедшие месяцы: ${maternityIncome.status==='known'?`${maternityIncome.amount.toLocaleString('ru-RU')} ₽`:'уточнить период начисления'}. ${newbornText} ${regularText}`;
    }).join(' '):'Отметьте хотя бы одного ребёнка для заявления.';
    if(!RULES[year]) { output.push(`<div class="result"><strong>${filingDate}</strong><span class="unknown">${familyText} ${incomeText} МРОТ на ${year} год ещё не загружен.</span></div>`); continue }
    // An entered 12-week condition is applicable only to the selected month.
    const adults=countedAdults.map(({person,index:j})=>{
      const income=Object.fromEntries(incomeWindow(month).map(m=>[m,[...(Number.isFinite(baseMonths(person)[m])?[{type:person.incomeType,amount:baseMonths(person)[m]}]:[]),...(supplemental.byPerson.get(j)?.[m]?.qualifying?[{type:'employment',amount:supplemental.byPerson.get(j)[m].qualifying}]:[])]]));
      const soleParent=j===0&&children.some(c=>members.included.some(p=>p.id===c.id)&&c.birthDate&&ageAt(c.birthDate,filingDate)<18&&(c.role==='ward'?['never','divorced','widowed'].includes($('marital-status').value):soleParentStatus([c])==='sole'));
      const result=minimumIncomeTest({reasons:reasons.filter(r=>r.person===j),pregnancyWeeksAtApplication:j===0&&i===0?Number($('weeks').value):0,income,singleParent:soleParent,multipleChildrenExemption:j===0&&$('large-family').checked},month,RULES[year].mrot);
      const amountKnown=!sourceEnabled.has('employment')||$('income-mode').value!=='total'?incomeWindow(month).every(m=>Number.isFinite(baseMonths(person)[m])):month===start&&Number.isFinite(person.total);
      const earned=sourceEnabled.has('employment')&&$('income-mode').value==='total'&&month===start&&person.incomeType!=='other'?person.total+[...Object.values(supplemental.byPerson.get(j)||{})].reduce((sum,v)=>sum+v.qualifying,0):result.earned;
      return {...result,earned,passed:earned>=result.minimum,known:sourceComplete&&amountKnown&&person.incomeType!=='other'&&supplemental.status==='known',label:person.label};
    });
    const adultText=adults.map(a=>`${a.label}: ${a.exempt?'порог не применяется':`засчитано причин ${a.creditedMonths} мес., нужно ${Math.ceil(a.minimum).toLocaleString('ru-RU')} ₽, ${a.known?`введено для этого требования ${a.earned.toLocaleString('ru-RU')} ₽ (${a.passed?'достаточно':'недостаточно'})`:'данных о подходящем доходе пока недостаточно'}`}`).join('; ');
    const applicantCheck=$('applicant-citizen').value==='no'||$('applicant-residence').value==='no'?'no':$('applicant-citizen').value&&$('applicant-residence').value?'yes':'unknown';
    const explicitBlockers=applicantCheck==='no'||[carCheck,propertyCheck,otherCheck,depositCheck].some(c=>c.status==='no')||adults.some(a=>a.known&&!a.passed)||scenarioBlocks;
    const headline=shortcutOnly&&selected.length&&applicantCheck!=='no'?'Для новорождённого проверьте упрощённое назначение ниже':explicitBlockers?'Есть препятствие по введённым данным':scenarioComplete&&applicantCheck==='yes'&&adults.every(a=>a.known||a.exempt)&&[carCheck,propertyCheck,otherCheck,depositCheck].every(c=>c.status==='yes')?'По проверенным критериям препятствий нет; полная оценка ещё не готова':'Для вывода нужны дополнительные данные';
    output.push(`<div class="result"><strong>${filingDate}<small> · доходы ${incomeWindow(month)[0]} — ${incomeWindow(month).at(-1)}</small></strong><span class="${explicitBlockers?'bad':'unknown'}">${headline}. Заявитель: ${applicantCheck==='yes'?'гражданство и проживание РФ подтверждены':applicantCheck==='no'?'нет необходимого гражданства или проживания':'уточните гражданство и проживание'}. Минимальный доход: ${adultText}. ${incomeText} ${familyText}${adults.flatMap(a=>a.warnings).length?' '+adults.flatMap(a=>a.warnings).join(' '):''}</span></div>`);
  }
  $('results').innerHTML=output.join('');
}
$('add').onclick=addReason;
$('add-child').onclick=addChild; $('add-car').onclick=addCar;
$('add-benefit').onclick=()=>{benefitPayments.push({childId:'',amount:'',from:'',to:''});renderBenefitRows();render()};
 $('add-property').onclick=addProperty; $('add-vehicle').onclick=addOtherVehicle; $('add-deposit').onclick=addDeposit;
 $('add-adult').onclick=()=>{if(incomePeople.length===1)incomePeople.push({label:'Супруг(а)',months:{},total:null,incomeType:'employment'});renderIncomeForm();render()};
 $('income-mode').addEventListener('input',()=>{renderIncomeForm();render()});
 $('start').addEventListener('input',()=>{renderIncomeForm();render()});
['applicant-citizen','applicant-residence','day','weeks','large-family','grace-used','disability','support-car','rural','pm-person','pm-child'].forEach(id=>$(id).addEventListener('input',render));
renderIncomeForm();
render();

const originalPanels=[...document.querySelectorAll('main > .panel')];
const steps=[
  {title:'Ваша ситуация',panels:[originalPanels[0],originalPanels[2]]},
  {title:'Доходы',panels:[originalPanels[5]]},
  {title:'Причины',panels:[originalPanels[1]]},
  {title:'Имущество',panels:[originalPanels[3],originalPanels[4]]},
  {title:'Календарь',panels:[originalPanels[6]]}
];
const anchor=document.querySelector('.wizard-actions');
steps.flatMap(step=>step.panels).forEach(panel=>anchor.before(panel));
let currentStep=0;
function showStep(index) {
  currentStep=Math.max(0,Math.min(steps.length-1,index));
  steps.forEach((step,i)=>step.panels.forEach(panel=>panel.hidden=i!==currentStep));
  $('progress').innerHTML=steps.map((step,i)=>`<span class="${i===currentStep?'active':''}">${i+1}. ${step.title}</span>`).join('');
  $('back').hidden=currentStep===0; $('next').hidden=currentStep===steps.length-1;
  if(currentStep===steps.length-1)render();
  window.scrollTo({top:0,behavior:'smooth'});
}
$('back').onclick=()=>showStep(currentStep-1);
$('next').onclick=()=>showStep(currentStep+1);
showStep(0);
