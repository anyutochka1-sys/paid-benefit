import { incomeWindow, minimumIncomeTest, monthIndex, monthString, RULES } from './engine.mjs';
import { includedFamily, childCanApply, checkCars, ageAt } from './family-assets.mjs';
import {incomeForMonth,childTier} from './income.mjs';
import {checkProperty,checkOtherVehicles,checkDepositInterest,depositIncomeForApplication} from './property.mjs';
import {childBenefitIncome} from './benefits.mjs';
import {alimonyForApplication} from './alimony.mjs';
import {soleParentStatus} from './parental-status.mjs';
import {newbornShortcut} from './newborn.mjs';
import {maternityIncomeForApplication} from './maternity.mjs';
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
alimonySection.innerHTML='<h3>Семейное положение и алименты</h3><label>Семейное положение на дату заявления<select id="marital-status"><option value="">Выберите</option><option value="never">В браке никогда не состояла</option><option value="married">Состою в браке (в том числе повторном)</option><option value="divorced">В разводе, новый брак не заключён</option><option value="widowed">Вдова</option></select></label><label id="spouse-status-field" hidden>Статус нынешнего супруга на дату заявления<select id="spouse-status"><option value="unknown">Уточните</option><option value="ordinary">Входит в состав семьи</option><option value="parentalRightsLost">Лишён / ограничен в правах на ребёнка из заявления</option><option value="stateCare">На полном государственном обеспечении</option><option value="conscript">Служба по призыву / военный курсант без контракта</option><option value="imprisoned">Отбывает лишение свободы</option><option value="forcedTreatment">На принудительном лечении по решению суда</option><option value="custody">Заключён под стражу</option><option value="missing">Признан безвестно отсутствующим / объявлен умершим</option><option value="wanted">Находится в розыске</option></select></label><div id="alimony-fields" hidden><label>Алименты на детей фактически поступали?<select id="alimony-received"><option value="no">Нет</option><option value="yes">Да</option></select></label><div id="alimony-actual-fields" hidden><label>Сумма за месяц, ₽<input id="alimony-monthly" type="number" min="0"></label><label>С какого месяца поступали<input id="alimony-from" type="month"></label><label>По какой месяц включительно<input id="alimony-to" type="month"></label></div><div id="alimony-divorced-fields" hidden><label>Месяц расторжения брака<input id="divorce-month" type="month"></label><label>Основание для алиментов на детей<select id="alimony-kind"><option value="">Выберите</option><option value="court">Есть решение суда</option><option value="court-order">Есть судебный приказ</option><option value="bailiffs">Есть исполнительное производство у приставов</option><option value="notary">Нотариальное соглашение</option><option value="informal">Устная договорённость / не оформлены</option></select></label><label>Сколько детей в этом алиментном обязательстве<input id="alimony-child-count" type="number" min="1" value="1"></label><label id="notary-amount-field" hidden>Ежемесячная сумма по нотариальному соглашению, ₽<input id="notary-amount" type="number" min="0"></label><p class="hint">Статус второго родителя укажите в карточке каждого ребёнка. Лишение свободы и лишение родительских прав сами по себе не означают статус единственного родителя.</p><div id="alimony-wage-fields"><label>Применимая окончательная средняя зарплата Росстата в регионе, ₽<input id="alimony-wage" type="number" min="0"></label><label class="check"><input id="alimony-final" type="checkbox"> Проверена окончательная годовая публикация Росстата, действующая в месяц обращения</label></div></div></div><p class="hint">Расчётный минимум алиментов применяется только при статусе «в разводе» и отсутствии судебного акта; новый зарегистрированный брак меняет статус. Если вы никогда не были замужем, минимум не вменяется, но полученные алименты учитываются. Единственный родитель и семейное положение — разные вопросы. Не включайте алименты повторно в зарплату.</p>';
benefitsSection.after(alimonySection);
const maternitySection=document.createElement('section');
maternitySection.innerHTML='<div class="section-heading"><h3>Пособие по беременности и родам (БиР)</h3><button id="add-maternity" type="button">+ Указать выплату</button></div><p class="hint">Вводите всю сумму разовой выплаты отдельно от зарплаты. Она распределяется по месяцам начисления, а не учитывается целиком в месяце поступления. Для обычного периода выставлено 5 месяцев; при продлении уточните срок по документу.</p><div id="maternity-payments"></div>';
benefitsSection.after(maternitySection);
const maternityPayments=[];
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
    const typeLabel=document.createElement('label');typeLabel.textContent='Что за доход в строках ниже';
    const incomeType=document.createElement('select');
    [['employment','Зарплата / договор ГПХ'],['business','ИП'],['selfEmployed','Самозанятость'],['pension','Пенсия / больничный'],['scholarship','Стипендия'],['other','Другой доход — для 8 МРОТ требуется уточнение']].forEach(([value,label])=>incomeType.add(new Option(label,value)));
    incomeType.value=person.incomeType||'employment';incomeType.oninput=()=>{person.incomeType=incomeType.value;render()};typeLabel.append(incomeType);section.append(typeLabel);
    if(mode==='total') {
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
  row.innerHTML='<label>Имя или обозначение ребёнка<input class="child-name" type="text" placeholder="Например, старший"></label><label>Дата рождения<input class="birth" type="date"></label><label class="check"><input class="applying" type="checkbox" checked> Подаю на этого ребёнка</label><label class="check"><input class="alimony-applies" type="checkbox" checked> Этот ребёнок входит в указанное ниже алиментное обязательство</label><label>Статус второго родителя этого ребёнка<select class="second-parent-status"><option value="">Уточните</option><option value="recorded">Указан в записи о рождении</option><option value="blank">Не указан в записи о рождении</option><option value="mother-statement">Записан по заявлению матери</option><option value="dead">Умер</option><option value="declared-dead">Объявлен умершим судом</option><option value="missing">Признан безвестно отсутствующим</option><option value="imprisoned">Лишён свободы</option><option value="deprived-rights">Лишён родительских прав</option></select></label><details><summary>Уже назначено пособие на этого ребёнка?</summary><label>Размер действующего пособия<select class="award-tier"><option value="">Не назначено / не знаю</option><option value="50">50%</option><option value="75">75%</option><option value="100">100%</option></select></label><label>Дата последнего решения<input class="award-decision" type="date"></label><label>Действует по<input class="award-end" type="date"></label></details><label>Очное обучение<select class="student"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label>В браке<select class="married"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label>Гражданин РФ и проживает в России<select class="citizen"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><button class="remove" type="button">Убрать</button>';
  row.querySelector('.remove').onclick=()=>{row.remove();renderBenefitRows();render()};
  row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{renderBenefitRows();render()}));
  $('children').append(row); renderBenefitRows(); render();
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
    id:row.dataset.childId,role:'child',birthDate:row.querySelector('.birth').value,
    applying:row.querySelector('.applying').checked,
    alimonyApplies:row.querySelector('.alimony-applies').checked,secondParentStatus:row.querySelector('.second-parent-status').value,
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
  const children=childData(), cars=carData(), properties=propertyData(),otherVehicles=otherVehicleData(),deposits=depositData();
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
    const incomeResult=incomeForMonth(countedAdults.map(({person})=>({...person,mode:$('income-mode').value,baseApplicationMonth:start})),month);
    const selected=children.filter((c,j)=>c.applying && applicable[j].status==='yes');
    const scenarios=$('application-mode').value==='separate'?selected.map(c=>[c]):[selected];
    const benefitRows=benefitRowsForWindow(month);
    const pmPerson=Number($('pm-person').value),pmChild=Number($('pm-child').value);
    const depositIncome=depositIncomeForApplication(countedDeposits,{applicationMonth:month,perCapitaMinimum:pmPerson});
    const maternityIncome=maternityIncomeForApplication(maternityPayments,month);
    const maritalStatus=$('marital-status').value;
    const alimonyFrom=$('alimony-from').value, alimonyTo=$('alimony-to').value;
    const alimonyMonthly=$('alimony-monthly').value;
    const receiving=$('alimony-received').value==='yes';
    const secondParent=soleParentStatus(children.filter(c=>c.alimonyApplies));
    const courtAmounts=Object.fromEntries(incomeWindow(month).map(m=>[m,receiving && alimonyFrom && alimonyTo && m>=alimonyFrom && m<=alimonyTo ? Number(alimonyMonthly) : 0]));
    const alimony=maritalStatus?alimonyForApplication({
      maritalStatus,singleParent:maritalStatus==='divorced'&&secondParent==='sole',
      arrangement:$('alimony-kind').value,divorceMonth:$('divorce-month').value,
      childrenForAlimony:Number($('alimony-child-count').value),
      declaredMonthly:$('alimony-kind').value==='notary'&&maritalStatus==='divorced'?($('notary-amount').value===''?NaN:Number($('notary-amount').value)):(receiving?(alimonyMonthly===''?NaN:Number(alimonyMonthly)):0),
      declaredByMonth:$('alimony-kind').value==='informal' && receiving && alimonyFrom && alimonyTo && alimonyMonthly!==''?courtAmounts:undefined,
      receivedByMonth:courtAmounts,officialWage:Number($('alimony-wage').value),wageFinal:$('alimony-final').checked
    },month):{status:'unknown',reason:'Укажите семейное положение'};
    if(receiving && (!alimonyFrom || !alimonyTo || alimonyMonthly==='')) {alimony.status='unknown';alimony.reason='Уточните фактически поступившие алименты и период'}
    if(maritalStatus==='divorced' && !['court','court-order','bailiffs'].includes($('alimony-kind').value) && !['sole','other'].includes(secondParent)) {alimony.status='unknown';alimony.reason=secondParent==='mixed'?'У детей разные вторые родители: укажите отдельные алиментные обязательства; общий расчёт сейчас недоступен':'Уточните статус второго родителя у детей, указанных в алиментном обязательстве'}
    let scenarioBlocks=false,scenarioComplete=scenarios.length>0&&selected.length>0,shortcutOnly=true;
    const incomeText=scenarios.length?scenarios.map((group,scenarioIndex)=>{
      const benefitResult=childBenefitIncome(benefitRows.payments,children,group.map(c=>c.id),month,filingDate);
      const benefitUnknown=[...benefitRows.missing,...benefitResult.missing];
      const combinedIncome=incomeResult.total===null || benefitResult.total===null || benefitUnknown.length || alimony.status!=='known' || depositIncome.status!=='known' || maternityIncome.status!=='known' ? null : incomeResult.total+benefitResult.total+alimony.amount+depositIncome.amount+maternityIncome.amount;
      const olderAwards=children.filter(c=>c.awardTier && c.awardEnd && c.awardDecision).map(c=>({childId:c.id,tier:c.awardTier,endsOn:c.awardEnd,decisionDate:c.awardDecision}));
      const newborns=group.filter(c=>c.birthDate && c.birthDate<=filingDate).map(c=>({child:c,result:newbornShortcut({birthDate:c.birthDate,applicationDate:filingDate,olderAwards:olderAwards.filter(a=>a.childId!==c.id),sameRecipient:yn($('same-recipient').value),motherPregnancyBenefit:$('mother-pregnancy-benefit').checked})})).filter(x=>x.result.status==='simplified');
      const regularChildren=group.length-newborns.length;
      if(regularChildren)shortcutOnly=false;
      const tier=year===2026 && regularChildren>0 && combinedIncome!==null && pmPerson>0 && pmChild>0 && !members.unanswered.length && !children.some(c=>c.birthDate && ageAt(c.birthDate,filingDate)>=18 && ageAt(c.birthDate,filingDate)<23 && c.fullTimeStudent)
        ?childTier({income12:combinedIncome,familySize:members.included.length,childrenApplying:regularChildren,pmPerson,pmChild}):null;
      if(regularChildren && tier?.status==='income-too-high')scenarioBlocks=true;
      if(regularChildren && (tier?.status!=='estimate'||members.unanswered.length))scenarioComplete=false;
      const childNumber=children.findIndex(c=>c.id===group[0]?.id)+1;
      const label=$('application-mode').value==='separate'?`Заявление на ребёнка ${childNumber} (${scenarioIndex+1} из ${scenarios.length})`:'Общее заявление';
      const benefitText=benefitUnknown.length?`Уточнить пособия: ${benefitUnknown.join('; ')}.`:`Пособия на остальных детей учтены: ${benefitResult.total.toLocaleString('ru-RU')} ₽; исключены для этого заявления: ${benefitResult.excluded.reduce((sum,p)=>sum+p.amount,0).toLocaleString('ru-RU')} ₽.`;
      const newbornText=newborns.length?`Новорождённому по действующему решению на старшего: ${newborns.map(x=>`${x.result.tier}% с ${x.result.startMonth} по ${x.result.endsOn}`).join('; ')}; без новой оценки на этот срок. Далее — обычная оценка.`:'';
      const regularText=regularChildren?`По обычной оценке ${tier?.status==='estimate'?`предварительная ступень ${tier.tier}% для остальных детей.`:tier?.status==='income-too-high'?'доход выше указанного ПМ.':'ступень пока неизвестна.'}`:'';
      return `${label}: доход ${combinedIncome===null?'нужны данные':combinedIncome.toLocaleString('ru-RU')+' ₽'}. ${benefitText} Алименты: ${alimony.status==='known'?`${alimony.amount.toLocaleString('ru-RU')} ₽`:'нужны данные ('+alimony.reason+')'}. Проценты по вкладам в доходе: ${depositIncome.status==='known'?`${depositIncome.amount.toLocaleString('ru-RU')} ₽`:'нужны данные ('+depositIncome.reason+')'}. БиР за вошедшие месяцы: ${maternityIncome.status==='known'?`${maternityIncome.amount.toLocaleString('ru-RU')} ₽`:'уточнить период начисления'}. ${newbornText} ${regularText}`;
    }).join(' '):'Отметьте хотя бы одного ребёнка для заявления.';
    if(!RULES[year]) { output.push(`<div class="result"><strong>${filingDate}</strong><span class="unknown">${familyText} ${incomeText} МРОТ на ${year} год ещё не загружен.</span></div>`); continue }
    // An entered 12-week condition is applicable only to the selected month.
    const adults=countedAdults.map(({person,index:j})=>{
      const income=Object.fromEntries(incomeWindow(month).map(m=>[m,Number.isFinite(person.months[m])?[{type:person.incomeType,amount:person.months[m]}]:[]]));
      const soleParent=j===0&&children.some(c=>c.birthDate&&ageAt(c.birthDate,filingDate)<18&&soleParentStatus([c])==='sole');
      const result=minimumIncomeTest({reasons:reasons.filter(r=>r.person===j),pregnancyWeeksAtApplication:j===0&&i===0?Number($('weeks').value):0,income,singleParent:soleParent,multipleChildrenExemption:j===0&&$('large-family').checked},month,RULES[year].mrot);
      const amountKnown=$('income-mode').value==='monthly'?incomeWindow(month).every(m=>Number.isFinite(person.months[m])):month===start&&Number.isFinite(person.total);
      const earned=$('income-mode').value==='total'&&month===start&&person.incomeType!=='other'?person.total:result.earned;
      return {...result,earned,passed:earned>=result.minimum,known:amountKnown&&person.incomeType!=='other',label:person.label};
    });
    const adultText=adults.map(a=>`${a.label}: ${a.exempt?'порог не применяется':`засчитано причин ${a.creditedMonths} мес., нужно ${Math.ceil(a.minimum).toLocaleString('ru-RU')} ₽, ${a.known?`введено для этого требования ${a.earned.toLocaleString('ru-RU')} ₽ (${a.passed?'достаточно':'недостаточно'})`:'данных о подходящем доходе пока недостаточно'}`}`).join('; ');
    const explicitBlockers=[carCheck,propertyCheck,otherCheck,depositCheck].some(c=>c.status==='no')||adults.some(a=>a.known&&!a.passed)||scenarioBlocks;
    const headline=shortcutOnly&&selected.length?'Для новорождённого проверьте упрощённое назначение ниже':explicitBlockers?'Есть препятствие по введённым данным':scenarioComplete&&adults.every(a=>a.known||a.exempt)&&[carCheck,propertyCheck,otherCheck,depositCheck].every(c=>c.status==='yes')?'По проверенным критериям препятствий нет; полная оценка ещё не готова':'Для вывода нужны дополнительные данные';
    output.push(`<div class="result"><strong>${filingDate}<small> · доходы ${incomeWindow(month)[0]} — ${incomeWindow(month).at(-1)}</small></strong><span class="${explicitBlockers?'bad':'unknown'}">${headline}. Минимальный доход: ${adultText}. ${incomeText} ${familyText}${adults.flatMap(a=>a.warnings).length?' '+adults.flatMap(a=>a.warnings).join(' '):''}</span></div>`);
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
['day','weeks','large-family','disability','support-car','rural','pm-person','pm-child'].forEach(id=>$(id).addEventListener('input',render));
renderIncomeForm();
addReason(); render();

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
