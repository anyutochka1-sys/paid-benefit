import { incomeWindow, minimumIncomeTest, monthIndex, monthString, RULES } from './engine.mjs';
import { includedFamily, childCanApply, checkCars, ageAt } from './family-assets.mjs';
import {incomeForMonth,childTier} from './income.mjs';
import {checkProperty,checkOtherVehicles,checkDepositInterest} from './property.mjs';
const $ = id => document.getElementById(id);
const types = [
  ['unemployment','Официальная безработица'], ['pregnancy','Беременность'],
  ['careUnderThree','Уход за ребёнком до 3 лет']
];
const incomePeople=[{label:'Заявитель',months:{},total:null}];
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
  row.innerHTML='<label>Дата рождения<input class="birth" type="date"></label><label>Очное обучение<select class="student"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label>В браке<select class="married"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label>Гражданин РФ и проживает в России<select class="citizen"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><button class="remove" type="button">Убрать</button>';
  bindRow(row); $('children').append(row); render();
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
  row.innerHTML='<label>Год получения процентов<input class="tax-year" type="number" min="2024" max="2030"></label><label>Выплачено процентов, ₽<input class="interest" type="number" min="0"></label><label>Счёт закрыт в месяце<input class="closed" type="month"></label><button class="remove" type="button">Убрать</button>';
  bindRow(row);$('deposits').append(row);render();
}
function bindRow(row) {
  row.querySelector('.remove').onclick=()=>{row.remove();render()};
  row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',render));
}
const yn = value => value==='' ? undefined : value==='yes';
function childData() {
  return [...document.querySelectorAll('#children .form-row')].map(row=>({
    role:'child',birthDate:row.querySelector('.birth').value,
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
    closedMonth:row.querySelector('.closed').value||undefined
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
    const allDepositsKnown=deposits.every(d=>d.taxYear===year-1 && Number.isFinite(d.interestForRelevantTaxYear));
    const depositCheck=allDepositsKnown&&Number($('pm-person').value)>0?checkDepositInterest(deposits,{applicationMonth:month,perCapitaMinimum:Number($('pm-person').value)}):{status:'unknown'};
    const familyText=`Учтено в этом шаге: ${members.included.length}${members.unanswered.length?' (есть неуточнённые дети)':''}. Детей, на которых можно подать: ${applicable.filter(x=>x.status==='yes').length}${applicable.some(x=>x.status==='unknown')?' (есть неуточнённые)':''}. Автомобили: ${carCheck.status==='yes'?'по этим признакам подходят':carCheck.status==='no'?carCheck.reasons.join('; '):'нужны сведения'}. Другая недвижимость: ${propertyCheck.status==='yes'?'по базовым порогам подходит':propertyCheck.status==='no'?propertyCheck.reasons.join('; '):'нужна проверка'}. Прочая техника: ${otherCheck.status==='yes'?'по базовым порогам подходит':otherCheck.status==='no'?otherCheck.reasons.join('; '):'нужна проверка'}. Вклады: ${depositCheck.status==='yes'?'по порогу процентов подходят':depositCheck.status==='no'?'превышен порог процентов':'нужны данные налогового года/ПМ'}.`;
    const incomeResult=incomeForMonth(incomePeople.map(p=>({...p,mode:$('income-mode').value,baseApplicationMonth:start})),month);
    const eligibleChildren=applicable.filter(x=>x.status==='yes').length;
    const pmPerson=Number($('pm-person').value),pmChild=Number($('pm-child').value);
    const tier=year===2026 && incomeResult.total!==null && pmPerson>0 && pmChild>0 && !members.unanswered.length && eligibleChildren && !children.some(c=>c.birthDate && ageAt(c.birthDate,filingDate)>=18 && ageAt(c.birthDate,filingDate)<23 && c.fullTimeStudent)
      ?childTier({income12:incomeResult.total,familySize:members.included.length,childrenApplying:eligibleChildren,pmPerson,pmChild}):null;
    const incomeText=incomeResult.total===null?'Для прогноза дохода нужны данные по месяцам каждого члена семьи.':`Введённый доход за окно: ${incomeResult.total.toLocaleString('ru-RU')} ₽. ${tier?.status==='estimate'?`Ступень только по введённому доходу: ${tier.tier}% (без остальных критериев).`:tier?.status==='income-too-high'?'Введённый доход выше указанного ПМ.':'Ступень не вычислена без ПМ и всех данных семьи.'}`;
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
