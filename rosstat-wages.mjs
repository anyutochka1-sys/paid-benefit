// Rosstat's historical workbook abbreviates several names used in SFR's PM
// table. Unmapped territories deliberately remain unknown.
const ALIASES = {
  '21':'Чувашская Республика',
  '42':'Кемеровская область',
  '78':'г.Санкт-Петербург',
  '79':'Еврейская авт.область',
  '83':'Ненецкий авт.округ',
  '86':'Ханты-Мансийский авт.округ - Югра',
  '87':'Чукотский авт.округ',
  '89':'Ямало-Ненецкий авт.округ',
};

export function confirmedRegionalWage(table,year,regionCode,regionName) {
  const record=table?.years?.[String(year)];
  if(!record || record.preliminary || record.final_confirmed!==true || !/^\d{4}-\d{2}$/.test(record.publication_month||''))
    return {status:'unknown',reason:'Годовая зарплата Росстата ещё не подтверждена как окончательная с датой публикации'};
  const name=ALIASES[String(regionCode)]||regionName;
  const normalize=s=>s.toLowerCase().replace(/ё/g,'е').replace(/^г\.?\s*/,'').replace(/\s+/g,' ').trim();
  const candidates=Object.entries(record.regions||{}).filter(([key])=>normalize(key)===normalize(name));
  const amount=record.regions?.[name]??(candidates.length===1?candidates[0][1]:null);
  if(!Number.isFinite(amount)||amount<=0)return {status:'unknown',reason:'В годовой таблице Росстата не найден этот субъект'};
  return {status:'known',year,amount,publishedMonth:record.publication_month,final:true,source:record.source};
}
