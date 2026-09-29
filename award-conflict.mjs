// Decree 2330 p. 21 and p. 31(ж). A court order placing the child with a
// different legal representative is an exception to the existing-award bar.
export function awardConflict(child,applicationMonth,{jointRenewal=false}={}) {
  if(!child.awardRecipient||child.awardRecipient==='unknown')return {status:'unknown',reason:'Уточните, назначено ли сейчас пособие на ребёнка'};
  if(child.awardRecipient==='none')return {status:'clear'};
  if(!child.awardEnd)return {status:'unknown',reason:'Укажите последний месяц действующего назначения'};
  const endMonth=child.awardEnd.slice(0,7);
  if(endMonth<applicationMonth)return {status:'clear'};
  if(child.awardRecipient==='other') {
    if(child.courtResidence===true)return {status:'court-exception'};
    if(child.courtResidence===undefined)return {status:'unknown',reason:'Уточните решение суда о месте жительства ребёнка'};
    return {status:'block',reason:'Пособие уже назначено другому законному представителю'};
  }
  if(endMonth===applicationMonth||jointRenewal)return {status:'renewal'};
  return {status:'review',reason:'Действующее назначение заявителя ещё не в последнем месяце'};
}
