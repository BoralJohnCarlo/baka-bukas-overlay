// Decorative interaction effects use the browser animation clock, separate from lyrics.
(() => {
  const scene = document.getElementById('stage');
  const sky = document.getElementById('heartSky');
  const button = document.getElementById('loveBtn');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Map();
  let lastRelease = -Infinity;
  let press = null;
  let enabled = true;
  let pageActive = true;
  let timer = null;
  let releaseIndex = 0;

  function clear() {
    for (const [heart, animation] of active) {
      animation.cancel();
      heart.remove();
    }
    active.clear();
    lastRelease = -Infinity;
    press = null;
  }

  function release(clientX) {
    const now = performance.now();
    const bounds = scene.getBoundingClientRect();
    const compact = bounds.width < 760;
    const limit = motion.matches ? 2 : compact ? 6 : 8;
    if (!enabled || !pageActive || document.hidden || now - lastRelease < 700 || active.size >= limit || bounds.width < 60) return;
    lastRelease = now;
    const count = Math.min(motion.matches ? 1 : 2, limit - active.size);
    for (let i = 0; i < count; i++) {
      const heart = document.createElement('span');
      heart.className = `heart-balloon ${i % 2 ? 'rose' : 'gold'}`;
      const x = Math.max(24, Math.min(bounds.width - 24, clientX - bounds.left + (i ? 14 : -14)));
      heart.style.left = `${x}px`;
      heart.style.width = `${compact ? 14 + i * 3 : 18 + i * 3}px`;
      heart.innerHTML = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M12 21S2 15 2 8.5C2 3 9 1 12 6c3-5 10-3 10 2.5C22 15 12 21 12 21Z"/><path class="heart-thread" d="M12 21q-2 2 0 3t0 3"/></svg>';
      sky.append(heart);
      const rise = bounds.height + 64;
      const side = i ? 1 : -1;
      const frames = motion.matches ? [
        { opacity: 0, transform: 'translateY(-38px)' },
        { opacity: 0.6, transform: 'translateY(-38px)', offset: 0.3 },
        { opacity: 0, transform: 'translateY(-38px)' }
      ] : [
        { opacity: 0, transform: 'translate3d(0, 0, 0) scale(.75)' },
        { opacity: 0.65, transform: `translate3d(${side * 5}px, ${-rise * 0.15}px, 0) scale(1)`, offset: 0.15 },
        { opacity: 0.55, transform: `translate3d(${-side * 8}px, ${-rise * 0.55}px, 0) scale(1)`, offset: 0.55 },
        { opacity: 0, transform: `translate3d(${side * 10}px, ${-rise}px, 0) scale(.85)` }
      ];
      const animation = heart.animate(frames, {
        duration: motion.matches ? 800 : 5200 + i * 350,
        delay: motion.matches ? 0 : i * 140,
        easing: 'linear', fill: 'both'
      });
      active.set(heart, animation);
      const remove = () => { active.delete(heart); heart.remove(); };
      void animation.finished.then(remove, remove);
    }
  }

  function stop() {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    clear();
  }

  function automaticRelease() {
    timer = null;
    if (!enabled || !pageActive || document.hidden) return;
    const bounds = scene.getBoundingClientRect();
    const positions = [0.22, 0.76, 0.42, 0.62];
    release(bounds.left + bounds.width * positions[releaseIndex++ % positions.length]);
    timer = window.setTimeout(automaticRelease, 2400);
  }

  function restart() {
    stop();
    automaticRelease();
  }

  // Pointer events cover touch, pen, and mouse; drags and controls never release hearts.
  document.addEventListener('pointerdown', event => {
    press = event.isPrimary !== false && event.button === 0 && !event.target.closest('.controls')
      ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null;
  });
  document.addEventListener('pointerup', event => {
    const down = press;
    press = null;
    if (!down || down.id !== event.pointerId || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 12) return;
    const bounds = scene.getBoundingClientRect();
    if (event.target.closest('.controls') || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    release(event.clientX);
  });
  document.addEventListener('pointercancel', () => { press = null; });
  button.addEventListener('click', () => {
    enabled = !enabled;
    button.setAttribute('aria-pressed', String(enabled));
    button.title = enabled ? 'Turn floating hearts off' : 'Turn floating hearts on';
    restart();
  });
  motion.addEventListener('change', restart);
  window.addEventListener('resize', restart);
  window.addEventListener('pagehide', () => { pageActive = false; stop(); });
  window.addEventListener('pageshow', () => { pageActive = true; restart(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else restart(); });
  restart();
})();
