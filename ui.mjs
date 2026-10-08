import {pmZones,zoneValue} from './pm-zones.mjs?v=20261008-39';
import {searchableSelect,syncSearchableSelect} from './searchable-select.mjs?v=20261008-39';
import {unifiedReceiptSuggestion,receiptAmount,receiptContext,benefitMonthForReceipt} from './benefit-amounts.mjs?v=20261008-39';
import {createGuidedFlow} from './guided-flow.mjs?v=20261008-39';
import {forecastScenario} from './forecast-scenario.mjs?v=20261008-39';
import {resultCard,childLabel,monthLabel,dateLabel} from './result-card.mjs?v=20261008-39';
import {comparePriorSupport} from './prior-support.mjs';
import {applicantCapacity} from './applicant-capacity.mjs';
import {officialRate,withOfficialRates} from './cbr-rates.mjs';
let cbrRateTable=null;
import { incomeWindow, minimumIncomeTest, reasonPeriod, applicationDateForMonth, monthIndex, monthString, RULES } from './engine.mjs?v=20260930-12';
import { includedFamily, childCanApply, applicationChildren, applicantParentalRights, checkCars, ageAt, fourChildCarStatus } from './family-assets.mjs?v=20261008-39';
import {incomeForMonth,childTier,regularIncomeMonths} from './income.mjs?v=20260930-13';
import {checkProperty,checkOtherVehicles,checkDepositInterest,depositIncomeForApplication} from './property.mjs';
import {CHILD_BENEFIT_KINDS,childBenefitIncome,expandBenefitPayments} from './benefits.mjs?v=20261008-39';
import {alimonyForApplication,allocatedAlimonyIncome} from './alimony.mjs';
import {soleParentStatus} from './parental-status.mjs';
import {newbornShortcut} from './newborn.mjs?v=20260930-8';
import {maternityIncomeForApplication} from './maternity.mjs';
import {ADDITIONAL_TYPES,OTHER_BENEFIT_KINDS,additionalIncomeForApplication,foreignRateDate} from './extra-income.mjs?v=20261008-39';
import {childIncomeForApplication} from './child-income.mjs';
import {awardConflict} from './award-conflict.mjs';
import {largeFamilyGrace} from './large-family-grace.mjs';
import {pmRegions,pmAreas,pmFor} from './regional-pm.mjs?v=20261008-39';
import {pregnancyTier,pregnancyAtDate} from './pregnancy.mjs';
import {confirmedRegionalWage} from './rosstat-wages.mjs?v=20261008-39';
import {familyAssets} from './asset-owners.mjs';
import {adultStudentChecks} from './adult-student.mjs';
const $ = id => document.getElementById(id);
let restoringDraft=false;let guidedFlow=null;
for(const id of ['family-goal','guided-question']){const input=document.createElement('input');input.type='hidden';input.id=id;document.querySelector('main').append(input)}
const today=new Date();
const currentMonth=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
$('start').value=currentMonth;
const forecastSettings=document.createElement('details');forecastSettings.id='forecast-settings';forecastSettings.className='field-help';
forecastSettings.innerHTML='<summary>Дополнительно: прогноз на 2027 год</summary><label class="check"><input id="forecast-enabled" type="checkbox" checked> Показывать предварительный сценарий, если официальные суммы ещё не загружены</label><p class="hint">По умолчанию берём суммы 2026 года без увеличения. Можно задать предполагаемый рост отдельно для прожиточного минимума и МРОТ. Это ваше допущение, а не утверждённая индексация. При появлении официальных сумм используем их.</p><label>Предполагаемый рост ПМ, %<input id="forecast-pm-growth" type="number" value="0" min="-99" max="300" step="0.1"></label><label>Предполагаемый рост МРОТ, %<input id="forecast-mrot-growth" type="number" value="0" min="-99" max="300" step="0.1"></label>';
$('start').closest('label').after(forecastSettings);
forecastSettings.querySelectorAll('input').forEach(input=>input.addEventListener('input',render));
const priorSupportEntries=[];
const priorSupportPanel=document.createElement('div');
priorSupportPanel.innerHTML='<p class="hint">Укажите действующие выплаты, назначенные с оценкой дохода, в отношении вас или детей. Для каждого периода с одной суммой добавьте отдельную строку. Этот раздел для перехода с прежних выплат на единое пособие. Уже назначенное единое пособие укажите в карточке ребёнка: его продление не относим автоматически к замене прежних мер. Для иных региональных выплат сначала нужно проверить применимость правила. Заработок, маткапитал и выплаты без оценки дохода сюда не добавляйте. Ввод здесь служит только сравнению сумм; учитываемые поступления за расчётный период указываются отдельно в разделе доходов.</p><div id="prior-support-rows"></div><button type="button" id="add-prior-support">+ Добавить прежнюю выплату</button><label class="check"><input type="checkbox" id="prior-support-complete"> Перечислены все такие выплаты на меня и детей из заявления</label>';
$('prior-measure').closest('label').after(priorSupportPanel);
priorSupportPanel.hidden=true;
function renderPriorSupportRows() {
  const list=$('prior-support-rows');list.replaceChildren();
  const choices=[['applicant','Заявитель (пособие по беременности)'],...childData().map((child,i)=>[`child:${child.id}`,child.name||`Ребёнок ${i+1}`])];
  priorSupportEntries.forEach((entry,index)=>{
    const row=document.createElement('div');row.className='form-row';
    row.innerHTML='<label>Вид прежней выплаты<select class="prior-kind"><option value="">Выберите</option><option value="firstChildOld">Прежняя выплата на первого ребёнка до 3 лет</option><option value="thirdChildOld">Прежняя выплата на третьего / последующего ребёнка до 3 лет</option><option value="old3to7">Прежняя выплата от 3 до 7 лет</option><option value="old8to17">Прежняя выплата от 8 до 17 лет</option><option value="oldPregnancy">Прежнее пособие беременной до введения единого</option><option value="unified">Уже назначенное единое пособие — продление</option><option value="regionalOther">Иная региональная / другая выплата — нужно проверить</option></select></label><label>Название в решении о назначении<input class="prior-name"></label><label>В отношении кого назначена<select class="prior-target"><option value="">Выберите</option></select></label><label>Назначена с оценкой среднедушевого дохода?<select class="prior-assessed"><option value="">Уточните</option><option value="yes">Да, по условиям выплаты</option><option value="no">Нет</option></select></label><label>Ежемесячная сумма, ₽<input class="prior-amount" type="number" min="0" step="0.01"></label><label>Назначена с месяца<input class="prior-from" type="month"></label><label>По месяц включительно<input class="prior-to" type="month"></label><button class="remove" type="button">Убрать</button>';
    for(const [value,label] of choices)row.querySelector('.prior-target').add(new Option(label,value));
    for(const [selector,key] of [['.prior-kind','kind'],['.prior-name','name'],['.prior-target','target'],['.prior-assessed','incomeAssessed'],['.prior-amount','monthly'],['.prior-from','from'],['.prior-to','to']]) {
      const input=row.querySelector(selector);input.value=entry[key]??'';
      input.oninput=()=>{entry[key]=key==='monthly'?(input.value===''?null:Number(input.value)):input.value;$('prior-support-complete').checked=false;render()};
    }
    row.querySelector('.remove').onclick=()=>{priorSupportEntries.splice(index,1);$('prior-support-complete').checked=false;renderPriorSupportRows();render()};
    list.append(row);
  });
}
$('add-prior-support').onclick=()=>{priorSupportEntries.push({name:'',target:'',monthly:null,from:'',to:'',incomeAssessed:'',kind:''});$('prior-support-complete').checked=false;renderPriorSupportRows();render()};
$('prior-support-complete').addEventListener('input',render);
$('prior-measure').addEventListener('input',()=>{priorSupportPanel.hidden=$('prior-measure').value!=='yes';renderPriorSupportRows();render()});
function priorSupportFor(targets,month,newMonthly,jointContextUnresolved=false) {
  return comparePriorSupport({answer:$('prior-measure').value,entries:priorSupportEntries,complete:$('prior-support-complete').checked,targets,knownTargets:['applicant',...childData().map(child=>`child:${child.id}`)],applicationMonth:month,newMonthly,jointContextUnresolved});
}

function updatePmSelection() {
  const year=Number($('start').value.slice(0,4));
  const region=$('pm-region'),area=$('pm-area');
  const oldRegion=region.value,oldArea=area.value;
  region.replaceChildren(new Option('Выберите регион',''));
  pmRegions(year).forEach(r=>region.add(new Option(r.name,r.code)));
  if([...region.options].some(o=>o.value===oldRegion))region.value=oldRegion;
  area.replaceChildren(new Option('Выберите территорию или группу',''));
  const areaYear=year===2027&&pmFor(year,region.value,oldArea).reason?.includes('ещё не загружены')?2026:year;
  const zones=pmZones(areaYear,region.value);
  zones.forEach(zone=>{const option=new Option(zone.label,zone.value);option.dataset.search=zone.areas.join(' ');option.dataset.composition=zone.composition;option.dataset.source=zone.source;option.dataset.act=zone.act;area.add(option)});
  area.value=zoneValue(zones,oldArea);
  syncSearchableSelect(region);syncSearchableSelect(area);
  area.closest('label').hidden=area.options.length===1;
  if(region.value!==oldRegion){alimonyWageRecords.clear();lastWageRegion=region.value;renderAlimonyWageYears()}
  render();
}
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
benefitsSection.innerHTML='<div class="section-heading"><h3>Пособия на детей, которые уже получали</h3><button id="add-benefit" type="button">+ Указать выплату</button></div><p class="hint">Укажите вид, ребёнка и фактически полученную сумму по месяцам. Разовую доплату за прошлые периоды укажите одной строкой в месяце поступления. Прежнее единое пособие на ребёнка в новом заявлении исключается, на другого ребёнка обычно учитывается. Не добавляйте эти суммы также к зарплате или другим пособиям.</p><div id="benefits"></div>';
$('income-people').after(benefitsSection);
const alimonySection=document.createElement('section');
alimonySection.innerHTML='<h3>Семейное положение и алименты</h3><label>Семейное положение на дату заявления<select id="marital-status"><option value="">Выберите</option><option value="never">В браке никогда не состояла</option><option value="married">Состою в браке (в том числе повторном)</option><option value="divorced">В разводе, новый брак не заключён</option><option value="widowed">Вдова</option></select></label><label id="spouse-status-field" hidden>Статус нынешнего супруга на дату заявления<select id="spouse-status"><option value="unknown">Уточните</option><option value="ordinary">Входит в состав семьи</option><option value="parentalRightsLost">Лишён / ограничен в правах на ребёнка из заявления</option><option value="stateCare">На полном государственном обеспечении</option><option value="conscript">Служба по призыву / военный курсант без контракта</option><option value="imprisoned">Отбывает лишение свободы</option><option value="forcedTreatment">На принудительном лечении по решению суда</option><option value="custody">Заключён под стражу</option><option value="missing">Признан безвестно отсутствующим / объявлен умершим</option><option value="wanted">Находится в розыске</option></select></label><div id="alimony-fields" hidden><label>Алименты на детей фактически поступали?<select id="alimony-received"><option value="no">Нет</option><option value="yes">Да</option></select></label><div id="alimony-actual-fields" hidden><label>Общая сумма от этого плательщика за месяц, ₽<input id="alimony-monthly" type="number" min="0"></label><label>С какого месяца поступали<input id="alimony-from" type="month"></label><label>По какой месяц включительно<input id="alimony-to" type="month"></label></div><div id="alimony-divorced-fields" hidden><label>Месяц расторжения брака<input id="divorce-month" type="month"></label><label>Основание для алиментов на детей<select id="alimony-kind"><option value="">Выберите</option><option value="court">Есть решение суда</option><option value="court-order">Есть судебный приказ</option><option value="bailiffs">Есть исполнительное производство у приставов</option><option value="notary">Нотариальное соглашение</option><option value="informal">Устная договорённость / не оформлены</option></select></label><label id="notary-amount-field" hidden>Ежемесячная сумма по нотариальному соглашению, ₽<input id="notary-amount" type="number" min="0"></label><p class="hint">Сумму указывайте на всех детей этого плательщика вместе. Если платят разные родители, добавьте следующего плательщика ниже: детей распределим автоматически.</p><div id="alimony-wage-fields"><label>Применимая окончательная средняя зарплата Росстата в регионе, ₽<input id="alimony-wage" type="number" min="0"></label><label class="check"><input id="alimony-final" type="checkbox"> Проверена окончательная годовая публикация Росстата, действующая в месяц обращения</label></div></div></div><p class="hint">Расчётный минимум алиментов применяется только при статусе «в разводе» и отсутствии судебного акта; новый зарегистрированный брак меняет статус. Если вы никогда не были замужем, минимум не вменяется, но полученные алименты учитываются. Единственный родитель и семейное положение — разные вопросы. Не включайте алименты повторно в зарплату.</p>';
const mainPayerSummary=document.createElement('p');mainPayerSummary.id='main-payer-summary';mainPayerSummary.className='hint';alimonySection.querySelector('#alimony-fields').prepend(mainPayerSummary);
const documentHelp=document.createElement('details');documentHelp.className='field-help';
documentHelp.innerHTML='<summary>Как узнать, какой у меня документ?</summary><p><strong>Судебный приказ</strong> — вверху документа так и написано. Судья выдаёт его по документам, без судебного заседания.</p><p><strong>Решение суда</strong> — документ с названием «Решение», принятый после рассмотрения иска. Для этого калькулятора оба варианта учитываются одинаково.</p><p><strong>Исполнительное производство</strong> — приставы уже открыли дело о взыскании алиментов. Выберите этот вариант, если знаете о деле у приставов, но не знаете название судебного документа.</p><p class="hint"><a href="https://epp.genproc.gov.ru/ru/proc_71/activity/legal-education/explain/e5650290/" target="_blank" rel="noopener">Разъяснение прокуратуры о судебном приказе</a></p>';
alimonySection.querySelector('#alimony-kind').closest('label').after(documentHelp);
const primaryChildChoices=document.createElement('div');primaryChildChoices.className='alimony-children';mainPayerSummary.after(primaryChildChoices);
const alimonyAllocation=new Map();
const extraAlimonyObligations=[];
const extraObligationsPanel=document.createElement('div');
extraObligationsPanel.innerHTML='<div class="section-heading"><h4>Алименты от другого родителя</h4><button type="button" class="add-obligation">+ Добавить другого плательщика</button></div><p class="hint">Если алименты платят разные родители, добавьте каждого отдельно. Выбранные здесь дети автоматически исключаются из суммы первого плательщика. Несколько документов на одного плательщика требуют отдельной проверки.</p><div class="obligation-rows"></div>';
alimonySection.querySelector('#alimony-fields').append(extraObligationsPanel);
function primaryAlimonyControl(id) {return [...document.querySelectorAll('#children .form-row')].find(row=>row.dataset.childId===id)?.querySelector('.alimony-applies')}
function syncAlimonyChildren() {
  for(const item of extraAlimonyObligations)for(const id of item.childIds){
    const control=primaryAlimonyControl(id);if(!control)continue;
    item.primarySelection??={};if(!(id in item.primarySelection))item.primarySelection[id]=control.checked;
    control.checked=false;
  }
}
function restorePrimaryAlimony(item,id) {
  if(extraAlimonyObligations.some(other=>other.childIds.includes(id)))return;
  const control=primaryAlimonyControl(id);if(control)control.checked=item.primarySelection?.[id]??true;
  if(item.primarySelection)delete item.primarySelection[id];
}
function renderExtraAlimonyObligations() {
  const list=extraObligationsPanel.querySelector('.obligation-rows');list.replaceChildren();
  const children=childData();
  extraAlimonyObligations.forEach((item,index)=>{
    const row=document.createElement('div');row.className='form-row';
    row.innerHTML='<strong>Плательщик '+(index+2)+'</strong><div class="obligation-children"><span>На каких детей платит этот родитель?</span></div><label>Основание<select class="kind"><option value="">Выберите</option><option value="court">Решение суда</option><option value="court-order">Судебный приказ</option><option value="bailiffs">Исполнительное производство</option><option value="notary">Нотариальное соглашение</option><option value="informal">Не оформлены</option></select></label><label class="actual-amount">Фактически поступало за месяц, ₽<input class="monthly" type="number" min="0" step="any"></label><label class="from-field">С какого месяца<input class="from" type="month"></label><label class="to-field">По какой месяц включительно<input class="to" type="month"></label><label class="notary-field">Ежемесячная сумма по соглашению, ₽<input class="notary" type="number" min="0" step="any"></label><label class="check">Это другой плательщик, не указанный выше или в других строках<input class="distinct-payer" type="checkbox"></label><button class="remove" type="button">Убрать</button>';
    const choices=row.querySelector('.obligation-children');
    children.forEach((child,i)=>{
      const label=document.createElement('label');label.className='check';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=item.childIds.includes(child.id);
      checkbox.disabled=!checkbox.checked&&extraAlimonyObligations.some(other=>other!==item&&other.childIds.includes(child.id));
      checkbox.addEventListener('input',()=>{
        if(checkbox.checked){item.childIds=[...item.childIds,child.id];syncAlimonyChildren()}
        else {item.childIds=item.childIds.filter(id=>id!==child.id);restorePrimaryAlimony(item,child.id)}
        renderExtraAlimonyObligations();render();
      });
      label.append(checkbox,document.createTextNode(' '+(child.name||`Ребёнок ${i+1}`)));choices.append(label);
    });
    for(const [key,selector] of [['arrangement','.kind'],['monthly','.monthly'],['from','.from'],['to','.to'],['notaryMonthly','.notary']]) {
      const input=row.querySelector(selector);input.value=item[key]??'';
      input.addEventListener('input',()=>{item[key]=input.value;toggle();render()});
    }
    row.querySelector('.distinct-payer').checked=item.distinctPayer===true;
    row.querySelector('.distinct-payer').addEventListener('input',e=>{item.distinctPayer=e.target.checked;render()});
    const toggle=()=>{row.querySelector('.notary-field').hidden=item.arrangement!=='notary'||$('marital-status').value!=='divorced'};
    row.querySelector('.remove').onclick=()=>{extraAlimonyObligations.splice(index,1);item.childIds.forEach(id=>restorePrimaryAlimony(item,id));renderExtraAlimonyObligations();render()};
    list.append(row);toggle();
  });
}
extraObligationsPanel.querySelector('.add-obligation').onclick=()=>{
  sourceEnabled.add('alimony');sourceSection.querySelector('input[value="alimony"]').checked=true;
  extraAlimonyObligations.push({childIds:[],arrangement:'',monthly:'',from:'',to:'',notaryMonthly:'',distinctPayer:true});
  renderExtraAlimonyObligations();render();
};
const alimonySplit=document.createElement('details');
alimonySplit.innerHTML='<summary>Алименты приходили на детей с разным статусом?</summary><p class="hint">Если одни дети входят в состав семьи, а другие нет, укажите сумму на каждого за месяц. Общая сумма должна совпасть с указанной выше. Для судебного акта и иных случаев без расчётного минимума учтём только суммы на детей из состава семьи. При нотариальном соглашении или неоформленных алиментах после развода укажите отдельные обязательства ниже; если одно обязательство охватывает включённых и исключённых детей, вывод остаётся открытым.</p><div class="alimony-split-rows"></div>';
alimonySection.querySelector('#alimony-actual-fields').append(alimonySplit);
function renderAlimonyAllocationRows() {
  const list=alimonySplit.querySelector('.alimony-split-rows');list.replaceChildren();
  childData().filter(child=>child.alimonyApplies).forEach((child,i)=>{
    const label=document.createElement('label');label.textContent=`Алименты на ${child.name||`ребёнка ${i+1}`}, ₽ в месяц`;
    const input=document.createElement('input');input.type='number';input.min='0';input.step='any';input.value=alimonyAllocation.get(child.id)??'';
    input.addEventListener('input',()=>{if(input.value==='')alimonyAllocation.delete(child.id);else alimonyAllocation.set(child.id,Number(input.value));render()});
    label.append(input);list.append(label);
  });
}
const alimonyWageRecords=new Map(),wageFields=alimonySection.querySelector('#alimony-wage-fields');
let rosstatAnnualTable=null,lastWageRegion='';
function wageRecordFor(year) {
  const manual=alimonyWageRecords.get(year);
  if(manual)return manual;
  const code=$('pm-region').value;
  const name=pmRegions(2026).find(region=>region.code===code)?.name;
  const automatic=confirmedRegionalWage(rosstatAnnualTable,year,code,name);
  return automatic.status==='known'?automatic:null;
}
function renderAlimonyWageYears() {
  const year=Number(($('start').value||currentMonth).slice(0,4));
  wageFields.innerHTML='<p class="hint">Среднюю зарплату для расчёта алиментов подставляем сами по выбранному региону. Искать её и вводить вручную не нужно. На будущие месяцы расчёт уточнится после выхода новых официальных данных.</p><div class="wage-auto-summary"></div><details class="wage-manual"><summary>Проверить источник или уточнить данные</summary><p class="hint">Используем окончательные годовые значения Росстата, опубликованные СФР. Предварительные данные не заменяют окончательные.</p><a href="https://sfr.gov.ru/grazhdanam/semyam_s_detmi/edinoe_posobie/ocenka/" target="_blank" rel="noopener">Официальная таблица СФР</a></details>';

  for(const y of [year-2,year-1,year]) {
    const record=wageRecordFor(y)||{},row=document.createElement('div');row.className='form-row';row.dataset.year=String(y);
    row.innerHTML=`<strong>За ${y} год</strong><label>Средняя зарплата региона, ₽<input class="wage-amount" type="number" min="0"></label><label>Месяц публикации окончательных данных Росстата<input class="wage-published" type="month"></label><label class="check"><input class="wage-final" type="checkbox"> Это окончательные годовые данные</label>`;
    row.querySelector('.wage-amount').value=record.amount??'';
    row.querySelector('.wage-published').value=record.publishedMonth||'';
    row.querySelector('.wage-final').checked=record.final===true;
    if(record.final&&record.amount){const line=document.createElement('p');line.className='hint';line.textContent=y+' год: '+record.amount.toLocaleString('ru-RU')+' ₽ — подставлено автоматически';wageFields.querySelector('.wage-auto-summary').append(line)}
    wageFields.querySelector('.wage-manual').append(row);
  }
}
renderAlimonyWageYears();
wageFields.addEventListener('input',e=>{const row=e.target.closest('.form-row');if(!row)return;const year=Number(row.dataset.year);alimonyWageRecords.set(year,{year,amount:row.querySelector('.wage-amount').value===''?null:Number(row.querySelector('.wage-amount').value),publishedMonth:row.querySelector('.wage-published').value,final:row.querySelector('.wage-final').checked});render()});
benefitsSection.after(alimonySection);
const maternitySection=document.createElement('section');
maternitySection.innerHTML='<div class="section-heading"><h3>Декретные — пособие по беременности и родам</h3><button id="add-maternity" type="button">+ Внести декретные</button></div><p class="hint">Вводите всю сумму разовой выплаты отдельно от зарплаты. Она распределяется по месяцам начисления, а не учитывается целиком в месяце поступления. Для обычного периода выставлено 5 месяцев; при продлении уточните срок по документу.</p><div id="maternity-payments"></div>';
benefitsSection.after(maternitySection);
const maternityPayments=[];
const additionalEntries=[];
const sourceEnabled=new Set();
const sourceSection=document.createElement('section');
sourceSection.className='source-picker';
const sourceGroups=[
  ['Чаще всего',[['employment','Зарплата до декрета или сейчас, работа по договору'],['pension','Пенсия / больничный'],['unemploymentBenefit','Пособие по безработице'],['otherBenefit','Пособие по уходу по месту работы и другие выплаты'],['childBenefit','Единое пособие и пособие по уходу для неработающего'],['alimony','Алименты'],['deposit','Проценты по вкладам'],['lottery','Выигрыш в лотерею']]],
  ['Другие поступления',[['childIncome','Доходы детей'],['maternity','Пособие по беременности и родам (БиР) — разовая выплата'],['selfEmployed','Самозанятость'],['business','ИП'],['scholarship','Стипендия'],['academicMedical','Выплата в медакадемическом отпуске'],['guardianReward','Вознаграждение приёмного родителя'],['successorPayment','Выплата правопреемнику'],['publicDuty','Компенсация за общественные обязанности'],['military','Денежное довольствие'],['rationCompensation','Компенсация вместо пайка'],['judgeAllowance','Содержание судьи в отставке'],['serviceSeverance','Выплата при увольнении со службы'],['rent','Аренда'],['propertySale','Продажа имущества'],['securities','Ценные бумаги / дивиденды'],['copyright','Авторские выплаты'],['foreignEarned','Заработок в иностранной валюте'],['foreignOther','Другой доход за пределами РФ']]]
];
sourceSection.innerHTML='<h3>Какие поступления были в семье?</h3><p class="hint">Сначала отметьте все виды дохода, которые были у семьи в расчётном периоде. Затем нажмите «Далее: суммы доходов» и заполните суммы и месяцы по каждому выбранному виду. Если поступлений не было, отметьте это ниже.</p>'+sourceGroups.map(([title,items])=>`<fieldset><legend>${title}</legend><div class="source-grid">${items.map(([key,label])=>`<label class="check"><input type="checkbox" value="${key}"> ${label}</label>`).join('')}</div></fieldset>`).join('')+'<label class="check"><input id="no-income" type="checkbox"> Никаких поступлений из перечисленных не было</label>';
const excludedIncomeInfo=document.createElement('details');
excludedIncomeInfo.innerHTML='<summary>Что не нужно вносить в доход?</summary><p class="hint">Если выплата точно подпадает под одно из исключений ниже, её сумму вводить не нужно. Если сомневаетесь в основании выплаты, отметьте «Другие пособия» и выберите «Не уверена» — результат останется открытым.</p><ul><li><strong>Маткапитал:</strong> номинал сертификата и перевод средств на погашение ипотеки, оплату жилья или учёбы не вводите как зарплату либо пособие: это распоряжение сертификатом, а не полученный заработок. Не вводите ежемесячную выплату из капитала на ребёнка до 3 лет и средства регионального маткапитала. Пункт 53 отдельно перечисляет федеральные средства на адаптацию ребёнка с инвалидностью, строительство или реконструкцию ИЖС и реконструкцию дома блокированной застройки. Если деньги поступили вам на счёт по другой схеме и вы не уверены в основании, уточните решение СФР.</li><li><strong>Детские выплаты:</strong> прежнее единое пособие на ребёнка из нового заявления; отдельные прежние выплаты за прошлые периоды на того же ребёнка; пособия и алименты на ребёнка вне состава семьи или достигшего 18 лет, с учётом возможного регионального правила до 23 лет. Такие поступления указывайте в специальных разделах для детей и алиментов, чтобы калькулятор проверил условия сам.</li><li><strong>Целевая помощь:</strong> социальный контракт; подтверждённые целевые средства на покупку недвижимости, транспорта или техники, израсходованные на эту цель; помощь при ЧС или теракте и на лечение ребёнка; целевые гранты и субсидии ИП. Если грант уже включён в выручку ИП, укажите его только в разделе ИП для вычета без повтора.</li><li><strong>Мобилизованный член семьи:</strong> если подтверждён призыв по Указу № 647, отметьте это ниже в раскрывающемся вопросе. Его личные заработок и другие доходы за расчётный период вводить не нужно; денежное довольствие военнослужащего по контракту сюда не относится.</li><li><strong>Другие исключения:</strong> возврат НДФЛ по вычету, пособие на погребение, выплата по уходу за ребёнком с инвалидностью, государственные поощрения родителей, установленные Правилами страховые возмещения и расходы на реабилитацию, компенсация средств реабилитации, питания ребёнка с ОВЗ дома и целевые средства на ремонт дома семьи погибшего кормильца.</li></ul><details><summary>Редкие исключения и условия</summary><ul><li>Доплата единого пособия беременной за прошлые периоды; отдельные прежние детские выплаты по Указам № 606 и № 175 и пособие по уходу для неработающего — за прошлые периоды на ребёнка из заявления; прежняя выплата на первого ребёнка из заявления и старое пособие 8–17 лет.</li><li>Доходы в виде процентов по номинальному счёту ребёнка под опекой; выплаты и алименты на умершего, объявленного умершим или признанного безвестно отсутствующим ребёнка.</li><li>Ежемесячная помощь жителям определённых территорий Курской области в связи с утратой имущества первой необходимости; единовременное возмещение вреда жизни и здоровью военнослужащим, участникам добровольческих формирований и сотрудникам перечисленных служб либо их семьям в связи с боевыми действиями.</li><li>Компенсация изготовления и установки надгробного памятника; ежегодная компенсация содержания и ветеринарного обслуживания собаки-проводника; целевые федеральные средства на ремонт дома семьи погибшего кормильца.</li></ul><p class="hint">Основание, получателя и период каждой такой выплаты сверяйте по решению о назначении. Перечень меняется при изменении Правил.</p></details><p class="hint">У помощи работодателя при рождении исключается только подтверждённая необлагаемая часть — её укажите в «Других пособиях». Полный перечень и условия: <a href="https://www.consultant.ru/document/cons_doc_LAW_434753/0f3a9ac1b53968ba1a801a920535924bcfcab577/" target="_blank" rel="noopener">пункт 53 Правил № 2330</a>.</p>';
sourceSection.append(excludedIncomeInfo);
const incomePanel=$('income-people').closest('.panel');
incomePanel.querySelector('#income-mode').closest('label').before(sourceSection);
const mobilizationSection=document.createElement('details');
mobilizationSection.innerHTML='<summary>Если член семьи призван по мобилизации</summary><p class="hint">Только призыв по Указу № 647 от 21.09.2022, подтверждённый документом. Срочная служба и контракт сами по себе сюда не относятся. Укажите, чей статус подтверждён; его зарплата, отдельные доходы, БиР и проценты по счетам не попадут в сумму. Детские выплаты и алименты без ясного получателя, а также правило минимального дохода потребуют проверки.</p><label class="check"><input id="mobilized-applicant" type="checkbox"> Заявитель призван по мобилизации</label><label class="check"><input id="mobilized-spouse" type="checkbox"> Нынешний супруг призван по мобилизации</label>';
sourceSection.after(mobilizationSection);
mobilizationSection.querySelectorAll('input').forEach(input=>input.addEventListener('input',render));
const extraSection=document.createElement('section');
extraSection.innerHTML='<div class="section-heading"><h3>Другие доходы</h3><label>Повторить вид<select id="extra-add-type"></select></label><button id="add-extra" type="button">+ Ещё период</button></div><p class="hint">Поля для отмеченных видов уже добавлены ниже. Заполните сумму и период по каждому виду. Кнопка «Ещё период» нужна, если по тому же виду были разные суммы или получатели. Ежемесячную сумму укажите для месяцев поступления, а годовую для ИП, аренды, продажи имущества, ценных бумаг и авторских выплат — за налоговый год. Продажу недвижимости вводите по налоговой базе. Исключённые выплаты из списка выше вводить не нужно. Если вид выплаты неясен, выберите «Не уверена» — калькулятор не выдаст уверенный вывод. Материальную помощь работодателя при рождении укажите отдельно: исключается только подтверждённая необлагаемая часть. Пенсия по потере кормильца, если её получает учитываемый член семьи, относится к пенсиям.</p><div id="extra-entries"></div>';
maternitySection.after(extraSection);
const childIncomeEntries=[];
const childIncomeSection=document.createElement('section');
childIncomeSection.innerHTML='<div class="section-heading"><h3>Доходы детей</h3><button id="add-child-income" type="button">+ Период дохода</button></div><p class="hint">Зарплата несовершеннолетнего и компенсация за государственные/общественные обязанности могут исключаться, если ребёнок учился очно не меньше 6 месяцев расчётного периода (п. 52¹). Для ребёнка 18–22 лет, входящего в состав семьи, укажите месяцы очной учёбы в его карточке, а зарплату и стипендию — здесь: его минимальный доход проверяется отдельно. Пока не подтверждены учёба или достаточный доход, вывод остаётся открытым.</p><div id="child-income-entries"></div>';
extraSection.after(childIncomeSection);
function renderChildIncomeRows() {
  $('child-income-entries').replaceChildren();
  const childOptions=childData().map((child,index)=>({id:child.id,label:document.querySelector(`[data-child-id="${child.id}"] .child-name`)?.value||`Ребёнок ${index+1}`}));
  childIncomeEntries.forEach((entry,index)=>{
    const row=document.createElement('div');row.className='form-row';
    row.innerHTML='<label>Кто получил<select class="child"><option value="">Выберите ребёнка</option></select></label><label>Вид<select class="type"><option value="employment">Зарплата / ГПХ</option><option value="scholarship">Стипендия</option><option value="publicDutyCompensation">Компенсация за государственные обязанности</option><option value="other">Другой учитываемый доход</option></select></label><label>За месяц, ₽<input class="amount" type="number" min="0"></label><label>С месяца<input class="from" type="month"></label><label>По месяц<input class="to" type="month"></label><label class="birthday-income-date">Если доход пришёл в месяц 18-летия, укажите дату получения<input class="receipt-date" type="date"></label><button class="remove" type="button">Убрать</button>';
    childOptions.forEach(child=>row.querySelector('.child').add(new Option(child.label,child.id)));
    for(const [selector,key] of [['.child','childId'],['.type','type'],['.amount','amount'],['.from','from'],['.to','to']]) {
      const input=row.querySelector(selector);input.value=entry[key]??'';
      input.oninput=()=>{entry[key]=key==='amount'?(input.value===''?null:Number(input.value)):input.value;if(['childId','from','to'].includes(key))toggleBirthdayDate();render()};
    }
    const dateInput=row.querySelector('.receipt-date');dateInput.value=entry.receiptDate||'';
    dateInput.oninput=()=>{entry.receiptDate=dateInput.value;render()};
    const toggleBirthdayDate=()=>{
      const child=childData().find(c=>c.id===entry.childId);
      const birthdayMonth=child?.birthDate?`${Number(child.birthDate.slice(0,4))+18}-${child.birthDate.slice(5,7)}`:'';
      const relevant=!!birthdayMonth&&!!entry.from&&!!entry.to&&entry.from<=birthdayMonth&&birthdayMonth<=entry.to;
      row.querySelector('.birthday-income-date').hidden=!relevant;
      if(!relevant){entry.receiptDate='';dateInput.value=''}
    };
    toggleBirthdayDate();
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
    row.innerHTML=`<label>Кто получил<select class="person"><option value="0">Заявитель</option><option value="1">Супруг(а)</option></select></label><strong>${ADDITIONAL_TYPES[entry.type].label}</strong><label class="benefit-kind-field">Какое именно пособие?<select class="benefit-kind"><option value="">Выберите вид</option></select></label><label>${entry.type==='securities'?'Доход до расходов':['foreignEarned','foreignOther'].includes(entry.type)?'Сумма за месяц в указанной валюте':'Сумма, ₽'}<input class="amount" type="number" min="0" step="any"></label><label class="expenses-field">Расходы по операциям, ₽<input class="expenses" type="number" min="0"></label><label class="tax-field">Налоговый год<input class="tax-year" type="number" min="2024" max="2030"></label><label class="from-field">С какого месяца<input class="from" type="month"></label><label class="to-field">По какой месяц включительно<input class="to" type="month"></label><label class="birth-aid-field">Выплачено в течение первого года после рождения / усыновления / установления опеки?<select class="first-year"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label class="tax-free-field">Какая часть не облагалась НДФЛ, ₽<input class="tax-free" type="number" min="0"></label><div class="foreign-field"><label>Буквенный код валюты (например, RUB или USD)<input class="currency" maxlength="3" placeholder="USD"></label><label>Дата курса ЦБ<input class="rate-date" type="date"></label><label>Курс ЦБ: рублей за 1 единицу валюты<input class="rate" type="number" min="0" step="any"></label><p class="hint foreign-rate-hint"></p></div><button class="remove" type="button">Убрать</button>`;
    const businessFields=document.createElement('div');businessFields.className='business-fields';
    businessFields.innerHTML='<label>Как определена сумма ИП?<select class="business-basis"><option value="">Уточните</option><option value="usnGross">УСН «доходы»: годовая выручка без вычета расходов</option><option value="usnDocumented">УСН «доходы»: выручка и подтверждённые расходы</option><option value="documentedOther">Другой режим: готовая сумма дохода по налоговым документам</option></select></label><label class="business-expense-field">Расходы за налоговый год, ₽<input class="business-expenses" type="number" min="0" step="any"></label><label class="business-confirm-field check"><input class="business-confirm" type="checkbox"> Смогу представить документы о доходах за вычетом расходов</label><details class="business-grant-field"><summary>В годовой выручке есть целевая субсидия или грант на предпринимательство?</summary><label>Сколько из указанной выручки составляет такая поддержка, ₽<input class="business-grant" type="number" min="0" step="any"></label><label class="check"><input class="grant-confirm" type="checkbox"> Подтвержу целевое назначение и документы о получении</label><label class="grant-expense-field check"><input class="grant-expense-confirm" type="checkbox"> Указанные выше расходы не включают затраты, оплаченные из этих средств</label></details><p class="hint">Сверьте суммы с декларацией и КУДиР. Для УСН «доходы» расходы вычитаются при представлении документов в СФР. Целевую поддержку укажите здесь лишь если она уже вошла в общую выручку; не добавляйте её повторно. <a href="https://www.nalog.gov.ru/rn77/taxation/taxes/usn/" target="_blank" rel="noopener">Разъяснение ФНС об УСН</a>.</p>';
    row.querySelector('.remove').before(businessFields);
    Object.entries(OTHER_BENEFIT_KINDS).filter(([key])=>['counted','employerBirthAid','uncertain'].includes(key)).forEach(([key,kind])=>row.querySelector('.benefit-kind').add(new Option(kind.label,key)));
    row.querySelector('.person').value=String(entry.personIndex);
    row.querySelector('.amount').value=entry.amount??'';
    row.querySelector('.expenses').value=entry.expenses??'';
    row.querySelector('.tax-year').value=entry.taxYear??'';
    row.querySelector('.from').value=entry.from||'';
    row.querySelector('.to').value=entry.to||'';
    row.querySelector('.benefit-kind').value=entry.benefitKind||'';
    row.querySelector('.first-year').value=entry.birthAidFirstYear===undefined?'':entry.birthAidFirstYear?'yes':'no';
    row.querySelector('.tax-free').value=entry.taxExemptAmount??'';
    row.querySelector('.business-basis').value=entry.businessBasis||'';
    row.querySelector('.business-expenses').value=entry.type==='business'?entry.expenses??'':'';
    row.querySelector('.business-confirm').checked=entry.expensesDocumented===true;
    row.querySelector('.business-grant').value=entry.targetedBusinessSupportAmount??'';
    row.querySelector('.grant-confirm').checked=entry.targetedBusinessSupportDocumented===true;
    row.querySelector('.grant-expense-confirm').checked=entry.expensesExcludeGrantCosts===true;
    row.querySelector('.currency').value=entry.currency||'';
    row.querySelector('.rate-date').value=entry.rateDate||'';
    row.querySelector('.rate').value=entry.rublesPerUnit??'';
    if(['foreignEarned','foreignOther'].includes(entry.type)) {
      const date=foreignRateDate($('start').value),quoted=date.slice(8)+'.'+date.slice(5,7)+'.'+date.slice(0,4);
      const link=document.createElement('a');link.href=`https://www.cbr.ru/currency_base/daily/?UniDbQuery.Posted=True&UniDbQuery.To=${quoted}`;link.target='_blank';link.rel='noopener';link.textContent=`Посмотреть курс ЦБ на ${quoted}`;
      row.querySelector('.foreign-rate-hint').replaceChildren(link,document.createTextNode('. Если сумма получена в рублях, укажите RUB: курс не нужен. Иначе при курсе за 10 или 100 единиц разделите его на это число. Для другого месяца подачи дата курса изменится.'));
    }
    const updateOfficialRate=()=>{
      if(!['foreignEarned','foreignOther'].includes(entry.type))return;
      const official=officialRate(cbrRateTable,$('start').value,entry.currency);
      row.querySelector('.rate-date').readOnly=!!official;row.querySelector('.rate').readOnly=!!official;
      row.querySelector('.rate-date').value=official?.rateDate||entry.rateDate||'';
      row.querySelector('.rate').value=official?.rublesPerUnit??entry.rublesPerUnit??'';
      let status=row.querySelector('.official-rate-status');
      if(!status){status=document.createElement('p');status.className='hint official-rate-status';row.querySelector('.foreign-field').append(status)}
      status.hidden=entry.currency==='RUB';
      status.textContent=official?`Курс ЦБ подставлен автоматически: ${official.rublesPerUnit} ₽ за 1 ${entry.currency}. Действует на ${official.rateDate}, опубликован на ${official.effectiveDate}. Для каждого месяца прогноза используется свой курс.`:'Автоматический курс на эту дату пока отсутствует. Можно внести официальный курс вручную; будущие курсы появятся после публикации ЦБ.';
    };
    const toggle=()=>{updateOfficialRate();const annual=ADDITIONAL_TYPES[entry.type].period==='annual',birthAid=entry.type==='otherBenefit'&&entry.benefitKind==='employerBirthAid',kind=entry.type==='otherBenefit'?entry.benefitKind:'',foreign=['foreignEarned','foreignOther'].includes(entry.type);row.querySelector('.tax-field').hidden=!annual;row.querySelector('.from-field').hidden=annual;row.querySelector('.to-field').hidden=annual;row.querySelector('.expenses-field').hidden=entry.type!=='securities';row.querySelector('.benefit-kind-field').hidden=entry.type!=='otherBenefit';row.querySelector('.birth-aid-field').hidden=!birthAid;row.querySelector('.tax-free-field').hidden=!birthAid||entry.birthAidFirstYear!==true;row.querySelector('.foreign-field').hidden=!foreign;row.querySelector('.rate-date').closest('label').hidden=entry.currency==='RUB';row.querySelector('.rate').closest('label').hidden=entry.currency==='RUB';row.querySelector('.foreign-rate-hint').hidden=entry.currency==='RUB';businessFields.hidden=entry.type!=='business';row.querySelector('.business-expense-field').hidden=entry.businessBasis!=='usnDocumented';row.querySelector('.business-confirm-field').hidden=entry.businessBasis!=='usnDocumented';row.querySelector('.business-grant-field').hidden=false;row.querySelector('.grant-expense-field').hidden=entry.businessBasis!=='usnDocumented';};
    row.querySelector('.business-basis').oninput=e=>{entry.businessBasis=e.target.value;toggle();render()};
    row.querySelector('.business-expenses').oninput=e=>{entry.expenses=e.target.value===''?null:Number(e.target.value);render()};
    row.querySelector('.business-confirm').oninput=e=>{entry.expensesDocumented=e.target.checked;render()};
    row.querySelector('.business-grant').oninput=e=>{entry.targetedBusinessSupportAmount=e.target.value===''?null:Number(e.target.value);render()};
    row.querySelector('.grant-confirm').oninput=e=>{entry.targetedBusinessSupportDocumented=e.target.checked;render()};
    row.querySelector('.grant-expense-confirm').oninput=e=>{entry.expensesExcludeGrantCosts=e.target.checked;render()};
    row.querySelector('.first-year').oninput=e=>{entry.birthAidFirstYear=e.target.value===''?undefined:e.target.value==='yes';toggle();render()};
    for(const [selector,key] of [['.person','personIndex'],['.benefit-kind','benefitKind'],['.tax-free','taxExemptAmount'],['.currency','currency'],['.rate-date','rateDate'],['.rate','rublesPerUnit'],['.amount','amount'],['.expenses','expenses'],['.tax-year','taxYear'],['.from','from'],['.to','to']])
      row.querySelector(selector).oninput=e=>{entry[key]=['personIndex','amount','expenses','taxYear','taxExemptAmount','rublesPerUnit'].includes(key)?e.target.value===''?null:Number(e.target.value):key==='currency'?e.target.value.toUpperCase():e.target.value;toggle();render()};
    row.querySelector('.remove').onclick=()=>{additionalEntries.splice(index,1);renderExtraRows();render()};
    $('extra-entries').append(row);toggle();
  });
}
$('add-extra').onclick=()=>{const type=$('extra-add-type').value;if(!type)return;additionalEntries.push({personIndex:0,type,amount:null,taxYear:null,from:'',to:'',rateDate:['foreignEarned','foreignOther'].includes(type)?foreignRateDate($('start').value):''});renderExtraRows();render()};
sourceSection.querySelectorAll('input[type="checkbox"]').forEach(box=>box.onchange=()=>{
  if(box.id==='no-income') {
    if(box.checked) sourceSection.querySelectorAll('input:not(#no-income)').forEach(other=>{other.checked=false;sourceEnabled.delete(other.value)});
  } else {
    if(box.checked){sourceEnabled.add(box.value);$('no-income').checked=false;
      if(ADDITIONAL_TYPES[box.value]&&!additionalEntries.some(e=>e.type===box.value))additionalEntries.push({personIndex:0,type:box.value,amount:null,taxYear:null,from:'',to:'',rateDate:box.value==='foreignEarned'?foreignRateDate($('start').value):''});
    } else sourceEnabled.delete(box.value);
  }
  $('income-people').hidden=!sourceEnabled.has('employment');
  $('income-mode').closest('label').hidden=!sourceEnabled.has('employment');
  extraSection.hidden=![...sourceEnabled].some(key=>ADDITIONAL_TYPES[key]);
  childIncomeSection.hidden=!sourceEnabled.has('childIncome');
  benefitsSection.hidden=!sourceEnabled.has('childBenefit');
  maternitySection.hidden=!sourceEnabled.has('maternity');
  if(box.checked&&box.value==='childBenefit'&&!benefitPayments.length){benefitPayments.push({childId:'',amount:'',from:'',to:'',amountMode:'automatic'});renderBenefitRows()}
  if(box.checked&&box.value==='maternity'&&!maternityPayments.length){maternityPayments.push({personIndex:0,amount:null,startMonth:'',chargedMonths:5});renderMaternityRows()}
  if(box.checked&&box.value==='deposit'&&!$('deposits').children.length)addDeposit();
  if(box.checked&&box.value==='childIncome'&&!childIncomeEntries.length)$('add-child-income').click();
  if(box.checked&&box.value==='alimony'){$('alimony-received').value='yes';refreshMaritalForm()}
  if(box.checked&&box.value==='employment'){
    incomePeople.forEach(person=>{person.regularFrom ||= incomeMonths()[0];person.regularTo ||= currentMonth});
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
    row.innerHTML='<label>Кто получил<select class="person"><option value="0">Заявитель</option><option value="1">Супруг(а)</option></select></label><label>Вся сумма декретных, ₽<input class="amount" type="number" min="0"></label><label>Первый месяц отпуска по беременности и родам<input class="start" type="month"></label><label>За сколько месяцев начислено<input class="months" type="number" min="1" max="12"></label><button type="button" class="remove">Убрать</button>';
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
  const start=monthIndex($('start').value||currentMonth);
  return Array.from({length:23},(_,i)=>monthString(start-13+i));
}
function renderIncomeForm() {
  const mode=$('income-mode').value;
  $('income-people').replaceChildren();
  incomePeople.forEach((person,index)=>{
    const section=document.createElement('section'); section.className='income-person';
    const title=document.createElement('h3'); title.textContent=index===0?'Ваша зарплата':'Зарплата супруга'; section.append(title);
    person.incomeType='employment';
    const typeHint=document.createElement('p');typeHint.className='hint';typeHint.textContent='Зарплата и вознаграждение по договору ГПХ, начислено до НДФЛ';section.append(typeHint);
    if(mode==='period') {
      const wrapper=document.createElement('div');wrapper.className='form-row';
      wrapper.innerHTML='<label>Одинаковая сумма за месяц, ₽<input class="regular-amount" type="number" min="0" step="0.01"></label><label>С месяца<input class="regular-from" type="month"></label><label>По месяц включительно<input class="regular-to" type="month"></label><label class="check forecast-option"><input class="project-future" type="checkbox"> Учитывать такую же зарплату в будущие месяцы указанного периода<span class="hint">Для примерного расчёта следующих месяцев подачи: калькулятор добавит ожидаемую зарплату за будущие месяцы этого периода. Отметьте, если ожидаете ту же сумму. Если заработок закончится или изменится, уточните сумму и период. Уже полученные доходы эта отметка не меняет.</span></label>';
      for(const [selector,key] of [['.regular-amount','regularAmount'],['.regular-from','regularFrom'],['.regular-to','regularTo']]) {
        const input=wrapper.querySelector(selector);input.value=person[key]??'';
        input.oninput=()=>{person[key]=key==='regularAmount'?(input.value===''?null:Number(input.value)):input.value;render()};
      }
      wrapper.querySelector('.project-future').checked=person.projectFuture===true;
      wrapper.querySelector('.project-future').oninput=e=>{person.projectFuture=e.target.checked;render()};
      const zero=document.createElement('button');zero.type='button';zero.className='remove salary-zero';zero.textContent='В этом периоде зарплаты не было — поставить 0';zero.onclick=()=>{person.regularAmount=0;wrapper.querySelector('.regular-amount').value='0';render()};
      wrapper.append(zero);
      const periodHelp=document.createElement('p');periodHelp.className='hint';periodHelp.textContent='Укажите только месяцы с этой суммой. Если вы ушли в декрет и зарплата прекратилась, закончите период последним месяцем начисления зарплаты. Пособие по уходу укажите отдельно.';wrapper.append(periodHelp);
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
        const label=document.createElement('label'); label.textContent=monthLabel(month,true);
        const input=document.createElement('input'); input.type='number'; input.min='0'; input.dataset.incomeMonth=month; input.placeholder='Не знаю'; input.value=person.months[month]??'';
        input.addEventListener('input',()=>{if(input.value==='')delete person.months[month];else person.months[month]=Number(input.value);render()});
        label.append(input); grid.append(label);
      }); details.append(grid);section.append(details);
    }
    if(index>0&&$('marital-status').value!=='married') {const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='Убрать';remove.onclick=()=>{incomePeople.splice(index,1);renderIncomeForm();render()};section.append(remove)}
    $('income-people').append(section);
  });
  $('add-adult').disabled=incomePeople.length>1;
}
function addReason() {
  const row = document.createElement('div'); row.className='reason';
  row.innerHTML=`<label>У кого была причина<select class="person"><option value="0">Заявитель</option><option value="1">Супруг(а)</option></select></label><label>Причина<select class="type">${types.map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>С месяца<input class="from" type="month"></label><label>По месяц<input class="to" type="month"></label><label class="check"><input class="registered" type="checkbox"> Состоял(а) на учёте в ЦЗН</label><label class="care-relationship" hidden>За кем ухаживали?<select><option value="">Уточните родство и основание</option><option value="eligible">За членом семьи заявителя из предусмотренных законом категорий; подтвержу документами</option><option value="ineligible">За другим человеком</option></select><small>С 21.07.2026 для ухода за взрослым нужен член семьи из категорий ч. 2 ст. 10 закона № 400-ФЗ. <a href="https://sfr.gov.ru/branches/orel/news~2026/07/21/283040" target="_blank" rel="noopener">Пояснение СФР</a>.</small></label><p class="hint period-review" role="status"></p><p class="hint service-help">Для службы и лишения свободы включите в даты не более трёх месяцев после окончания. Основание и период должны подтверждаться документами.</p><button class="remove" type="button">Убрать</button>`;
  row.querySelector('.remove').onclick=()=>{row.remove();render()};
  row.querySelector('.type').onchange=()=>{row.querySelector('.check').hidden=row.querySelector('.type').value!=='unemployment';row.querySelector('.care-relationship').hidden=row.querySelector('.type').value!=='careDisabledAdult';row.querySelector('.service-help').hidden=!['military','incarceration'].includes(row.querySelector('.type').value);render()};
  row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',render));
  $('reasons').append(row); row.querySelector('.type').dispatchEvent(new Event('change'));
}
function addChild() {
  const row=document.createElement('div'); row.className='form-row';
  row.dataset.childId=`child-${nextChildId++}`;
  row.innerHTML='<label>Имя или обозначение ребёнка<input class="child-name" type="text" placeholder="Например, старший"></label><label>Ваше отношение к ребёнку<select class="child-role"><option value="child">Родитель / усыновитель</option><option value="ward">Опекун / попечитель</option></select></label><label>Дата рождения<input class="birth" type="date"></label><details><summary>Дополнительные обстоятельства ребёнка</summary><label>Дата смерти, если ребёнок умер<input class="death" type="date"></label><label>Особый статус для состава семьи<select class="child-family-status"><option value="ordinary">Нет</option><option value="stateCare">На полном государственном обеспечении</option><option value="conscript">Военная служба по призыву / курсант без контракта</option><option value="imprisoned">Отбывает лишение свободы</option><option value="forcedTreatment">Принудительное лечение по решению суда</option><option value="custody">Заключён под стражу</option><option value="missing">Признан безвестно отсутствующим / объявлен умершим</option><option value="wanted">Находится в розыске</option></select></label><label>Учёба для проверки дохода несовершеннолетнего<select class="education-status"><option value="">Уточните, если был доход ребёнка</option><option value="school">Школа / колледж / вуз очно</option><option value="none">Не обучался</option><option value="additional">Только дополнительные программы</option></select></label><label>Очная учёба с месяца<input class="education-from" type="month"></label><label>По месяц включительно<input class="education-to" type="month"></label></details><label class="check"><input class="applying" type="checkbox" checked> Подаю на этого ребёнка</label><label class="check"><input class="alimony-applies" type="checkbox" checked> Алименты на этого ребёнка — от первого плательщика</label><label>Статус второго родителя этого ребёнка<select class="second-parent-status"><option value="">Уточните</option><option value="recorded">Указан в записи о рождении</option><option value="blank">Не указан в записи о рождении</option><option value="mother-statement">Записан по заявлению матери</option><option value="dead">Умер</option><option value="declared-dead">Объявлен умершим судом</option><option value="missing">Признан безвестно отсутствующим</option><option value="imprisoned">Лишён свободы</option><option value="deprived-rights">Лишён родительских прав</option></select></label><details><summary>Уже назначено пособие на этого ребёнка?</summary><label>Кому назначено сейчас<select class="award-recipient"><option value="unknown">Уточните</option><option value="none">Никому</option><option value="self">Заявителю</option><option value="other">Другому законному представителю</option></select></label><label>Если другому: суд определил место жительства ребёнка с заявителем?<select class="court-residence"><option value="">Уточните</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label>Размер действующего пособия<select class="award-tier"><option value="">Не назначено / не знаю</option><option value="50">50%</option><option value="75">75%</option><option value="100">100%</option></select></label><label>Дата последнего решения<input class="award-decision" type="date"></label><label>Действует по<input class="award-end" type="date"></label></details><label>Очное обучение<select class="student"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label>В браке<select class="married"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label>Гражданин РФ и проживает в России<select class="citizen"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><button class="remove" type="button">Убрать</button>';
  const rightsField=document.createElement('label');
  rightsField.textContent='Вы как заявитель лишены или ограничены судом в родительских правах на этого ребёнка?';
  rightsField.innerHTML+='<select class="applicant-rights"><option value="">Выберите</option><option value="intact">Нет</option><option value="restricted">Ограничена / ограничен</option><option value="lost">Лишена / лишён</option></select>';
  row.querySelector('.applying').closest('label').after(rightsField);
  const updateRightsField=()=>{rightsField.hidden=row.querySelector('.child-role').value==='ward'||!row.querySelector('.applying').checked};
  row.querySelector('.child-role').addEventListener('input',updateRightsField);
  row.querySelector('.applying').addEventListener('input',updateRightsField);
  updateRightsField();
  organizeChildCard(row);
  row.querySelector(':scope > .remove').onclick=()=>{row.remove();renderBenefitRows();renderChildIncomeRows();renderAlimonyAllocationRows();renderExtraAlimonyObligations();render()};
  row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{renderBenefitRows();renderChildIncomeRows();renderAlimonyAllocationRows();renderExtraAlimonyObligations();refreshMaritalForm()}));
  $('children').append(row); guidedFlow?.childAdded(row); renderBenefitRows(); renderChildIncomeRows();renderAlimonyAllocationRows();renderExtraAlimonyObligations(); render();
}
function renderBenefitRows() {
  const childOptions=[...document.querySelectorAll('#children .form-row')].map((row,i)=>({id:row.dataset.childId,label:row.querySelector('.child-name').value||`Ребёнок ${i+1}`}));
  $('benefits').replaceChildren();
  benefitPayments.forEach((payment,index)=>{
    const row=document.createElement('div');row.className='form-row';
    const kindSelect=document.createElement('select');
    const oldKind=!['unified','nonworkingCare'].includes(payment.kind||'unified');
    const historicalLabel=document.createElement('label');historicalLabel.className='check';const historical=document.createElement('input');historical.type='checkbox';historical.checked=payment.historical??oldKind;
    historicalLabel.append(historical,document.createTextNode(' Это доплата по старой выплате за прошлые периоды'));row.append(historicalLabel);
    const fillKinds=()=>{kindSelect.replaceChildren();Object.entries(CHILD_BENEFIT_KINDS).filter(([key])=>historical.checked||['unified','nonworkingCare'].includes(key)).forEach(([key,definition])=>kindSelect.add(new Option(key==='nonworkingCare'?'Пособие по уходу до 1,5 лет для неработающего':definition.label,key)))};fillKinds();
    historical.oninput=()=>{payment.historical=historical.checked;if(!historical.checked&&!['unified','nonworkingCare'].includes(payment.kind)){payment.historicalKind=payment.kind;payment.kind='unified'}else if(historical.checked&&payment.historicalKind)payment.kind=payment.historicalKind;renderBenefitRows();render()};
    kindSelect.value=payment.kind||'unified';
    const kindLabel=document.createElement('label');kindLabel.textContent='Вид пособия';kindLabel.append(kindSelect);row.append(kindLabel);
    const pastLabel=document.createElement('label');pastLabel.textContent='Выплата за прошлые периоды?';
    const pastSelect=document.createElement('select');
    [['','Выберите'],['yes','Да'],['no','Нет']].forEach(([key,label])=>pastSelect.add(new Option(label,key)));
    pastSelect.value=payment.forPastPeriods===undefined?'':payment.forPastPeriods?'yes':'no';
    pastLabel.append(pastSelect);row.append(pastLabel);
    const togglePast=()=>{pastLabel.hidden=!['decree606','decree175','nonworkingCare'].includes(kindSelect.value)};
    kindSelect.addEventListener('input',()=>{payment.kind=kindSelect.value;renderBenefitRows();render()});
    pastSelect.addEventListener('input',()=>{payment.forPastPeriods=pastSelect.value===''?undefined:pastSelect.value==='yes';render()});
    togglePast();
    const regionalDetails=document.createElement('details');
    regionalDetails.innerHTML='<summary>Если ребёнку 18–22 года к дате заявления</summary><label>На эту выплату распространяется региональная норма до 23 лет?<select><option value="">Уточните</option><option value="no">Нет</option><option value="yes">Да, подтвержу основание</option></select></label><p class="hint">Уточните условия именно этой выплаты в вашем регионе. Если не знаете, оставьте вопрос открытым: сумма не попадёт в точный вывод.</p>';
    const regionalSelect=regionalDetails.querySelector('select');
    regionalSelect.value=payment.regionalPaymentThrough23===undefined?'':payment.regionalPaymentThrough23?'yes':'no';
    regionalSelect.addEventListener('input',()=>{payment.regionalPaymentThrough23=regionalSelect.value===''?undefined:regionalSelect.value==='yes';render()});
    row.append(regionalDetails);
    const select=document.createElement('select');
    const placeholder=new Option('Выберите ребёнка','');select.add(placeholder);
    childOptions.forEach(c=>select.add(new Option(c.label,c.id)));
    select.value=payment.childId;
    const toggleRegional=()=>{const child=childData().find(child=>child.id===select.value);regionalDetails.hidden=!child?.birthDate||ageAt(child.birthDate,applicationDateForMonth(monthString(monthIndex($('start').value||currentMonth)+11),1))<18;};
    select.addEventListener('input',()=>{payment.childId=select.value;toggleRegional();render()});toggleRegional();
    select.className='benefit-child';const childLabel=document.createElement('label');childLabel.textContent='Кому назначено пособие';childLabel.append(select);row.append(childLabel);
    const automatic=(payment.kind||'unified')==='unified'&&payment.amountMode==='automatic';
    if((payment.kind||'unified')==='unified'){
      const modeLabel=document.createElement('label');modeLabel.textContent='Как указать сумму пособия?';
      const mode=document.createElement('select');mode.className='benefit-amount-mode';mode.add(new Option('Подставить по региону и году','automatic'));mode.add(new Option('Ввести полученную сумму самостоятельно','manual'));mode.value=automatic?'automatic':'manual';
      mode.oninput=()=>{payment.amountMode=mode.value;renderBenefitRows();render()};modeLabel.append(mode);row.append(modeLabel);
    }
    if(automatic){
      const sameLabel=document.createElement('label');sameLabel.textContent='Пособие получали в том же регионе и населённом пункте, где подаёте сейчас?';
      const same=document.createElement('select');same.className='benefit-same-region';[['','Выберите'],['yes','Да'],['no','Нет, получали в другом месте']].forEach(([v,t])=>same.add(new Option(t,v)));same.value=payment.sameRegion||'';same.oninput=()=>{payment.sameRegion=same.value;payment.receiptsConfirmed=false;renderBenefitRows();render()};sameLabel.append(same);row.append(sameLabel);
      if(payment.sameRegion==='no'){
        const label=document.createElement('label');label.textContent='Регион, в котором получали пособие';const select=document.createElement('select');select.add(new Option('Выберите регион',''));pmRegions(2026).forEach(r=>select.add(new Option(r.name,r.code)));select.className='benefit-region';select.value=payment.benefitRegion||'';select.oninput=()=>{payment.benefitRegion=select.value;payment.benefitAreas={};payment.receiptsConfirmed=false;renderBenefitRows();render()};label.append(select);row.append(label);searchableSelect(select,{label:'Регион, в котором получали пособие'});
      }
      const tierLabel=document.createElement('label');tierLabel.textContent='Какой размер пособия был назначен?';const tier=document.createElement('select');tier.className='benefit-tier';[['','Выберите'],['50','50%'],['75','75%'],['100','100%']].forEach(([v,t])=>tier.add(new Option(t,v)));tier.value=String(payment.tier||'');tier.oninput=()=>{payment.tier=tier.value;payment.receiptsConfirmed=false;renderBenefitRows();render()};tierLabel.append(tier);row.append(tierLabel);
      const note=document.createElement('p');note.className='hint';note.textContent='Период ниже — месяцы, когда деньги поступили. По обычному графику единое пособие приходит за предыдущий месяц: в январе — за декабрь по прежней сумме, с февраля — за январь по новой. При смене назначенного процента добавьте отдельный период.';row.append(note);
    }
    const monthlyPreview=document.createElement('div');monthlyPreview.className='benefit-monthly-preview';monthlyPreview.style.gridColumn='1 / -1';
    for(const [key,label,type] of [['amount','Полученная сумма за каждый указанный месяц, ₽','number'],['from','С месяца получения','month'],['to','По месяц получения включительно','month']]) {
      const wrapper=document.createElement('label');wrapper.textContent=label;
      const input=document.createElement('input');input.type=type;input.className='benefit-'+key;if(type==='number'){input.min='0';input.step='0.01';}input.value=payment[key]??'';
      wrapper.hidden=key==='amount'&&automatic;
      input.addEventListener('input',()=>{payment[key]=input.value;if(automatic){payment.receiptsConfirmed=false;fillPreview()}const forecast=row.querySelector('.benefit-project-future');if(forecast)forecast.closest('label').hidden=!payment.to||payment.to<=currentMonth;render()});wrapper.append(input);row.append(wrapper);
    }
    row.append(monthlyPreview);
    function fillPreview(){
      monthlyPreview.replaceChildren();if(!automatic||!/^\d{4}-\d{2}$/.test(payment.from||'')||!/^\d{4}-\d{2}$/.test(payment.to||'')||payment.from>payment.to)return;
      const first=monthIndex(payment.from),last=monthIndex(payment.to);if(last-first>59){monthlyPreview.textContent='Укажите период не длиннее 5 лет.';return;}
      const months=Array.from({length:last-first+1},(_,i)=>monthString(first+i));const context={region:$('pm-region').value,area:$('pm-area').value};
      const code=payment.sameRegion==='yes'?context.region:payment.benefitRegion;
      for(const year of [...new Set(months.map(m=>Number(benefitMonthForReceipt(m).slice(0,4))))]){
        const areas=pmZones(year,code);const current=payment.benefitAreas?.[year]??(payment.sameRegion==='yes'?context.area:payment.benefitArea);
        if(areas.length&&pmFor(year,code,current).status!=='known'){
          const label=document.createElement('label');label.textContent='Территория, по которой назначено пособие за '+year+' год?';const locality=document.createElement('select');locality.add(new Option('Выберите населённый пункт или район',''));areas.forEach(zone=>{const option=new Option(zone.label,zone.value);option.dataset.search=zone.areas.join(' ');option.dataset.composition=zone.composition;option.dataset.source=zone.source;option.dataset.act=zone.act;locality.add(option)});locality.className='benefit-area';locality.value=zoneValue(areas,payment.benefitAreas?.[year]||'');locality.oninput=()=>{payment.benefitAreas??={};payment.benefitAreas[year]=locality.value;payment.receiptsConfirmed=false;fillPreview();render()};label.append(locality);monthlyPreview.append(label);searchableSelect(locality,{label:'Территория получения пособия в '+year+' году',placeholder:'Введите город, район или название группы'});
        }

      }
      const groups=[];for(const receiptMonth of months){const amount=unifiedReceiptSuggestion(payment,receiptMonth,context);const last=groups.at(-1);if(last&&last.amount===amount)last.months.push(receiptMonth);else groups.push({amount,months:[receiptMonth]})}
      for(const group of groups){const line=document.createElement('p');line.className='hint';line.textContent='Поступления: '+monthLabel(group.months[0])+(group.months.length>1?' — '+monthLabel(group.months.at(-1)):'')+' · '+(group.amount!=null?group.amount.toLocaleString('ru-RU')+' ₽ за обычный месяц поступления':'сумму нужно уточнить вручную: официальные данные за месяц начисления не загружены');monthlyPreview.append(line)}
      const receiptHelp=document.createElement('p');receiptHelp.className='hint';receiptHelp.textContent='Сверьте с фактическими поступлениями. Если декабрьскую выплату перечислили досрочно в декабре, укажите её там вместе с другими поступлениями, а в январе — 0, если денег не было. При первом назначении или доплате сумма может отличаться от обычного графика — исправьте её в месяце получения.';monthlyPreview.append(receiptHelp);
      const detail=document.createElement('details');detail.innerHTML='<summary>Проверить и изменить суммы по месяцам</summary><p class="hint">Подставлен обычный размер за предыдущий месяц. Доплаты, досрочную выплату, пропуски и первую выплату после назначения укажите в месяце фактического получения. Пустое поле означает, что сумму ещё нужно уточнить.</p>';
      for(const month of months){const label=document.createElement('label');label.textContent=monthLabel(month)+' · обычно за '+monthLabel(benefitMonthForReceipt(month))+' · ₽';const input=document.createElement('input');input.type='number';input.min='0';input.step='0.01';input.value=Object.hasOwn(payment.receiptOverrides||{},month)?payment.receiptOverrides[month]:unifiedReceiptSuggestion(payment,month,context)??'';input.dataset.receiptMonth=month;input.oninput=()=>{payment.receiptOverrides??={};payment.receiptOverrides[month]=input.value;reset.hidden=false;render()};label.append(input);detail.append(label);const reset=document.createElement('button');reset.type='button';reset.className='remove';reset.textContent='Вернуть сумму по региону';reset.hidden=!Object.hasOwn(payment.receiptOverrides||{},month);reset.onclick=()=>{delete payment.receiptOverrides[month];input.value=unifiedReceiptSuggestion(payment,month,context)??'';payment.receiptsConfirmed=false;const confirmation=monthlyPreview.querySelector('.benefit-receipts-confirmed');if(confirmation)confirmation.checked=false;reset.hidden=true;render()};label.append(reset)}monthlyPreview.append(detail);
      const check=document.createElement('label');check.className='check';const box=document.createElement('input');box.type='checkbox';box.className='benefit-receipts-confirmed';box.checked=payment.receiptsConfirmed===true&&payment.confirmedContext===receiptContext(payment,context);box.oninput=()=>{payment.receiptsConfirmed=box.checked;payment.confirmedContext=receiptContext(payment,context);render()};check.append(box,document.createTextNode(' Проверила: суммы соответствуют поступлениям в указанные месяцы'));monthlyPreview.append(check);
    }
    fillPreview();
    const forecastLabel=document.createElement('label');forecastLabel.className='check forecast-option';forecastLabel.hidden=!payment.to||payment.to<=currentMonth;
    const forecastInput=document.createElement('input');forecastInput.type='checkbox';forecastInput.className='benefit-project-future';forecastInput.checked=payment.projectFuture===true;
    forecastInput.addEventListener('input',()=>{payment.projectFuture=forecastInput.checked;render()});
    forecastLabel.append(forecastInput,document.createTextNode(automatic?' Ожидаю получать пособие в будущие месяцы этого периода по указанному проценту':' Предполагаю такую же сумму пособия в будущие месяцы указанного периода'));const forecastHelp=document.createElement('span');forecastHelp.className='hint';forecastHelp.textContent='Для примерного расчёта следующих месяцев подачи: калькулятор учтёт ожидаемые поступления за будущие месяцы указанного периода. Отметьте, если планируете получать это пособие дальше. В автоматическом режиме используем выбранный процент пособия, при ручном вводе — указанную сумму. Уже полученные выплаты эта отметка не меняет.';forecastLabel.append(forecastHelp);row.append(forecastLabel);
    const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='Убрать';remove.onclick=()=>{benefitPayments.splice(index,1);renderBenefitRows();render()};row.append(remove);
    $('benefits').append(row);
  });
}
function benefitRowsForWindow(applicationMonth) {
  return expandBenefitPayments(benefitPayments,applicationMonth,{knownThrough:currentMonth,amountForMonth:(entry,month)=>receiptAmount(entry,month,{region:$('pm-region').value,area:$('pm-area').value})});
}
function addCar() {
  const row=document.createElement('div'); row.className='form-row';
  row.innerHTML='<label>Владелец<select class="owner"><option value="applicant">Заявитель</option><option value="spouse">Нынешний супруг</option></select></label><label>Год выпуска<input class="year" type="number" min="1950" max="2030"></label><label>Мощность, л. с.<input class="hp" type="number" min="1"></label><label>Получен при четырёх детях?<select class="acquired"><option value="">Выберите</option><option value="yes">Да</option><option value="no">Нет</option></select></label><label class="check"><input class="excluded" type="checkbox"> Под арестом / в розыске / запрет регистрационных действий</label><button class="remove" type="button">Убрать</button>';
  if($('asset-car'))$('asset-car').checked=true;if($('assets-none'))$('assets-none').checked=false;
  bindRow(row); $('cars').append(row); render();
}
function addProperty(requestedType) {
  const row=document.createElement('div');row.className='form-row';
  row.innerHTML='<label>Владелец<select class="owner"><option value="applicant">Заявитель</option><option value="spouse">Нынешний супруг</option></select></label><label>Вид<select class="type"><option value="apartment">Квартира</option><option value="house">Дом</option><option value="garden">Садовый дом</option><option value="nonresidential">Нежилое помещение / здание / сооружение</option><option value="garage">Гараж / машино-место</option><option value="land">Участок</option></select></label><label class="area-field">Площадь, м²<input class="area" type="number" min="0"></label><label class="land-field">Площадь, га<input class="hectares" type="number" min="0" step="0.001"></label><label>Сумма долей семьи в объекте, %<input class="share" type="number" min="0" max="100" value="100"></label><details><summary>Исключения для этого объекта</summary><label class="check"><input class="supported" type="checkbox"> Предоставлен как целевая господдержка или полностью оплачен ею (без маткапитала)</label><label class="check"><input class="excluded" type="checkbox"> Под арестом или запретом регистрации</label><label class="check"><input class="uninhabitable" type="checkbox"> Квартира признана непригодной для проживания</label><label class="check"><input class="severe-illness" type="checkbox"> В квартире живёт член семьи с заболеванием из установленного перечня</label><label class="check"><input class="agricultural" type="checkbox"> Земля сельхозназначения с оборотом по отдельному закону</label><label class="check"><input class="far-east" type="checkbox"> Дальневосточный / арктический гектар</label><label class="check"><input class="auxiliary" type="checkbox"> Хозяйственная постройка на ИЖС / ЛПХ / садовом участке либо общее имущество</label></details><button class="remove" type="button">Убрать</button>';
  if(typeof requestedType==='string')row.querySelector('.type').value=requestedType;
  if($('asset-'+row.querySelector('.type').value))$('asset-'+row.querySelector('.type').value).checked=true;
  if($('assets-none'))$('assets-none').checked=false;
  bindRow(row); const toggle=()=>{const type=row.querySelector('.type').value;row.querySelector('.area-field').hidden=!['apartment','house'].includes(type);row.querySelector('.land-field').hidden=type!=='land';render()}; row.querySelector('.type').addEventListener('input',toggle);
  $('properties').append(row);toggle();
}
function addOtherVehicle() {
  const row=document.createElement('div');row.className='form-row';
  row.innerHTML='<label>Владелец<select class="owner"><option value="applicant">Заявитель</option><option value="spouse">Нынешний супруг</option></select></label><label>Вид<select class="type"><option value="motorcycle">Мотоцикл</option><option value="boat">Маломерное судно</option><option value="machine">Самоходная машина</option></select></label><label class="year-field">Год выпуска<input class="year" type="number" min="1950" max="2030"></label><label class="check"><input class="excluded" type="checkbox"> Под арестом / в розыске / запрет действий</label><button class="remove" type="button">Убрать</button>';
  bindRow(row); row.querySelector('.type').addEventListener('input',()=>{row.querySelector('.year-field').hidden=row.querySelector('.type').value==='motorcycle';render()});row.querySelector('.year-field').hidden=true;
  if($('asset-vehicle'))$('asset-vehicle').checked=true;if($('assets-none'))$('assets-none').checked=false;
  $('other-vehicles').append(row);render();
}
function addDeposit() {
  const row=document.createElement('div');row.className='form-row';
  row.innerHTML='<label>Владелец<select class="owner"><option value="applicant">Заявитель</option><option value="spouse">Нынешний супруг</option></select></label><label>Год получения процентов<input class="tax-year" type="number" min="2024" max="2030"></label><label>Выплачено процентов, ₽<input class="interest" type="number" min="0"></label><label>Счёт закрыт в месяце<input class="closed" type="month"></label><label class="check"><input class="nominal" type="checkbox"> Номинальный счёт ребёнка под опекой</label><button class="remove" type="button">Убрать</button>';
  bindRow(row);$('deposits').append(row);render();
}
function bindRow(row) {
  row.querySelector('.remove').onclick=()=>{row.remove();render()};
  row.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',render));
}
function refreshAssetOwners() {
  const options=[['applicant','Заявитель'],['spouse','Нынешний супруг'],
    ...[...document.querySelectorAll('#children .form-row')].map((row,index)=>[`child:${row.dataset.childId}`,row.querySelector('.child-name').value||`Ребёнок ${index+1}`])];
  document.querySelectorAll('#cars .owner,#properties .owner,#other-vehicles .owner,#deposits .owner').forEach(select=>{
    const selected=select.value;
    const available=options.some(([value])=>value===selected)?options:[...options,[selected,'Ребёнок удалён — уточните владельца']];
    if([...select.options].length===available.length && [...select.options].every((option,index)=>option.value===available[index][0]&&option.textContent===available[index][1]))return;
    select.replaceChildren(...available.map(([value,label])=>new Option(label,value)));
    select.value=selected;
  });
}
const yn = value => value==='' ? undefined : value==='yes';
function childData() {
  return [...document.querySelectorAll('#children .form-row')].map(row=>({
    id:row.dataset.childId,name:row.querySelector('.child-name').value,role:row.querySelector('.child-role').value,familyStatus:row.querySelector('.child-family-status').value,birthDate:row.querySelector('.birth').value,deathDate:row.querySelector('.death').value,educationStatus:row.querySelector('.education-status').value,educationFrom:row.querySelector('.education-from').value,educationTo:row.querySelector('.education-to').value,
    applying:row.querySelector('.applying').checked,applicantRights:row.querySelector('.applicant-rights').value,
    alimonyApplies:row.querySelector('.alimony-applies').checked,secondParentStatus:row.querySelector('.second-parent-status').value,
    awardRecipient:row.querySelector('.award-recipient').value,courtResidence:yn(row.querySelector('.court-residence').value),
    awardTier:row.querySelector('.award-tier').value?Number(row.querySelector('.award-tier').value):undefined,
    awardDecision:row.querySelector('.award-decision').value,
    awardEnd:row.querySelector('.award-end').value,
    fullTimeStudent:yn(row.querySelector('.student').value),married:row.querySelector('.child-family-status').value==='minorMarried'?true:yn(row.querySelector('.married').value),ordinaryMinor:row.querySelector('.married').value===''&&row.querySelector('.child-family-status').value!=='minorMarried',
    russianCitizen:yn(row.querySelector('.citizen').value),livesInRussia:yn(row.querySelector('.citizen').value)
  }));
}
function carData() {
  return [...document.querySelectorAll('#cars .form-row')].filter(()=>!$('asset-car')||$('asset-car').checked).map(row=>({
    owner:row.querySelector('.owner').value,manufactureYear:row.querySelector('.year').value ? Number(row.querySelector('.year').value) : undefined,
    horsepower:row.querySelector('.hp').value ? Number(row.querySelector('.hp').value) : undefined,
    acquiredWithFourChildren:yn(row.querySelector('.acquired').value),
    seized:row.querySelector('.excluded').checked
  }));
}
function propertyData() {
  return [...document.querySelectorAll('#properties .form-row')].filter(row=>!$('asset-'+row.querySelector('.type').value)||$('asset-'+row.querySelector('.type').value).checked).map(row=>({
    owner:row.querySelector('.owner').value,type:row.querySelector('.type').value,
    area:row.querySelector('.area').value===''?undefined:Number(row.querySelector('.area').value),
    hectares:row.querySelector('.hectares').value===''?undefined:Number(row.querySelector('.hectares').value),
    familyShare:row.querySelector('.share').value===''?undefined:Number(row.querySelector('.share').value)/100,
    supported:row.querySelector('.supported').checked,seized:row.querySelector('.excluded').checked,
    uninhabitable:row.querySelector('.uninhabitable').checked,
    severeIllnessResidence:row.querySelector('.severe-illness').checked,
    agriculturalExcluded:row.querySelector('.agricultural').checked,
    farEastHectare:row.querySelector('.far-east').checked,
    auxiliaryExcluded:row.querySelector('.auxiliary').checked
  }));
}
function otherVehicleData() {
  return [...document.querySelectorAll('#other-vehicles .form-row')].filter(()=>!$('asset-vehicle')||$('asset-vehicle').checked).map(row=>({
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
  if(restoringDraft)return;
  updateRelevantFields();
  document.querySelectorAll('input[type=number]').forEach(input=>input.setAttribute('inputmode','decimal'));
  if($('income-period-note')){const months=incomeWindow($('start').value||currentMonth);$('income-period-note').textContent=`Для подачи в ${monthLabel($('start').value||currentMonth).replace(/^(январь|февраль|апрель|июнь|июль|сентябрь|октябрь|ноябрь|декабрь)/,m=>m.slice(0,-1)+'е').replace(/^март /,'марте ').replace(/^май /,'мае ').replace(/^август /,'августе ')} нужны доходы: ${monthLabel(months[0])} — ${monthLabel(months.at(-1))}. Для следующих месяцев период сдвигается: будущие суммы указывайте только как предположение.`;}
  const start=$('start').value; if (!start){guidedFlow?.refresh();return;}
  $('mobilized-spouse').closest('label').hidden=$('marital-status').value!=='married';
  refreshAssetOwners();
  for(const input of document.querySelectorAll('#prior-support-rows .prior-target')) {
    const current=input.value;input.replaceChildren(new Option('Выберите',''),new Option('Заявитель (пособие по беременности)','applicant'));
    childData().forEach((child,i)=>input.add(new Option(child.name||`Ребёнок ${i+1}`,`child:${child.id}`)));input.value=current;
  }
  const sourceComplete=sourceEnabled.size>0||$('no-income').checked;
  const children=childData(), cars=carData(), properties=propertyData(),otherVehicles=otherVehicleData(),deposits=sourceEnabled.has('deposit')?depositData():[];
  const reasons=[...document.querySelectorAll('.reason')].map(row=>({person:Number(row.querySelector('.person').value),type:row.querySelector('.type').value,start:row.querySelector('.from').value,end:row.querySelector('.to').value,registered:row.querySelector('.registered').checked,careRelationship:row.querySelector('.care-relationship select').value}));
  document.querySelectorAll('.reason').forEach(row=>{
    const check=reasonPeriod({start:row.querySelector('.from').value,end:row.querySelector('.to').value});
    row.querySelector('.period-review').textContent=check.status==='unknown'?check.reason+'. До уточнения период не засчитываем и не делаем окончательный вывод о нехватке дохода.':'';
  });
  const output=[], overview={blocked:0,clear:0,needs:0,estimated:0}, candidates=[],forecastCandidates=[];
  for(let i=0;i<12;i++) {
    const month=monthString(monthIndex(start)+i), year=Number(month.slice(0,4));
    const scenario=forecastScenario(year,pmFor(year,$('pm-region').value,$('pm-area').value),RULES[year],pmFor(2026,$('pm-region').value,$('pm-area').value),RULES[2026],{enabled:$('forecast-enabled').checked,pmGrowth:$('forecast-pm-growth').value,mrotGrowth:$('forecast-mrot-growth').value});
    const pm=scenario.pm,yearRules=scenario.rules;if(scenario.estimated)overview.estimated++;
    const pmPerson=pm.status==='known'?pm.person:null,pmChild=pm.status==='known'?pm.child:null;
    const day=Math.trunc(Math.max(1,Math.min(31,Number($('day').value)||1)));
    const filingDate=applicationDateForMonth(month,day);
    const pregnancyState=pregnancyAtDate({weeks:$('weeks').value,referenceDate:applicationDateForMonth(start,day),applicationDate:filingDate,forecastThrough:$('pregnancy-forecast-through').value,endedDate:$('pregnancy-ended').value});
    const members=includedFamily([{role:'applicant'},...($('marital-status').value==='married'?[{role:'spouse',familyStatus:$('spouse-status').value}]:[]),...children],filingDate);
    const spouseRuleExcluded=members.excluded.some(x=>x.person.role==='spouse');
    const spouseExcluded=$('marital-status').value!=='married'||spouseRuleExcluded;
    const countedAdults=incomePeople.map((person,index)=>({person,index})).filter(x=>x.index===0||!spouseExcluded);
    const applicable=children.map(child=>childCanApply(child,filingDate));
    const capacity=applicantCapacity({status:$('applicant-capacity').value,decisionDate:$('capacity-decision').value,restoredDate:$('capacity-restored').value,children,pregnancyApplying:$('pregnancy-applying').checked},filingDate);
    const capacityText=`Дееспособность заявителя: ${capacity.reason}. ${capacity.children.map(check=>`Ребёнок ${children.findIndex(child=>child.id===check.childId)+1}: ${check.reason}.`).join(' ')}`;
    const rightsChecks=children.map(applicantParentalRights);
    const rightsBlocked=rightsChecks.some(check=>check.status==='block');
    const rightsUnknown=rightsChecks.some(check=>check.status==='unknown');
    const rightsText=rightsBlocked?'Родительские права заявителя: по пункту 31(р) есть основание для отказа по соответствующему ребёнку.':rightsUnknown?'Родительские права заявителя: уточните ответ в карточке ребёнка.':'Родительские права заявителя: по указанным детям препятствий не отмечено.';
    const {fourOrMoreChildren,fourChildrenReview}=fourChildCarStatus(children,members,filingDate);
    const householdAssets=[familyAssets(cars,members),familyAssets(properties,members),familyAssets(otherVehicles,members),familyAssets(deposits,members,{includeWardIncome:true})];
    const assetsUnanswered=$('assets-none')&&(!$('assets-none').checked&&![...document.querySelectorAll('.asset-choice')].some(input=>input.checked)||assetInputsMissing().length>0);
    const assetOwnerReview=assetsUnanswered||householdAssets.some(group=>group.needsReview);
    const carCheck=checkCars(householdAssets[0].items,{applicationYear:year,multipleChildren:$('large-family').checked,disabledFamilyMember:$('disability').checked,supportVehicle:$('support-car').checked,fourOrMoreChildren,fourChildrenReview});
    const propertyCheck=checkProperty(householdAssets[1].items,{familySize:members.unanswered.length?null:members.included.length,rural:$('rural').value===''?undefined:$('rural').value==='rural',multipleChildren:$('large-family').checked,disabledFamilyMember:$('disability').checked,supportVehicle:$('support-car').checked,supportMotorcycle:$('support-motorcycle').checked});
    const otherCheck=checkOtherVehicles(householdAssets[2].items,{applicationYear:year,multipleChildren:$('large-family').checked,disabledFamilyMember:$('disability').checked,supportMotorcycle:$('support-motorcycle').checked,supportMachine:$('support-machine').checked});
    const mobilizedIndices=[...($('mobilized-applicant').checked?[0]:[]),...($('marital-status').value==='married'&&$('mobilized-spouse').checked?[1]:[])];
    const countedDeposits=householdAssets[3].items.filter(item=>!mobilizedIndices.includes(item.owner==='applicant'?0:item.owner==='spouse'?1:-1));
    const allDepositsKnown=countedDeposits.filter(d=>!d.nominalWardAccount).every(d=>d.taxYear===year-1 && Number.isFinite(d.interestForRelevantTaxYear));
    const depositCheck=allDepositsKnown&&pmPerson!==null?checkDepositInterest(countedDeposits,{applicationMonth:month,perCapitaMinimum:pmPerson}):{status:'unknown'};
    const familyText=`Учтено в этом шаге: ${members.included.length}${members.unanswered.length?' (есть неуточнённые члены семьи)':''}${$('marital-status').value==='married'&&members.unanswered.some(item=>item.person.role==='spouse')?' (уточните статус супруга)':''}${spouseRuleExcluded?' (супруг исключён по п. 46)':''}. ${assetOwnerReview?'Для одного или нескольких объектов нужно уточнить владельца или его включение в состав семьи. ':''}Детей, на которых можно подать: ${applicable.filter(x=>x.status==='yes').length}${applicable.some(x=>x.status==='unknown')?' (есть неуточнённые)':''}.`;
    const assetText=`Автомобили: ${carCheck.status==='yes'?'по этим признакам подходят':carCheck.status==='no'?carCheck.reasons.join('; '):carCheck.review?.join('; ')||'нужны сведения'}. Другая недвижимость: ${propertyCheck.status==='yes'?'по указанным объектам подходит':propertyCheck.status==='no'?propertyCheck.reasons.join('; '):propertyCheck.review?.join('; ')||'нужна проверка'}. Прочая техника: ${otherCheck.status==='yes'?'по указанным объектам подходит':otherCheck.status==='no'?otherCheck.reasons.join('; '):otherCheck.review?.join('; ')||'нужна проверка'}. Вклады: ${depositCheck.status==='yes'?'по порогу процентов подходят':depositCheck.status==='no'?'превышен порог процентов':'нужны данные налогового года/ПМ'}.`;
    const baseMonths=(person,index)=>mobilizedIndices.includes(index)||!sourceEnabled.has('employment')?Object.fromEntries(incomeWindow(month).map(m=>[m,0])):$('income-mode').value==='period'?regularIncomeMonths(person,month,{knownThrough:currentMonth,projectFuture:person.projectFuture===true}):person.months;
    const incomeResult=incomeForMonth(countedAdults.map(({person,index})=>({...person,months:baseMonths(person,index),total:mobilizedIndices.includes(index)?0:sourceEnabled.has('employment')?person.total:0,mode:mobilizedIndices.includes(index)?'monthly':sourceEnabled.has('employment')&&$('income-mode').value==='total'?'total':'monthly',baseApplicationMonth:start})),month);
    const incomeEntryReviewText=incomeResult.missing.length?'Ввод доходов требует уточнения: '+incomeResult.missing.slice(0,3).join('; ')+(incomeResult.missing.length>3?`; ещё ${incomeResult.missing.length-3} незаполненных или неверных сумм`:'')+'.':'';
    const supplemental=additionalIncomeForApplication(withOfficialRates(additionalEntries.filter(e=>sourceEnabled.has(e.type)),month,cbrRateTable),month,[...new Set([...mobilizedIndices,...(spouseExcluded?[1]:[])])]);
    const childEarnings=childIncomeForApplication(sourceEnabled.has('childIncome')?childIncomeEntries:[],children,members,month);
    const applicationSelection=applicationChildren(children,filingDate);
    const selected=applicationSelection.selected;
    const applicationSelectionText=applicationSelection.requested.length?'Дети, отмеченные для заявления: '+applicationSelection.requested.map(check=>`${childLabel(check.child,children.findIndex(child=>child.id===check.child.id))}: ${check.status==='yes'?'возраст, семейное положение, гражданство и проживание позволяют подать; остальные критерии проверяем отдельно':check.status==='unknown'?'нужно уточнить — '+check.reason:'подать нельзя — '+check.reason}`).join('; ')+'.':'';
    const scenarios=$('application-mode').value==='separate'?selected.map(c=>[c]):[selected];
    const jointRenewal=$('application-mode').value==='together'&&selected.some(c=>c.awardRecipient==='self'&&c.awardEnd?.slice(0,7)===month);
    const benefitRows=sourceEnabled.has('childBenefit')?benefitRowsForWindow(month):{payments:[],missing:[]};
    const depositIncome=pmPerson!==null?depositIncomeForApplication(countedDeposits,{applicationMonth:month,perCapitaMinimum:pmPerson}):{status:'unknown',reason:pm.reason};
    const maternityIncome=maternityIncomeForApplication(sourceEnabled.has('maternity')?maternityPayments:[],month,mobilizedIndices);
    const maritalStatus=$('marital-status').value;
    const alimonyFrom=$('alimony-from').value, alimonyTo=$('alimony-to').value;
    const alimonyMonthly=$('alimony-monthly').value;
    const receiving=sourceEnabled.has('alimony')&&$('alimony-received').value==='yes';
    const alimonyChildren=children.filter(c=>c.alimonyApplies && members.included.some(p=>p.id===c.id) && c.birthDate && ageAt(c.birthDate,filingDate)<18 && !(c.deathDate&&c.deathDate<=filingDate) && !c.married);
    const excludedAlimonyChildren=children.some(c=>c.alimonyApplies&&!alimonyChildren.includes(c));
    const ambiguousAlimonyRecipient=children.some(c=>c.alimonyApplies && (!c.birthDate || members.unanswered.some(p=>p.person.id===c.id)
      || c.birthDate && ageAt(c.birthDate,filingDate)>=18 && ageAt(c.birthDate,filingDate)<23 && members.included.some(p=>p.id===c.id)));
    const secondParent=soleParentStatus(alimonyChildren.map(c=>c.role==='ward'?{...c,secondParentStatus:'blank'}:c));
    const courtAmounts=Object.fromEntries(incomeWindow(month).map(m=>[m,receiving && alimonyFrom && alimonyTo && m>=alimonyFrom && m<=alimonyTo ? Number(alimonyMonthly) : 0]));
    const alimony=maritalStatus?alimonyForApplication({
      maritalStatus,singleParent:maritalStatus==='divorced'&&secondParent==='sole',
      arrangement:$('alimony-kind').value,divorceMonth:$('divorce-month').value,
      childrenForAlimony:alimonyChildren.length,
      declaredMonthly:$('alimony-kind').value==='notary'&&maritalStatus==='divorced'?($('notary-amount').value===''?NaN:Number($('notary-amount').value)):(receiving?(alimonyMonthly===''?NaN:Number(alimonyMonthly)):0),
      declaredByMonth:$('alimony-kind').value==='informal' && receiving && alimonyFrom && alimonyTo && alimonyMonthly!==''?courtAmounts:undefined,
      receivedByMonth:courtAmounts,wageRecords:[year-2,year-1].map(wageRecordFor).filter(Boolean)
    },month):{status:'unknown',reason:'Укажите семейное положение'};
    if(!alimonyChildren.length && !receiving) {alimony.status='known';alimony.amount=0;alimony.method='no-eligible-child'}
    if(!alimonyChildren.length && receiving && excludedAlimonyChildren && !ambiguousAlimonyRecipient) {
      alimony.status='known';alimony.amount=0;alimony.method='excluded-child';
    }
    if(!alimonyChildren.length && receiving && (!excludedAlimonyChildren || ambiguousAlimonyRecipient)) {
      alimony.status='unknown';alimony.reason='Уточните ребёнка, на которого перечислялись алименты, и возможное региональное правило до 23 лет';
    }
    if(receiving && alimonyChildren.length && excludedAlimonyChildren) {
      const actualOnly=maritalStatus!=='divorced'||['court','court-order','bailiffs'].includes($('alimony-kind').value)||secondParent==='sole';
      if(actualOnly && !ambiguousAlimonyRecipient) {
        const recipients=children.filter(c=>c.alimonyApplies).map(c=>c.id);
        Object.assign(alimony,allocatedAlimonyIncome(courtAmounts,Object.fromEntries(alimonyAllocation),recipients,alimonyChildren.map(c=>c.id),month));
      } else {alimony.status='unknown';alimony.reason=ambiguousAlimonyRecipient?'Уточните региональное правило для алиментов на ребёнка 18–22 лет':'Для неоформленных алиментов или соглашения нужны отдельные обязательства по детям; общую сумму нельзя делить автоматически'}
    }
    if(receiving && (!alimonyFrom || !alimonyTo || alimonyMonthly==='')) {alimony.status='unknown';alimony.reason='Уточните фактически поступившие алименты и период'}
    if(alimonyChildren.length && maritalStatus==='divorced' && !['court','court-order','bailiffs'].includes($('alimony-kind').value) && !['sole','other'].includes(secondParent)) {alimony.status='unknown';alimony.reason=secondParent==='mixed'?'У детей разные вторые родители: укажите отдельные алиментные обязательства; общий расчёт сейчас недоступен':'Уточните статус второго родителя у детей, указанных в алиментном обязательстве'}
    if(sourceEnabled.has('alimony')&&extraAlimonyObligations.length) {
      const used=new Set(children.filter(c=>c.alimonyApplies).map(c=>c.id));
      const amounts=[];let issue='';
      for(const [index,item] of extraAlimonyObligations.entries()) {
        const group=item.childIds.map(id=>children.find(c=>c.id===id));
        if(!item.distinctPayer || !item.childIds.length || group.some(c=>!c) || group.some(c=>used.has(c.id)) || new Set(item.childIds).size!==item.childIds.length) {
          issue=`Обязательство ${index+2}: подтвердите отдельного плательщика и укажите детей без повторов`;break;
        }
        group.forEach(c=>used.add(c.id));
        const eligible=group.filter(c=>members.included.some(p=>p.id===c.id)&&c.birthDate&&ageAt(c.birthDate,filingDate)<18);
        const uncertain=group.some(c=>!c.birthDate || members.unanswered.some(p=>p.person.id===c.id)
          || c.birthDate&&ageAt(c.birthDate,filingDate)>=18&&ageAt(c.birthDate,filingDate)<23&&members.included.some(p=>p.id===c.id));
        if(uncertain || eligible.length && eligible.length!==group.length) {
          issue=`Обязательство ${index+2}: уточните детей вне состава семьи и региональное правило до 23 лет`;break;
        }
        if(!eligible.length) {amounts.push(0);continue}
        const monthly=item.monthly===''&&item.arrangement==='notary'?0:item.monthly===''?NaN:Number(item.monthly);
        const notary=item.notaryMonthly===''?NaN:Number(item.notaryMonthly);
        if(!item.arrangement || !Number.isFinite(monthly) || monthly<0 || item.from!==''&&item.to==='' || item.to!==''&&item.from==='' || item.from&&item.to&&item.from>item.to
          || monthly>0&&(!item.from||!item.to) || item.arrangement==='notary'&&maritalStatus==='divorced'&&(!Number.isFinite(notary)||notary<0)) {
          issue=`Обязательство ${index+2}: уточните основание, сумму и месяцы поступления`;break;
        }
        const groupSecondParent=soleParentStatus(eligible.map(c=>c.role==='ward'?{...c,secondParentStatus:'blank'}:c));
        if(maritalStatus==='divorced'&&!['court','court-order','bailiffs'].includes(item.arrangement)&&!['sole','other'].includes(groupSecondParent)) {
          issue=`Обязательство ${index+2}: уточните второго родителя детей этого обязательства`;break;
        }
        const byMonth=Object.fromEntries(incomeWindow(month).map(m=>[m,item.from&&item.to&&m>=item.from&&m<=item.to?monthly:0]));
        const result=alimonyForApplication({maritalStatus,singleParent:maritalStatus==='divorced'&&groupSecondParent==='sole',arrangement:item.arrangement,
          divorceMonth:$('divorce-month').value,childrenForAlimony:eligible.length,
          declaredMonthly:item.arrangement==='notary'&&maritalStatus==='divorced'?notary:monthly,
          declaredByMonth:item.arrangement==='informal'&&item.from&&item.to?byMonth:undefined,
          receivedByMonth:byMonth,wageRecords:[year-2,year-1].map(wageRecordFor).filter(Boolean)},month);
        if(result.status!=='known') {issue=`Обязательство ${index+2}: ${result.reason}`;break}
        amounts.push(result.amount);
      }
      if(issue) {alimony.status='unknown';alimony.reason=issue}
      else if(alimony.status==='known') {alimony.amount+=amounts.reduce((sum,value)=>sum+value,0);alimony.method='multiple-obligations'}
    }
    const monthBenefitMissing=new Set(benefitRows.missing),awardNeedsReview=new Set();
    let scenarioBlocks=false,scenarioComplete=scenarios.length>0&&selected.length>0&&!applicationSelection.review&&!applicationSelection.blocked,shortcutOnly=true,newbornReview=false;
    const scenarioTiers=[],priorSupportChecks=[],scenarioAmounts=[];
    const incomeText=selected.length?scenarios.map((group,scenarioIndex)=>{
      const awardChecks=group.map(child=>awardConflict(child,month,{jointRenewal}));
      if(awardChecks.some(check=>check.status==='block'))scenarioBlocks=true;
      if(awardChecks.some(check=>['unknown','review'].includes(check.status))){scenarioComplete=false;awardChecks.forEach((check,index)=>{if(['unknown','review'].includes(check.status))awardNeedsReview.add(group[index]?.id)})}
      const benefitResult=childBenefitIncome(benefitRows.payments,children,group.map(c=>c.id),month,filingDate);
      const benefitUnknown=[...benefitRows.missing,...benefitResult.missing];benefitUnknown.forEach(text=>monthBenefitMissing.add(text));
      const combinedIncome=!sourceComplete || incomeResult.total===null || benefitResult.total===null || benefitUnknown.length || alimony.status!=='known' || depositIncome.status!=='known' || maternityIncome.status!=='known' || supplemental.status!=='known' || childEarnings.status!=='known' ? null : incomeResult.total+benefitResult.total+alimony.amount+depositIncome.amount+maternityIncome.amount+supplemental.amount+childEarnings.amount;
      const olderAwards=children.filter(c=>c.awardRecipient==='self').map(c=>({childId:c.id,tier:c.awardTier,endsOn:c.awardEnd,decisionDate:c.awardDecision}));
      const newbornChecks=group.filter(c=>c.birthDate && c.birthDate<=filingDate).map(c=>({child:c,result:newbornShortcut({birthDate:c.birthDate,applicationDate:filingDate,olderAwards:olderAwards.filter(a=>a.childId!==c.id),sameRecipient:olderAwards.length?true:children.some(other=>other.id!==c.id&&other.awardRecipient==='unknown')?undefined:false,motherPregnancyBenefit:$('mother-pregnancy-benefit').checked})}));
      const newborns=newbornChecks.filter(x=>x.result.status==='simplified');
      const newbornUnknowns=newbornChecks.filter(x=>x.result.status==='unknown');
      if(newbornUnknowns.length){newbornReview=true;scenarioComplete=false;}
      const regularChildren=group.length-newborns.length-newbornUnknowns.length;
      if(regularChildren)shortcutOnly=false;
      let tier=!!yearRules && regularChildren>0 && combinedIncome!==null && pmPerson>0 && pmChild>0 && !members.unanswered.length
        ?childTier({income12:combinedIncome,familySize:members.included.length,childrenApplying:regularChildren,pmPerson,pmChild}):null;
      const grace=tier?.status==='income-too-high'?largeFamilyGrace({applicationMonth:month,perCapita:tier.base,pmPerson,isLargeFamily:$('large-family').checked,usedBefore:yn($('grace-used').value),awardEndMonths:children.filter(c=>c.awardRecipient==='self'&&c.awardEnd).map(c=>c.awardEnd.slice(0,7))}):null;
      if(grace?.status==='eligible')tier={...tier,status:'estimate',tier:50,grace:true};
      if(regularChildren && tier?.status==='estimate')scenarioTiers.push(tier.tier);
      if(regularChildren && tier?.status==='income-too-high'&&grace?.status!=='unknown')scenarioBlocks=true;
      if(regularChildren && (tier?.status!=='estimate'||members.unanswered.length))scenarioComplete=false;
      const newMonthly=!newbornUnknowns.length&&pmChild>0&&(!regularChildren||tier?.status==='estimate')?pmChild*((regularChildren?(tier.tier/100)*regularChildren:0)+newborns.reduce((sum,item)=>sum+item.result.tier/100,0)):null;
      scenarioAmounts.push(newMonthly);
      const priorSupport=priorSupportFor(group.map(child=>`child:${child.id}`),month,newMonthly,$('pregnancy-applying').checked);
      priorSupportChecks.push(priorSupport);
      if(priorSupport.status==='block')scenarioBlocks=true;
      if(priorSupport.status==='unknown')scenarioComplete=false;
      const priorSupportText=`Сравнение с прежними выплатами: ${priorSupport.reason}${Number.isFinite(priorSupport.oldMonthly)?`; прежние ${priorSupport.oldMonthly.toLocaleString('ru-RU')} ₽/мес.`:''}${Number.isFinite(priorSupport.newMonthly)?`; новые ${priorSupport.newMonthly.toLocaleString('ru-RU')} ₽/мес.`:''}.`;
      const childNumber=children.findIndex(c=>c.id===group[0]?.id)+1;
      const label=$('application-mode').value==='separate'?`Заявление: ${childLabel(group[0],childNumber-1)} (${scenarioIndex+1} из ${scenarios.length})`:'Общее заявление';
      const excludedBenefitText=benefitResult.excluded.every(payment=>Number.isFinite(payment.amount))?benefitResult.excluded.reduce((sum,payment)=>sum+payment.amount,0).toLocaleString('ru-RU')+' ₽':'сумма не уточнена; эти выплаты не входят в доход заявления';
      const benefitText=(benefitResult.included.some(payment=>payment.projected)?'Для будущих месяцев использовано ваше предположение о сумме пособия. ':'')+(benefitUnknown.length?`Уточнить пособия: ${benefitUnknown.join('; ')}.`:`Пособия на остальных детей учтены: ${benefitResult.total.toLocaleString('ru-RU')} ₽; исключены для этого заявления: ${excludedBenefitText}.`);
      const newbornText=(newbornUnknowns.length?`Упрощённое назначение новорождённому требует уточнения: ${newbornUnknowns.map(x=>x.result.reason).join('; ')}. `:'')+(newborns.length?`Новорождённому по действующему решению на старшего: ${newborns.map(x=>`${x.result.tier}% с ${x.result.startMonth} по ${x.result.endsOn}`).join('; ')}; без новой оценки на этот срок. Далее — обычная оценка.`:'');
      const regularText=regularChildren?`${tier?.grace?'По однократному продлению многодетным — предварительно 50% для остальных детей.':`По обычной оценке ${tier?.status==='estimate'?`предварительная ступень ${tier.tier}% для остальных детей.`:tier?.status==='income-too-high'?`доход выше указанного ПМ; ${grace?.reason||'проверьте однократное продление'}.`:'ступень пока неизвестна.'}`}`:'';
      if(!regularChildren)return `${label}: Действующее назначение: ${awardChecks.map(check=>check.status==='clear'?'нет препятствия':check.status==='renewal'?'можно продлить в последний месяц':check.status==='court-exception'?'учесть решение суда':check.reason).join('; ')}. ${newbornText} ${priorSupportText}`;
      return `${label}: доход ${combinedIncome===null?'нужны данные':combinedIncome.toLocaleString('ru-RU')+' ₽'}. Действующее назначение: ${awardChecks.map(check=>check.status==='clear'?'нет препятствия':check.status==='renewal'?'можно продлить в последний месяц':check.status==='court-exception'?'учесть решение суда':check.reason).join('; ')}. ${benefitText} Алименты: ${alimony.status==='known'?`${alimony.amount.toLocaleString('ru-RU')} ₽${alimony.wageYear?' (минимум по окончательным данным Росстата за '+alimony.wageYear+' год)':''}`:'нужны данные ('+alimony.reason+')'}. Доходы детей: ${childEarnings.status==='known'?`${childEarnings.amount.toLocaleString('ru-RU')} ₽`:'уточнить ('+childEarnings.issues.join('; ')+')'}. Дополнительные источники: ${supplemental.status==='known'?`${supplemental.amount.toLocaleString('ru-RU')} ₽; исключено по п. 53: ${supplemental.excluded.reduce((sum,item)=>sum+item.amount,0).toLocaleString('ru-RU')} ₽`:'нужны данные ('+supplemental.issues.join('; ')+')'}. Проценты по вкладам в доходе: ${depositIncome.status==='known'?`${depositIncome.amount.toLocaleString('ru-RU')} ₽`:'нужны данные ('+depositIncome.reason+')'}. БиР за вошедшие месяцы: ${maternityIncome.status==='known'?`${maternityIncome.amount.toLocaleString('ru-RU')} ₽`:'уточнить период начисления'}. ${newbornText} ${regularText} ${priorSupportText}`;
    }).join(' '):$('pregnancy-applying').checked?'Заявление на ребёнка не выбрано.':applicationSelection.requested.length?'Дети отмечены. Уточните сведения в блоке «Дети из заявления» — до этого доход и ступень для заявления не рассчитываются.':'Отметьте ребёнка или заявление по беременности.';
    let pregnancyText='',pregnancyMonthly=null;
    if($('pregnancy-applying').checked) {
      if(capacity.pregnancy?.status==='block')pregnancyText=capacity.pregnancy.reason+'.';
      else if(capacity.status==='unknown')pregnancyText='По беременности: сначала уточните судебное решение о дееспособности и даты.';
      else if(pregnancyState.status==='ended'||pregnancyState.status==='unknown') pregnancyText=`По беременности: ${pregnancyState.reason}.`;
      else if($('pregnancy-registered').value!=='yes') pregnancyText=$('pregnancy-registered').value==='no'?'По беременности: нужна постановка на учёт в ранний срок.':'По беременности: уточните постановку на учёт до 12 недель.';
      else if($('weeks').value==='') pregnancyText='По беременности: укажите срок на дату подачи.';
      else if(pregnancyState.weeks<12) pregnancyText='По беременности: обратиться за назначением можно после наступления 12 недель.';
      else {
        const pregnancyBenefits=childBenefitIncome(benefitRows.payments,children,[],month,filingDate);
        const pregnancyIncome=!sourceComplete||incomeResult.total===null||pregnancyBenefits.total===null||benefitRows.missing.length||pregnancyBenefits.missing.length||alimony.status!=='known'||depositIncome.status!=='known'||maternityIncome.status!=='known'||supplemental.status!=='known'||childEarnings.status!=='known'?null:incomeResult.total+pregnancyBenefits.total+alimony.amount+depositIncome.amount+maternityIncome.amount+supplemental.amount+childEarnings.amount;
        const result=pregnancyTier({income12:pregnancyIncome,familySize:members.unanswered.length?null:members.included.length,pmPerson,pmWorking:pm.status==='known'?pm.working:null});
        if(result.status==='estimate')pregnancyMonthly=result.monthly;
        pregnancyText=result.status==='estimate'?`Отдельное заявление по беременности: предварительная ступень ${result.tier}% от ПМ трудоспособных (${result.monthly.toLocaleString('ru-RU')} ₽ в месяц). Прежние выплаты на детей, остающихся в семье, учтены в доходе этого заявления: ${pregnancyBenefits.total.toLocaleString('ru-RU')} ₽ за расчётный период. Сроки выплаты и остальные критерии ещё требуют проверки.${pregnancyBenefits.included.some(payment=>payment.projected)?' Для будущих выплат на детей использовано ваше предположение о сумме.':''}`:result.status==='income-too-high'?'По беременности: доход отдельного заявления выше указанного ПМ на человека.':'По беременности: для ступени нужны подтверждённые доходы и ПМ.';
      }
    }
    if(!yearRules) {
      overview.needs++;
      const futureYearSections=[
        {title:'Данные будущего года',text:`${pm.status==='known'?`ПМ: ${pm.person.toLocaleString('ru-RU')} ₽ на человека, ${pm.child.toLocaleString('ru-RU')} ₽ на ребёнка.`:pm.reason+'.'} МРОТ на ${year} год ещё не загружен.`},
        {title:'Дети из заявления',text:applicationSelectionText},
        {title:'Доходы и выплаты на детей',text:`${incomeEntryReviewText} ${incomeText}`},
        {title:'Отдельное заявление по беременности',text:pregnancyText},
        {title:'Состав семьи и имущество',text:`${familyText} ${assetText}`}
      ];
      output.push(resultCard(filingDate,incomeWindow(month),'Для вывода нужны данные на '+year+' год',futureYearSections,'unknown',false,'','Официальные суммы и правила не загружены. Можно включить расчёт по вашим допущениям.',[{label:'Открыть настройки предварительного прогноза на 2027 год',selector:'#forecast-enabled'}]));
      continue;
    }
    // Future pregnancy conditions require an explicit continuation forecast.
    if($('pregnancy-applying').checked&&pregnancyState.status==='forecast')pregnancyText+=` ${pregnancyState.reason}.`;
    const adults=countedAdults.map(({person,index:j})=>{
      const income=Object.fromEntries(incomeWindow(month).map(m=>[m,[...(Number.isFinite(baseMonths(person,j)[m])?[{type:person.incomeType,amount:baseMonths(person,j)[m]}]:[]),...(supplemental.byPerson.get(j)?.[m]?.qualifying?[{type:'employment',amount:supplemental.byPerson.get(j)[m].qualifying}]:[])]]));
      const includedMinorWards=children.filter(c=>c.role==='ward'&&members.included.some(p=>p.id===c.id)&&c.birthDate&&ageAt(c.birthDate,filingDate)<18);
      const spouseStatusUnknown=j===1&&members.unanswered.some(item=>item.person.role==='spouse');
      const guardianUnknown=j===0&&includedMinorWards.length>0&&$('sole-guardian').value==='';
      const soleParent=j===0&&(children.some(c=>members.included.some(p=>p.id===c.id)&&c.birthDate&&ageAt(c.birthDate,filingDate)<18&&c.role!=='ward'&&soleParentStatus([c])==='sole')||includedMinorWards.length>0&&$('sole-guardian').value==='yes');
      const result=minimumIncomeTest({reasons:reasons.filter(r=>r.person===j),applicationDate:filingDate,pregnancyWeeksAtApplication:j===0?pregnancyState.weeks:0,pregnancyStatusUnknown:j===0&&pregnancyState.status==='unknown'&&($('weeks').value!==''||$('pregnancy-applying').checked||$('pregnancy-forecast-through').value!==''||$('pregnancy-ended').value!==''),income,singleParent:soleParent,multipleChildrenExemption:j===0&&$('large-family').checked},month,yearRules.mrot);
      if(spouseStatusUnknown)result.warnings.push('Уточните статус супруга: до этого его индивидуальный минимум дохода не подтверждён.');
      if(j===0&&pregnancyState.status==='forecast')result.warnings.push(pregnancyState.reason+'.');
      const amountKnown=mobilizedIndices.includes(j)||!sourceEnabled.has('employment')||$('income-mode').value!=='total'?incomeWindow(month).every(m=>Number.isFinite(baseMonths(person,j)[m])&&baseMonths(person,j)[m]>=0):month===start&&Number.isFinite(person.total)&&person.total>=0;
      const earned=!mobilizedIndices.includes(j)&&sourceEnabled.has('employment')&&$('income-mode').value==='total'&&month===start&&person.incomeType!=='other'?person.total+[...Object.values(supplemental.byPerson.get(j)||{})].reduce((sum,v)=>sum+v.qualifying,0):result.earned;
      return {...result,earned,passed:earned>=result.minimum,known:!mobilizedIndices.includes(j)&&sourceComplete&&amountKnown&&!guardianUnknown&&!spouseStatusUnknown&&person.incomeType!=='other'&&supplemental.status==='known'&&(!result.uncertain||earned>=result.minimum),mobilizedReview:mobilizedIndices.includes(j),label:person.label};
    });
    const needsMeansAssessment=!shortcutOnly||$('pregnancy-applying').checked;
    const newbornOnly=selected.length>0&&!needsMeansAssessment;
    const studentChecks=adultStudentChecks(children,members,sourceEnabled.has('childIncome')?childIncomeEntries:[],month,filingDate,yearRules.mrot);
    const adultText=newbornOnly?(newbornReview?'Сначала уточните право на упрощённое назначение новорождённому. Если оно подтвердится, проверка минимального дохода не требуется':'При упрощённом назначении новорождённому проверка минимального дохода не требуется'):[...adults.map(a=>`${a.label}: ${a.mobilizedReview?'мобилизация по Указу № 647; минимум 8 МРОТ требует отдельной проверки':a.exempt?'порог не применяется':`засчитано причин ${a.creditedMonths} мес., нужно ${Math.ceil(a.minimum).toLocaleString('ru-RU')} ₽, ${a.known?`введено для этого требования ${a.earned.toLocaleString('ru-RU')} ₽ (${a.passed?'достаточно':'недостаточно'})`:'данных о подходящем доходе пока недостаточно'}`}`),...studentChecks.map(check=>`Ребёнок ${children.findIndex(child=>child.id===check.childId)+1} (18–22 года): ${check.status==='yes'?check.reason:check.reason+'; индивидуальный порог 8 МРОТ пока не подтверждён'}`)].join('; ');
    if($('pregnancy-applying').checked) {
      const priorSupport=priorSupportFor(['applicant'],month,pregnancyMonthly,selected.length>0);priorSupportChecks.push(priorSupport);
      if(priorSupport.status==='block')scenarioBlocks=true;
      pregnancyText+=` Сравнение с прежними выплатами по беременности: ${priorSupport.reason}.`;
    }
    const applicantCheck=$('applicant-citizen').value==='no'||$('applicant-residence').value==='no'?'no':$('applicant-citizen').value&&$('applicant-residence').value?'yes':'unknown';
    const addressBasis=$('residence-basis').value;
    const addressReview=!addressBasis||addressBasis!=='permanent'&&$('address-proof').value!=='yes';
    const priorMeasureReview=priorSupportChecks.length?priorSupportChecks.some(check=>check.status==='unknown'):$('prior-measure').value!=='no';
    const contextReview=applicationSelection.review||pregnancyState.status==='forecast'||capacity.status==='unknown'||addressReview||priorMeasureReview||rightsUnknown||assetOwnerReview||mobilizedIndices.length>0||studentChecks.some(check=>check.status!=='yes');
    const contextText=`Адрес подачи: ${addressReview?'нужно уточнить основание и подтверждение':'сведения введены, СФР проверит подтверждение'}. Прежние меры поддержки: ${priorMeasureReview?'нужно уточнить вид, получателей и сумму для сравнения по п. 31(м)':'сравнение для выбранных заявлений выполнено ниже'}. ${mobilizedIndices.length?'Зарплата, дополнительные поступления, БиР и проценты по счетам отмеченных мобилизованных взрослых исключены; получателей детских выплат и алиментов, статус по Указу № 647 и правило минимального дохода нужно проверить по документам.':''}`;
    const explicitBlockers=applicationSelection.blocked||capacity.status==='block'||applicantCheck==='no'||rightsBlocked||needsMeansAssessment&&([carCheck,propertyCheck,otherCheck,depositCheck].some(c=>c.status==='no')||adults.some(a=>a.known&&!a.passed))||scenarioBlocks;
    const headline=explicitBlockers?'Есть препятствие по введённым данным':!applicationSelection.review&&shortcutOnly&&!newbornReview&&selected.length&&capacity.status!=='unknown'&&applicantCheck!=='no'?'Для новорождённого проверьте упрощённое назначение ниже':scenarioComplete&&!$('pregnancy-applying').checked&&!contextReview&&applicantCheck==='yes'&&adults.every(a=>a.known||a.exempt)&&[carCheck,propertyCheck,otherCheck,depositCheck].every(c=>c.status==='yes')?'По проверенным критериям препятствий нет; полная оценка ещё не готова':'Для вывода нужны дополнительные данные';
    const clear=!explicitBlockers&&headline.startsWith('По проверенным критериям');
    overview[explicitBlockers?'blocked':clear?'clear':'needs']++;
    const comparableTier=clear&&scenarios.length===1&&scenarioTiers.length===1?scenarioTiers[0]:null;
    if(comparableTier!==null)(scenario.estimated?forecastCandidates:candidates).push({date:filingDate,tier:comparableTier,monthly:scenarioAmounts.every(Number.isFinite)?scenarioAmounts.reduce((sum,amount)=>sum+amount,0):null});
    const resultSections=[
      ...(scenario.estimated?[{title:'Предварительный сценарий на 2027 год',text:scenario.assumptions.join('. ')+'. Результат изменится при других ПМ, МРОТ, правилах или доходах.'}]:[]),
      {title:'Регион и прожиточный минимум',text:pm.status==='known'?`ПМ ${pm.area}: ${pm.person.toLocaleString('ru-RU')} ₽ на человека, ${pm.child.toLocaleString('ru-RU')} ₽ на ребёнка.`:pm.reason+'.'},
      {title:'Заявитель и условия подачи',text:`${applicantCheck==='yes'?'Гражданство и проживание РФ подтверждены':applicantCheck==='no'?'Нет необходимого гражданства или проживания':'Уточните гражданство и проживание'}. ${capacityText} ${contextText}`},
      {title:'Дети из заявления',text:`${applicationSelectionText} ${rightsText}`},
      {title:'Минимальный доход',text:`${adultText}.${!newbornOnly&&adults.flatMap(a=>a.warnings).length?' '+adults.flatMap(a=>a.warnings).join(' '):''}`},
      {title:'Доходы и выплаты на детей',text:`${newbornOnly?'':incomeEntryReviewText} ${incomeText}`},
      {title:'Отдельное заявление по беременности',text:pregnancyText},
      {title:'Состав семьи и имущество',text:`${familyText} ${newbornOnly?(newbornReview?'Имущество: необходимость новой оценки зависит от подтверждения упрощённого назначения.':'Имущество: при упрощённом назначении новая оценка не проводится.'):assetText}`}
    ];
    const shortStatus=explicitBlockers?'Есть условие, которое мешает назначению':clear?'Предварительный расчёт готов':headline.includes('новорождённого')?'Возможно упрощённое назначение новорождённому':'Нужно уточнить ответы';
    const amount=clear&&scenarioAmounts.length&&scenarioAmounts.every(Number.isFinite)?scenarioAmounts.reduce((sum,value)=>sum+value,0):null;
    const answerActions=[];
    const addAnswer=(label,selector)=>{if(selector&&!answerActions.some(a=>a.selector===selector))answerActions.push({label,selector})};
    if(pm.status!=='known')addAnswer('Выберите регион и территорию для расчёта прожиточного минимума',$('pm-region').value?'#pm-area':'#pm-region');
    if(!sourceComplete)addAnswer('Отметьте виды доходов или их отсутствие','#no-income');
    if(!children.length&&!$('pregnancy-applying').checked)addAnswer('Добавьте детей, на которых проверяем пособие','#add-child');
    if(incomeResult.missing.length&&sourceEnabled.has('employment'))countedAdults.forEach(({person,index})=>{
      const missing=incomeWindow(month).filter(m=>!Number.isFinite(baseMonths(person,index)[m])||baseMonths(person,index)[m]<0);
      const prefix=`#income-people .income-person:nth-child(${index+1}) `;
      const mode=$('income-mode').value;
      if(mode==='total'&&month!==start)addAnswer(`${person.label}: для ${monthLabel(month)} нужны суммы по месяцам, а не общая сумма за первый период`,'#income-mode');
      else if(missing.length){const future=missing.every(m=>m>currentMonth);addAnswer(`${person.label}: ${future?'укажите ожидаемую зарплату':'заполните зарплату'} за ${missing.map(m=>monthLabel(m)).join(', ')}${mode==='period'&&future?'. Подтвердите прежнюю сумму для будущих месяцев или выберите ввод по месяцам':''}`,mode==='monthly'?prefix+`[data-income-month="${missing[0]}"]`:prefix+(future?'.project-future':'.regular-amount'));}
      else if(mode==='total'&&(!Number.isFinite(person.total)||person.total<0))addAnswer(`${person.label}: заполните сумму дохода за первый расчётный период`,prefix+'input[type="number"]');
    });
    if(monthBenefitMissing.size)addAnswer('Пособия на детей: '+[...monthBenefitMissing].join('; '),'#benefits');
    if(maternityIncome.status!=='known')addAnswer('БиР: укажите полную сумму, месяц начала отпуска и число месяцев начисления','#maternity-payments');
    if(supplemental.status!=='known')addAnswer('Другие выбранные доходы: '+supplemental.issues.join('; '),'#extra-entries');
    if(childEarnings.status!=='known')addAnswer('Доходы детей: '+childEarnings.issues.join('; '),'#child-income-entries');
    if(alimony.status!=='known')addAnswer('Алименты: '+alimony.reason,!maritalStatus?'#marital-status':maritalStatus==='divorced'?'#alimony-kind':'#alimony-received');
    if(sourceEnabled.has('deposit')&&(depositIncome.status!=='known'||depositCheck.status==='unknown'))addAnswer(`Вклады: укажите проценты за ${year-1} год и данные счетов`,'#deposits');
    if(applicantCheck==='unknown')addAnswer('Уточните гражданство и проживание заявителя','#applicant-citizen');
    if(capacity.status==='unknown')addAnswer('Ответьте, было ли решение суда о дееспособности','#applicant-capacity');
    if(addressReview)addAnswer('Уточните адрес подачи и его подтверждение','#residence-basis');
    if(priorMeasureReview)addAnswer('Переход со старой выплаты: уточните сведения для сравнения сумм','#prior-measure');
    if(assetOwnerReview)addAnswer('Имущество: укажите объекты и владельцев','#assets-none');
    if(members.unanswered.some(x=>x.person.role==='spouse'))addAnswer('Уточните, входит ли супруг в состав семьи','#spouse-status');
    children.forEach((child,index)=>{
      const row=`#children .form-row:nth-child(${index+1}) `;
      const eligibility=childCanApply(child,filingDate),rights=applicantParentalRights(child);
      if(eligibility.status==='unknown')addAnswer(`${childLabel(child,index)}: ${eligibility.reason}`,row+'.birth');
      if(rights.status==='unknown')addAnswer(`${childLabel(child,index)}: уточните родительские права`,row+'.applicant-rights');
      if(applicationSelection.review||newbornReview||awardNeedsReview.has(child.id))addAnswer(`${childLabel(child,index)}: проверьте действующее единое пособие, дату окончания и выбор заявления`,row+'.award-recipient');
    });
    if($('pregnancy-applying').checked&&pregnancyState.status==='unknown')addAnswer('Беременность: '+pregnancyState.reason,'#pregnancy-forecast-through');
    if(sourceComplete&&adults.some(a=>!a.known&&!a.exempt)&&!incomeResult.missing.length)addAnswer('Уточните причины месяцев без заработка и подтверждение условий','#reasons');
    const nextAnswers=[...(!sourceComplete?['виды доходов']:[]),...(applicantCheck==='unknown'?['гражданство и проживание']:[]),...(capacity.status==='unknown'?['решение суда о дееспособности']:[]),...(addressReview?['адрес подачи']:[]),...(priorMeasureReview?['прежние выплаты']:[]),...(rightsUnknown?['родительские права']:[]),...(assetOwnerReview?['имущество и владельцев']:[])];
    const blockerReasons=[...(applicantCheck==='no'?['нет необходимого гражданства или проживания']:[]),...(rightsBlocked?['ограничения родительских прав']:[]),...(needsMeansAssessment&&adults.some(a=>a.known&&!a.passed)?['недостаточный доход с учётом указанных причин']:[]),...(needsMeansAssessment&&[carCheck,propertyCheck,otherCheck,depositCheck].some(c=>c.status==='no')?['имущество или проценты превышают допустимые условия']:[])];
    const actionHint=explicitBlockers?(blockerReasons.join('; ')||'Откройте месяц: указано условие, которое нужно проверить.') :!clear&&nextAnswers.length?'Уточните: '+nextAnswers.slice(0,3).join(', ')+'.':!clear?'Проверьте пояснения к условиям этого месяца.':'';
    const metric=amount!==null?`${amount.toLocaleString('ru-RU')} ₽ в месяц на отмеченных детей`:'';
    output.push(resultCard(filingDate,incomeWindow(month),`${scenario.estimated?'Сценарий 2027: ':''}${shortStatus}${comparableTier!==null?` · предварительно ${comparableTier}%`:''}`,resultSections,scenario.estimated?'unknown':explicitBlockers?'bad':clear?'ok':'unknown',false,metric,!clear&&!explicitBlockers&&answerActions.length?'Ниже указано, что дополнить. Нажмите на нужный ответ.':actionHint,clear||explicitBlockers?[]:answerActions));
  }
  const best=candidates.reduce((current,item)=>!current||item.tier>current.tier?item:current,null);
  const forecastBest=forecastCandidates.reduce((current,item)=>!current||item.tier>current.tier?item:current,null);
  const forecastText=overview.estimated?` Из них ${overview.estimated} месяцев — сценарий 2027 года по вашим допущениям.${forecastBest?` При этих допущениях наибольший размер — ${forecastBest.tier}% (${monthLabel(forecastBest.date)}).`:''} Откройте месяц: использованные суммы ПМ и МРОТ указаны отдельно.`:'';
  const bestText=best?` Среди месяцев с сопоставимыми данными наибольший предварительный размер — <strong>${best.tier}%</strong> при подаче <strong>${monthLabel(best.date)}</strong>. Если размер одинаков, показан первый месяц.`:'';
  renderCompletionChecklist();
  $('results').innerHTML=`<div class="result-overview"><h3>${best?'Лучший месяц по загруженным данным':forecastBest?'Предварительный сценарий на 2027 год':overview.blocked?'Есть препятствия для назначения':'Нужно уточнить данные'}</h3><p>${best?`Подача ${monthLabel(best.date)}: ${Number.isFinite(best.monthly)?best.monthly.toLocaleString('ru-RU')+' ₽ в месяц на отмеченных детей, ':''}предварительно ${best.tier}%.`:forecastBest?`По выбранным допущениям: ${monthLabel(forecastBest.date)}, предварительно ${forecastBest.tier}%. Это сценарий, а не расчёт по утверждённым суммам 2027 года.`:overview.blocked?`В ${overview.blocked} из 12 месяцев найдены препятствия по введённым сведениям. Причины — в подробностях месяца.`:'Заполните отмеченные ответы, чтобы получить расчёт. Остальные пояснения доступны внутри месяцев.'}</p><p class="hint">Подробности расчёта доступны ниже. При неполных данных сначала заполните отмеченные ответы.</p></div><details class="forecast-details"><summary>Сравнение 12 месяцев и условия прогноза</summary><p class="forecast-overview">Прогноз на 12 месяцев: <strong>${overview.blocked}</strong> с препятствием, <strong>${overview.clear}</strong> без выявленных препятствий по проверенным критериям, <strong>${overview.needs}</strong> требуют уточнения.${bestText}${forecastText} Оценка предварительная и зависит от полноты сведений и будущих доходов; откройте месяц для подробностей.</p></details>`+output.join('');
  $('results').querySelectorAll('[data-answer-target]').forEach(button=>button.onclick=()=>openResultAnswer(button.dataset.answerTarget,button.dataset.applicationMonth));
  guidedFlow?.refresh();
}
$('add').onclick=addReason;
$('add-child').onclick=addChild; $('add-car').onclick=addCar;
$('add-benefit').onclick=()=>{benefitPayments.push({childId:'',amount:'',from:'',to:'',amountMode:'automatic'});renderBenefitRows();render()};
 $('add-property').onclick=addProperty; $('add-vehicle').onclick=addOtherVehicle; $('add-deposit').onclick=addDeposit;
 $('add-adult').onclick=()=>{if(incomePeople.length===1)incomePeople.push({label:'Супруг(а)',months:{},total:null,incomeType:'employment'});renderIncomeForm();render()};
 $('income-mode').addEventListener('input',()=>{renderIncomeForm();render()});
 $('start').addEventListener('input',()=>{renderIncomeForm();renderExtraRows();renderAlimonyWageYears();updatePmSelection()});
 $('pm-region').addEventListener('input',()=>{const code=$('pm-region').value;if(code!==lastWageRegion)alimonyWageRecords.clear();lastWageRegion=code;updatePmSelection();renderAlimonyWageYears();renderBenefitRows()});
 $('pm-area').addEventListener('input',()=>{renderBenefitRows();render()});
['capacity-decision','capacity-restored','applicant-citizen','applicant-residence','residence-basis','address-proof','prior-measure','pregnancy-applying','pregnancy-registered','sole-guardian','day','weeks','pregnancy-forecast-through','pregnancy-ended','large-family','grace-used','disability','support-car','support-motorcycle','support-machine','rural'].forEach(id=>$(id).addEventListener('input',render));
$('applicant-capacity').addEventListener('input',()=>{$('capacity-dates').hidden=!['limited','incapable'].includes($('applicant-capacity').value);render()});
renderIncomeForm();
searchableSelect($('pm-region'),{label:'Регион проживания'});
searchableSelect($('pm-area'),{label:'Территория или группа территорий',placeholder:'Введите город, район или название группы'});
updatePmSelection();

const originalPanels=[...document.querySelectorAll('main > .panel')];
const basicPanel=document.createElement('section');basicPanel.className='panel';
basicPanel.innerHTML='<h2>Начнём с вашей семьи</h2><div class="basic-grid"></div>';
const basicGrid=basicPanel.querySelector('.basic-grid');
basicGrid.append($('pm-region').closest('.demo-pm'));
basicGrid.querySelector('.demo-pm h3').textContent='Где вы живёте?';
for(const id of ['marital-status','spouse-status','large-family','disability','start','day'])basicGrid.append($(id).closest('label'));
const dayDetails=document.createElement('details');dayDetails.className='field-help';dayDetails.innerHTML='<summary>Нужно ли указывать день подачи?</summary><p class="hint">Для сравнения доходов достаточно месяца. По умолчанию расчёт идёт на 1-е число. Измените день, если в этом месяце ребёнку исполнится 17 лет, изменится срок беременности или закончится уже назначенное пособие. Если дня нет в месяце, используем последний день.</p>';dayDetails.append(basicGrid.querySelector('#day').closest('label'));basicGrid.append(dayDetails,forecastSettings);
originalPanels[0].querySelector('h2').textContent='Условия подачи заявления';
const renewalHelp=document.createElement('div');renewalHelp.id='renewal-help';renewalHelp.className='renewal-help';renewalHelp.innerHTML='<h3>Продление пособия многодетной семье</h3><p class="hint">При продлении пособия доход семьи может превышать прожиточный минимум не более чем на 10%. Этой возможностью можно воспользоваться один раз. Здесь речь о доходе семьи.</p>';
renewalHelp.append($('grace-used').closest('label'));originalPanels[0].append(renewalHelp);
originalPanels[2].querySelector('h2').textContent='На кого будем считать пособие?';
const pregnancyPanel=document.createElement('div');pregnancyPanel.className='pregnancy-choice';
pregnancyPanel.append($('pregnancy-applying').closest('label'),$('pregnancy-registered').closest('label'),$('pregnancy-details'));
originalPanels[2].append(pregnancyPanel);
const newbornExplanation=document.createElement('p');newbornExplanation.id='newborn-explanation';newbornExplanation.className='hint';newbornExplanation.textContent='Если на старшего ребёнка единое пособие уже назначено вам, новорождённому в первые 6 месяцев можно проверить назначение в том же размере и до той же даты, без новой оценки доходов и имущества. Кому назначено пособие, размер и срок укажите в карточке старшего ребёнка.';applicationChoice.after(newbornExplanation);
alimonySection.querySelector('h3').textContent='Алименты: основание и поступления';
for(const panel of originalPanels) {
  if(panel===originalPanels[6])continue;
  const hints=[...panel.querySelectorAll(':scope > p.hint')];
  if(!hints.length)continue;
  const help=document.createElement('details');help.className='field-help';help.innerHTML='<summary>Подсказки к этому шагу</summary>';hints.forEach(hint=>help.append(hint));panel.append(help);
}
const pmHelp=document.createElement('details');pmHelp.className='field-help';pmHelp.innerHTML='<summary>Откуда берутся суммы и как выбрать местность</summary>';
const pmHint=basicGrid.querySelector('.demo-pm > p.hint');if(pmHint){pmHelp.append(pmHint);basicGrid.querySelector('.demo-pm').append(pmHelp)}

const assetKinds=[['apartment','Квартира / доля в квартире'],['house','Жилой дом / доля в доме'],['land','Земельный участок'],['garage','Гараж / машино-место'],['garden','Садовый дом'],['nonresidential','Нежилое помещение'],['car','Автомобиль'],['vehicle','Мотоцикл, лодка или самоходная техника']];
const assetPicker=document.createElement('div');assetPicker.className='asset-picker';assetPicker.innerHTML='<h3>Что принадлежит вам, супругу или детям?</h3><p class="hint">Отметьте собственность семьи. Съёмное жильё указывать не нужно. Затем уточним площадь и другие нужные сведения.</p><div class="asset-choice-grid"></div><label class="check"><input id="assets-none" type="checkbox"> Ничего из перечисленного нет</label>';
for(const [kind,title] of assetKinds){const label=document.createElement('label');label.className='check';const box=document.createElement('input');box.type='checkbox';box.id='asset-'+kind;box.className='asset-choice';label.append(box,document.createTextNode(' '+title));assetPicker.querySelector('.asset-choice-grid').append(label);
  box.oninput=()=>{if(box.checked){$('assets-none').checked=false;if(kind==='car'&&!$('cars').children.length)addCar();else if(kind==='vehicle'&&!$('other-vehicles').children.length)addOtherVehicle();else if(!['car','vehicle'].includes(kind)&&![...$('properties').children].some(row=>row.querySelector('.type').value===kind))addProperty(kind)}render()};
}
assetPicker.querySelector('#assets-none').addEventListener('input',()=>{if($('assets-none').checked)assetPicker.querySelectorAll('.asset-choice').forEach(box=>box.checked=false);render()});
originalPanels[4].querySelector('h2').textContent='Имущество семьи';
originalPanels[4].querySelector(':scope > p:not(.hint)').remove();
$('add-property').hidden=true;originalPanels[4].querySelector('.section-heading').after(assetPicker);
const propertyAdds=document.createElement('div');propertyAdds.className='property-adds';
for(const [kind,title] of assetKinds.filter(([kind])=>!['car','vehicle'].includes(kind))){const button=document.createElement('button');button.type='button';button.dataset.kind=kind;button.textContent='+ Ещё: '+title.toLowerCase();button.onclick=()=>addProperty(kind);propertyAdds.append(button)}
$('properties').after(propertyAdds);
const vehicleFields=document.createElement('div');vehicleFields.id='vehicle-fields';const vehicleHeading=$('add-vehicle').closest('.section-heading');vehicleHeading.before(vehicleFields);vehicleFields.append(vehicleHeading,vehicleHeading.nextElementSibling,$('other-vehicles'));
// The support details were originally next to the heading; retain them inside this group.
const vehicleSupport=$('support-motorcycle').closest('details');if(vehicleSupport)vehicleFields.append(vehicleSupport);
const steps=[
  {title:'Семья',intro:'Выберите регион, семейное положение и планируемый месяц подачи.',panels:[basicPanel]},
  {title:'Дети',intro:'Добавьте всех детей семьи и отметьте, на кого подаёте.',panels:[originalPanels[2]]},
  {title:'Доходы',intro:'Отметьте виды поступлений. Откроются только выбранные разделы.',panels:[originalPanels[5]]},
  {title:'Причины',intro:'Если дохода мало или не было, укажите уважительные причины. Если их нет, переходите дальше.',panels:[originalPanels[1]]},
  {title:'Имущество',intro:'Добавьте имущество членов семьи. Если имущества нет, отметьте «Ничего из перечисленного нет».',panels:[originalPanels[4],originalPanels[3]]},
  {title:'Условия',intro:'Проверьте гражданство, адрес подачи и прежние меры поддержки.',panels:[originalPanels[0]]},
  {title:'Результат',intro:'Сначала короткий итог, затем подробности любого месяца.',panels:[originalPanels[6]]}
];
const anchor=document.querySelector('.wizard-actions');
steps.flatMap(step=>step.panels).forEach(panel=>anchor.before(panel));
originalPanels[6].id='result-panel';
originalPanels[6].querySelector('h2').textContent='Ваш предварительный результат';
originalPanels[6].querySelector('h2').nextElementSibling.textContent='Расчёт по вашим ответам. Решение о назначении принимает СФР.';
for(const [i,step] of steps.entries())for(const panel of step.panels)panel.dataset.step=String(i);
const stepReview=document.createElement('div');stepReview.id='step-review';stepReview.className='step-review';stepReview.hidden=true;stepReview.setAttribute('role','status');anchor.before(stepReview);
const periodNote=document.createElement('p');periodNote.id='income-period-note';periodNote.className='period-note';sourceSection.before(periodNote);
const incomeIntro=originalPanels[5].querySelector('#income-mode').closest('label').nextElementSibling;
if(incomeIntro?.classList.contains('hint'))incomeIntro.textContent='Отметьте, какие доходы были у вас и супруга в нужном периоде. Суммы зарплаты вводите до вычета налога. Пустое поле — сумма неизвестна, 0 — дохода действительно не было.';
const leaveHelp=document.createElement('div');leaveHelp.className='leave-help';leaveHelp.innerHTML='<h3>Куда внести пособие по беременности и родам?</h3><p>Отметьте выше «Пособие по беременности и родам (БиР) — разовая выплата». Нажмите «Далее: суммы доходов»: откроется отдельный шаг, где нужно указать всю сумму БиР, месяц начала отпуска и число месяцев начисления.</p><p class="hint">Зарплату до декрета и ежемесячное пособие по уходу отмечайте отдельно. Зарплатный период закончите последним месяцем начисления зарплаты.</p>';
periodNote.after(leaveHelp);
const careHelper=document.createElement('details');careHelper.id='care-helper';careHelper.className='leave-help';careHelper.innerHTML='<summary>Я ухаживаю за ребёнком до 3 лет</summary><p>Выберите ребёнка и проверьте месяцы, в которые вы действительно ухаживали за ним. Предлагаем прошедший период — его можно изменить.</p><label>За каким ребёнком?<select id="care-child"><option value="">Выберите ребёнка</option></select></label><label>Кто ухаживал?<select id="care-person"><option value="0">Вы</option><option value="1">Супруг(а)</option></select></label><label>Уход с месяца<input id="care-from" type="month"></label><label>По месяц включительно<input id="care-to" type="month"></label><button type="button" id="add-care-period">Добавить этот период ухода</button><p id="care-status" role="status" class="hint"></p>';
$('reasons').before(careHelper);
const proposeCarePeriod=()=>{const child=childData().find(child=>child.id===$('care-child').value);if(!child?.birthDate)return;const months=incomeWindow($('start').value||currentMonth);const birthMonth=child.birthDate.slice(0,7);$('care-from').value=birthMonth>months[0]?birthMonth:months[0];const thirdBirthday=String(Number(birthMonth.slice(0,4))+3)+birthMonth.slice(4);$('care-to').value=currentMonth<thirdBirthday?currentMonth:monthString(monthIndex(thirdBirthday)-1);$('care-status').textContent='Проверьте предложенные даты. Если ухаживали только часть периода, исправьте их.';};
$('care-child').oninput=proposeCarePeriod;
$('add-care-period').onclick=()=>{const from=$('care-from').value,to=$('care-to').value;const child=childData().find(child=>child.id===$('care-child').value);const birthday=child?.birthDate?.slice(0,7);const end=birthday?String(Number(birthday.slice(0,4))+3)+birthday.slice(4):'';
  if(!birthday||!from||!to||from>to||from<birthday||to>=end){$('care-status').textContent='Выберите ребёнка и период от рождения до месяца перед его трёхлетием. Начало должно быть раньше окончания.';return;}
  if([...$('reasons').children].some(row=>row.querySelector('.type').value==='careUnderThree'&&row.querySelector('.person').value===$('care-person').value&&row.querySelector('.from').value===from&&row.querySelector('.to').value===to)){$('care-status').textContent='Такой период уже добавлен ниже.';return;}
  addReason();const row=$('reasons').lastElementChild;row.querySelector('.person').value=$('care-person').value;row.querySelector('.type').value='careUnderThree';row.querySelector('.from').value=from;row.querySelector('.to').value=to;row.querySelector('.type').dispatchEvent(new Event('change'));$('care-status').textContent='Период добавлен. Его можно изменить или удалить ниже.';row.scrollIntoView({block:'center',behavior:'smooth'});
};
const conditionsQuick=document.createElement('div');conditionsQuick.className='quick-confirm';conditionsQuick.innerHTML='<p>Вы гражданин России, постоянно живёте в России и суд не ограничивал вашу дееспособность?</p><button type="button" class="remove">Да, всё так — заполнить эти три ответа</button>';
originalPanels[0].querySelector('h2').after(conditionsQuick);
conditionsQuick.querySelector('button').onclick=()=>{for(const [id,value] of [['applicant-citizen','yes'],['applicant-residence','yes'],['applicant-capacity','none']])if(!$(id).value)$(id).value=value;render()};
const capacityLabel=$('applicant-capacity').closest('label');capacityLabel.closest('details').before(capacityLabel);
let currentStep=0;
function showStep(index) {
  currentStep=Math.max(0,Math.min(steps.length-1,index));
  const requestedStep=currentStep;
  document.body.classList.toggle('inside-wizard',currentStep>0);
  const stepReview=$('step-review');if(stepReview){stepReview.hidden=true;stepReview.replaceChildren()}
  steps.forEach((step,i)=>step.panels.forEach(panel=>panel.hidden=i!==currentStep||(panel===originalPanels[3]&&!$('asset-car').checked)));
  const progress=$('progress');progress.replaceChildren();
  const counter=document.createElement('p');counter.className='step-counter';counter.textContent=`Шаг ${currentStep+1} из ${steps.length} · ${steps[currentStep].title}`;progress.append(counter);
  const links=document.createElement('div');links.className='step-links';
  steps.forEach((step,i)=>{const button=document.createElement('button');button.type='button';button.className=i===currentStep?'active':'';button.textContent=`${i+1}. ${step.title}`;if(i===currentStep)button.setAttribute('aria-current','step');button.onclick=()=>showStep(i);links.append(button)});progress.append(links);
  $('step-help').textContent=steps[currentStep].intro;
  $('back').hidden=currentStep===0; $('next').hidden=currentStep===steps.length-1;
  $('next').textContent=currentStep===steps.length-2?'Показать результат':'Далее: '+steps[currentStep+1]?.title;
  if(currentStep===steps.length-1)render();
  if(guidedFlow&&!guidedFlow.painting)guidedFlow.selectSection(requestedStep);
  if(!guidedFlow?.painting)window.scrollTo({top:0,behavior:'smooth'});
}
$('back').onclick=()=>showStep(currentStep-1);
$('next').onclick=()=>{if(!reviewStep())showStep(currentStep+1)};
render();showStep(0);
fetch('./data/rosstat-wages.json?v=20261008-39').then(response=>{if(!response.ok)throw new Error('No wage data');return response.json()}).then(table=>{rosstatAnnualTable=table;renderAlimonyWageYears();render()}).catch(()=>{/* Manual entry remains available. */});

fetch('./data/cbr-rates.json').then(response=>{if(!response.ok)throw new Error('No CBR data');return response.json()}).then(table=>{cbrRateTable=table;renderExtraRows();render()}).catch(()=>{/* Date-specific manual entry remains available. */});


function assetInputsMissing(){return [...document.querySelectorAll('.asset-choice:checked')].filter(box=>{const kind=box.id.slice(6);return kind==='car'?!$('cars').children.length:kind==='vehicle'?!$('other-vehicles').children.length:![...$('properties').children].some(row=>row.querySelector('.type').value===kind)})}
function updateRelevantFields() {
  if($('assets-none')){
    for(const row of $('properties').children){const kind=row.querySelector('.type').value;row.hidden=!$('asset-'+kind).checked;row.querySelector('.type').closest('label').hidden=true;let title=row.querySelector('.asset-row-title');if(!title){title=document.createElement('h4');title.className='asset-row-title';row.prepend(title)}title.textContent=row.querySelector('.type').selectedOptions[0].textContent;}
    document.querySelectorAll('.property-adds button').forEach(button=>button.hidden=!$('asset-'+button.dataset.kind).checked);
    $('rural').closest('label').hidden=!$('asset-land').checked;
    $('vehicle-fields').hidden=!$('asset-vehicle').checked;
    const carPanel=$('cars').closest('.panel');if(carPanel.dataset.step)carPanel.hidden=!$('asset-car').checked||!$('progress').querySelector('[aria-current]')?.textContent.startsWith('5.');
  }

  if($('care-child')){const select=$('care-child');const current=select.value;const choices=childData().filter(child=>child.birthDate&&child.birthDate<=applicationDateForMonth(currentMonth,31)&&monthString(monthIndex(child.birthDate.slice(0,7))+36)>=incomeWindow($('start').value||currentMonth)[0]);const key=JSON.stringify(choices.map(child=>[child.id,child.name]));if(select.dataset.options!==key){select.replaceChildren(new Option('Выберите ребёнка',''));choices.forEach((child,i)=>select.add(new Option(child.name||`Ребёнок ${i+1}`,child.id)));select.value=current;select.dataset.options=key;}$('care-helper').hidden=!choices.length;$('care-person').options[1].disabled=$('marital-status').value!=='married';}
  for(const row of $('reasons').children)row.querySelector('.service-help').hidden=!['military','incarceration'].includes(row.querySelector('.type').value);
  document.querySelectorAll('[aria-invalid="true"]').forEach(el=>{if(el.value&&el.validity.valid){el.removeAttribute('aria-invalid');el.classList.remove('field-invalid')}});
  syncAlimonyChildren();
  mainPayerSummary.textContent=extraAlimonyObligations.length?'Выберите детей для этого плательщика. Детей других родителей укажите в карточках ниже.':'На каких детей оформлены или поступают алименты? Отметьте нужных детей. Если плательщиков несколько, добавьте другого ниже.';
  primaryChildChoices.replaceChildren();
  childData().forEach((child,index)=>{const control=primaryAlimonyControl(child.id);const label=document.createElement('label');label.className='check';const choice=document.createElement('input');choice.type='checkbox';choice.checked=control.checked;choice.disabled=extraAlimonyObligations.some(item=>item.childIds.includes(child.id));choice.oninput=()=>{control.checked=choice.checked;renderAlimonyAllocationRows();render()};label.append(choice,document.createTextNode(' '+(child.name||`Ребёнок ${index+1}`)));primaryChildChoices.append(label)});
  alimonySection.hidden=$('marital-status').value!=='divorced'&&!sourceEnabled.has('alimony');
  $('pregnancy-registered').closest('label').hidden=!$('pregnancy-applying').checked;
  if($('pregnancy-applying').checked&&$('pregnancy-details'))$('pregnancy-details').open=true;
  $('sole-guardian').closest('label').hidden=![...document.querySelectorAll('#children .child-role')].some(el=>el.value==='ward');
  if($('renewal-help'))$('renewal-help').hidden=!$('large-family').checked;
  $('address-proof').closest('label').hidden=!['temporary','actual'].includes($('residence-basis').value);
  const start=$('start').value||currentMonth;
  forecastSettings.hidden=Number(start.slice(0,4))>2027||Number(monthString(monthIndex(start)+11).slice(0,4))<2027;
  $('pregnancy-details').hidden=!$('pregnancy-applying').checked;
  const horizon=applicationDateForMonth(monthString(monthIndex(start)+11),1);
  const childRows=[...document.querySelectorAll('#children .form-row')];
  const newbornPossible=childRows.some(row=>row.querySelector('.birth').value&&row.querySelector('.birth').value>=monthString(monthIndex(start)-6)+'-01'&&row.querySelector('.birth').value<=horizon);
  $('same-recipient').closest('label').hidden=true;
  const olderAwardExists=childRows.some(row=>['self','other'].includes(row.querySelector('.award-recipient').value));
  if($('newborn-explanation'))$('newborn-explanation').hidden=!newbornPossible||!olderAwardExists;
  $('mother-pregnancy-benefit').closest('label').hidden=!newbornPossible||!olderAwardExists;
  $('application-mode').closest('label').hidden=childRows.length<2;
  applicationChoice.querySelector('.hint').hidden=childRows.length<2||$('application-mode').value!=='separate';

  for(const row of document.querySelectorAll('#children .form-row')) {
    const birth=row.querySelector('.birth').value;
    const adult=!!birth&&ageAt(birth,applicationDateForMonth(start,Number($('day').value)||1))>=18;
    row.querySelector('.married').closest('label').hidden=!adult;
    row.querySelector('.student').closest('label').hidden=!adult;
    const familyStatus=row.querySelector('.child-family-status');if(![...familyStatus.options].some(option=>option.value==='minorMarried'))familyStatus.add(new Option('Несовершеннолетний ребёнок вступил в брак','minorMarried'));
    if(!adult&&row.querySelector('.married').value==='yes'&&familyStatus.value==='ordinary')familyStatus.value='minorMarried';
    
    const quick=row.querySelector('.quick-confirm');if(quick)quick.hidden=row.querySelector('.child-role').value==='ward'||['applicant-rights','second-parent-status'].every(cls=>row.querySelector('.'+cls).value);
    const recipient=row.querySelector('.award-recipient').value;
    const award=row.querySelector('.award-fields');if(award)award.hidden=!['self','other'].includes(recipient);
    row.querySelector('.court-residence').closest('label').hidden=recipient!=='other';
    row.querySelector('.alimony-applies').disabled=extraAlimonyObligations.some(item=>item.childIds.includes(row.dataset.childId));
    row.querySelector('.alimony-applies').closest('label').hidden=true;
    const title=row.querySelector('.child-card-title');if(title)title.textContent=row.querySelector('.child-name').value.trim()||`Ребёнок ${[...row.parentElement.children].indexOf(row)+1}`;
  }
}

const draftKey='anna-benefit-draft-v1';
const draftRows=[['children',addChild],['reasons',addReason],['cars',addCar],['properties',addProperty],['other-vehicles',addOtherVehicle],['deposits',addDeposit]];
const readControl=el=>({value:el.value,checked:el.checked});
function writeControl(el,data) {if(!el||!data)return;el.value=data.value??'';if(el.type==='checkbox')el.checked=!!data.checked;}
function captureDraft() {
  const fixed={};document.querySelectorAll('input[id],select[id]').forEach(el=>{if(el.id!=='save-draft')fixed[el.id]=readControl(el)});
  const rows={};for(const [id] of draftRows)rows[id]=[...$(id).children].map(row=>({childId:row.dataset.childId,fields:[...row.querySelectorAll('input,select')].map((el,i)=>({...readControl(el),key:el.dataset.draftIndex??String(i)}))}));
  return {version:1,layout:2,fixed,rows,step:currentStep,nextChildId,incomePeople,savedSpouse,benefitPayments,maternityPayments,additionalEntries,childIncomeEntries,priorSupportEntries,extraAlimonyObligations,alimonyAllocation:[...alimonyAllocation],alimonyWageRecords:[...alimonyWageRecords],sources:[...sourceEnabled]};
}
function saveDraft() {
  if(restoringDraft||!$('save-draft').checked)return;
  try {localStorage.setItem(draftKey,JSON.stringify(captureDraft()));$('draft-status').textContent='Черновик сохранён в этом браузере.'}
  catch {$('draft-status').textContent='Браузер не разрешил сохранить черновик. Не закрывайте страницу до завершения.'}
}
function restoreDraft(data) {
  if(data?.version!==1||!data.fixed||!data.rows||!Array.isArray(data.incomePeople)||data.incomePeople.length<1||data.incomePeople.length>2)throw new Error('Неверный черновик');
  restoringDraft=true;
  try {
    for(const [id,value] of Object.entries(data.fixed))writeControl($(id),value);
    for(const [id,create] of draftRows) {
      $(id).replaceChildren();
      for(const saved of (data.rows[id]||[]).slice(0,100)) {
        create();const row=$(id).lastElementChild;
        if(saved.childId)row.dataset.childId=saved.childId;
        [...row.querySelectorAll('input,select')].forEach((el,i)=>writeControl(el,draftField(saved.fields,el,i)));
      }
    }
    for(const [target,key] of [[incomePeople,'incomePeople'],[benefitPayments,'benefitPayments'],[maternityPayments,'maternityPayments'],[additionalEntries,'additionalEntries'],[childIncomeEntries,'childIncomeEntries'],[priorSupportEntries,'priorSupportEntries'],[extraAlimonyObligations,'extraAlimonyObligations']])target.splice(0,target.length,...(data[key]||[]));
    nextChildId=data.nextChildId||1;savedSpouse=data.savedSpouse||null;
    sourceEnabled.clear();for(const key of data.sources||[])sourceEnabled.add(key);
    updatePmSelection();
    for(const [id,value] of Object.entries(data.fixed))writeControl($(id),value);
    const restoredYear=Number($('start').value.slice(0,4));
    const zoneYear=restoredYear===2027&&pmFor(restoredYear,$('pm-region').value).status==='unknown'?2026:restoredYear;
    $('pm-area').value=zoneValue(pmZones(zoneYear,$('pm-region').value),data.fixed['pm-area']?.value||'');
    const previousContext={region:data.fixed['pm-region']?.value||'',area:data.fixed['pm-area']?.value||''};
    const currentContext={region:$('pm-region').value,area:$('pm-area').value};
    const sameZone=[2025,2026].every(year=>{const a=pmFor(year,currentContext.region,previousContext.area),b=pmFor(year,currentContext.region,currentContext.area);return a.status==='known'&&b.status==='known'&&a.person===b.person&&a.working===b.working&&a.child===b.child});
    if(sameZone)for(const entry of benefitPayments)if(entry.confirmedContext===receiptContext(entry,previousContext))entry.confirmedContext=receiptContext(entry,currentContext);
    syncSearchableSelect($('pm-region'));syncSearchableSelect($('pm-area'));
    alimonyAllocation.clear();for(const [key,value] of data.alimonyAllocation||[])alimonyAllocation.set(key,value);
    alimonyWageRecords.clear();for(const [key,value] of data.alimonyWageRecords||[])alimonyWageRecords.set(key,value);
    lastWageRegion=$('pm-region').value;
    sourceSection.querySelectorAll('input:not(#no-income)').forEach(box=>box.checked=sourceEnabled.has(box.value));
    $('income-people').hidden=!sourceEnabled.has('employment');$('income-mode').closest('label').hidden=!sourceEnabled.has('employment');
    extraSection.hidden=![...sourceEnabled].some(key=>ADDITIONAL_TYPES[key]);childIncomeSection.hidden=!sourceEnabled.has('childIncome');
    benefitsSection.hidden=!sourceEnabled.has('childBenefit');maternitySection.hidden=!sourceEnabled.has('maternity');$('deposit-section').hidden=!sourceEnabled.has('deposit');
    renderIncomeForm();renderBenefitRows();renderMaternityRows();renderExtraRows();renderChildIncomeRows();renderPriorSupportRows();renderAlimonyAllocationRows();renderExtraAlimonyObligations();renderAlimonyWageYears();
    priorSupportPanel.hidden=$('prior-measure').value!=='yes';$('capacity-dates').hidden=!['limited','incapable'].includes($('applicant-capacity').value);
    refreshAssetOwners();
    for(const [id] of draftRows)for(const [i,row] of [...$(id).children].entries()) {
      const saved=data.rows[id]?.[i];if(saved)[...row.querySelectorAll('input,select')].forEach((el,j)=>writeControl(el,draftField(saved.fields,el,j)));
      if(id==='reasons')row.querySelector('.type').dispatchEvent(new Event('change'));
      if(id==='properties'||id==='other-vehicles')row.querySelector('.type').dispatchEvent(new Event('input'));
      if(id==='children')row.querySelector('.applying').dispatchEvent(new Event('input'));
    }
    if(!data.fixed['assets-none']){
      for(const row of $('properties').children){const box=$('asset-'+row.querySelector('.type').value);if(box)box.checked=true}
      $('asset-car').checked=$('cars').children.length>0;$('asset-vehicle').checked=$('other-vehicles').children.length>0;
      $('assets-none').checked=![...assetPicker.querySelectorAll('.asset-choice')].some(box=>box.checked);
    }
    refreshMaritalForm();
  } finally {restoringDraft=false}
  render();showStep(Number.isInteger(data.step)?(data.layout===2?data.step:([1,2,3,4,6][data.step]??0)):0);
}
$('save-draft').addEventListener('change',()=>{
  if($('save-draft').checked)saveDraft();else {try{localStorage.removeItem(draftKey)}catch{}$('draft-status').textContent='Сохранение выключено; сохранённый черновик удалён.'}
});
$('clear-draft').onclick=()=>{try{localStorage.removeItem(draftKey)}catch{}$('save-draft').checked=false;$('draft-status').textContent='Сохранённый черновик удалён. Введённые ответы остаются на странице.'};
let draftTimer;
for(const event of ['input','change','click'])document.addEventListener(event,()=>{clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,200)});
window.addEventListener('pagehide',saveDraft);
$('print-results').onclick=()=>{
  document.querySelectorAll('#results details').forEach(el=>{el.dataset.printOpen=String(el.open);el.open=true});
  window.print();
};
window.addEventListener('afterprint',()=>document.querySelectorAll('#results details').forEach(el=>{el.open=el.dataset.printOpen==='true';delete el.dataset.printOpen}));
try {const raw=localStorage.getItem(draftKey);if(raw){restoreDraft(JSON.parse(raw));$('save-draft').checked=true;$('draft-status').textContent='Черновик восстановлен. Проверьте даты и суммы перед расчётом.'}}
catch {$('draft-status').textContent='Не удалось восстановить черновик. Заполните анкету заново.'}
updateRelevantFields();

function openResultAnswer(selector,month) {
  const field=document.querySelector(selector);if(!field)return;
  guidedFlow?.revealField(field);
  for(let parent=field.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  let banner=$('result-edit-context');if(!banner){banner=document.createElement('div');banner.id='result-edit-context';banner.className='result-edit-context';$('progress').after(banner)}
  banner.replaceChildren();const text=document.createElement('p');text.textContent=`Дополните ответы для подачи в ${monthLabel(month)}. После изменения вернитесь к результату — прогноз пересчитается.`;banner.append(text);
  const back=document.createElement('button');back.type='button';back.textContent='Вернуться к результату';back.onclick=()=>{banner.hidden=true;guidedFlow?.selectSection(6);const card=$('results').querySelector(`[data-result-month="${month}"] details`);if(card){card.open=true;card.scrollIntoView({block:'center',behavior:'smooth'})}};banner.append(back);banner.hidden=false;
  field.scrollIntoView({block:'center',behavior:'smooth'});(field.matches('input,select,button')?field:field.querySelector('input,select,button'))?.focus();
}

function renderCompletionChecklist() {
  const issues=[];
  const check=(id,label,step)=>{if(!$(id).value)issues.push({label,step,selector:'#'+id})};
  for(const [id,label,step] of [['applicant-citizen','Гражданство заявителя',0],['applicant-residence','Проживание в России',0],['applicant-capacity','Если есть решение суда о дееспособности',0],['residence-basis','Адрес подачи',0],['prior-measure','Прежние меры поддержки',0],['marital-status','Семейное положение заявителя',1],['pm-region','Регион проживания',1]])check(id,label,step);
  if($('assets-none')&&!$('assets-none').checked&&![...document.querySelectorAll('.asset-choice')].some(input=>input.checked))issues.push({label:'Имущество семьи: выберите виды или «Ничего нет»',step:4,selector:'#assets-none'});
  assetInputsMissing().forEach(box=>issues.push({label:'Добавьте объект: '+box.parentElement.textContent.trim(),step:4,selector:'#'+box.id}));
  if(!sourceEnabled.size&&!$('no-income').checked)issues.push({label:'Виды дохода или подтверждение их отсутствия',step:1,selector:'#no-income'});
  document.querySelectorAll('#children .form-row').forEach((row,i)=>{
    for(const [cls,label] of [['birth','дата рождения'],['married','семейное положение'],['citizen','гражданство и проживание']])if(!row.querySelector('.'+cls).value&&!row.querySelector('.'+cls).closest('label').hidden)issues.push({label:`Ребёнок ${i+1}: ${label}`,step:0,selector:`#children .form-row:nth-child(${i+1}) .${cls}`});
    if(row.querySelector('.applying').checked&&row.querySelector('.child-role').value!=='ward'&&!row.querySelector('.applicant-rights').value)issues.push({label:`Ребёнок ${i+1}: родительские права заявителя`,step:0,selector:`#children .form-row:nth-child(${i+1}) .applicant-rights`});
  });
  const box=$('completion-check');if(!box)return;box.replaceChildren();box.hidden=!issues.length;
  if(!issues.length)return;
  const title=document.createElement('h3');title.textContent='Что заполнить для расчёта';box.append(title);
  const text=document.createElement('p');text.textContent='Начните с этих ответов. Дополнительные уточнения по доходам и документам показаны внутри каждого месяца.';box.append(text);
  for(const issue of issues){const button=document.createElement('button');button.type='button';button.className='review-link';button.textContent=issue.label;button.onclick=()=>{const field=document.querySelector(issue.selector);showStep(Number(field?.closest('.panel')?.dataset.step??issue.step));for(let parent=field?.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;guidedFlow?.revealField(field);field?.focus();field?.scrollIntoView({block:'center',behavior:'smooth'})};box.append(button)}
}

function organizeChildCard(row) {
  [...row.querySelectorAll('input,select')].forEach((el,i)=>el.dataset.draftIndex=String(i));
  row.classList.add('child-card');
  const title=document.createElement('h3');title.className='child-card-title';title.textContent='Ребёнок';row.prepend(title);
  const core=document.createElement('div');core.className='child-core';
  for(const cls of ['child-name','birth','child-role','applying','citizen','married','applicant-rights','second-parent-status','student','award-recipient'])core.append(row.querySelector('.'+cls).closest('label'));
  title.after(core);
  for(const [cls,text] of [['award-recipient','Единое пособие уже назначено? Кому?'],['applicant-rights','Суд ограничивал или лишал вас прав на этого ребёнка?'],['married','Ребёнок состоит в браке?']]) {
    const label=row.querySelector('.'+cls).closest('label');label.firstChild.textContent=text;
  }

  const circumstances=document.createElement('details');circumstances.className='child-circumstances';circumstances.innerHTML='<summary>Семейные обстоятельства и родительские права</summary>';
  for(const cls of ['applicant-rights','second-parent-status'])circumstances.append(row.querySelector('.'+cls).closest('label'));
  core.after(circumstances);
  const quick=document.createElement('div');quick.className='quick-confirm';
  quick.innerHTML='<p>Второй родитель указан в свидетельстве о рождении, ваши родительские права сохранены?</p><button type="button" class="remove">Да, всё так — заполнить эти ответы</button><small>Если хотя бы один ответ другой, откройте обстоятельства ниже.</small>';
  quick.querySelector('button').onclick=()=>{for(const [cls,value] of [['applicant-rights','intact'],['second-parent-status','recorded']]){const el=row.querySelector('.'+cls);if(!el.value)el.value=value}render();};core.after(quick);
  const award=[...row.querySelectorAll('details')].find(d=>d.querySelector('.award-tier'));award.classList.add('award-fields');award.querySelector('summary').textContent='Размер и срок уже назначенного пособия';
  row.querySelector(':scope > .remove').textContent='Удалить ребёнка';
  row.querySelector('.child-role').closest('label').hidden=true;
  const roleDetails=document.createElement('details');roleDetails.className='child-role-help';roleDetails.innerHTML='<summary>Я опекун или попечитель этого ребёнка</summary>';const role=row.querySelector('.child-role').closest('label');role.hidden=false;roleDetails.append(role);circumstances.append(roleDetails);
}

function draftField(fields,el,index) {const key=el.dataset.draftIndex??String(index);return fields.some(field=>field.key!==undefined)?fields.find(field=>field.key===key):fields[Number(key)];}

// Missing answers are shown before leaving a step; users can still continue and return.
function reviewStep() {
  const issues=[];const ask=(el,text)=>{if(el&&!el.disabled&&(!el.value||!el.validity.valid))issues.push({el,text})};
  if(currentStep===0){for(const [id,text] of [['pm-region','Выберите регион'],['marital-status','Укажите семейное положение'],['start','Выберите месяц подачи']])ask($(id),text);if($('marital-status').value==='married'&&$('spouse-status').value==='unknown')issues.push({el:$('spouse-status'),text:'Уточните, входит ли супруг в состав семьи'});if(!$('pm-area').closest('label').hidden)ask($('pm-area'),'Выберите местность в регионе');}
  if(currentStep===1){for(const [i,row] of [...$('children').children].entries()){for(const [cls,text] of [['birth','дата рождения'],['citizen','гражданство и проживание'],['married','семейное положение']])if(!row.querySelector('.'+cls).closest('label').hidden)ask(row.querySelector('.'+cls),`Ребёнок ${i+1}: ${text}`);if(row.querySelector('.applying').checked&&row.querySelector('.award-recipient').value==='unknown')issues.push({el:row.querySelector('.award-recipient'),text:`Ребёнок ${i+1}: уже назначено единое пособие?`});if(row.querySelector('.applying').checked&&row.querySelector('.child-role').value!=='ward')ask(row.querySelector('.applicant-rights'),`Ребёнок ${i+1}: родительские права`);}if(!$('children').children.length&&!$('pregnancy-applying').checked)issues.push({el:$('add-child'),text:'Добавьте ребёнка или выберите пособие по беременности'});}
  if(currentStep===2){if(!sourceEnabled.size&&!$('no-income').checked)issues.push({el:$('no-income'),text:'Отметьте виды доходов или их отсутствие'});if(sourceEnabled.has('employment')&&$('income-mode').value==='period')document.querySelectorAll('#income-people .regular-amount,#income-people .regular-from,#income-people .regular-to').forEach(el=>ask(el,'Заполните сумму и период зарплаты'));}
  if(currentStep===3)document.querySelectorAll('#reasons .from,#reasons .to').forEach(el=>ask(el,'Укажите начало и окончание причины отсутствия дохода'));
  if(currentStep===4){if(!$('assets-none').checked&&![...document.querySelectorAll('.asset-choice')].some(el=>el.checked))issues.push({el:$('assets-none'),text:'Отметьте имущество или его отсутствие'});}
  if(currentStep===5){for(const [id,text] of [['applicant-citizen','Гражданство'],['applicant-residence','Проживание в России'],['applicant-capacity','Решения суда о дееспособности'],['residence-basis','Адрес подачи'],['prior-measure','Прежние выплаты']])ask($(id),text);}
  const box=$('step-review');box.replaceChildren();box.hidden=!issues.length;if(!issues.length)return false;
  const title=document.createElement('h3');title.textContent='На этом шаге остались вопросы';box.append(title);const hint=document.createElement('p');hint.textContent='Можно заполнить сейчас или продолжить и вернуться позже.';box.append(hint);
  for(const {el,text} of issues){if(el.matches('input,select')){el.setAttribute('aria-invalid','true');el.classList.add('field-invalid')}const link=document.createElement('button');link.type='button';link.className='review-link';link.textContent=text;link.onclick=()=>{for(let parent=el.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;el.focus();el.scrollIntoView({block:'center',behavior:'smooth'})};box.append(link)}
  const skip=document.createElement('button');skip.type='button';skip.className='remove';skip.textContent='Продолжить, заполню позже';skip.onclick=()=>showStep(currentStep+1);box.append(skip);box.scrollIntoView({block:'center',behavior:'smooth'});return true;
}

// The guided view moves controls; calculation and draft identities remain unchanged.
guidedFlow=createGuidedFlow({steps,showSection:showStep,render,sourceEnabled,parents:{basic:basicGrid,children:originalPanels[2],income:originalPanels[5],reasons:originalPanels[1],property:originalPanels[4],cars:originalPanels[3],conditions:originalPanels[0],result:originalPanels[6]},nodes:{sourceSection,periodNote,leaveHelp,extraSection,benefitsSection,maternitySection,childIncomeSection,alimonySection,applicationChoice,pregnancyPanel,assetPicker,propertyAdds,conditionsQuick,priorSupportPanel},currentSection:currentStep,addChild});
