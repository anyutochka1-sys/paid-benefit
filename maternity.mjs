import {incomeWindow,monthIndex,monthString} from './engine.mjs';

// The one-time maternity payment belongs to the months for which it was
// awarded, not the bank-transfer month. The ordinary 140-day example is
// commonly five charged months; an extended leave must use its documented
// charged-month count rather than a hardcoded five.
export function maternityIncomeForApplication(payments,applicationMonth) {
  const window=new Set(incomeWindow(applicationMonth));
  let amount=0;const included=[],missing=[];
  for(const payment of payments) {
    if(!payment.startMonth || !Number.isFinite(payment.amount) || payment.amount<0 || !Number.isInteger(payment.chargedMonths) || payment.chargedMonths<1 || payment.chargedMonths>12) {
      missing.push('Укажите сумму, первый месяц и число месяцев начисления пособия по БиР');continue;
    }
    const months=Array.from({length:payment.chargedMonths},(_,i)=>monthString(monthIndex(payment.startMonth)+i));
    const overlap=months.filter(m=>window.has(m));
    const counted=payment.amount*overlap.length/payment.chargedMonths;
    amount+=counted;included.push({personIndex:payment.personIndex,counted,overlap,months});
  }
  return {status:missing.length?'unknown':'known',amount:missing.length?null:amount,included,missing};
}
