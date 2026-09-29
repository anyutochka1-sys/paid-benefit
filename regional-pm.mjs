import {regionalPm2026} from './regional-pm-data.mjs';

const tables = {2026: regionalPm2026};

export function pmRegions(year) {
  const table=tables[year];
  if(!table)return [];
  return Object.entries(table.regions).map(([code,region])=>({code,name:region.name})).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
}

export function pmAreas(year,code) {
  const areas=tables[year]?.regions[code]?.areas??[];
  const distinct=new Set(areas.map(area=>area.slice(1).join('|')));
  return distinct.size>1?areas.map(([name])=>name):[];
}

export function pmFor(year,code,area='') {
  const table=tables[year];
  if(!table)return {status:'unknown',reason:`Официальные региональные ПМ на ${year} год ещё не загружены`};
  const region=table.regions[code];
  if(!region)return {status:'unknown',reason:'Выберите регион проживания'};
  const areas=pmAreas(year,code);
  if(areas.length && !area)return {status:'unknown',reason:'Выберите местность: в регионе действуют разные значения ПМ'};
  const selected=areas.length?region.areas.find(item=>item[0]===area):region.areas[0];
  if(!selected)return {status:'unknown',reason:'Местность отсутствует в таблице СФР; проверьте её вручную'};
  return {status:'known',year,region:region.name,area:selected[0],person:selected[1],working:selected[2],child:selected[3],act:region.act,source:table.source,retrieved:table.retrieved};
}
