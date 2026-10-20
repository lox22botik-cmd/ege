'use strict';
// «Курсы»: уроки по блокам, отметки «посмотрел» и ДЗ, карточка урока, добавление новых блоков.

function lessonBadges(l) {
  const s = st(l.id), out = [];
  if (isDebt(l)) out.push('<span class="pill warn">долг</span>');
  else if (!isWatched(l) && l.date === todayStr()) out.push('<span class="pill now">сегодня</span>');
  if (s.hw === 'todo') out.push('<span class="pill warn">ДЗ</span>');
  if (s.hw === 'done') out.push(`<span class="pill ok">ДЗ${s.hwP != null ? ' ' + s.hwP + '%' : ' ✓'}</span>`);
  return out.join('');
}
// Строка урока. withSubj — показать предмет (на «Сегодня»)
function lessonRow(l, withSubj) {
  const w = isWatched(l);
  return `<div class="lrow${w ? ' done' : ''}">
    <button class="lcheck${w ? ' on' : ''}" data-watch="${l.id}" aria-label="${w ? 'Снять отметку' : 'Отметить просмотренным'}" style="--c:${SUBJECTS[l.subj].color}">✓</button>
    <button class="lmain" data-open="${l.id}">
      <span class="ltitle">${esc(l.title)}</span>
      <span class="lmeta">${withSubj ? dot(l.subj) + SUBJECTS[l.subj].short + ' · ' : ''}${dayLabel(l.date)}${l.time ? ' · ' + esc(l.time) : ''} ${lessonBadges(l)}</span>
    </button>
    ${w ? '' : `<button class="lplay" data-play="${l.id}" aria-label="Смотреть с таймером">▶</button>`}
  </div>`;
}
function bindLessons(root) {
  root.querySelectorAll('[data-watch]').forEach(b => b.onclick = () => {
    const on = !isWatched(lesById(b.dataset.watch));
    setWatched(b.dataset.watch, on); render();
    if (on) toast('Урок отмечен. Не забудь ДЗ');
  });
  root.querySelectorAll('[data-open]').forEach(b => b.onclick = () => lessonSheet(b.dataset.open));
  root.querySelectorAll('[data-play]').forEach(b => b.onclick = () => { const l = lesById(b.dataset.play); startTimer(l.subj, l.title, l.id); });
}

function lessonSheet(id) {
  const l = lesById(id), s = st(id), w = isWatched(l);
  const hw = s.hw === 'old' ? 'none' : s.hw || 'todo';
  openSheet(SUBJECTS[l.subj].name + ' · ' + l.block, `
    <div class="ls-title">${esc(l.title)}</div>
    <div class="muted">${fmtDate(l.date)}${l.time ? ' · ' + esc(l.time) : ''}${w ? ' · посмотрен ' + fmtShort(s.w) : ''}</div>
    ${l.tasks.length ? `<div class="chips">${l.tasks.map(n => `<a class="chip" href="#practice" data-task="${l.subj}:${n}">№${n}${taskName(l.subj, n) && TASK_NAMES[l.subj][n] ? ' · ' + esc(taskName(l.subj, n)) : ''}</a>`).join('')}</div>` : ''}
    <div class="btn-row">
      <button class="btn ${w ? 'ghost' : ''}" id="lsW">${w ? 'Снять «посмотрел»' : '✓ Посмотрел'}</button>
      ${S.timer ? '' : '<button class="btn ghost" id="lsT">▶ Смотреть с таймером</button>'}
    </div>
    <h4>Домашнее задание</h4>
    <div class="seg" id="lsH">
      <button data-h="none" class="${hw === 'none' ? 'on' : ''}">Нет / не учитывать</button>
      <button data-h="todo" class="${hw === 'todo' ? 'on' : ''}">Не сделано</button>
      <button data-h="done" class="${hw === 'done' ? 'on' : ''}">Сделано</button>
    </div>
    <label class="field">Результат ДЗ, % (необязательно)<input type="number" id="lsP" inputmode="numeric" min="0" max="100" value="${s.hwP != null ? s.hwP : ''}" placeholder="например 80"></label>
    <label class="field">Заметка<textarea id="lsN" rows="3" placeholder="что не понял, к чему вернуться, ссылка на запись">${esc(s.note || '')}</textarea></label>
    <button class="btn wide" id="lsOk">Сохранить</button>
    ${l.custom ? '<button class="btn danger wide" id="lsDel">Удалить урок</button>' : ''}`, b => {
    let h = hw;
    b.querySelectorAll('[data-h]').forEach(x => x.onclick = () => { h = x.dataset.h; b.querySelectorAll('[data-h]').forEach(y => y.classList.toggle('on', y === x)); });
    b.querySelector('#lsW').onclick = () => { setWatched(id, !w); closeSheet(); render(); };
    const tb = b.querySelector('#lsT');
    if (tb) tb.onclick = () => { closeSheet(); startTimer(l.subj, l.title, l.id); };
    b.querySelectorAll('[data-task]').forEach(a => a.onclick = () => { const [sj, n] = a.dataset.task.split(':'); S.ui.prac = sj; S.ui.openTask = +n; save(); if (location.hash === '#practice') { closeSheet(); render(); } });
    b.querySelector('#lsOk').onclick = () => {
      const x = S.les[id] || (S.les[id] = {});
      x.hw = h === 'none' ? 'old' : h;
      const p = b.querySelector('#lsP').value;
      if (p === '') delete x.hwP; else x.hwP = Math.max(0, Math.min(100, parseInt(p)));
      if (x.hwP != null && x.hw !== 'old') x.hw = 'done';
      x.note = b.querySelector('#lsN').value.trim();
      save(); closeSheet(); render();
    };
    const del = b.querySelector('#lsDel');
    if (del) del.onclick = () => {
      if (!confirm('Удалить урок «' + l.title + '»?')) return;
      S.custom = S.custom.filter(c => c.id !== id); delete S.les[id]; resetLessons(); save(); closeSheet(); render();
    };
  });
}

// Новый блок: строки «дд.мм чч:мм Название» (время можно не писать)
function addLessonsSheet(subj) {
  const blocks = [...new Set(lessonsOf(subj).map(l => l.block))];
  const next = 'Блок ' + (blocks.length + 1);
  openSheet('Добавить уроки · ' + SUBJECTS[subj].name, `
    <label class="field">Блок<input id="alB" value="${esc(next)}" list="alBl"><datalist id="alBl">${blocks.map(b => `<option value="${esc(b)}">`).join('')}</datalist></label>
    <label class="field">Уроки — по одному в строке: дата, время, название
      <textarea id="alT" rows="8" placeholder="09.11 16:00 №14. Стереометрия&#10;10.11 18:00 №18. Простая планиметрия&#10;12.11 Веб с методистом"></textarea></label>
    <div class="muted small" id="alPrev">Перепиши расписание с афиши в Телеграме — даты и номера заданий подхватятся сами.</div>
    <button class="btn wide" id="alOk">Добавить</button>`, b => {
    const parse = () => b.querySelector('#alT').value.split('\n').map(x => x.trim()).filter(Boolean).map(line => {
      const m = line.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\s+(?:(\d{1,2}:\d{2})\s+)?(.+)$/);
      if (!m) return { bad: line };
      let y = m[3] ? +m[3] : null;
      if (y && y < 100) y += 2000;
      if (!y) y = +m[2] >= 8 ? 2026 : 2027; // учебный год: сентябрь–декабрь 2026, январь–июнь 2027
      return { date: y + '-' + z2(m[2]) + '-' + z2(m[1]), time: m[4] || '', title: m[5] };
    });
    b.querySelector('#alT').oninput = () => {
      const r = parse(), bad = r.filter(x => x.bad);
      b.querySelector('#alPrev').innerHTML = r.length ? `Распознано уроков: <b>${r.length - bad.length}</b>${bad.length ? ` · <span class="warn-t">не понял ${bad.length} ${plural(bad.length, 'строку', 'строки', 'строк')}: «${esc(bad[0].bad)}»</span>` : ''}` : 'Пусто';
    };
    b.querySelector('#alOk').onclick = () => {
      const r = parse().filter(x => !x.bad), block = b.querySelector('#alB').value.trim() || next;
      if (!r.length) { toast('Нет ни одной строки вида «12.11 16:00 Название»'); return; }
      const have = new Set(lessonsOf(subj).map(l => l.id));
      let n = 0;
      for (const x of r) {
        let id = subj + '-' + x.date;
        if (have.has(id)) id += '-' + uid();
        S.custom.push({ id, subj, block, date: x.date, time: x.time, title: x.title, custom: true });
        have.add(id); n++;
      }
      resetLessons(); save(); closeSheet(); render(); toast('Добавлено уроков: ' + n);
    };
  });
}

VIEWS.course = () => {
  const subj = S.ui.course === 'r' ? 'r' : 'm', f = S.ui.filter || 'all';
  const ls = lessonsOf(subj), t = todayStr();
  const out = ls.filter(l => l.date <= t), watched = ls.filter(isWatched), debt = ls.filter(isDebt);
  const hwT = ls.filter(hwDebt).length, hwD = ls.filter(l => st(l.id).hw === 'done');
  const hwPs = hwD.map(l => st(l.id).hwP).filter(x => x != null);
  const shown = f === 'debt' ? ls.filter(l => isDebt(l) || hwDebt(l)) : f === 'next' ? ls.filter(l => l.date >= t) : ls;
  const blocks = [...new Set(shown.map(l => l.block))];

  return {
    title: 'Курсы',
    html: `
    <div class="seg big" id="cS">${['m', 'r'].map(k => `<button data-s="${k}" class="${k === subj ? 'on' : ''}" style="--c:${SUBJECTS[k].color}">${SUBJECTS[k].name}</button>`).join('')}</div>
    <section class="card course-head" style="--c:${SUBJECTS[subj].color}">
      <div class="muted small">${esc(SUBJECTS[subj].course)}</div>
      <div class="kpis">
        <div><b class="mono">${watched.length}<small>/${out.length}</small></b><span>посмотрено из вышедших</span></div>
        <div class="${debt.length ? 'warn-t' : 'ok-t'}"><b class="mono">${debt.length}</b><span>${plural(debt.length, 'урок', 'урока', 'уроков')} в долгу</span></div>
        <div><b class="mono">${hwT}</b><span>ДЗ не сделано</span></div>
        <div><b class="mono">${hwPs.length ? Math.round(sum(hwPs) / hwPs.length) + '%' : '—'}</b><span>средний % за ДЗ</span></div>
      </div>
      ${bar(pct(watched.length, out.length), SUBJECTS[subj].color)}
    </section>
    <div class="chips filt">${[['all', 'Все'], ['debt', 'Долги'], ['next', 'Впереди']].map(([k, n]) => `<button class="chip${k === f ? ' on' : ''}" data-f="${k}">${n}</button>`).join('')}</div>
    ${blocks.length ? blocks.slice().reverse().map(bk => {
      const bl = shown.filter(l => l.block === bk), full = ls.filter(l => l.block === bk);
      return `<h3 class="sec">${esc(bk)} <span class="muted">· ${full.filter(isWatched).length}/${full.length} · ${fmtShort(full[0].date)} – ${fmtShort(full[full.length - 1].date)}</span></h3>
        <section class="card"><div class="lessons">${bl.map(l => lessonRow(l)).join('')}</div></section>`;
    }).join('') : `<div class="empty">${f === 'debt' ? 'Долгов нет — так держать 🎉' : 'Уроков нет'}</div>`}
    <button class="btn ghost wide" id="cAdd">+ Добавить уроки (новый блок)</button>`,
    mount: root => {
      root.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { S.ui.course = b.dataset.s; save(); render(); });
      root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { S.ui.filter = b.dataset.f; save(); render(); });
      root.querySelector('#cAdd').onclick = () => addLessonsSheet(subj);
      bindLessons(root);
    },
  };
};
