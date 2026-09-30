// Rules 2330 p. 31(p): court incapacity is not an automatic child-award bar
// when the applicant retains parental rights for that particular child.
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value||'') && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0,10)===value;
}
export function applicantCapacity({status,decisionDate,restoredDate,children=[],pregnancyApplying=false},applicationDate) {
  if(status==='none')return {status:'clear',children:[],pregnancy:null,reason:'Судебное ограничение дееспособности не отмечено'};
  if(!['limited','incapable'].includes(status))return {status:'unknown',children:[],pregnancy:null,reason:'Уточните, есть ли судебное решение о дееспособности заявителя'};
  if(!validDate(applicationDate)||!validDate(decisionDate)||restoredDate&&(!validDate(restoredDate)||restoredDate<decisionDate))
    return {status:'unknown',children:[],pregnancy:null,reason:'Нужны точные даты вступления в силу решений суда о дееспособности'};
  if(applicationDate<decisionDate || restoredDate&&applicationDate>=restoredDate)
    return {status:'clear',children:[],pregnancy:null,reason:'На эту дату указанное судебное ограничение не действует'};
  const checks=children.filter(child=>child.applying).map(child=>{
    if(child.role==='ward')return {childId:child.id,status:'unknown',reason:'Для заявления опекуна с судебным ограничением нужна проверка полномочий; исключение по родительским правам автоматически не применяется'};
    if(child.applicantRights==='intact')return {childId:child.id,status:'exception',reason:'Родительские права сохранены: применяется исключение по пункту 31(п)'};
    if(['lost','restricted'].includes(child.applicantRights))return {childId:child.id,status:'block',reason:'Родительские права лишены или ограничены: исключение по пункту 31(п) не применяется'};
    return {childId:child.id,status:'unknown',reason:'Для исключения по пункту 31(п) уточните родительские права на этого ребёнка'};
  });
  const pregnancy=pregnancyApplying?{status:'block',reason:'По заявлению беременной действует основание пункта 31(п); исключение относится к заявлению на ребёнка'}:null;
  const statusResult=checks.some(check=>check.status==='block')||pregnancy?'block':checks.some(check=>check.status==='unknown')||!checks.length?'unknown':'exception';
  return {status:statusResult,children:checks,pregnancy,reason:statusResult==='exception'?'На выбранных детей действует исключение по сохранённым родительским правам':statusResult==='block'?'Есть препятствие по пункту 31(п) для отмеченного заявления':'Применимость исключения по пункту 31(п) требует уточнения'};
}
