// Decree 2330 paragraphs 5–6: when testing the next tier, the hypothetical
// pregnancy award is included for eight months of the 12-month comparison.
export function pregnancyTier({income12,familySize,pmPerson,pmWorking}) {
  if(!Number.isFinite(income12)||income12<0||!Number.isInteger(familySize)||familySize<1||
    !Number.isFinite(pmPerson)||pmPerson<=0||!Number.isFinite(pmWorking)||pmWorking<=0)
    return {status:'unknown',reason:'Нужны доход за расчётный период, состав семьи и действующие ПМ'};
  const base=income12/12/familySize;
  if(base>pmPerson)return {status:'income-too-high',base};
  const after50=(income12+pmWorking*0.5*8)/12/familySize;
  if(after50>pmPerson)return {status:'estimate',tier:50,monthly:pmWorking*0.5,base,after50};
  const after75=(income12+pmWorking*0.75*8)/12/familySize;
  return {status:'estimate',tier:after75>pmPerson?75:100,monthly:pmWorking*(after75>pmPerson?0.75:1),base,after50,after75};
}
