const assert = require('node:assert/strict');

module.exports = async function checkHearts(page, reduced = false) {
  const hearts = page.locator('.heart-balloon');
  const toggle = page.locator('#loveBtn');
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true', 'hearts should default to on');
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  const paused = await page.evaluate(() => audio.paused);
  await page.waitForFunction(count => document.querySelectorAll('.heart-balloon').length === count, reduced ? 1 : 2);
  const design = await page.evaluate(() => [...document.querySelectorAll('.heart-balloon')].map(heart => ({
    color: getComputedStyle(heart).color,
    frames: heart.getAnimations()[0].effect.getKeyframes(),
    pointer: getComputedStyle(heart).pointerEvents
  })));
  assert.equal(design[0].color, 'rgb(217, 184, 138)');
  assert.ok(design.every(heart => heart.pointer === 'none'));
  if (reduced) assert.equal(new Set(design[0].frames.map(frame => frame.transform)).size, 1);
  else assert.equal(design[1].color, 'rgb(185, 132, 148)');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(await hearts.count(), 0, 'off must clear existing hearts');
  await page.waitForTimeout(2600);
  assert.equal(await hearts.count(), 0, 'automatic releases continued while off');
  const box = await page.locator('#stage').boundingBox();
  const point = { x: box.x + box.width / 2, y: Math.max(10, box.y) + 36 };
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  assert.equal(await hearts.count(), 0, 'scene tap bypassed off switch');
  await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('pageshow')); });
  assert.equal(await hearts.count(), 0, 'returning to the page enabled an off switch');
  await page.locator('#resetBtn').click();
  assert.equal(await hearts.count(), 0, 'reset enabled hearts');
  await toggle.focus();
  await page.keyboard.press('Enter');
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
  await page.waitForFunction(() => document.querySelector('.heart-balloon'));
  await page.waitForTimeout(2600);
  await page.waitForFunction(() => document.querySelector('.heart-balloon'));
  const limit = reduced ? 2 : box.width < 760 ? 6 : 8;
  assert.ok(await hearts.count() <= limit, 'automatic flow crowded the scene');
  if (!reduced) assert.ok(await hearts.count() >= 4, 'no second automatic release');
  assert.equal(await page.evaluate(() => audio.paused), paused, 'heart toggle changed playback');
  await page.evaluate(() => document.querySelectorAll('.heart-balloon').forEach(heart => heart.getAnimations().forEach(animation => animation.finish())));
  await page.waitForFunction(() => !document.querySelector('.heart-balloon'));
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  assert.equal(await hearts.count(), 0);
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await page.waitForFunction(() => document.querySelector('.heart-balloon'));
  for (let i = 0; i < 3; i++) {
    await toggle.click();
    assert.equal(await hearts.count(), 0);
    await toggle.click();
    assert.ok(await hearts.count() <= (reduced ? 1 : 2), 'toggle duplicated the release loop');
  }
};
