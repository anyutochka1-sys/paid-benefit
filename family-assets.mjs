// Decree 2330 paragraphs 31(з, и), 45–46. This module only evaluates the
// conditions explicitly represented by the input; missing facts remain unknown.
function parseDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!value || Number.isNaN(date.getTime())) throw new Error('Нужна дата в формате ГГГГ-ММ-ДД');
  return date;
}

export function ageAt(birthDate, applicationDate) {
  const b = parseDate(birthDate), d = parseDate(applicationDate);
  return d.getUTCFullYear() - b.getUTCFullYear() -
    Number(d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate()));
}

export function includedFamily(people, applicationDate) {
  const included=[], excluded=[], unanswered=[];
  for (const person of people) {
    if (person.role==='applicant') { included.push(person); continue; }
    if (person.role==='spouse') {
      if(person.familyStatus==='unknown') unanswered.push({person,reason:'Уточните статус супруга по пункту 46'});
      else if(['parentalRightsLost','stateCare','conscript','imprisoned','forcedTreatment','custody','missing','wanted'].includes(person.familyStatus))
        excluded.push({person,reason:'Супруг исключён из состава семьи по пункту 46'});
      else included.push(person);
      continue;
    }
    if (!['child', 'ward'].includes(person.role)) { unanswered.push({person, reason:'Неизвестная роль в семье'}); continue; }
    if (person.deathDate && person.deathDate<=applicationDate) { excluded.push({person,reason:'Ребёнок умер до даты заявления'}); continue; }
    if(person.familyStatus==='stateCare'&&person.role!=='ward') {excluded.push({person,reason:'Ребёнок на полном государственном обеспечении'});continue}
    if(['conscript','imprisoned','forcedTreatment','custody','missing','wanted'].includes(person.familyStatus)) {excluded.push({person,reason:'Ребёнок исключён по пункту 46'});continue}
    if (!person.birthDate || person.married === undefined) { unanswered.push({person, reason:'Нужны дата рождения и семейное положение'}); continue; }
    const age=ageAt(person.birthDate, applicationDate);
    if (person.married) { excluded.push({person, reason:'Ребёнок состоит в браке'}); continue; }
    if (age < 18) { included.push(person); continue; }
    if (person.role === 'child' && age < 23) {
      if (person.fullTimeStudent === undefined) unanswered.push({person, reason:'Нужно уточнить очное обучение'});
      else if (person.fullTimeStudent) included.push(person);
      else excluded.push({person, reason:'Нет очного обучения'});
    } else excluded.push({person, reason:'Возраст вне состава семьи'});
  }
  return { included, excluded, unanswered };
}

export function childCanApply(person, applicationDate) {
  if(person.deathDate && person.deathDate<=applicationDate)return {status:'no',reason:'Ребёнок умер до даты обращения'};
  if(person.married===true)return {status:'no',reason:'Ребёнок состоит в браке и не входит в состав семьи'};
  if(person.familyStatus==='stateCare'&&person.role!=='ward'||['conscript','imprisoned','forcedTreatment','custody','missing','wanted'].includes(person.familyStatus))
    return {status:'no',reason:'Ребёнок исключён из состава семьи по пункту 46'};
  if (!person.birthDate || person.russianCitizen === undefined || person.livesInRussia === undefined)
    return {status:'unknown', reason:'Нужны дата рождения, гражданство и проживание ребёнка'};
  if (ageAt(person.birthDate, applicationDate) >= 17) return {status:'no', reason:'На дату обращения ребёнку исполнилось 17 лет'};
  if (!person.russianCitizen || !person.livesInRussia) return {status:'no', reason:'Требуются гражданство РФ и постоянное проживание в РФ'};
  return {status:'yes'};
}

// Decree 2330 p. 31(r): the applicant's own court status for this child.
// The status of the other parent is a separate question and cannot block this applicant.
export function applicantParentalRights(child) {
  if (!child.applying || child.role === 'ward') return {status:'not-applicable'};
  if (child.applicantRights === 'lost' || child.applicantRights === 'restricted')
    return {status:'block', reason:'Заявитель лишён или ограничен в родительских правах в отношении этого ребёнка'};
  if (child.applicantRights === 'intact') return {status:'clear'};
  return {status:'unknown', reason:'Уточните родительские права заявителя в отношении ребёнка из заявления'};
}

export function checkCars(cars, context) {
  if (!Array.isArray(cars) || context.applicationYear === undefined ||
    context.multipleChildren === undefined || context.disabledFamilyMember === undefined ||
    context.supportVehicle === undefined || context.fourOrMoreChildren === undefined)
    return {status:'unknown', reasons:['Недостаточно данных об автомобилях или семье']};
  const counted=[];
  for (const car of cars) {
    if (car.wardOwned || car.seized || car.wanted || car.registrationBan) continue;
    if (car.manufactureYear === undefined || car.horsepower === undefined) return {status:'unknown', reasons:['Нужны год выпуска и мощность каждого учитываемого автомобиля']};
    counted.push(car);
  }
  const allowed = context.multipleChildren || context.disabledFamilyMember || context.supportVehicle ? 2 : 1;
  const reasons=[];
  if (counted.length > allowed) reasons.push(`Автомобилей ${counted.length}, допустимо ${allowed}`);
  for (const car of counted) {
    if (Number(car.horsepower) >= 250 && context.applicationYear - Number(car.manufactureYear) <= 5) {
      if (!context.fourOrMoreChildren) reasons.push('Есть автомобиль не старше 5 лет с мощностью от 250 л. с.');
      else if (car.acquiredWithFourChildren === undefined) return {status:'unknown', reasons:['Нужно уточнить обстоятельства приобретения мощного автомобиля семьёй с четырьмя детьми']};
      else if (!car.acquiredWithFourChildren) reasons.push('Мощный автомобиль не отмечен как приобретённый семьёй с четырьмя детьми');
    }
  }
  return {status:reasons.length?'no':'yes', reasons, countedCars:counted.length};
}
