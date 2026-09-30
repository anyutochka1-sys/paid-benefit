import test from 'node:test';
import assert from 'node:assert/strict';
import {pmRegions,pmAreas,pmFor} from './regional-pm.mjs';

test('все 91 субъекта доступны, территориальные различия не скрыты',()=>{
  assert.equal(pmRegions(2026).length,91);
  assert.ok(pmAreas(2026,'24').includes('город Красноярск'));
  assert.equal(pmFor(2026,'24').status,'unknown');
  assert.deepEqual([pmFor(2026,'24','город Красноярск').person,pmFor(2026,'24','город Красноярск').child],[19891,19294]);
  assert.deepEqual([pmFor(2026,'24','город Норильск').person,pmFor(2026,'24','город Норильск').child],[29614,28725]);
});

test('обычный субъект выбирается без местности; неизвестный год остаётся неизвестным',()=>{
  assert.equal(pmAreas(2026,'08').length,0);
  assert.equal(pmFor(2026,'08').person,18560);
  assert.equal(pmFor(2027,'24','город Красноярск').status,'unknown');
  assert.equal(pmFor(2026,'24','неизвестная местность').status,'unknown');
});

test('future year keeps region choices without substituting old benefit amounts',()=>{assert.ok(pmRegions(2027).length>80);assert.equal(pmFor(2027,'63').status,'unknown')});
