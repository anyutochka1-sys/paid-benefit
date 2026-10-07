import test from 'node:test';import assert from 'node:assert/strict';
import {pmZones,zoneValue} from './pm-zones.mjs';import {pmFor,pmAreas} from './regional-pm.mjs';
test('Krasnoyarsk and Kansk share a territorial zone; regional average is not selectable',()=>{
 for(const year of [2025,2026]){const zones=pmZones(year,'24');assert.equal(zones.length,12);const city=zoneValue(zones,'город Красноярск');assert.equal(city,zoneValue(zones,'г. Канск'));assert.ok(city);assert.equal(zoneValue(zones,'Красноярский край'),'');assert.equal(pmFor(year,'24',city).child,year===2026?19294:18066);assert.notEqual(city,zoneValue(zones,'город Норильск'));}
});
test('grouping preserves all three values for every municipality and historical aliases',()=>{
 for(const year of [2025,2026])for(const code of ['10','11','14','24','28','29','38','70']){
 const zones=pmZones(year,code);for(const area of pmAreas(year,code)){if(code==='24'&&area==='Красноярский край')continue;const old=pmFor(year,code,area),now=pmFor(year,code,zoneValue(zones,area));assert.deepEqual([now.person,now.working,now.child],[old.person,old.working,old.child]);}}
});
test('regions without territorial differences have no additional picker; missing future data stays absent',()=>{assert.deepEqual(pmZones(2026,'63'),[]);assert.deepEqual(pmZones(2027,'24'),[])});
