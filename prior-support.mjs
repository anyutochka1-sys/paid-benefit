// Rules 2330 p. 31(m). Compare monthly amounts only for the recipients
// of this application, never the entire family's unrelated support.
const validMonth=m=>/^\d{4}-(0[1-9]|1[0-2])$/.test(m||'');
export function comparePriorSupport({answer,entries=[],complete=false,targets=[],knownTargets=[],applicationMonth,newMonthly,jointContextUnresolved=false}) {
  if(answer==='no')return {status:'clear',oldMonthly:0,reason:'Прежние меры поддержки не отмечены'};
  if(answer!=='yes'||!complete||!entries.length)return {status:'unknown',reason:'Уточните прежние меры поддержки и подтвердите полноту списка'};
  let oldMonthly=0;
  for(const entry of entries) {
    if(!entry.target||!knownTargets.includes(entry.target))return {status:'unknown',reason:'Уточните, в отношении кого назначена прежняя мера поддержки'};
    if(!targets.includes(entry.target))continue;
    if(!validMonth(applicationMonth)||!validMonth(entry.from)||!validMonth(entry.to)||entry.from>entry.to)
      return {status:'unknown',reason:'Уточните период действия прежней меры поддержки'};
    if(applicationMonth<entry.from||applicationMonth>entry.to)continue;
    if(entry.incomeAssessed==='no'||entry.kind==='unified')continue;
    if(!['firstChildOld','thirdChildOld','old3to7','old8to17','oldPregnancy'].includes(entry.kind))
      return {status:'unknown',reason:'Для этой меры нужно проверить применимость сравнения по пункту 31(м); одной оценки дохода недостаточно'};
    if(entry.incomeAssessed!=='yes')return {status:'unknown',reason:'Уточните, назначена ли прежняя выплата с оценкой среднедушевого дохода'};
    if(!entry.name?.trim()||!Number.isFinite(entry.monthly)||entry.monthly<0)
      return {status:'unknown',reason:'Уточните вид и ежемесячную сумму прежней меры поддержки'};
    oldMonthly+=Math.round(entry.monthly*100);
  }
  oldMonthly/=100;
  if(oldMonthly===0)return {status:'clear',oldMonthly,reason:'В этом месяце для данного заявления нет учитываемых прежних мер поддержки'};
  if(jointContextUnresolved)return {status:'unknown',oldMonthly,reason:'При одновременной подаче на детей и по беременности нужно уточнить состав заявлений и сравнить совокупные суммы'};
  if(!Number.isFinite(newMonthly)||newMonthly<0)return {status:'unknown',oldMonthly,reason:'Прежняя сумма известна; для сравнения нужна рассчитанная новая ежемесячная сумма'};
  const roundedNew=Math.round(newMonthly*100)/100;
  return {status:roundedNew<oldMonthly?'block':'clear',oldMonthly,newMonthly:roundedNew,
    reason:roundedNew<oldMonthly?'Новая ежемесячная сумма меньше прежних мер поддержки: основание пункта 31(м)':'Новая ежемесячная сумма не меньше прежних мер поддержки: препятствия по пункту 31(м) не выявлено'};
}
