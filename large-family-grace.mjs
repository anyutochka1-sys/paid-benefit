import {monthIndex} from './engine.mjs';

// Decree 2330 p. 3 paragraphs 3–4, p. 7 paragraph 6: a one-time 50% award
// for an officially large family when per-capita income is above PM by at most
// 10%, applying in the last award month or the next three months.
export function largeFamilyGrace({applicationMonth,perCapita,pmPerson,isLargeFamily,usedBefore,awardEndMonths}) {
  if(!Number.isFinite(perCapita)||!Number.isFinite(pmPerson)||pmPerson<=0)return {status:'unknown',reason:'Нужны доход и ПМ'};
  if(perCapita<=pmPerson)return {status:'ordinary'};
  if(perCapita>pmPerson*1.1)return {status:'no',reason:'Доход выше ПМ более чем на 10%'};
  if(!isLargeFamily)return {status:'no',reason:'Нет статуса многодетной семьи'};
  if(usedBefore===undefined)return {status:'unknown',reason:'Уточните, применяли ли уже однократное продление'};
  if(usedBefore)return {status:'no',reason:'Однократное продление уже использовано'};
  if(!Array.isArray(awardEndMonths)||!awardEndMonths.length)return {status:'unknown',reason:'Нужна дата окончания предыдущего назначения'};
  const month=monthIndex(applicationMonth);
  if(!awardEndMonths.some(end=>end&&month-monthIndex(end)>=0&&month-monthIndex(end)<=3))
    return {status:'no',reason:'Обращение вне последнего месяца назначения и следующих трёх месяцев'};
  return {status:'eligible',tier:50};
}
