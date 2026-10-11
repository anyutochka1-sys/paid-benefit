import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});
  await page.locator('[data-goal="children"]').click();
  await page.locator('#pm-region').waitFor({state:'attached'});
  assert.equal(await page.locator('#family-goal').inputValue(),'children');
  // Choose employment as a source and verify the dedicated salary question exists.
  await page.locator('input[value="employment"][type="checkbox"]').evaluate(el => { el.checked=true; el.dispatchEvent(new Event('input',{bubbles:true})); });
  await page.waitForTimeout(100);
  assert.equal(await page.locator('section[data-question="salary"]').count(),1);
  assert.equal(await page.locator('section[data-question="salary"] #income-people').count(),1);
  // Married applicant must have a separate marital-status control.
  assert.equal(await page.locator('#marital-status option[value="married"]').count(),1);
  assert.deepEqual(errors,[]);
  console.log('Browser smoke passed: mobile boot, goal, employment selection, salary screen, marriage option');
} finally { await browser.close(); }
