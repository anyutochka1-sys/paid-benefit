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

// Weeks are anchored to the first filing date; continuation is an explicit forecast.
export function pregnancyAtDate({weeks,referenceDate,applicationDate,forecastThrough='',endedDate=''}) {
  const day=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return NaN;const n=Date.parse(value+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value?n:NaN;};
  const reference=day(referenceDate), application=day(applicationDate);
  if(!Number.isFinite(reference)||!Number.isFinite(application)||application<reference)
    return {status:'unknown',weeks:null,reason:'Уточните дату, на которую указан срок беременности'};
  if(endedDate && !Number.isFinite(day(endedDate)))return {status:'unknown',weeks:null,reason:'Уточните фактическую дату окончания беременности'};
  if(endedDate && application>=day(endedDate))return {status:'ended',weeks:0,reason:'На дату подачи беременность уже окончилась; прежние месяцы беременности укажите среди причин отсутствия дохода'};
  if(weeks===''||weeks==null||!Number.isFinite(Number(weeks))||Number(weeks)<0||Number(weeks)>42)
    return {status:'unknown',weeks:null,reason:'Укажите срок беременности на дату первой подачи'};
  const projected=Number(weeks)+(application-reference)/604800000;
  if(projected>42)return {status:'unknown',weeks:null,reason:'Уточните срок и окончание беременности: прогноз превышает 42 недели'};
  if(application===reference)return {status:'known',weeks:projected,reason:`Срок на дату подачи: ${Math.floor(projected)} нед.`};
  if(endedDate || Number.isFinite(day(forecastThrough))&&application<=day(forecastThrough))
    return {status:'forecast',weeks:projected,reason:`Прогноз срока: ${Math.floor(projected)} нед.; расчёт предполагает продолжение беременности на дату подачи`};
  return {status:'unknown',weeks:null,reason:'Для будущего месяца подтвердите предположение о продолжении беременности или укажите фактическую дату её окончания'};
}
