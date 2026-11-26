const assert = require('node:assert/strict');

module.exports = async function checkHearts(page, reduced = false) {
  const hearts = page.locator('.heart-balloon');
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  const box = await page.locator('#stage').boundingBox();
  const point = { x: box.x + box.width / 2, y: Math.max(10, box.y) + 36 };
  const paused = await page.evaluate(() => audio.paused);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.waitForFunction(count => document.querySelectorAll('.heart-balloon').length === count, reduced ? 1 : 2);
  assert.equal(await page.evaluate(() => audio.paused), paused, 'hearts changed playback');
  const design = await page.evaluate(() => [...document.querySelectorAll('.heart-balloon')].map(heart => {
    const animation = heart.getAnimations()[0];
    return { color: getComputedStyle(heart).color, frames: animation.effect.getKeyframes(), pointer: getComputedStyle(heart).pointerEvents };
  }));
  assert.equal(design[0].color, 'rgb(217, 184, 138)');
  assert.ok(design.every(heart => heart.pointer === 'none'));
  if (reduced) {
    assert.equal(new Set(design[0].frames.map(frame => frame.transform)).size, 1, 'reduced motion must not float');
  } else {
    assert.equal(design[1].color, 'rgb(185, 132, 148)');
    assert.notEqual(design[0].frames[0].transform, design[0].frames.at(-1).transform);
    for (let group = 0; group < 3; group++) {
      await page.evaluate(() => { for (let i = 0; i < 20; i++) document.getElementById('loveBtn').click(); });
      const limit = box.width < 760 ? 6 : 8;
      assert.ok(await hearts.count() <= limit, 'rapid input crowded the scene');
      if (!group) assert.equal(await hearts.count(), 2, 'cooldown allowed a rapid burst');
      await page.waitForTimeout(720);
    }
    await page.evaluate(() => { for (let i = 0; i < 20; i++) document.getElementById('loveBtn').click(); });
    assert.equal(await hearts.count(), box.width < 760 ? 6 : 8, 'heart population cap was not enforced');
  }
  // Finish real animations and check that both DOM nodes and animation handles disappear.
  await page.evaluate(() => document.querySelectorAll('.heart-balloon').forEach(heart => heart.getAnimations().forEach(animation => animation.finish())));
  await page.waitForFunction(() => !document.querySelector('.heart-balloon'));
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await page.locator('#resetBtn').click();
  assert.equal(await hearts.count(), 0, 'playback control released hearts');
  await page.locator('#loveBtn').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.heart-balloon'));
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  assert.equal(await hearts.count(), 0, 'page exit did not clear hearts');
  await page.evaluate(() => {
    const bounds = document.getElementById('stage').getBoundingClientRect();
    const init = { bubbles: true, pointerId: 1, isPrimary: true, button: 0, clientX: bounds.left + 30, clientY: bounds.top + 30 };
    const scene = document.getElementById('stage');
    scene.dispatchEvent(new PointerEvent('pointerdown', init));
    scene.dispatchEvent(new PointerEvent('pointerup', { ...init, clientY: init.clientY + 40 }));
  });
  assert.equal(await hearts.count(), 0, 'drag released hearts');
};
