const validGrowth=value=>value!==''&&Number.isFinite(Number(value))&&Number(value)>-100&&Number(value)<=300;

export function forecastSettingsIssue({enabled,pmGrowth,mrotGrowth,missingPm,missingRules,baselinePmKnown}) {
  if(!enabled)return {field:'enabled',label:'Включите предварительный прогноз на 2027 год по вашим допущениям'};
  if(missingPm&&!baselinePmKnown)return {field:'region',label:'Выберите регион и местность: для прогноза нужны исходные суммы ПМ'};
  if(missingPm&&!validGrowth(pmGrowth))return {field:'pmGrowth',label:'Укажите предполагаемый рост ПМ: больше −100% и не больше 300%. Можно поставить 0, чтобы использовать суммы 2026 года'};
  if(missingRules&&!validGrowth(mrotGrowth))return {field:'mrotGrowth',label:'Укажите предполагаемый рост МРОТ: больше −100% и не больше 300%. Можно поставить 0, чтобы использовать сумму 2026 года'};
  return null;
}

export function forecastScenario(year,officialPm,officialRules,baselinePm,baselineRules,{enabled=false,pmGrowth=0,mrotGrowth=0}={}) {
  const missingPm=officialPm.status!=='known',missingRules=!officialRules;
  if(year!==2027||!enabled||(!missingPm&&!missingRules))return {pm:officialPm,rules:officialRules,estimated:false,assumptions:[]};
  if((missingPm&&(!validGrowth(pmGrowth)||baselinePm.status!=='known'))||(missingRules&&!validGrowth(mrotGrowth)))return {pm:officialPm,rules:officialRules,estimated:false,assumptions:[],invalid:true};
  const pm=missingPm?{...baselinePm,year,person:Math.round(baselinePm.person*(1+Number(pmGrowth)/100)),child:Math.round(baselinePm.child*(1+Number(pmGrowth)/100)),working:Math.round(baselinePm.working*(1+Number(pmGrowth)/100))}:officialPm;
  const rules=missingRules?{...baselineRules,mrot:Math.round(baselineRules.mrot*(1+Number(mrotGrowth)/100))}:officialRules;
  const assumptions=[];
  if(missingPm)assumptions.push(`ПМ 2027 для выбранной территории ещё не загружен. Допущение: суммы ПМ 2026 года, изменение ${Number(pmGrowth)}%; на человека ${pm.person.toLocaleString('ru-RU')} ₽, на ребёнка ${pm.child.toLocaleString('ru-RU')} ₽, для трудоспособного ${pm.working.toLocaleString('ru-RU')} ₽`);
  if(missingRules)assumptions.push(`Проверенный МРОТ 2027 ещё не загружен. Допущение: сумма МРОТ 2026 года, изменение ${Number(mrotGrowth)}%; ${rules.mrot.toLocaleString('ru-RU')} ₽`);
  assumptions.push('Правила оценки — как в расчёте на 2026 год. Новые условия 2027 года здесь не подтверждены. Суммы доходов и будущие выплаты взяты из ваших ответов');
  return {pm,rules,estimated:true,assumptions};
}
