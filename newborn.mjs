function addSixCalendarMonths(date) {
  const [year,month,day]=date.split('-').map(Number);
  const targetMonth=month+6;
  const targetYear=year+Math.floor((targetMonth-1)/12);
  const targetMonthInYear=(targetMonth-1)%12+1;
  const lastDay=new Date(Date.UTC(targetYear,targetMonthInYear,0)).getUTCDate();
  return `${targetYear}-${String(targetMonthInYear).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;
}

// Decree 2330 p. 3, 13, 14 and 19(1). The last previous award controls
// both the amount and expiry; without its decision details we return unknown.
export function newbornShortcut({birthDate,applicationDate,olderAwards=[],sameRecipient,motherPregnancyBenefit=false}) {
  if(!birthDate || !applicationDate)return {status:'unknown',reason:'Нужны дата рождения и дата обращения'};
  if(applicationDate<birthDate)return {status:'not-yet-born'};
  if(applicationDate>addSixCalendarMonths(birthDate))return {status:'ordinary',reason:'Позже 6 месяцев со дня рождения'};
  if(sameRecipient===undefined)return {status:'unknown',reason:'Уточните, тот же ли получатель пособия на старшего'};
  if(!sameRecipient)return {status:'ordinary',reason:'Выплату на старшего получает другое лицо'};
  const active=olderAwards.filter(a=>a.endsOn && a.endsOn>=applicationDate && Number.isFinite(a.tier) && [50,75,100].includes(a.tier));
  if(!active.length)return {status:'ordinary',reason:'Нет действующего назначения на старшего ребёнка этому получателю'};
  const latest=active.sort((a,b)=>(b.decisionDate||'').localeCompare(a.decisionDate||''))[0];
  if(!latest.decisionDate)return {status:'unknown',reason:'Нужна дата последнего решения о назначении на старших детей'};
  const month=birthDate.slice(0,7);
  const startMonth=motherPregnancyBenefit?addMonths(month,1):month;
  return {status:'simplified',tier:latest.tier,startMonth,endsOn:latest.endsOn,sourceChildId:latest.childId,
    reason:'Размер и срок по последнему решению на старшего ребёнка, без оценки дохода и имущества'};
}

function addMonths(month,offset) {
  const [y,m]=month.split('-').map(Number);
  const n=y*12+m-1+offset;
  return `${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`;
}
