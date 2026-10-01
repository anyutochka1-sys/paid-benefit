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

test('structured result sections escape labels and omit empty sections',()=>{
  const rendered=resultCard('2026-09-01',['2025-08','2026-07'],'Оценка',[
    {title:'Дети <b>',text:'Маша & <script>текст</script>'},
    {title:'Беременность',text:''}
  ],'unknown',true);
  assert.ok(rendered.includes('<h3>Дети &lt;b&gt;</h3>'));
  assert.ok(rendered.includes('Маша &amp; &lt;script&gt;текст&lt;/script&gt;'));
  assert.equal(rendered.includes('<script>'),false);
  assert.equal(rendered.includes('Беременность'),false);
});

test('result dates and income windows use readable Russian months',()=>{
  const rendered=resultCard('2026-10-01',['2025-09','2026-08'],'Оценка',[{title:'Срок',text:'С 2026-10 по 2027-03-31'}],'unknown',false);
  assert.ok(rendered.includes('Октябрь 2026'));assert.ok(rendered.includes('сентябрь 2025 — август 2026'));assert.ok(rendered.includes('31 марта 2027'));assert.equal(rendered.includes('2026-10-01'),false);
});
