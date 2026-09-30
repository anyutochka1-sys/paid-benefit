import test from 'node:test';
import assert from 'node:assert/strict';
import {escapeText,resultCard,childLabel} from './result-card.mjs';
test('result strings display tags, ampersands and quotes as literal text',()=>{
  const input='<img src=x onerror="alert(1)"> & старший';
  const rendered=resultCard('2026-09-01',['2025-08','2026-07'],input,input,'unknown',true);
  assert.equal(rendered.includes('<img'),false);
  assert.ok(rendered.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; старший'));
  assert.ok(rendered.includes('<details class="result" open>'));
});
test('child names preserve their numbers and have a fallback',()=>{
  assert.equal(childLabel({name:'  Маша  '},1),'Ребёнок 2 (Маша)');
  assert.equal(childLabel({name:'  '},0),'Ребёнок 1');
  assert.equal(childLabel({},2),'Ребёнок 3');
});
test('unrecognized presentation classes cannot insert markup',()=>{
  const rendered=resultCard('2026-09-01',[],'Оценка','Текст','bad" onclick="alert(1)',false);
  assert.ok(rendered.includes('<span class="unknown">'));
  assert.equal(rendered.includes('onclick'),false);
  assert.equal(escapeText('Обычный текст — 100%'),'Обычный текст — 100%');
});
