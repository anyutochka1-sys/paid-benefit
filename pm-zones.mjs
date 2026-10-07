import {pmAreas,pmFor} from './regional-pm.mjs';
export const normalizePlace=name=>String(name||'').toLowerCase().replace(/ё/g,'е').replace(/^(?:город\s+|г\.\s*)/,'').replace(/\s+/g,' ').trim();
// Group by all three calculation values, not just the child benefit amount.
export function pmZones(year,code){
  const groups=new Map();
  for(const area of pmAreas(year,code)){
    // The region-wide average is not a municipality's territorial amount.
    if(code==='24'&&area==='Красноярский край')continue;
    const pm=pmFor(year,code,area);if(pm.status!=='known')continue;
    const key=[pm.person,pm.working,pm.child].join('|');
    if(!groups.has(key))groups.set(key,{value:area,areas:[],person:pm.person,working:pm.working,child:pm.child});
    groups.get(key).areas.push(area);
  }
  return [...groups.values()].map(zone=>{
    const main=code==='24'&&zone.areas.some(name=>normalizePlace(name)==='красноярск');
    const label=main?'Третья зона — Красноярск, Канск и остальные территории':zone.areas.length>3?zone.areas.slice(0,2).join(', ')+' и другие территории':zone.areas.join(', ');
    return {...zone,label};
  }).sort((a,b)=>a.person-b.person);
}
export function zoneValue(zones,area){return zones.find(zone=>zone.areas.some(name=>normalizePlace(name)===normalizePlace(area)))?.value||'';}
