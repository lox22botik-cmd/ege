'use strict';
// Живой фон: пастельные пятна перетекают (низкое разрешение — CSS сам размывает при растяжении),
// сверху — плавающая пыль с параллаксом от мыши, за курсором — мягкий свет. 30 кадров/с, на паузе, когда вкладка скрыта.
(() => {
  const mesh = document.getElementById('bgMesh'), dust = document.getElementById('bgDust');
  if (!mesh || !dust) return;
  const mx = mesh.getContext('2d'), dx = dust.getContext('2d');
  const SCALE = 8; // сетка пятен в 8 раз меньше экрана
  const BLOBS = [
    { c: [157, 140, 255], r: .55, a: .55, sx: .00011, sy: .00009, px: 0, py: 1.3 },  // лаванда
    { c: [238, 143, 176], r: .42, a: .42, sx: .00008, sy: .00013, px: 2.1, py: .4 },  // роза
    { c: [111, 214, 196], r: .48, a: .36, sx: .00010, sy: .00007, px: 4.2, py: 2.6 }, // мята
    { c: [243, 166, 131], r: .36, a: .30, sx: .00013, sy: .00010, px: 1.1, py: 3.7 }, // персик
    { c: [126, 167, 255], r: .50, a: .34, sx: .00006, sy: .00011, px: 3.3, py: 5.1 }, // васильковый
  ];
  // оттенок по времени суток: утром и вечером теплее (персик/роза), ночью — фиолетовее
  const hr = new Date().getHours(), warm = hr >= 6 && hr < 11 ? 1.5 : hr >= 17 && hr < 22 ? 1.3 : 1, night = hr >= 22 || hr < 6 ? 1.35 : 1;
  BLOBS[1].a *= warm; BLOBS[3].a *= warm; BLOBS[0].a *= night; BLOBS[4].a *= night;
  const GLYPHS = ['π', '∫', '√x', 'Σ', 'x²', 'sin α', 'log₂', '∞', 'Δ', 'f(x)', '≈', '∠', 'eˣ', 'n!', 'ℝ', 'cos', 'a⃗', 'P(A)', '½', '∑', 'y′', '10₂'];
  let W = 0, H = 0, dpr = 1, motes = [], glyphs = [], stars = [], nextStar = 0;
  const mouse = { x: .5, y: .3, tx: .5, ty: .3 };
  function size() {
    W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 1.5);
    mesh.width = Math.ceil(W / SCALE); mesh.height = Math.ceil(H / SCALE);
    dust.width = W * dpr; dust.height = H * dpr; dx.setTransform(dpr, 0, 0, dpr, 0, 0);
    motes = [...Array(Math.round(W * H / 22000))].map(() => ({
      x: Math.random() * W, y: Math.random() * H, z: .3 + Math.random() * .9, r: .5 + Math.random() * 1.4,
      v: .08 + Math.random() * .22, ph: Math.random() * 6.28, tw: .6 + Math.random() * 1.6,
    }));
    glyphs = GLYPHS.map((g, i) => ({
      g, x: Math.random() * W, y: Math.random() * H, z: .35 + Math.random() * .75, s: 14 + Math.random() * 26,
      rot: (Math.random() - .5) * .5, vr: (Math.random() - .5) * .0004, v: .05 + Math.random() * .1, ph: i,
    }));
  }
  addEventListener('resize', size); size();
  addEventListener('pointermove', e => { mouse.tx = e.clientX / W; mouse.ty = e.clientY / H; }, { passive: true });

  const STILL = matchMedia('(prefers-reduced-motion: reduce)').matches; // без анимации — один кадр
  let last = -1e9;
  function frame(now) {
    if (!STILL) requestAnimationFrame(frame);
    if (document.hidden || now - last < 33) return;
    last = now;
    mouse.x += (mouse.tx - mouse.x) * .06; mouse.y += (mouse.ty - mouse.y) * .06;
    // пятна
    const w = mesh.width, h = mesh.height, m = Math.max(w, h);
    mx.globalCompositeOperation = 'source-over';
    mx.fillStyle = '#0a0c15'; mx.fillRect(0, 0, w, h);
    mx.globalCompositeOperation = 'lighter';
    for (const b of BLOBS) {
      const x = w * (.5 + .42 * Math.sin(now * b.sx + b.px)) + (mouse.x - .5) * w * .06;
      const y = h * (.5 + .45 * Math.cos(now * b.sy + b.py)) + (mouse.y - .5) * h * .06;
      const r = m * b.r * (1 + .08 * Math.sin(now * .0004 + b.px));
      const g = mx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${b.c},${b.a * .5})`); g.addColorStop(.5, `rgba(${b.c},${b.a * .16})`); g.addColorStop(1, `rgba(${b.c},0)`);
      mx.fillStyle = g; mx.fillRect(0, 0, w, h);
    }
    // свет за курсором
    const lx = mouse.x * w, ly = mouse.y * h, lg = mx.createRadialGradient(lx, ly, 0, lx, ly, m * .22);
    lg.addColorStop(0, 'rgba(200,190,255,.10)'); lg.addColorStop(1, 'rgba(200,190,255,0)');
    mx.fillStyle = lg; mx.fillRect(0, 0, w, h);
    dx.clearRect(0, 0, W, H);
    // символы математики: едва видны, медленно плывут, ближние сильнее смещаются за мышью
    for (const q of glyphs) {
      q.y -= q.v * q.z; q.rot += q.vr * 33;
      if (q.y < -60) { q.y = H + 60; q.x = Math.random() * W; }
      const ox = (mouse.x - .5) * -70 * q.z, oy = (mouse.y - .5) * -50 * q.z;
      dx.save(); dx.translate(q.x + ox, q.y + oy); dx.rotate(q.rot);
      dx.font = `600 ${q.s * q.z + 6}px 'JetBrains Mono', monospace`;
      dx.fillStyle = `rgba(214,206,255,${.035 + .05 * q.z})`; dx.fillText(q.g, 0, 0); dx.restore();
    }
    // падающая звезда раз в 7–15 секунд
    if (now > nextStar) { nextStar = now + 7000 + Math.random() * 8000; stars.push({ x: W * (.2 + Math.random() * .7), y: H * Math.random() * .35, t: now }); }
    stars = stars.filter(st => now - st.t < 900);
    for (const st of stars) {
      const k = (now - st.t) / 900, len = 160, hx = st.x - k * 420, hy = st.y + k * 210;
      const g = dx.createLinearGradient(hx, hy, hx + len, hy - len / 2);
      g.addColorStop(0, `rgba(255,240,230,${.9 * (1 - k)})`); g.addColorStop(1, 'rgba(255,240,230,0)');
      dx.strokeStyle = g; dx.lineWidth = 1.6; dx.beginPath(); dx.moveTo(hx, hy); dx.lineTo(hx + len, hy - len / 2); dx.stroke();
    }
    const MX = mouse.tx * W, MY = mouse.ty * H, near = [];
    // пыль
    for (const p of motes) {
      p.y -= p.v * p.z; p.x += Math.sin(now * .0003 + p.ph) * .12 * p.z;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      const ox = (mouse.x - .5) * -40 * p.z, oy = (mouse.y - .5) * -30 * p.z;
      const a = (.25 + .35 * Math.sin(now * .001 * p.tw + p.ph) ** 2) * p.z;
      dx.beginPath(); dx.arc(p.x + ox, p.y + oy, p.r * p.z, 0, 6.283);
      dx.fillStyle = `rgba(230,225,255,${a})`; dx.fill();
      const d = Math.hypot(p.x + ox - MX, p.y + oy - MY);
      if (d < 170) near.push([p.x + ox, p.y + oy, d]);
    }
    // созвездие: пылинки рядом с курсором соединяются линиями
    dx.lineWidth = .8;
    for (let i = 0; i < near.length; i++) {
      const [ax, ay, ad] = near[i];
      dx.strokeStyle = `rgba(238,170,200,${.28 * (1 - ad / 170)})`; dx.beginPath(); dx.moveTo(ax, ay); dx.lineTo(MX, MY); dx.stroke();
      for (let j = i + 1; j < near.length; j++) {
        const [bx, by] = near[j], dd = Math.hypot(ax - bx, ay - by);
        if (dd < 90) { dx.strokeStyle = `rgba(200,190,255,${.22 * (1 - dd / 90)})`; dx.beginPath(); dx.moveTo(ax, ay); dx.lineTo(bx, by); dx.stroke(); }
      }
    }
  }
  requestAnimationFrame(frame);
})();
