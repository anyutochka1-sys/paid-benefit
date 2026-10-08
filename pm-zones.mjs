import {pmAreas,pmFor} from './regional-pm.mjs';
export const normalizePlace=name=>String(name||'').toLowerCase().replace(/ё/g,'е').replace(/^(?:город\s+|г\.\s*)/,'').replace(/\s+/g,' ').trim();
// Region-wide aggregates are not local rates. Amur's general rate also applies
// outside its northern territories, so it is deliberately retained.
export const isAggregate=(code,area)=>({
 '11':['Республика Коми в целом'],'14':['Республика Саха (Якутия)'],
 '24':['Красноярский край'],'29':['Архангельская область'],
 '38':['Иркутская область'],'70':['Томская область']
}[code]||[]).includes(area);
const sources={
 '10':'https://publication.pravo.gov.ru/document/1000202511120002',
 '11':'https://publication.pravo.gov.ru/Document/View/1100202511120006',
 '14':'https://yakd.riihsmedia.ru/postanovlenie-pravitelstva-respubliki-saha-yakutiya-ot-20-oktyabrya-2025-g-%E2%84%96-438/',
 '24':'https://kcson-erm.ru/wp-content/uploads/2025/12/Постановление-Правительства-Красноярского-края-от-11.11.2025-г.-№-1010-п.pdf',
 '28':'https://publication.pravo.gov.ru/document/2800202511120002',
 '29':'https://publication.pravo.gov.ru/Document/View/2900202511130005',
 '38':'https://www.ogirk.ru/pravo/wp-content/uploads/sm-issue-print/2025/11/Oblast_133.pdf',
 '70':'https://rabota.tomsk.gov.ru/velichina-prozhitochnogo-minimuma-na-2026-god'
};
function officialLabel(code,zone,index){
 const names=zone.areas.join(' '),has=re=>re.test(names);
 if(code==='10')return has(/Костомукш/)?'Северная часть Республики Карелия':'Республика Карелия, кроме северной части';
 if(code==='11')return has(/Воркута/)?'Северная природно-климатическая зона':'Южная природно-климатическая зона';
 if(code==='14')return has(/Абыйский/)?'1 зона':'2 зона';
 if(code==='29')return has(/Северодвинск/)?'Зона V':'Зона VI';
 if(code==='38')return has(/Катангский/)?'Районы Крайнего Севера и местности, приравненные к районам Крайнего Севера':'Иные местности Иркутской области';
 if(code==='28')return has(/Зейский/)?'Местности Амурской области, приравненные к районам Крайнего Севера':'Амурская область — общая величина (включая посёлок Муртыгит)';
 // The Tomsk decree lists municipalities; it does not number or name zones.
 if(code==='70')return has(/Стрежевой/)?'Муниципальные образования: Стрежевой, Кедровый и 10 районов':'Муниципальные образования: Томск, Северск и 6 районов';
 if(code==='24'){
  if(has(/город Красноярск/))return 'Третья группа территорий края — остальные территории края';
  if(has(/Хатанга/)&&!has(/за искл/))return 'Первая группа территорий края, подгруппа 2';
  if(has(/Норильск/))return 'Первая группа территорий края, подгруппа 1 — Норильск, Северо-Енисейский';
  if(has(/Таймырский/))return 'Первая группа территорий края, подгруппа 1 — Таймырский Долгано-Ненецкий (кроме территорий подгруппы 2)';
  if(has(/Туруханский/))return 'Первая группа территорий края, подгруппа 1 — Туруханский';
  if(has(/Эвенкийский/))return 'Первая группа территорий края, подгруппа 1 — Эвенкийский';
  return 'Вторая группа территорий края — '+zone.areas.join(', ').replace(/ район/g,'').replace(/город /g,'');
 }
 return zone.areas.join(', ');
}
const khatanga=['Жданиха','Катырык','Каяк','Кресты','Новая','Новорыбная','Попигай','Сындасско','Хатанга','Хета'];
export function pmZones(year,code){
 const groups=new Map();
 for(const area of pmAreas(year,code)){
  if(isAggregate(code,area))continue;
  const pm=pmFor(year,code,area);if(pm.status!=='known')continue;
  const key=[pm.person,pm.working,pm.child].join('|');
  if(!groups.has(key))groups.set(key,{value:area,areas:[],person:pm.person,working:pm.working,child:pm.child});
  groups.get(key).areas.push(area);
 }
 return [...groups.values()].sort((a,b)=>a.person-b.person).map((zone,index)=>{
  const label=officialLabel(code,zone,index);let composition=zone.areas.join('; ');
  if(code==='24'&&year===2026)composition=composition.replace(/ район/g,' муниципальный округ');
  if(code==='24'&&label.includes('подгруппа 2')){
   zone.areas.push(...khatanga.map(n=>(n==='Хатанга'?'село ':'посёлок ')+n));
   composition=zone.areas.slice(1).join('; ');
  }
  if(code==='24'&&label.includes('Таймырский'))composition+='; исключены: '+khatanga.join(', ');
  if(code==='24'&&label.startsWith('Вторая')&&zone.areas.some(n=>n==='Енисейский район'))composition+=' (кроме городов Енисейск и Лесосибирск)';
  if(code==='14'&&label==='2 зона')composition=composition.replace('Мирнинский улус (район)','Мирнинский улус (район), кроме посёлка Айхал и города Удачного с населёнными пунктами');
  if(code==='29'&&label==='Зона VI')composition+='; Приморский — кроме посёлков Малая Муксалма, Реболда, Савватьево, Соловецкий';
  if(code==='29'&&label==='Зона V')zone.areas.push('посёлок Соловецкий');
  if(code==='28'&&label.startsWith('Местности'))composition+='; Тындинский — кроме посёлка Муртыгит';
  return {...zone,label,composition,source:year===2026?sources[code]:pmFor(year,code,zone.value).source,act:pmFor(year,code,zone.value).act};
 });
}
export function zoneValue(zones,area){return zones.find(zone=>zone.areas.some(name=>normalizePlace(name)===normalizePlace(area)))?.value||'';}
