// Decree 2330 p. 31(з–к): object-by-object evaluation. Facts that cannot be
// established from the form are returned as review items, not guessed.
import {incomeWindow} from './engine.mjs';
const excluded = item => item.wardOwned || item.seized || item.registrationBan ||
  (item.supported && ['apartment','house','land'].includes(item.type)) ||
  (item.auxiliaryExcluded && item.type==='nonresidential') || item.familyShare <= 1/3;

export function checkProperty(items, {familySize, rural, multipleChildren, disabledFamilyMember, supportVehicle}) {
  if (!Array.isArray(items) || !familySize) return {status:'unknown',reasons:['Нужен состав семьи']};
  // A missing share can change whether any object is counted at all. Do not
  // turn a potential one-third exclusion into a definite property refusal.
  if(items.some(item=>!item.wardOwned&&!item.seized&&!item.registrationBan &&
      !(item.supported&&['apartment','house','land'].includes(item.type)) &&
      !(item.auxiliaryExcluded&&item.type==='nonresidential') &&
      (!Number.isFinite(item.familyShare)||item.familyShare<0||item.familyShare>1)))
    return {status:'review',reasons:[],review:['Укажите совокупную долю членов семьи в каждом объекте недвижимости']};
  const relevant=items.filter(item=>!excluded(item));
  const reasons=[], review=[];
  const group=type=>relevant.filter(item=>item.type===type);
  for (const [type,limit,label] of [['apartment',24,'квартир'],['house',40,'домов']]) {
    const objects=group(type).filter(x=>!(type==='apartment'&&(x.uninhabitable||x.severeIllnessResidence)));
    if(objects.length>=2) {
      if(objects.some(x=>!Number.isFinite(x.area))) review.push(`Укажите площадь всех ${label}`);
      else if(objects.reduce((s,x)=>s+x.area,0)>limit*familySize) reasons.push(`Площадь ${label} при наличии нескольких объектов выше ${limit} м² на человека`);
      if(objects.some(x=>x.familyShare!==undefined && x.familyShare<1)) review.push(`Уточните учитываемую площадь долей ${label}`);
    }
  }
  for(const [type,limit,label] of [['garden',1,'садовых домов'],['nonresidential',1,'нежилых помещений'],['garage',multipleChildren||disabledFamilyMember||supportVehicle?2:1,'гаражей или машино-мест']]) {
    if(group(type).length>limit) reasons.push(`Слишком много ${label}: ${group(type).length}`);
  }
  const land=group('land').filter(x=>!x.agriculturalExcluded && !x.farEastHectare);
  if(land.length && rural===undefined) review.push('Уточните место жительства для порога земли: 0,25 га или 1 га');
  if(land.some(x=>!Number.isFinite(x.hectares))) review.push('Нужна площадь земельных участков');
  else if(rural!==undefined && land.reduce((s,x)=>s+x.hectares,0)>(rural?1:.25)) reasons.push('Площадь земельных участков выше допустимой');
  if(relevant.some(x=>!['apartment','house','garden','nonresidential','garage','land'].includes(x.type))) review.push('Есть объект недвижимости, для которого пока нет правила');
  return {status:reasons.length?'no':review.length?'review':'yes',reasons,review};
}

export function checkOtherVehicles(items, {applicationYear,multipleChildren,disabledFamilyMember,supportMotorcycle,supportMachine}) {
  if(!Array.isArray(items)||!applicationYear)return {status:'unknown',reasons:['Нужны сведения о транспорте']};
  const relevant=items.filter(x=>!x.wardOwned&&!x.seized&&!x.wanted&&!x.registrationBan);
  const group=type=>relevant.filter(x=>x.type===type);
  const reasons=[], review=[];
  const motorcycleLimit=multipleChildren||disabledFamilyMember||supportMotorcycle?2:1;
  if(group('motorcycle').length>motorcycleLimit)reasons.push('Превышено допустимое число мотоциклов');
  for(const [type,limit,label] of [['boat',1,'маломерных судов'],['machine',supportMachine?2:1,'самоходных машин']]) {
    if(group(type).some(x=>!Number.isFinite(x.manufactureYear)))review.push(`Нужен год выпуска ${label}`);
    else if(group(type).filter(x=>applicationYear-x.manufactureYear<=5).length>limit)reasons.push(`Превышено допустимое число ${label} не старше пяти лет`);
  }
  return {status:reasons.length?'no':review.length?'review':'yes',reasons,review};
}

export function checkDepositInterest(accounts, {applicationMonth,perCapitaMinimum}) {
  if(!Array.isArray(accounts)||!applicationMonth||!Number.isFinite(perCapitaMinimum))return {status:'unknown'};
  const appIndex=Number(applicationMonth.slice(0,4))*12+Number(applicationMonth.slice(5,7))-1;
  const activeInterest=accounts.reduce((sum,account)=>{
    if(!Number.isFinite(account.interestForRelevantTaxYear))return NaN;
    if(account.nominalWardAccount)return sum;
    const closed=account.closedMonth;
    const closedIndex=closed?Number(closed.slice(0,4))*12+Number(closed.slice(5,7))-1:null;
    return sum+(closedIndex!==null&&closedIndex<=appIndex-6?0:account.interestForRelevantTaxYear);
  },0);
  if(!Number.isFinite(activeInterest))return {status:'unknown'};
  return {status:activeInterest>perCapitaMinimum?'no':'yes',interestForThreshold:activeInterest};
}

// P. 50: normally 1/12 of tax-year interest for each month in the 12-month
// window that belongs to that year. If p. 31(k) denial applies, count the full
// tax-year interest. Closed accounts can avoid that denial but still enter
// income; qualifying ward nominal accounts are excluded under p. 53(щ).
export function depositIncomeForApplication(accounts,{applicationMonth,perCapitaMinimum}) {
  if(Array.isArray(accounts) && !accounts.length)return {status:'known',amount:0,thresholdStatus:'yes',method:'none',months:0};
  if(!applicationMonth || !Number.isFinite(perCapitaMinimum) || perCapitaMinimum<=0)return {status:'unknown',reason:'Нужен ПМ на душу населения'};
  const taxYear=Number(applicationMonth.slice(0,4))-1;
  const relevant=accounts.filter(a=>!a.nominalWardAccount);
  if(relevant.some(a=>a.taxYear!==taxYear || !Number.isFinite(a.interestForRelevantTaxYear) || a.interestForRelevantTaxYear<0))
    return {status:'unknown',reason:`Нужны проценты всех счетов за ${taxYear} год`};
  const threshold=checkDepositInterest(relevant,{applicationMonth,perCapitaMinimum});
  if(threshold.status==='unknown')return threshold;
  const annual=relevant.reduce((sum,a)=>sum+a.interestForRelevantTaxYear,0);
  const months=incomeWindow(applicationMonth).filter(m=>Number(m.slice(0,4))===taxYear).length;
  return {status:'known',amount:threshold.status==='no'?annual:annual*months/12,
    taxYear,months,thresholdStatus:threshold.status,thresholdInterest:threshold.interestForThreshold,
    method:threshold.status==='no'?'full-due-to-threshold':'prorated'};
}
