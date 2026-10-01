export function forecastScenario(year,officialPm,officialRules,baselinePm,baselineRules,{enabled=false,pmGrowth=0,mrotGrowth=0}={}) {
  const missingPm=officialPm.status!=='known',missingRules=!officialRules;
  if(year!==2027||!enabled||(!missingPm&&!missingRules))return {pm:officialPm,rules:officialRules,estimated:false,assumptions:[]};
  const valid=value=>value!==''&&Number.isFinite(Number(value))&&Number(value)>-100&&Number(value)<=300;
  if((missingPm&&(!valid(pmGrowth)||baselinePm.status!=='known'))||(missingRules&&!valid(mrotGrowth)))return {pm:officialPm,rules:officialRules,estimated:false,assumptions:[],invalid:true};
  const pm=missingPm?{...baselinePm,year,person:Math.round(baselinePm.person*(1+Number(pmGrowth)/100)),child:Math.round(baselinePm.child*(1+Number(pmGrowth)/100)),working:Math.round(baselinePm.working*(1+Number(pmGrowth)/100))}:officialPm;
  const rules=missingRules?{...baselineRules,mrot:Math.round(baselineRules.mrot*(1+Number(mrotGrowth)/100))}:officialRules;
  const assumptions=[];
  if(missingPm)assumptions.push(`ПМ: суммы 2026 года, изменение ${Number(pmGrowth)}%; на человека ${pm.person.toLocaleString('ru-RU')} ₽, на ребёнка ${pm.child.toLocaleString('ru-RU')} ₽, для трудоспособного ${pm.working.toLocaleString('ru-RU')} ₽`);
  if(missingRules)assumptions.push(`МРОТ: сумма 2026 года, изменение ${Number(mrotGrowth)}%; ${rules.mrot.toLocaleString('ru-RU')} ₽`);
  assumptions.push('Правила оценки — как в расчёте на 2026 год. Новые условия 2027 года здесь не подтверждены. Суммы доходов и будущие выплаты взяты из ваших ответов');
  return {pm,rules,estimated:true,assumptions};
}
