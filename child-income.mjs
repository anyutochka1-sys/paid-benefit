import {incomeWindow,monthIndex,monthString} from './engine.mjs';
import {ageAt} from './family-assets.mjs';

const exemptible=new Set(['employment','publicDutyCompensation']);
const monthsBetween=(from,to)=>{
  if(!from||!to||from>to)return [];
  return Array.from({length:monthIndex(to)-monthIndex(from)+1},(_,i)=>monthString(monthIndex(from)+i));
};

// Paragraphs 45–47, 52(1) of Decree 2330. Only employment and compensation
// for public duties are excluded for a minor who studied at least six months
// in the assessment window. A birth month with the 18th birthday needs an
// exact receipt date, so monthly input remains unresolved there.
export function childIncomeForApplication(entries,children,family,applicationMonth) {
  const window=new Set(incomeWindow(applicationMonth));
  const byId=new Map(children.map(child=>[child.id,child]));
  const included=new Set(family.included.filter(p=>p.role==='child'||p.role==='ward').map(p=>p.id));
  const unanswered=new Set(family.unanswered.map(x=>x.person.id));
  const issues=[], counted=[], excluded=[];
  let amount=0;
  for(const entry of entries) {
    const child=byId.get(entry.childId);
    if(!child||!entry.from||!entry.to||entry.from>entry.to||!Number.isFinite(entry.amount)||entry.amount<0||!['employment','scholarship','publicDutyCompensation','other'].includes(entry.type)) {
      issues.push('Уточните ребёнка, вид дохода, сумму и период');continue;
    }
    for(const month of monthsBetween(entry.from,entry.to).filter(m=>window.has(m))) {
      if(unanswered.has(child.id)){issues.push('Уточните, входит ли ребёнок с доходом в состав семьи');continue}
      if(!included.has(child.id)){excluded.push({childId:child.id,month,reason:'вне состава семьи'});continue}
      if(!child.birthDate){issues.push('Уточните дату рождения ребёнка с доходом');continue}
      const eighteenth=Number(child.birthDate.slice(0,4))+18+'-'+child.birthDate.slice(5,7);
      if(exemptible.has(entry.type)&&month===eighteenth){issues.push('Укажите точную дату дохода в месяце 18-летия');continue}
      const minor=ageAt(child.birthDate,`${month}-01`)<18;
      if(exemptible.has(entry.type)&&minor) {
        if(['none','additional'].includes(child.educationStatus)){amount+=entry.amount;counted.push({childId:child.id,month,amount:entry.amount});continue}
        if(child.educationStatus!=='school'){issues.push('Уточните вид обучения несовершеннолетнего ребёнка');continue}
        if(!child.educationFrom||!child.educationTo||child.educationFrom>child.educationTo){issues.push('Уточните месяцы очного обучения несовершеннолетнего ребёнка');continue}
        const studied=monthsBetween(child.educationFrom,child.educationTo).filter(m=>window.has(m)).length;
        if(studied>=6){excluded.push({childId:child.id,month,reason:'пункт 52(1): очное обучение не менее шести месяцев'});continue}
      }
      amount+=entry.amount;counted.push({childId:child.id,month,amount:entry.amount});
    }
  }
  return {status:issues.length?'unknown':'known',amount:issues.length?null:amount,counted,excluded,issues:[...new Set(issues)]};
}
