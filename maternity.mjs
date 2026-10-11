import {incomeWindow,monthIndex,monthString} from './engine.mjs';

export function maternityPaymentIssue(payment) {
  if(!Number.isFinite(payment.amount)||payment.amount<0)return {field:'amount',reason:'Укажите всю сумму пособия по беременности и родам: 0 или больше'};
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(payment.startMonth||''))return {field:'start',reason:'Укажите первый месяц отпуска по беременности и родам'};
  if(!Number.isInteger(payment.chargedMonths)||payment.chargedMonths<1||payment.chargedMonths>12)return {field:'months',reason:'Укажите целое число месяцев начисления БиР от 1 до 12 по документу'};
  return null;
}

// The one-time maternity payment belongs to the months for which it was
// awarded, not the bank-transfer month. The ordinary 140-day example is
// commonly five charged months; an extended leave must use its documented
// charged-month count rather than a hardcoded five.
export function maternityIncomeForApplication(payments,applicationMonth,excludedPersonIndices=[]) {
  const window=new Set(incomeWindow(applicationMonth));
  let amount=0;const included=[],missing=[];
  for(const payment of payments) {
    if(excludedPersonIndices.includes(payment.personIndex))continue;
    const issue=maternityPaymentIssue(payment);
    if(issue) {missing.push(issue.reason);continue;}
    const months=Array.from({length:payment.chargedMonths},(_,i)=>monthString(monthIndex(payment.startMonth)+i));
    const overlap=months.filter(m=>window.has(m));
    const counted=payment.amount*overlap.length/payment.chargedMonths;
    amount+=counted;included.push({personIndex:payment.personIndex,counted,overlap,months});
  }
  return {status:missing.length?'unknown':'known',amount:missing.length?null:amount,included,missing};
}
