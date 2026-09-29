import {incomeWindow} from './engine.mjs';
import {ageAt} from './family-assets.mjs';

// Previous unified-benefit payments are excluded for a child named in this
// application (and for a child already 17). Other children's payments count.
// This is deliberately evaluated for every proposed application, since the
// children selected and their ages can change across the forecast.
export function childBenefitIncome(payments, children, applicationChildIds, applicationMonth, applicationDate=`${applicationMonth}-01`) {
  const window=new Set(incomeWindow(applicationMonth));
  const childrenById=new Map(children.map(child=>[child.id,child]));
  const selected=new Set(applicationChildIds);
  const included=[],excluded=[],missing=[];
  let total=0;
  for (const payment of payments) {
    if (!window.has(payment.month)) continue;
    const child=childrenById.get(payment.childId);
    if (!child || !child.birthDate) {
      missing.push(`Укажите ребёнка и дату рождения для пособия за ${payment.month}`); continue;
    }
    if (!Number.isFinite(payment.amount) || payment.amount<0) {
      missing.push(`Уточните сумму пособия за ${payment.month}`); continue;
    }
    const excludedReason=selected.has(child.id)
      ? 'подача на этого ребёнка'
      : child.deathDate && child.deathDate<=applicationDate
        ? 'ребёнок умер до даты заявления'
      : child.married
        ? 'ребёнок не входит в состав семьи'
      : ageAt(child.birthDate,applicationDate)>=17
        ? 'ребёнку исполнилось 17 лет'
        : null;
    const record={...payment,reason:excludedReason};
    if (excludedReason) excluded.push(record);
    else {included.push(record);total+=payment.amount}
  }
  return {total:missing.length?null:total,included,excluded,missing};
}
