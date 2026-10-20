'use strict';
// «Сегодня»: время за день, уроки на сегодня, долги по курсам и ДЗ, записанные занятия.

VIEWS.home = () => {
  const t = todayStr(), tm = todayMin(), g = S.settings.goal, sk = streak();
  const all = allLessons();
  const todayL = all.filter(l => l.date === t);
  const soon = all.filter(l => l.date > t && l.date <= addDays(t, 3));
  const hw = all.filter(hwDebt);
  const sess = S.sessions.filter(s => s.date === t);
  const essayLeft = daysBetween(t, S.settings.essay);

  const debtCards = ['m', 'r'].map(subj => {
    const d = lessonsOf(subj).filter(isDebt);
    if (!d.length) return `<div class="debt ok">${dot(subj)}<b>${SUBJECTS[subj].name}</b><span class="pill ok">✓ долгов нет</span></div>`;
    // Темп догона: новые уроки смотрим в их день + 2 старых в день
    const done = addDays(t, Math.ceil(d.length / 2));
    return `<div class="debt">
      <div class="debt-head">${dot(subj)}<b>${SUBJECTS[subj].name}</b><span class="debt-n mono">${d.length}</span><span class="muted">${plural(d.length, 'урок', 'урока', 'уроков')} в долгу</span></div>
      <div class="muted small">по 2 старых в день — догонишь к <b class="txt">${fmtShort(done)}</b></div>
      <div class="lessons">${d.slice(0, 3).map(l => lessonRow(l)).join('')}</div>
      ${d.length > 3 ? `<a class="more-link" href="#course" data-course="${subj}">Ещё ${d.length - 3} → в курс</a>` : ''}
    </div>`;
  }).join('');

  return {
    title: 'Сегодня',
    html: `
    <section class="card hero">
      <div class="hero-top">
        <div>
          <div class="muted small">${fmtDate(t)} · занимался</div>
          <div class="hero-num mono">${fmtMin(tm)}</div>
        </div>
        <div class="ring" style="--p:${Math.min(100, pct(tm, g))}"><span class="mono">${pct(tm, g)}%</span><small>цели</small></div>
      </div>
      ${bar(pct(tm, g))}
      <div class="hero-sub muted">цель ${fmtMin(g)} · серия <b class="txt">${sk} ${plural(sk, 'день', 'дня', 'дней')}</b> (от 20 мин в день)</div>
      ${S.timer ? '' : `<div class="start-row">${SUBJ_ORDER.map(k => `<button class="sbtn" data-start="${k}" style="--c:${SUBJECTS[k].color}">▶ ${SUBJECTS[k].name}</button>`).join('')}</div>`}
      <button class="btn ghost wide" id="addTime">+ Добавить время вручную</button>
    </section>

    ${essayLeft >= 0 && essayLeft <= 60 ? `<div class="banner">✍️ Итоговое сочинение (допуск к ЕГЭ) — <b>${fmtShort(S.settings.essay)}</b>, через ${essayLeft} ${plural(essayLeft, 'день', 'дня', 'дней')}. Уроки «ИС» в русском — в приоритете.</div>` : ''}

    <h3 class="sec">Уроки сегодня</h3>
    <section class="card">${todayL.length ? `<div class="lessons">${todayL.map(l => lessonRow(l, true)).join('')}</div>` : '<div class="empty">Сегодня по расписанию уроков нет — хороший день, чтобы закрыть долги или порешать инфу</div>'}</section>

    <h3 class="sec">Долги по курсам</h3>
    <section class="debts">${debtCards}</section>

    ${hw.length ? `<h3 class="sec">ДЗ не сделано · ${hw.length}</h3><section class="card"><div class="lessons">${hw.map(l => lessonRow(l)).join('')}</div></section>` : ''}

    ${soon.length ? `<h3 class="sec">Ближайшие дни</h3><section class="card"><div class="lessons">${soon.map(l => lessonRow(l, true)).join('')}</div></section>` : ''}

    <h3 class="sec">Записано сегодня</h3>
    <section class="card">${sess.length ? sess.map(s => `<div class="srow">${dot(s.subj)}<span>${SUBJECTS[s.subj].name}${s.what ? ' <span class="muted">· ' + esc(s.what) + '</span>' : ''}</span><b class="mono">${fmtMin(s.min)}</b><button class="x" data-del="${s.id}" aria-label="Удалить">✕</button></div>`).join('') : '<div class="empty">Пока пусто. Нажми ▶ у предмета — таймер посчитает время сам</div>'}</section>`,
    mount: root => {
      root.querySelectorAll('[data-start]').forEach(b => b.onclick = () => startTimer(b.dataset.start));
      root.querySelector('#addTime').onclick = () => addTimeSheet();
      root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        if (!confirm('Удалить запись?')) return;
        S.sessions = S.sessions.filter(s => s.id !== b.dataset.del); save(); render();
      });
      root.querySelectorAll('[data-course]').forEach(a => a.onclick = () => { S.ui.course = a.dataset.course; S.ui.filter = 'debt'; save(); });
      bindLessons(root);
    },
  };
};
