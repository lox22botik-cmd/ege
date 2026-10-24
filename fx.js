'use strict';
// Эффекты интерфейса: кольцо за курсором, магнитные кнопки, волна при нажатии, наклон карточек, проявление при прокрутке.
// Всё через transform/opacity; при «уменьшить движение» в системе — выключено.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const HOT = 'a, button, select, input, textarea, .cell, .badge, .rcol, .hc';

  // кольцо за курсором (родной курсор остаётся)
  const ring = document.createElement('div'); ring.className = 'cur-ring';
  const dot = document.createElement('div'); dot.className = 'cur-dot';
  document.body.append(ring, dot);
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, hot = false, shown = false;
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    if (!shown) { shown = true; rx = x; ry = y; document.body.classList.add('cur-on'); }
    const h = !!e.target.closest(HOT);
    if (h !== hot) { hot = h; ring.classList.toggle('hot', h); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { shown = false; document.body.classList.remove('cur-on'); });
  addEventListener('pointerdown', () => ring.classList.add('down'));
  addEventListener('pointerup', () => ring.classList.remove('down'));
  (function loop() {
    rx += (x - rx) * .18; ry += (y - ry) * .18;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    requestAnimationFrame(loop);
  })();

  // магнитные кнопки: главная кнопка и «Итог» тянутся к курсору
  document.addEventListener('pointermove', e => {
    document.querySelectorAll('.btn.glow, .pc-act').forEach(b => {
      const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy), R = Math.max(r.width, 90);
      b.style.transform = d < R ? `translate(${dx * .18}px, ${dy * .25}px)` : '';
    });
  }, { passive: true });

  // волна при нажатии
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn, .pc-act, .chip, .seg button, .tabs a, .pc-check');
    if (!b) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, w = document.createElement('i');
    w.className = 'ripple'; w.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden'; b.appendChild(w); setTimeout(() => w.remove(), 650);
  });

  // наклон за мышью — только у небольших блоков
  document.addEventListener('pointermove', e => {
    const c = e.target.closest('.kpi2, .badge.on, .rank, .cd');
    document.querySelectorAll('.tilt').forEach(t => { if (t !== c) { t.classList.remove('tilt'); t.style.transform = ''; } });
    if (!c) return;
    const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
    c.classList.add('tilt'); c.style.transform = `perspective(700px) rotateX(${-py * 7}deg) rotateY(${px * 9}deg) translateY(-2px)`;
  }, { passive: true });

  // карточки ниже экрана проявляются при прокрутке (после каждой отрисовки вкладки)
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -60px 0px' });
  new MutationObserver(() => {
    document.querySelectorAll('#view .card:not(.rv-done)').forEach(c => {
      c.classList.add('rv-done');
      if (c.getBoundingClientRect().top > innerHeight) { c.classList.add('rv'); io.observe(c); }
    });
  }).observe(document.getElementById('view'), { childList: true });
})();
