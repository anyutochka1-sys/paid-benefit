import { incomeWindow, minimumIncomeTest, monthIndex, monthString, RULES } from './engine.mjs';
import { includedFamily, childCanApply, checkCars, ageAt } from './family-assets.mjs';
import {incomeForMonth,childTier} from './income.mjs';
import {checkProperty,checkOtherVehicles,checkDepositInterest,depositIncomeForApplication} from './property.mjs';
import {childBenefitIncome} from './benefits.mjs';
import {alimonyForApplication} from './alimony.mjs';
import {newbornShortcut} from './newborn.mjs';
const $ = id => document.getElementById(id);
const types = [
  ['unemployment','Официальная безработица'], ['pregnancy','Беременность'],
  ['careUnderThree','Уход за ребёнком до 3 лет']
];
const incomePeople=[{label:'Заявитель',months:{},total:null}];
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
alimonySection.innerHTML='<h3>Алименты</h3><label>Семейное положение заявителя<select id="marital-status"><option value="other">Не в разводе / нет алиментов</option><option value="divorced">В разводе</option><option value="single">Единственный родитель</option></select></label><div id="alimony-fields" hidden><label>Месяц расторжения брака<input id="divorce-month" type="month"></label><label>На каком основании алименты?<select id="alimony-kind"><option value="">Выберите</option><option value="court">Решение суда / судебный приказ / приставы</option><option value="notary">Нотариальное соглашение</option><option value="informal">Устная договорённость / не оформлены</option></select></label><label>Детей, на которых полагаются алименты<input id="alimony-child-count" type="number" min="1" value="1"></label><label>Сумма алиментов за месяц, ₽<input id="alimony-monthly" type="number" min="0" placeholder="0, если ничего не поступало"></label><label>С какого месяца поступает сумма<input id="alimony-from" type="month"></label><label>По какой месяц включительно<input id="alimony-to" type="month"></label><div id="alimony-wage-fields"><label>Применимая окончательная средняя зарплата Росстата в регионе, ₽<input id="alimony-wage" type="number" min="0"></label><label class="check"><input id="alimony-final" type="checkbox"> Проверена окончательная годовая публикация Росстата, действующая в месяц обращения</label></div></div><p class="hint">При судебном решении учитываются фактически полученные суммы, даже ноль; укажите месяцы и изменения отдельными периодами в дальнейшем. При нотариальном соглашении или без оформления для разведённого заявителя действует минимум ¼, ⅓ или ½ региональной зарплаты на 1, 2 или 3+ детей; месяц развода входит. Без подтверждённых окончательных данных Росстата точного вывода нет. Не включайте алименты повторно в поле зарплаты.</p>';
benefitsSection.after(alimonySection);
alimonySection.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{ $('alimony-fields').hidden=$('marital-status').value!=='divorced';$('alimony-wage-fields').hidden=$('alimony-kind').value==='court';render()}));
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
  row.innerHTML=`<label>Причина<select class="type">${types.map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>С месяца<input class="from" type="month"></label><label>По месяц<input class="to" type="month"></label><label class="check"><input class="registered" type="checkbox">Стою на учёте в ЦЗН</label><button class="remove" type="button">Убрать</button>`;
  row.querySelector('.remove').onclick=()=>{row.remove();render()};
  row.querySelector('.type').onchange=()=>{row.querySelector('.check').hidden=row.querySelector('.type').value!=='unemployment';render()};
  row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',render));
  $('reasons').append(row); row.querySelector('.type').dispatchEvent(new Event('change'));
}
function addChild() {
  const row=document.createElement('div'); row.className='form-row';
  row.dataset.childId=`child-${nextChildId++}`;
  row.innerHTML='<label>Имя или обозначение ребёнка<input class="child-name" type="text" placeholder="Например, старший"></label><label>Дата рождения<input class="birth" type="date"></label><label class="check"><input class="applying" type="checkbox" checked> Подаю на этого ребёнка</label><details><summary>Уже назначено пособие на этого ребёнка?</summary><label>Размер действующего пособия<select class="award-tier"><option value="">Не назначено / не знаю</option><option value="50">50%</option><option value="75">75%</option><option value="100">100%</option></select></label><label>Дата последнего решения<input class="award-decision" type="date"></label><label>Действует по<input class="award-end" type="date"></label></details><label>Очное обучение<select class="student"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label>В браке<select class="married"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label>Гражданин РФ и проживает в России<select class="citizen"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><button class="remove" type="button">Убрать</button>';
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
  row.innerHTML='<label>Год выпуска<input class="year" type="number" min="1950" max="2030"></label><label>Мощность, л. с.<input class="hp" type="number" min="1"></label><label>Получен при четырёх детях?<select class="acquired"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label class="check"><input class="excluded" type="checkbox"> Под арестом / в розыске / запрет регистрационных действий</label><button class="remove" type="button">Убрать</button>';
  bindRow(row); $('cars').append(row); render();
}
function addProperty() {
  const row=document.createElement('div');row.className='form-row';
  row.innerHTML='<label>Вид<select class="type"><option value="apartment">Квартира</option><option value="house">Дом</option><option value="garden">Садовый дом</option><option value="nonresidential">Нежилое помещение</option><option value="garage">Гараж / машино-место</option><option value="land">Участок</option></select></label><label class="area-field">Площадь, м²<input class="area" type="number" min="0"></label><label class="land-field">Площадь, га<input class="hectares" type="number" min="0" step="0.001"></label><label>Доля семьи, %<input class="share" type="number" min="0" max="100" placeholder="100"></label><label class="check"><input class="supported" type="checkbox"> Получено как целевая господдержка</label><label class="check"><input class="excluded" type="checkbox"> Под арестом / запрет действий / у опекаемого</label><button class="remove" type="button">Убрать</button>';
  bindRow(row); const toggle=()=>{const type=row.querySelector('.type').value;row.querySelector('.area-field').hidden=!['apartment','house'].includes(type);row.querySelector('.land-field').hidden=type!=='land';render()}; row.querySelector('.type').addEventListener('input',toggle);
  $('properties').append(row);toggle();
}
function addOtherVehicle() {
  const row=document.createElement('div');row.className='form-row';
  row.innerHTML='<label>Вид<select class="type"><option value="motorcycle">Мотоцикл</option><option value="boat">Маломерное судно</option><option value="machine">Самоходная машина</option></select></label><label class="year-field">Год выпуска<input class="year" type="number" min="1950" max="2030"></label><label class="check"><input class="excluded" type="checkbox"> Под арестом / в розыске / запрет действий</label><button class="remove" type="button">Убрать</button>';
  bindRow(row); row.querySelector('.type').addEventListener('input',()=>{row.querySelector('.year-field').hidden=row.querySelector('.type').value==='motorcycle';render()});row.querySelector('.year-field').hidden=true;
  $('other-vehicles').append(row);render();
}
function addDeposit() {
  const row=document.createElement('div');row.className='form-row';
  row.innerHTML='<label>Год получения процентов<input class="tax-year" type="number" min="2024" max="2030"></label><label>Выплачено процентов, ₽<input class="interest" type="number" min="0"></label><label>Счёт закрыт в месяце<input class="closed" type="month"></label><label class="check"><input class="nominal" type="checkbox"> Номинальный счёт ребёнка под опекой</label><button class="remove" type="button">Убрать</button>';
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
    awardTier:row.querySelector('.award-tier').value?Number(row.querySelector('.award-tier').value):undefined,
    awardDecision:row.querySelector('.award-decision').value,
    awardEnd:row.querySelector('.award-end').value,
    fullTimeStudent:yn(row.querySelector('.student').value),married:yn(row.querySelector('.married').value),
    russianCitizen:yn(row.querySelector('.citizen').value),livesInRussia:yn(row.querySelector('.citizen').value)
  }));
}
function carData() {
  return [...document.querySelectorAll('#cars .form-row')].map(row=>({
    manufactureYear:row.querySelector('.year').value ? Number(row.querySelector('.year').value) : undefined,
    horsepower:row.querySelector('.hp').value ? Number(row.querySelector('.hp').value) : undefined,
    acquiredWithFourChildren:yn(row.querySelector('.acquired').value),
    seized:row.querySelector('.excluded').checked
  }));
}
function propertyData() {
  return [...document.querySelectorAll('#properties .form-row')].map(row=>({
    type:row.querySelector('.type').value,
    area:row.querySelector('.area').value===''?undefined:Number(row.querySelector('.area').value),
    hectares:row.querySelector('.hectares').value===''?undefined:Number(row.querySelector('.hectares').value),
    familyShare:row.querySelector('.share').value===''?undefined:Number(row.querySelector('.share').value)/100,
    supported:row.querySelector('.supported').checked,seized:row.querySelector('.excluded').checked
  }));
}
function otherVehicleData() {
  return [...document.querySelectorAll('#other-vehicles .form-row')].map(row=>({
    type:row.querySelector('.type').value,
    manufactureYear:row.querySelector('.year').value===''?undefined:Number(row.querySelector('.year').value),
    seized:row.querySelector('.excluded').checked
  }));
}
function depositData() {
  return [...document.querySelectorAll('#deposits .form-row')].map(row=>({
    taxYear:row.querySelector('.tax-year').value===''?undefined:Number(row.querySelector('.tax-year').value),
    interestForRelevantTaxYear:row.querySelector('.interest').value===''?undefined:Number(row.querySelector('.interest').value),
    closedMonth:row.querySelector('.closed').value||undefined,
    nominalWardAccount:row.querySelector('.nominal').checked
  }));
}
function render() {
  const start=$('start').value; if (!start) return;
  const children=childData(), cars=carData(), properties=propertyData(),otherVehicles=otherVehicleData(),deposits=depositData();
  const reasons=[...document.querySelectorAll('.reason')].map(row=>({type:row.querySelector('.type').value,start:row.querySelector('.from').value,end:row.querySelector('.to').value,registered:row.querySelector('.registered').checked}));
  const output=[];
  for(let i=0;i<12;i++) {
    const month=monthString(monthIndex(start)+i), year=Number(month.slice(0,4));
    const day=String(Math.max(1,Math.min(28,Number($('day').value)||1))).padStart(2,'0');
    const filingDate=`${month}-${day}`;
    const members=includedFamily([{role:'applicant'},...(incomePeople.length>1?[{role:'spouse'}]:[]),...children],filingDate);
    const applicable=children.map(child=>childCanApply(child,filingDate));
    const fourOrMoreChildren=children.filter(c=>c.birthDate && ageAt(c.birthDate,filingDate)<18).length>=4;
    const carCheck=checkCars(cars,{applicationYear:year,multipleChildren:$('large-family').checked,disabledFamilyMember:$('disability').checked,supportVehicle:$('support-car').checked,fourOrMoreChildren});
    const propertyCheck=checkProperty(properties,{familySize:members.included.length,rural:$('rural').checked,multipleChildren:$('large-family').checked,disabledFamilyMember:$('disability').checked,supportVehicle:$('support-car').checked});
    const otherCheck=checkOtherVehicles(otherVehicles,{applicationYear:year,multipleChildren:$('large-family').checked,disabledFamilyMember:$('disability').checked,supportMotorcycle:$('support-car').checked,supportMachine:$('support-car').checked});
    const allDepositsKnown=deposits.filter(d=>!d.nominalWardAccount).every(d=>d.taxYear===year-1 && Number.isFinite(d.interestForRelevantTaxYear));
    const depositCheck=allDepositsKnown&&Number($('pm-person').value)>0?checkDepositInterest(deposits,{applicationMonth:month,perCapitaMinimum:Number($('pm-person').value)}):{status:'unknown'};
    const familyText=`Учтено в этом шаге: ${members.included.length}${members.unanswered.length?' (есть неуточнённые дети)':''}. Детей, на которых можно подать: ${applicable.filter(x=>x.status==='yes').length}${applicable.some(x=>x.status==='unknown')?' (есть неуточнённые)':''}. Автомобили: ${carCheck.status==='yes'?'по этим признакам подходят':carCheck.status==='no'?carCheck.reasons.join('; '):'нужны сведения'}. Другая недвижимость: ${propertyCheck.status==='yes'?'по базовым порогам подходит':propertyCheck.status==='no'?propertyCheck.reasons.join('; '):'нужна проверка'}. Прочая техника: ${otherCheck.status==='yes'?'по базовым порогам подходит':otherCheck.status==='no'?otherCheck.reasons.join('; '):'нужна проверка'}. Вклады: ${depositCheck.status==='yes'?'по порогу процентов подходят':depositCheck.status==='no'?'превышен порог процентов':'нужны данные налогового года/ПМ'}.`;
    const incomeResult=incomeForMonth(incomePeople.map(p=>({...p,mode:$('income-mode').value,baseApplicationMonth:start})),month);
    const selected=children.filter((c,j)=>c.applying && applicable[j].status==='yes');
    const scenarios=$('application-mode').value==='separate'?selected.map(c=>[c]):[selected];
    const benefitRows=benefitRowsForWindow(month);
    const pmPerson=Number($('pm-person').value),pmChild=Number($('pm-child').value);
    const depositIncome=depositIncomeForApplication(deposits,{applicationMonth:month,perCapitaMinimum:pmPerson});
    const maritalStatus=$('marital-status').value;
    const alimonyFrom=$('alimony-from').value, alimonyTo=$('alimony-to').value;
    const alimonyMonthly=$('alimony-monthly').value;
    const courtAmounts=Object.fromEntries(incomeWindow(month).map(m=>[m,alimonyFrom && alimonyTo && m>=alimonyFrom && m<=alimonyTo ? Number(alimonyMonthly) : 0]));
    const alimony=maritalStatus==='other'?{status:'known',amount:0}:alimonyForApplication({
      maritalStatus:maritalStatus==='single'?'other':maritalStatus,singleParent:maritalStatus==='single',
      arrangement:$('alimony-kind').value,divorceMonth:$('divorce-month').value,
      childrenForAlimony:Number($('alimony-child-count').value),
      declaredMonthly:alimonyMonthly===''?NaN:Number(alimonyMonthly),
      declaredByMonth:alimonyFrom && alimonyTo && alimonyMonthly!==''?courtAmounts:undefined,
      receivedByMonth:courtAmounts,officialWage:Number($('alimony-wage').value),wageFinal:$('alimony-final').checked
    },month);
    if(maritalStatus==='divorced' && $('alimony-kind').value==='court' && (!alimonyFrom || !alimonyTo || alimonyMonthly==='')) {alimony.status='unknown';alimony.reason='Уточните полученные алименты и период'}
    const incomeText=scenarios.length?scenarios.map((group,scenarioIndex)=>{
      const benefitResult=childBenefitIncome(benefitRows.payments,children,group.map(c=>c.id),month,filingDate);
      const benefitUnknown=[...benefitRows.missing,...benefitResult.missing];
      const combinedIncome=incomeResult.total===null || benefitResult.total===null || benefitUnknown.length || alimony.status!=='known' || depositIncome.status!=='known' ? null : incomeResult.total+benefitResult.total+alimony.amount+depositIncome.amount;
      const olderAwards=children.filter(c=>c.awardTier && c.awardEnd && c.awardDecision).map(c=>({childId:c.id,tier:c.awardTier,endsOn:c.awardEnd,decisionDate:c.awardDecision}));
      const newborns=group.filter(c=>c.birthDate && c.birthDate<=filingDate).map(c=>({child:c,result:newbornShortcut({birthDate:c.birthDate,applicationDate:filingDate,olderAwards:olderAwards.filter(a=>a.childId!==c.id),sameRecipient:yn($('same-recipient').value),motherPregnancyBenefit:$('mother-pregnancy-benefit').checked})})).filter(x=>x.result.status==='simplified');
      const regularChildren=group.length-newborns.length;
      const tier=year===2026 && regularChildren>0 && combinedIncome!==null && pmPerson>0 && pmChild>0 && !members.unanswered.length && !children.some(c=>c.birthDate && ageAt(c.birthDate,filingDate)>=18 && ageAt(c.birthDate,filingDate)<23 && c.fullTimeStudent)
        ?childTier({income12:combinedIncome,familySize:members.included.length,childrenApplying:regularChildren,pmPerson,pmChild}):null;
      const childNumber=children.findIndex(c=>c.id===group[0]?.id)+1;
      const label=$('application-mode').value==='separate'?`Заявление на ребёнка ${childNumber} (${scenarioIndex+1} из ${scenarios.length})`:'Общее заявление';
      const benefitText=benefitUnknown.length?`Уточнить пособия: ${benefitUnknown.join('; ')}.`:`Пособия на остальных детей учтены: ${benefitResult.total.toLocaleString('ru-RU')} ₽; исключены для этого заявления: ${benefitResult.excluded.reduce((sum,p)=>sum+p.amount,0).toLocaleString('ru-RU')} ₽.`;
      const newbornText=newborns.length?`Новорождённому по действующему решению на старшего: ${newborns.map(x=>`${x.result.tier}% с ${x.result.startMonth} по ${x.result.endsOn}`).join('; ')}; без новой оценки на этот срок. Далее — обычная оценка.`:'';
      const regularText=regularChildren?`По обычной оценке ${tier?.status==='estimate'?`предварительная ступень ${tier.tier}% для остальных детей.`:tier?.status==='income-too-high'?'доход выше указанного ПМ.':'ступень пока неизвестна.'}`:'';
      return `${label}: доход ${combinedIncome===null?'нужны данные':combinedIncome.toLocaleString('ru-RU')+' ₽'}. ${benefitText} Алименты: ${alimony.status==='known'?`${alimony.amount.toLocaleString('ru-RU')} ₽`:'нужны данные ('+alimony.reason+')'}. Проценты по вкладам в доходе: ${depositIncome.status==='known'?`${depositIncome.amount.toLocaleString('ru-RU')} ₽`:'нужны данные ('+depositIncome.reason+')'}. ${newbornText} ${regularText}`;
    }).join(' '):'Отметьте хотя бы одного ребёнка для заявления.';
    if(!RULES[year]) { output.push(`<div class="result"><strong>${filingDate}</strong><span class="unknown">${familyText} ${incomeText} МРОТ на ${year} год ещё не загружен.</span></div>`); continue }
    // An entered 12-week condition is applicable only to the selected month.
    const adult={reasons,pregnancyWeeksAtApplication:i===0?Number($('weeks').value):0,income:Object.fromEntries(incomeWindow(month).map(m=>[m,[]]))};
    const result=minimumIncomeTest(adult,month,RULES[year].mrot);
    output.push(`<div class="result"><strong>${filingDate}<small> · доходы ${incomeWindow(month)[0]} — ${incomeWindow(month).at(-1)}</small></strong><span class="${result.exempt?'ok':'bad'}">${result.exempt?'Порог дохода не применяется':`Необходимый доход: ${Math.ceil(result.minimum).toLocaleString('ru-RU')} ₽`}. Засчитано причин: ${result.creditedMonths} мес. ${incomeText} ${familyText}${result.warnings.length?' '+result.warnings.join(' '):''}</span></div>`);
  }
  $('results').innerHTML=output.join('');
}
$('add').onclick=addReason;
$('add-child').onclick=addChild; $('add-car').onclick=addCar;
$('add-benefit').onclick=()=>{benefitPayments.push({childId:'',amount:'',from:'',to:''});renderBenefitRows();render()};
 $('add-property').onclick=addProperty; $('add-vehicle').onclick=addOtherVehicle; $('add-deposit').onclick=addDeposit;
 $('add-adult').onclick=()=>{if(incomePeople.length===1)incomePeople.push({label:'Супруг(а)',months:{},total:null});renderIncomeForm();render()};
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
