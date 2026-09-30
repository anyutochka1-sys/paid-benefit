import {incomeWindow,minimumIncomeTest} from './engine.mjs';
import {ageAt} from './family-assets.mjs';

// Adult children in the family are subject to the individual income minimum.
// This check confirms an exemption or a sufficient qualifying sum. If neither
// is established, other lawful reasons and unentered income still need review.
export function adultStudentChecks(children,family,entries,applicationMonth,filingDate,mrot) {
  const window=incomeWindow(applicationMonth);
  return children.filter(child=>family.included.some(person=>person.id===child.id)&&child.birthDate&&ageAt(child.birthDate,filingDate)>=18)
    .map(child=>{
      const study=child.fullTimeStudent===true&&child.educationFrom&&child.educationTo&&child.educationFrom<=child.educationTo
        ?[{type:'fullTimeStudent',start:child.educationFrom,end:child.educationTo}]:[];
      const result=minimumIncomeTest({reasons:study},applicationMonth,mrot);
      if(result.exempt)return {childId:child.id,status:'yes',reason:'очная учёба подтверждена в достаточном числе месяцев',creditedMonths:result.creditedMonths};
      const threshold=result.minimum;
      const birthdayMonth=`${Number(child.birthDate.slice(0,4))+18}-${child.birthDate.slice(5,7)}`;
      const relevant=entries.filter(entry=>entry.childId===child.id);
      let earned=0,complete=true;
      for(const entry of relevant) {
        if(!entry.from||!entry.to||entry.from>entry.to||!Number.isFinite(entry.amount)||entry.amount<0){complete=false;continue}
        if(!['employment','scholarship','publicDutyCompensation','other'].includes(entry.type)){complete=false;continue}
        if(!['employment','scholarship'].includes(entry.type))continue;
        for(const month of window)if(month>=entry.from&&month<=entry.to)earned+=entry.amount;
      }
      // The treatment of pre-18 earnings in the window depends on the minor's
      // education and exact receipt date in the birthday month.
      const birthdayInWindow=window.includes(birthdayMonth)||window.some(month=>month<birthdayMonth);
      if(complete&&!birthdayInWindow&&earned>=threshold)
        return {childId:child.id,status:'yes',reason:'введённый подходящий доход достигает минимума',earned,minimum:threshold,creditedMonths:result.creditedMonths};
      return {childId:child.id,status:'unknown',reason:birthdayInWindow?'Период включает доход до 18-летия: нужны точные даты и проверка исключений':'Уточните месяцы очной учёбы, все доходы и другие уважительные причины',earned,minimum:threshold,creditedMonths:result.creditedMonths};
    });
}
