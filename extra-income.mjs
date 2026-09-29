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
  foreignEarned:{label:'Заработок из-за рубежа (рублёвый эквивалент)',period:'monthly',qualifies:true},
  securities:{label:'Ценные бумаги / дивиденды',period:'annual',qualifies:false},
  business:{label:'Доход ИП за налоговый год',period:'annual',qualifies:true},
  propertySale:{label:'Налоговая база от продажи имущества',period:'annual',qualifies:false},
  rent:{label:'Аренда имущества',period:'annual',qualifies:false},
  copyright:{label:'Авторский доход',period:'annual',qualifies:true}
};

// Decree 2330 p. 53. Only unmistakable categories are offered here; a
// conditional payment (for example some uses of maternity capital) must be
// classified after its statutory purpose is known.
export const OTHER_BENEFIT_KINDS = {
  counted:{label:'Иное учитываемое пособие / компенсация',excluded:false},
  employerBirthAid:{label:'Единовременная материальная помощь работодателя при рождении / усыновлении / опеке',excluded:false},
  maternityCapitalMonthly:{label:'Ежемесячная выплата из материнского капитала на ребёнка до 3 лет',excluded:true},
  socialContract:{label:'Государственная социальная помощь по социальному контракту',excluded:true},
  taxRefund:{label:'Возврат НДФЛ из-за налогового вычета',excluded:true},
  funeral:{label:'Социальное пособие на погребение',excluded:true},
  emergencyAid:{label:'Единовременная помощь в связи с ЧС или терактом',excluded:true},
  childTreatmentAid:{label:'Единовременная материальная помощь на лечение ребёнка',excluded:true},
};

export function additionalIncomeForApplication(entries,applicationMonth,excludedPersonIndices=[]) {
  const window=incomeWindow(applicationMonth),byPerson=new Map(),issues=[],excluded=[];
  for(const entry of entries) {
    if(excludedPersonIndices.includes(entry.personIndex))continue;
    const definition=ADDITIONAL_TYPES[entry.type];
    if(!definition || !Number.isFinite(entry.amount) || entry.amount<0) {issues.push('Уточните вид и сумму дополнительного дохода');continue}
    const benefitKind=entry.type==='otherBenefit'?OTHER_BENEFIT_KINDS[entry.benefitKind]:null;
    if(entry.type==='otherBenefit'&&!benefitKind) {issues.push('Уточните вид другого пособия: часть выплат исключается по пункту 53');continue}
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
    const months=definition.period==='annual'
      ? window.filter(m=>Number(m.slice(0,4))===entry.taxYear)
      : window.filter(m=>entry.from && entry.to && m>=entry.from && m<=entry.to);
    if(definition.period==='annual'&&!Number.isInteger(entry.taxYear) || definition.period==='monthly'&&(!entry.from||!entry.to||entry.from>entry.to)) {
      issues.push('Уточните налоговый год или месяцы получения дохода');continue;
    }
    if(benefitKind?.excluded) {
      excluded.push({type:entry.benefitKind,label:benefitKind.label,amount:entry.amount*months.length});
      continue;
    }
    const birthExclusion=entry.type==='otherBenefit'&&entry.benefitKind==='employerBirthAid'&&entry.birthAidFirstYear?entry.taxExemptAmount:0;
    if(birthExclusion && months.length) excluded.push({type:'employerBirthAid',label:'Необлагаемая часть помощи работодателя при рождении',amount:birthExclusion});
    const relevantAmount=entry.type==='securities'?entry.amount-entry.expenses:entry.amount-birthExclusion;
    const value=definition.period==='annual'?relevantAmount/12:relevantAmount;
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
