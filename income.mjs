import {incomeWindow} from './engine.mjs';

export function regularIncomeMonths(person,applicationMonth,{knownThrough,projectFuture=false}={}) {
  if(!Number.isFinite(person.regularAmount)||person.regularAmount<0||!person.regularFrom||!person.regularTo||person.regularFrom>person.regularTo)return {};
  return Object.fromEntries(incomeWindow(applicationMonth).map(month=>[month,knownThrough&&month>knownThrough&&!projectFuture?undefined:month>=person.regularFrom&&month<=person.regularTo?person.regularAmount:0]));
}

// The shortcut total is tied to exactly one 12-month window. Reusing it for a
// later application month would fabricate a forecast.
export function incomeForMonth(people, applicationMonth) {
  const window=incomeWindow(applicationMonth), byPerson=[], missing=[];
  for (const person of people) {
    if (person.mode==='total') {
      if(person.baseApplicationMonth!==applicationMonth) {missing.push(`${person.label}: нужен помесячный прогноз`);continue;}
      if(!Number.isFinite(person.total)||person.total<0) {missing.push(`${person.label}: укажите неотрицательную сумму за 12 месяцев`);continue;}
      byPerson.push({label:person.label,amount:person.total}); continue;
    }
    let sum=0;
    for (const m of window) {
      const n=person.months?.[m];
      if (!Number.isFinite(n)||n<0) missing.push(`${person.label}: ${m} — укажите неотрицательную сумму`);
      else sum+=n;
    }
    byPerson.push({label:person.label,amount:sum});
  }
  return {window,byPerson,total:missing.length?null:byPerson.reduce((sum,p)=>sum+p.amount,0),missing};
}

// Estimate under p. 7 Decree 2330. Other eligibility tests are separate.
export function childTier({income12,familySize,childrenApplying,pmPerson,pmChild}) {
  if (![income12,familySize,childrenApplying,pmPerson,pmChild].every(Number.isFinite) ||
      income12<0 || !Number.isInteger(familySize) || !Number.isInteger(childrenApplying) || familySize<1 || childrenApplying<1 || childrenApplying>familySize || pmPerson<=0 || pmChild<=0)
    return {status:'unknown'};
  const base=income12/12/familySize;
  if (base>pmPerson) return {status:'income-too-high',base};
  const withTier=fraction=>base+fraction*pmChild*childrenApplying/familySize;
  const tier=withTier(.75)<=pmPerson?100:withTier(.5)<=pmPerson?75:50;
  return {status:'estimate',tier,base,monthlyPerChild:pmChild*tier/100};
}
