import {incomeWindow} from './engine.mjs';
import {ageAt} from './family-assets.mjs';

// Decree 2330 p. 53(b, g, e, zh, z, k): the historical benefit type and
// whether an amount was paid for earlier periods affect its exclusion.
export const CHILD_BENEFIT_KINDS = {
  unified:{label:'Единое пособие на ребёнка'},
  decree606:{label:'Прежняя ежемесячная выплата на третьего и последующих детей (Указ № 606)'},
  decree175:{label:'Прежняя выплата на ребёнка 8–17 лет (Указ № 175 от 31.03.2022)'},
  nonworkingCare:{label:'Пособие по уходу за ребёнком до 1,5 лет для неработающего (ст. 13, абз. 7–9)'},
  firstChild:{label:'Прежняя ежемесячная выплата на первого ребёнка'},
  oldEightToSeventeen:{label:'Прежнее пособие 8–17 лет по редакции до 01.05.2022'}
};

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
    const kind=payment.kind||'unified';
    if (!CHILD_BENEFIT_KINDS[kind] || (['decree606','decree175','nonworkingCare'].includes(kind) && typeof payment.forPastPeriods!=='boolean')) {
      missing.push(`Уточните вид пособия и относится ли выплата за ${payment.month} к прошлым периодам`); continue;
    }
    const child=childrenById.get(payment.childId);
    if (!child || !child.birthDate) {
      missing.push(`Укажите ребёнка и дату рождения для пособия за ${payment.month}`); continue;
    }
    if (!Number.isFinite(payment.amount) || payment.amount<0) {
      missing.push(`Уточните сумму пособия за ${payment.month}`); continue;
    }
    const sameChild=selected.has(child.id);
    const excludedByKind=kind==='oldEightToSeventeen'
      || sameChild && (kind==='unified' || kind==='firstChild'
        || ['decree606','decree175','nonworkingCare'].includes(kind) && payment.forPastPeriods);
    const excludedReason=excludedByKind
      ? kind==='oldEightToSeventeen'?'прежнее пособие 8–17 лет исключено по п. 53 «к»':'подача на этого ребёнка: исключение по виду и периоду выплаты'
      : child.deathDate && child.deathDate<=applicationDate
        ? 'ребёнок умер до даты заявления'
      : child.married
        ? 'ребёнок не входит в состав семьи'
      : kind==='unified' && ageAt(child.birthDate,applicationDate)>=17
        ? 'ребёнку исполнилось 17 лет'
        : null;
    const record={...payment,reason:excludedReason};
    if (excludedReason) excluded.push(record);
    else {included.push(record);total+=payment.amount}
  }
  return {total:missing.length?null:total,included,excluded,missing};
}
