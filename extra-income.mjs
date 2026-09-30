import {incomeWindow} from './engine.mjs';

// Decree 2330 p. 47, 49, 50. Annual categories under p. 50 are spread over
// twelve months of the tax year; exact exclusions under p. 53 are separate.
export const ADDITIONAL_TYPES = {
  pension:{label:'Пенсия / больничный',period:'monthly',qualifies:true},
  scholarship:{label:'Стипендия',period:'monthly',qualifies:true},
  academicMedical:{label:'Компенсация при академическом отпуске по медицинским показаниям',period:'monthly',qualifies:true},
  guardianReward:{label:'Вознаграждение приёмного родителя / возмездного опекуна',period:'monthly',qualifies:true},
  successorPayment:{label:'Выплата правопреемнику умершего застрахованного лица',period:'monthly',qualifies:false},
  publicDuty:{label:'Компенсация за государственные или общественные обязанности',period:'monthly',qualifies:false},
  military:{label:'Денежное довольствие',period:'monthly',qualifies:true},
  rationCompensation:{label:'Денежная компенсация вместо продовольственного пайка',period:'monthly',qualifies:true},
  judgeAllowance:{label:'Пожизненное содержание судьи в отставке',period:'monthly',qualifies:true},
  serviceSeverance:{label:'Единовременное пособие при увольнении со службы',period:'monthly',qualifies:false},
  otherBenefit:{label:'Другое пособие или компенсация',period:'monthly',qualifies:false},
  unemploymentBenefit:{label:'Пособие по безработице',period:'monthly',qualifies:false},
  lottery:{label:'Выигрыш в лотерею / тотализаторе',period:'monthly',qualifies:false},
  selfEmployed:{label:'Самозанятость',period:'monthly',qualifies:true},
  foreignEarned:{label:'Заработок в иностранной валюте',period:'monthly',qualifies:true},
  securities:{label:'Ценные бумаги / дивиденды',period:'annual',qualifies:false},
  business:{label:'Доход ИП за налоговый год',period:'annual',qualifies:true},
  propertySale:{label:'Налоговая база от продажи имущества',period:'annual',qualifies:false},
  rent:{label:'Аренда имущества',period:'annual',qualifies:false},
  copyright:{label:'Авторский доход',period:'annual',qualifies:true}
};

// Decree 2330 p. 55: one CBR rate on the final calendar date of the twelfth
// income-window month, rather than a different rate for each payment.
export function foreignRateDate(applicationMonth) {
  const lastMonth=incomeWindow(applicationMonth).at(-1);
  const [year,month]=lastMonth.split('-').map(Number);
  return new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
}

// Decree 2330 p. 53. Only unmistakable categories are offered here; a
// conditional payment (for example some uses of maternity capital) must be
// classified after its statutory purpose is known.
export const OTHER_BENEFIT_KINDS = {
  counted:{label:'Иное учитываемое пособие / компенсация',excluded:false},
  employerBirthAid:{label:'Единовременная материальная помощь работодателя при рождении / усыновлении / опеке',excluded:false},
  maternityCapitalMonthly:{label:'Ежемесячная выплата из материнского капитала на ребёнка до 3 лет',excluded:true},
  maternityCapitalUse:{label:'Средства федерального или регионального материнского капитала (не ежемесячная выплата)',excluded:false},
  socialContract:{label:'Государственная социальная помощь по социальному контракту',excluded:true},
  taxRefund:{label:'Возврат НДФЛ из-за налогового вычета',excluded:true},
  funeral:{label:'Социальное пособие на погребение',excluded:true},
  emergencyAid:{label:'Единовременная помощь в связи с ЧС или терактом',excluded:true},
  childTreatmentAid:{label:'Единовременная материальная помощь на лечение ребёнка',excluded:true},
  insuranceDamage:{label:'Страховое возмещение вреда жизни, здоровью или имуществу',excluded:false},
  mseRehabilitation:{label:'Выплата на дополнительные расходы по реабилитации по решению МСЭ',excluded:false},
  targetedAssetSupport:{label:'Целевая господдержка на покупку жилья, транспорта или техники',excluded:false},
  pregnancyBenefitArrears:{label:'Доплата единого пособия беременной за прошлые периоды',excluded:true},
  disabledChildCare:{label:'Ежемесячная выплата по уходу родителю ребёнка-инвалида или инвалида с детства I группы',excluded:true},
  parentAward:{label:'Выплата за звание «Мать-героиня», орден или медаль «Родительская слава»',excluded:true},
  rehabilitationEquipment:{label:'Компенсация за самостоятельно приобретённые средства реабилитации',excluded:true},
  homeEducationMeals:{label:'Компенсация бесплатного двухразового питания ребёнку с ОВЗ при обучении дома',excluded:true},
  fallenProviderHomeRepair:{label:'Целевые федеральные средства на ремонт дома семьи погибшего кормильца',excluded:true},
};

export function additionalIncomeForApplication(entries,applicationMonth,excludedPersonIndices=[]) {
  const window=incomeWindow(applicationMonth),byPerson=new Map(),issues=[],excluded=[];
  for(const entry of entries) {
    if(excludedPersonIndices.includes(entry.personIndex))continue;
    const definition=ADDITIONAL_TYPES[entry.type];
    if(!definition || !Number.isFinite(entry.amount) || entry.amount<0) {issues.push('Уточните вид и сумму дополнительного дохода');continue}
    const benefitKind=entry.type==='otherBenefit'?OTHER_BENEFIT_KINDS[entry.benefitKind]:null;
    if(entry.type==='otherBenefit'&&!benefitKind) {issues.push('Уточните вид другого пособия: часть выплат исключается по пункту 53');continue}
    if(entry.type==='otherBenefit'&&entry.benefitKind==='maternityCapitalUse') {
      const allowedFederal=['disabledGoods','individualHousing','blockHousing'];
      if(entry.matcapConfirmed!==true || !['federal','regional'].includes(entry.matcapSource)
        || entry.matcapSource==='federal'&&!allowedFederal.includes(entry.matcapPurpose)) {
        issues.push('Уточните источник и документально подтверждённое направление маткапитала: не все виды расходования федеральных средств перечислены в пункте 53');continue;
      }
    }
    if(entry.type==='otherBenefit'&&['insuranceDamage','mseRehabilitation','targetedAssetSupport'].includes(entry.benefitKind)) {
      if(entry.benefitKind==='insuranceDamage' && (entry.from!==entry.to || entry.verifiedInsuranceDamage!==true)) {
        issues.push('Для страхового возмещения подтвердите единовременную выплату за вред жизни, здоровью или личному/общему имуществу и месяц получения');continue;
      }
      if(entry.benefitKind==='mseRehabilitation' && entry.mseAdditionalExpenses!==true) {
        issues.push('Для реабилитационных расходов требуется решение МСЭ о дополнительных расходах');continue;
      }
      if(entry.benefitKind==='targetedAssetSupport' && (entry.from!==entry.to || !['realEstate','vehicle','equipment'].includes(entry.assetPurpose) || entry.spentOnPurpose!==true)) {
        issues.push('Для целевой господдержки подтвердите покупку указанного имущества на эти средства и месяц получения');continue;
      }
    }
    if(entry.type==='otherBenefit'&&entry.benefitKind==='employerBirthAid') {
      if(entry.from!==entry.to || !entry.from) {issues.push('Помощь работодателя при рождении укажите в одном месяце выплаты');continue}
      if(typeof entry.birthAidFirstYear!=='boolean') {issues.push('Уточните, выплачена ли помощь работодателя в течение первого года после рождения, усыновления или установления опеки');continue}
      if(entry.birthAidFirstYear && (!Number.isFinite(entry.taxExemptAmount)||entry.taxExemptAmount<0||entry.taxExemptAmount>entry.amount)) {
        issues.push('Уточните освобождённую от НДФЛ часть помощи работодателя по справке');continue;
      }
    }
    if(entry.type==='securities'&&(!Number.isFinite(entry.expenses)||entry.expenses<0||entry.expenses>entry.amount)) {
      issues.push('Уточните расходы по операциям с ценными бумагами; они не могут превышать введённую выручку');continue;
    }
    if(entry.type==='business') {
      if(!['usnGross','usnDocumented','documentedOther'].includes(entry.businessBasis)) {
        issues.push('Для ИП уточните налоговый режим и является ли введённая сумма выручкой или документально определённым доходом');continue;
      }
      if(entry.businessBasis==='usnDocumented' && (!Number.isFinite(entry.expenses)||entry.expenses<0||entry.expenses>entry.amount||entry.expensesDocumented!==true)) {
        issues.push('Для УСН «доходы» укажите подтверждённые расходы не выше выручки и возможность представить документы в СФР');continue;
      }
      const grant=entry.targetedBusinessSupportAmount??0;
      if(!Number.isFinite(grant)||grant<0||grant>entry.amount || grant>0 && (entry.businessBasis==='documentedOther'||entry.targetedBusinessSupportDocumented!==true
        || entry.businessBasis==='usnDocumented'&&entry.expensesExcludeGrantCosts!==true
        || entry.businessBasis==='usnDocumented'&&grant+entry.expenses>entry.amount)) {
        issues.push('Уточните целевую субсидию ИП и документы; расходы не должны повторно включать затраты, оплаченные из субсидии');continue;
      }
    }
    const months=definition.period==='annual'
      ? window.filter(m=>Number(m.slice(0,4))===entry.taxYear)
      : window.filter(m=>entry.from && entry.to && m>=entry.from && m<=entry.to);
    if(definition.period==='annual'&&!Number.isInteger(entry.taxYear) || definition.period==='monthly'&&(!entry.from||!entry.to||entry.from>entry.to)) {
      issues.push('Уточните налоговый год или месяцы получения дохода');continue;
    }
    if(entry.type==='foreignEarned'&&months.length) {
      const date=foreignRateDate(applicationMonth);
      if(!/^[A-Z]{3}$/.test(entry.currency||'') || entry.rateDate!==date || !Number.isFinite(entry.rublesPerUnit) || entry.rublesPerUnit<=0) {
        issues.push(`Для заработка в валюте укажите буквенный код валюты и курс ЦБ в рублях за 1 единицу на ${date}; прошлый курс для другого месяца подачи не подходит`);
        continue;
      }
    }
    if(benefitKind?.excluded || entry.type==='otherBenefit'&&['insuranceDamage','mseRehabilitation','targetedAssetSupport','maternityCapitalUse'].includes(entry.benefitKind)) {
      excluded.push({type:entry.benefitKind,label:benefitKind.label,amount:entry.amount*months.length});
      continue;
    }
    if(entry.type==='business'&&entry.targetedBusinessSupportAmount>0&&months.length)
      excluded.push({type:'businessTargetedSupport',label:'Подтверждённая целевая поддержка предпринимательства',amount:entry.targetedBusinessSupportAmount*months.length/12});
    const birthExclusion=entry.type==='otherBenefit'&&entry.benefitKind==='employerBirthAid'&&entry.birthAidFirstYear?entry.taxExemptAmount:0;
    if(birthExclusion && months.length) excluded.push({type:'employerBirthAid',label:'Необлагаемая часть помощи работодателя при рождении',amount:birthExclusion});
    const relevantAmount=entry.type==='securities'?entry.amount-entry.expenses:
      entry.type==='business'?entry.amount-(entry.targetedBusinessSupportAmount||0)-(entry.businessBasis==='usnDocumented'?entry.expenses:0):
      entry.amount-birthExclusion;
    const value=(definition.period==='annual'?relevantAmount/12:relevantAmount)*(entry.type==='foreignEarned'&&months.length?entry.rublesPerUnit:1);
    const person=byPerson.get(entry.personIndex)||{};
    for(const month of months) {
      const previous=person[month]||{total:0,qualifying:0};
      person[month]={total:previous.total+value,qualifying:previous.qualifying+(definition.qualifies?value:0)};
    }
    byPerson.set(entry.personIndex,person);
  }
  const total=[...byPerson.values()].flatMap(person=>Object.values(person)).reduce((s,v)=>s+v.total,0);
  return {status:issues.length?'unknown':'known',amount:issues.length?null:total,byPerson,issues,excluded};
}
