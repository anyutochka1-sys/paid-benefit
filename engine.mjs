// Rule snapshot: Government Decree 2330, amended through 20 April 2026.
// Dates are handled as UTC calendar months; an interval includes both endpoints.
export const RULES = {
  2026: { mrot: 27093, minimumEarnedMrot: 8 },
};

export function monthIndex(iso) {
  if (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(iso)) throw new Error('Неверная дата');
  const [year, month] = iso.split('-').map(Number);
  if (month < 1 || month > 12) throw new Error('Неверный месяц');
  return year * 12 + month - 1;
}

export function monthString(index) {
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
}

export function incomeWindow(applicationMonth) {
  const m = monthIndex(applicationMonth);
  return Array.from({ length: 12 }, (_, i) => monthString(m - 13 + i));
}

const monthRange = (start, end) => {
  const first = monthIndex(start), last = monthIndex(end);
  return first <= last ? Array.from({ length: last - first + 1 }, (_, i) => monthString(first + i)) : [];
};

// Reasons: unemployment requires an official employment-centre registration;
// only six months may be credited. Pregnancy has a separate statutory override.
export function minimumIncomeTest(adult, applicationMonth, mrot) {
  const window = incomeWindow(applicationMonth);
  const credited = new Set();
  const unemploymentMonths = new Set();
  const warnings = [];
  for (const reason of adult.reasons ?? []) {
    if (!reason.start || !reason.end) continue;
    if (!['unemployment', 'pregnancy', 'careUnderThree', 'fullTimeStudent', 'careDisabledChild', 'careDisabledAdult', 'treatment', 'military', 'incarceration', 'indigenous', 'pensionRecipient'].includes(reason.type)) {
      warnings.push('Эта причина требует дополнительной проверки.');
      continue;
    }
    let months = monthRange(reason.start, reason.end).filter(m => window.includes(m));
    if(reason.type==='treatment' && monthRange(reason.start,reason.end).length<=3) {
      warnings.push('Непрерывное лечение должно длиться свыше трёх месяцев.');
      continue;
    }
    if (reason.type === 'unemployment') {
      if (!reason.registered) {
        warnings.push('Без регистрации в центре занятости безработица не засчитывается.');
        continue;
      }
      months.forEach(m => unemploymentMonths.add(m));
      continue;
    }
    if (reason.type !== 'pregnancy') months.forEach(m => credited.add(m));
  }
  [...unemploymentMonths].sort().slice(0, 6).forEach(m => credited.add(m));
  const pregnantMonths = new Set((adult.reasons ?? []).filter(r => r.type === 'pregnancy' && r.start && r.end)
    .flatMap(r => monthRange(r.start, r.end).filter(m => window.includes(m))));
  const pregnancyOverride = pregnantMonths.size >= 6 || (adult.pregnancyWeeksAtApplication ?? 0) >= 12;
  pregnantMonths.forEach(m => credited.add(m));
  const exempt = pregnancyOverride || credited.size >= 10 || adult.singleParent === true || adult.multipleChildrenExemption === true;
  const minimum = exempt ? 0 : mrot * 8 * (12 - credited.size) / 12;
  const qualifyingTypes = new Set(['employment', 'sickLeave', 'business', 'selfEmployed', 'pension', 'scholarship', 'military', 'copyright', 'foreignEarned']);
  const earned = window.reduce((sum, month) => sum + (adult.income?.[month] ?? []).filter(row => qualifyingTypes.has(row.type)).reduce((s, row) => s + Number(row.amount || 0), 0), 0);
  return { passed: earned >= minimum, earned, minimum, creditedMonths: credited.size, exempt, warnings };
}

export function assessMonth(data, applicationMonth) {
  const window = incomeWindow(applicationMonth);
  const year = Number(applicationMonth.slice(0, 4));
  const rules = RULES[year];
  const pm = data.pmByYear?.[year];
  if (!rules || !pm) return { month: applicationMonth, status: 'unknown', reason: 'Нет утверждённых данных МРОТ или прожиточного минимума на год обращения.', window };
  const familySize = data.familySizeByMonth?.[applicationMonth];
  if (!familySize || familySize < 1) return { month: applicationMonth, status: 'unknown', reason: 'Нужно уточнить состав семьи на дату заявления.', window };
  const income = (data.people ?? []).reduce((sum, person) => sum + window.reduce((s, m) => s + (person.income?.[m] ?? []).reduce((n, row) => n + Number(row.amount || 0), 0), 0), 0);
  const incomePerPerson = income / 12 / familySize;
  const adultChecks = (data.adults ?? []).map(adult => minimumIncomeTest(adult, applicationMonth, rules.mrot));
  const blockers = [];
  if (incomePerPerson > pm.perCapita) blockers.push('Среднедушевой доход выше прожиточного минимума.');
  if (adultChecks.some(x => !x.passed)) blockers.push('Не выполнено требование минимального дохода взрослого.');
  // Other statutory tests are not inferred from missing answers.
  const required = ['assetsChecked', 'citizenshipChecked', 'alimonyChecked', 'regionalRulesChecked'];
  if (required.some(key => data[key] !== true)) return { month: applicationMonth, status: 'needs-review', window, incomePerPerson, adultChecks, blockers, reason: 'Не проверены имущество, гражданство, алименты или региональные условия.' };
  return { month: applicationMonth, status: blockers.length ? 'likely-ineligible' : 'preliminary-eligible', window, incomePerPerson, adultChecks, blockers };
}
