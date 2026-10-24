'use strict';
// «Итоги»: время по дням и предметам, прогресс курсов, рост на пробниках.

// Прямоугольник со скруглённым верхом (концы столбиков — 4px, низ на базовой линии — прямой)
function topRound(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
// Ширина графика = ширина карточки, чтобы подписи не раздувались и не мельчали
const chartW = () => Math.max(300, Math.min(720, ($('#view').clientWidth || 360) - 66));
function niceStep(max) { for (const s of [30, 60, 90, 120, 180, 240]) if (max / s <= 4) return s; return 300; }

// Столбики минут по дням с разбивкой по предметам
function daysChart(days) {
  const W = chartW(), H = 190, L = 30, R = 6, T = 8, B = 22;
  const data = days.map(d => ({ d, by: SUBJ_ORDER.map(k => minutesOn(d, k) + (S.timer && S.timer.subj === k && d === todayStr() ? timerMin() : 0)) }));
  const max = Math.max(S.settings.goal, ...data.map(x => sum(x.by)), 60);
  const step = niceStep(max), top = Math.ceil(max / step) * step;
  const cw = (W - L - R) / days.length, bw = Math.max(4, cw - 3);
  const y = v => T + (H - T - B) * (1 - v / top);
  let g = '';
  for (let v = 0; v <= top; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" class="ax" text-anchor="end">${v / 60 === Math.round(v / 60) ? v / 60 + 'ч' : fmtH(v)}</text>`;
  const gy = y(S.settings.goal);
  g += `<line x1="${L}" x2="${W - R}" y1="${gy}" y2="${gy}" class="goal"/><text x="${W - R}" y="${gy - 4}" class="ax" text-anchor="end">цель</text>`;
  data.forEach((x, i) => {
    const bx = L + i * cw + (cw - bw) / 2;
    let acc = 0;
    const segs = SUBJ_ORDER.map((k, j) => ({ k, v: x.by[j] })).filter(s => s.v > 0);
    segs.forEach((s, j) => {
      const y0 = y(acc), y1 = y(acc + s.v), h = Math.max(1, y0 - y1 - (j ? 2 : 0));
      g += j === segs.length - 1 ? `<path d="${topRound(bx, y1, bw, h, 4)}" fill="${SUBJECTS[s.k].color}"/>` : `<rect x="${bx}" y="${y1 + 2}" width="${bw}" height="${Math.max(1, h - 2)}" fill="${SUBJECTS[s.k].color}"/>`;
      acc += s.v;
    });
    const dd = parseDate(x.d);
    if ((days.length - 1 - i) % (days.length > 30 ? 14 : 7) === 0) g += `<text x="${bx + bw / 2}" y="${H - 6}" class="ax" text-anchor="middle">${dd.getDate()}.${z2(dd.getMonth() + 1)}</text>`;
    const tipTxt = `<b>${dayLabel(x.d)}</b> · ${fmtMin(sum(x.by))}` + SUBJ_ORDER.map((k, j) => x.by[j] ? `<br><i class="sdot" style="background:${SUBJECTS[k].color}"></i>${SUBJECTS[k].name}: ${fmtMin(x.by[j])}` : '').join('');
    g += `<rect x="${L + i * cw}" y="${T}" width="${cw}" height="${H - T - B}" fill="transparent" data-tip="${esc(tipTxt)}"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Минуты занятий по дням">${g}</svg>`;
}

// Линия процентов на пробниках по одному предмету
function testsChart(subj) {
  const ts = S.tests.filter(t => t.subj === subj).sort((a, b) => a.date.localeCompare(b.date));
  const W = chartW(), H = 150, L = 34, R = 12, T = 12, B = 20, c = SUBJECTS[subj].color;
  const y = v => T + (H - T - B) * (1 - v / 100);
  const x = i => ts.length === 1 ? (L + W - R) / 2 : L + (W - L - R) * i / (ts.length - 1);
  let g = '';
  for (const v of [0, 50, 100]) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" class="ax" text-anchor="end">${v}%</text>`;
  const pts = ts.map((t, i) => [x(i), y(pct(t.score, t.max)), t]);
  if (pts.length > 1) g += `<polyline points="${pts.map(p => p[0] + ',' + p[1]).join(' ')}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`;
  pts.forEach(([px, py, t], i) => {
    g += `<circle cx="${px}" cy="${py}" r="5" fill="${c}" stroke="var(--surface)" stroke-width="2"/>`;
    g += `<circle cx="${px}" cy="${py}" r="14" fill="transparent" data-tip="${esc(`<b>${fmtShort(t.date)}</b> · ${esc(t.src || 'вариант')}<br>${t.score}/${t.max} перв. (${pct(t.score, t.max)}%)${t.test !== '' ? '<br>' + t.test + ' тестовых' : ''}`)}"/>`;
    if (i === pts.length - 1) g += `<text x="${Math.min(px, W - R - 4)}" y="${py - 10}" class="lbl" text-anchor="${pts.length > 1 ? 'end' : 'middle'}">${pct(t.score, t.max)}%</text>`;
  });
  if (pts.length) { g += `<text x="${pts[0][0]}" y="${H - 4}" class="ax" text-anchor="start">${fmtShort(ts[0].date)}</text>`; if (pts.length > 1) g += `<text x="${W - R}" y="${H - 4}" class="ax" text-anchor="end">${fmtShort(ts[ts.length - 1].date)}</text>`; }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Результаты пробников: ${SUBJECTS[subj].name}">${g}</svg>`;
}

// ДЗ: точность по предметам и список номеров с ошибками — по нему повторение перед стримом
function hwCard() {
  const rows = allLessons().map(l => ({ l, s: st(l.id) })).filter(x => x.s.hwN);
  if (!rows.length) return `<section class="card"><div class="card-title">Домашки</div><div class="empty">Когда проверим первое ДЗ, впиши в карточке урока, сколько было заданий и сколько верно — здесь появится точность и список ошибок</div></section>`;
  const bySubj = ['m', 'r'].map(k => { const r = rows.filter(x => x.l.subj === k); return { k, n: sum(r.map(x => x.s.hwN)), ok: sum(r.map(x => x.s.hwOk)), cnt: r.length }; }).filter(x => x.cnt);
  const errs = rows.filter(x => x.s.hwErr || x.s.hwOk < x.s.hwN);
  return `<section class="card">
      <div class="card-title">Домашки</div>
      <div class="kpis two">${bySubj.map(x => `<div><b class="mono">${pct(x.ok, x.n)}%</b><span>${dot(x.k)}${SUBJECTS[x.k].name}: верно ${x.ok} из ${x.n} · ДЗ ${x.cnt}</span></div>`).join('')}</div>
      ${errs.length ? `<div class="sm-title">Где были ошибки · ${errs.length}</div>${errs.map(x => `<button class="hwerr" data-open="${x.l.id}"><span>${dot(x.l.subj)}${esc(x.l.title)}</span><b class="mono">${x.s.hwOk}/${x.s.hwN}</b>${x.s.hwErr ? `<small class="muted">ошибки: ${esc(x.s.hwErr)}</small>` : ''}</button>`).join('')}` : '<div class="ok-t small">Ошибок нет — всё верно</div>'}
    </section>`;
}

VIEWS.stats = () => {
  const t = todayStr(), range = S.ui.range || 28;
  const days = Array.from({ length: range }, (_, i) => addDays(t, i - range + 1));
  const minIn = (from, subj) => sum(S.sessions.filter(s => s.date >= from && s.date <= t && (!subj || s.subj === subj)).map(s => s.min)) + (S.timer && (!subj || S.timer.subj === subj) ? timerMin() : 0);
  const w7 = minIn(addDays(t, -6)), total = sum(S.sessions.map(s => s.min)) + timerMin(), sk = streak();
  const activeDays = new Set(S.sessions.filter(s => s.date >= addDays(t, -6)).map(s => s.date)).size;
  const rangeMin = SUBJ_ORDER.map(k => minIn(days[0], k)), rangeAll = sum(rangeMin);
  const subjWithTests = SUBJ_ORDER.filter(k => S.tests.some(x => x.subj === k));

  return {
    title: 'Итоги',
    html: `
    <section class="kpi-grid">
      <div class="kpi"><span>Сегодня</span><b class="mono">${fmtMin(todayMin())}</b><small>цель ${fmtMin(S.settings.goal)}</small></div>
      <div class="kpi"><span>За 7 дней</span><b class="mono">${fmtH(w7)} ч</b><small>в среднем ${fmtMin(w7 / 7)} в день</small></div>
      <div class="kpi"><span>Серия</span><b class="mono">${sk}</b><small>${plural(sk, 'день', 'дня', 'дней')} подряд · ${activeDays}/7 за неделю</small></div>
      <div class="kpi"><span>Всего</span><b class="mono">${fmtH(total)} ч</b><small>с начала учёта</small></div>
    </section>

    <section class="card">
      <div class="card-head"><div class="card-title">Время по дням</div>
        <div class="chips mini">${[14, 28, 56].map(n => `<button class="chip${n === range ? ' on' : ''}" data-r="${n}">${n} дн</button>`).join('')}</div></div>
      <div class="legend">${SUBJ_ORDER.map(k => `<span>${dot(k)}${SUBJECTS[k].name}</span>`).join('')}<span><i class="lg goal-l"></i>цель</span></div>
      ${S.sessions.length || S.timer ? daysChart(days) : '<div class="empty">Пока нет занятий. Запусти таймер на «Сегодня» — здесь появится график</div>'}
    </section>

    <section class="card">
      <div class="card-title">Куда ушло время · ${range} дн</div>
      ${rangeAll ? SUBJ_ORDER.map((k, j) => `<div class="hbar"><span class="hb-name">${dot(k)}${SUBJECTS[k].name}</span><div class="hb-track"><i style="width:${pct(rangeMin[j], Math.max(...rangeMin))}%;background:${SUBJECTS[k].color}"></i></div><b class="mono">${fmtH(rangeMin[j])} ч</b><span class="muted mono">${pct(rangeMin[j], rangeAll)}%</span></div>`).join('') : '<div class="muted">Нет данных за период</div>'}
    </section>

    <section class="card">
      <div class="card-title">Курсы</div>
      ${['m', 'r'].map(k => {
        const ls = lessonsOf(k), out = ls.filter(l => l.date <= t), w = ls.filter(isWatched).length, d = ls.filter(isDebt).length, hw = ls.filter(hwDebt).length;
        return `<div class="cprog"><div class="cp-top">${dot(k)}<b>${SUBJECTS[k].name}</b><span class="mono">${w}/${out.length}</span></div>${bar(pct(w, out.length), SUBJECTS[k].color)}
          <div class="muted small">${d ? `<span class="warn-t">долг ${d} ${plural(d, 'урок', 'урока', 'уроков')}</span>` : '<span class="ok-t">без долгов</span>'}${hw ? ` · ДЗ не сделано: ${hw}` : ''} · всего в курсе ${ls.length}</div></div>`;
      }).join('')}
    </section>

    ${hwCard()}

    <section class="card">
      <div class="card-title">Пробники · % от первичного максимума</div>
      ${subjWithTests.length ? subjWithTests.map(k => `<div class="sm-title">${dot(k)}${SUBJECTS[k].name}</div>${testsChart(k)}`).join('') : '<div class="empty">Запиши первый пробник во вкладке «Практика» — здесь появится график роста</div>'}
    </section>`,
    mount: root => {
      root.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { S.ui.range = +b.dataset.r; save(); render(); });
      root.querySelectorAll('[data-open]').forEach(b => b.onclick = () => lessonSheet(b.dataset.open));
    },
  };
};
