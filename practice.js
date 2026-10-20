'use strict';
// «Практика»: карта номеров заданий (сколько решено и с какой точностью) и пробники.

// Статистика по номеру: решения из практики + полные варианты (номер не в списке ошибок = решён верно).
function taskStats(subj, n) {
  let ok = 0, bad = 0;
  for (const p of S.practice) if (p.subj === subj && p.n === n) { ok += p.ok; bad += p.total - p.ok; }
  for (const t of S.tests) if (t.subj === subj && t.full && n <= SUBJECTS[subj].tasks) { if (t.wrong.includes(n)) bad++; else ok++; }
  return { ok, bad, total: ok + bad, acc: ok + bad ? Math.round(ok / (ok + bad) * 100) : null };
}
// Цвет — только когда решено от 3 задач, иначе процент ни о чём не говорит
const accCls = (a, n) => a == null ? 'none' : n < 3 ? 'few' : a >= 80 ? 'hi' : a >= 50 ? 'mid' : 'lo';
const LINKS = {
  i: [['kompege.ru', 'https://kompege.ru', 'тренажёр КЕГЭ и варианты'], ['Сайт Полякова', 'https://kpolyakov.spb.ru/school/ege.htm', 'задачи по каждому номеру']],
  m: [['Открытый банк ФИПИ', 'https://ege.fipi.ru/bank/', 'задачи по номерам']],
  r: [['Открытый банк ФИПИ', 'https://ege.fipi.ru/bank/', 'задачи по номерам']],
};

function taskSheet(subj, n) {
  const s = taskStats(subj, n), name = taskName(subj, n);
  const hist = S.practice.filter(p => p.subj === subj && p.n === n).slice(-6).reverse();
  const les = lessonsOf(subj).filter(l => l.tasks.includes(n));
  openSheet(SUBJECTS[subj].name + ' · №' + n, `
    ${name ? `<div class="ls-title">${esc(name)}</div>` : ''}
    <div class="kpis three">
      <div><b class="mono">${s.total}</b><span>решено задач</span></div>
      <div class="${s.acc == null ? '' : s.acc >= 80 ? 'ok-t' : s.acc < 50 ? 'warn-t' : ''}"><b class="mono">${s.acc == null ? '—' : s.acc + '%'}</b><span>верно</span></div>
      <div><b class="mono">${s.bad}</b><span>ошибок</span></div>
    </div>
    <h4>Записать решённые</h4>
    <div class="two">
      <label class="field">Решил задач<input type="number" id="tsT" inputmode="numeric" min="1" max="200" value="10"></label>
      <label class="field">Из них верно<input type="number" id="tsO" inputmode="numeric" min="0" max="200" value=""></label>
    </div>
    <button class="btn wide" id="tsOk">Записать</button>
    ${hist.length ? `<h4>Последние записи</h4>${hist.map(p => `<div class="srow"><span>${dayLabel(p.date)}</span><span class="mono">${p.ok}/${p.total}</span><b class="mono">${pct(p.ok, p.total)}%</b><button class="x" data-pdel="${p.id}" aria-label="Удалить">✕</button></div>`).join('')}` : ''}
    ${les.length ? `<h4>Уроки курса по этому номеру</h4><div class="lessons">${les.map(l => lessonRow(l)).join('')}</div>` : ''}
    ${LINKS[subj] ? `<h4>Где брать задачи</h4>${LINKS[subj].map(([t, u, d]) => `<a class="ext" href="${u}" target="_blank" rel="noopener">${t} <span class="muted">— ${d}</span> ↗</a>`).join('')}` : ''}`, b => {
    b.querySelector('#tsOk').onclick = () => {
      const total = parseInt(b.querySelector('#tsT').value), okV = b.querySelector('#tsO').value, ok = okV === '' ? total : parseInt(okV);
      if (!(total > 0) || !(ok >= 0) || ok > total) { toast('Проверь числа: верно не может быть больше, чем решено'); return; }
      S.practice.push({ id: uid(), date: todayStr(), subj, n, total, ok });
      save(); closeSheet(); render(); toast(`№${n}: ${ok}/${total} записано`);
    };
    b.querySelectorAll('[data-pdel]').forEach(x => x.onclick = () => { S.practice = S.practice.filter(p => p.id !== x.dataset.pdel); save(); closeSheet(); render(); taskSheet(subj, n); });
    bindLessons(b);
  });
}

function testSheet(subj, test) {
  const sb = SUBJECTS[subj], t = test || { date: todayStr(), score: '', max: sb.max, test: '', src: '', wrong: [], full: true };
  openSheet((test ? 'Пробник' : 'Новый пробник') + ' · ' + sb.name, `
    <label class="field">Где писал<input id="teS" value="${esc(t.src)}" placeholder="${subj === 'i' ? 'kompege, вариант 12' : 'курс, ФИПИ, школа…'}"></label>
    <div class="two">
      <label class="field">Первичные баллы<input type="number" id="teP" inputmode="numeric" min="0" max="${sb.max}" value="${t.score}"></label>
      <label class="field">Максимум<input type="number" id="teM" inputmode="numeric" min="1" max="100" value="${t.max}"></label>
    </div>
    <label class="field">Тестовый балл (если знаешь)<input type="number" id="teT" inputmode="numeric" min="0" max="100" value="${t.test}" placeholder="из 100"></label>
    <label class="field">Номера с ошибками<input id="teW" value="${t.wrong.join(', ')}" placeholder="например: 6, 13, 19"></label>
    <label class="check"><input type="checkbox" id="teF" ${t.full ? 'checked' : ''}> Это полный вариант — учесть в карте номеров</label>
    <label class="field">День<input type="date" id="teD" value="${t.date}" max="${todayStr()}"></label>
    <button class="btn wide" id="teOk">Сохранить</button>
    ${test ? '<button class="btn danger wide" id="teDel">Удалить</button>' : ''}`, b => {
    b.querySelector('#teOk').onclick = () => {
      const score = parseInt(b.querySelector('#teP').value), max = parseInt(b.querySelector('#teM').value);
      if (!(score >= 0) || !(max > 0) || score > max) { toast('Укажи баллы: от 0 до максимума'); return; }
      const tv = b.querySelector('#teT').value;
      const wrong = [...new Set((b.querySelector('#teW').value.match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= sb.tasks))].sort((a, b) => a - b);
      const rec = { id: test ? test.id : uid(), subj, date: b.querySelector('#teD').value || todayStr(), src: b.querySelector('#teS').value.trim(), score, max, test: tv === '' ? '' : Math.min(100, parseInt(tv)), wrong, full: b.querySelector('#teF').checked };
      S.tests = S.tests.filter(x => x.id !== rec.id).concat(rec);
      save(); closeSheet(); render(); toast('Пробник сохранён');
    };
    const d = b.querySelector('#teDel');
    if (d) d.onclick = () => { if (!confirm('Удалить пробник?')) return; S.tests = S.tests.filter(x => x.id !== test.id); save(); closeSheet(); render(); };
  });
}

VIEWS.practice = () => {
  const subj = SUBJECTS[S.ui.prac] ? S.ui.prac : 'i', sb = SUBJECTS[subj];
  const nums = Array.from({ length: sb.tasks }, (_, i) => i + 1);
  const stats = nums.map(n => ({ n, ...taskStats(subj, n) }));
  const weak = stats.filter(s => s.total >= 3).sort((a, b) => a.acc - b.acc).slice(0, 3).filter(s => s.acc < 80);
  const untouched = stats.filter(s => !s.total).length;
  const watchedT = new Set(lessonsOf(subj).filter(isWatched).flatMap(l => l.tasks));
  const tests = S.tests.filter(t => t.subj === subj).sort((a, b) => b.date.localeCompare(a.date));

  return {
    title: 'Практика',
    html: `
    <div class="seg big" id="pS">${['i', 'm', 'r'].map(k => `<button data-s="${k}" class="${k === subj ? 'on' : ''}" style="--c:${SUBJECTS[k].color}">${SUBJECTS[k].name}</button>`).join('')}</div>
    <section class="card">
      <div class="card-title">Что решать сегодня</div>
      ${weak.length ? weak.map(s => `<button class="weak" data-n="${s.n}"><b class="mono">№${s.n}</b><span>${esc(taskName(subj, s.n)) || '&nbsp;'}</span><span class="pill warn">${s.acc}% верно</span></button>`).join('')
        : `<div class="muted">${stats.some(s => s.total >= 3) ? 'Слабых номеров нет — все от 80% и выше. Пиши полный вариант.' : 'Пока мало данных. Решай по 5–10 задач на номер и записывай — здесь появятся самые слабые номера.'}</div>`}
      <div class="muted small" style="margin-top:8px">Не тронуто номеров: <b class="txt">${untouched} из ${sb.tasks}</b></div>
    </section>

    <h3 class="sec">Карта номеров · ${esc(sb.full)}</h3>
    <div class="legend"><span><i class="lg hi"></i>от 80%</span><span><i class="lg mid"></i>50–79%</span><span><i class="lg lo"></i>ниже 50%</span><span><i class="lg none"></i>не решал или меньше 3 задач</span>${subj !== 'i' ? '<span><i class="lg les"></i>урок пройден</span>' : ''}</div>
    <section class="tgrid">${stats.map(s => `<button class="tcell ${accCls(s.acc, s.total)}" data-n="${s.n}" data-tip="<b>№${s.n}</b>${taskName(subj, s.n) ? ' · ' + esc(taskName(subj, s.n)) : ''}<br>${s.total ? s.ok + ' из ' + s.total + ' верно' : 'ещё не решал'}">
      ${watchedT.has(s.n) ? '<i class="les-dot"></i>' : ''}<b>${s.n}</b><span class="mono">${s.acc == null ? '—' : s.acc + '%'}</span><small>${s.total ? s.total + ' реш.' : '&nbsp;'}</small></button>`).join('')}</section>

    <h3 class="sec">Пробники</h3>
    <section class="card">
      ${tests.length ? tests.map(t => `<button class="trow" data-t="${t.id}">
        <span><b>${fmtShort(t.date)}</b> <span class="muted">${esc(t.src || 'вариант')}</span>${t.wrong.length ? `<span class="tw">ошибки: ${t.wrong.map(n => '№' + n).join(', ')}</span>` : ''}</span>
        <span class="tscore"><b class="mono">${t.score}/${t.max}</b><small>${t.test !== '' ? t.test + ' тест.' : pct(t.score, t.max) + '%'}</small></span></button>`).join('')
        : '<div class="empty">Пока нет. Записывай каждый вариант — в «Итогах» появится график роста.</div>'}
      <button class="btn wide" id="tAdd">+ Записать пробник</button>
    </section>`,
    mount: root => {
      root.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { S.ui.prac = b.dataset.s; save(); render(); });
      root.querySelectorAll('[data-n]').forEach(b => b.onclick = () => taskSheet(subj, +b.dataset.n));
      root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => testSheet(subj, S.tests.find(t => t.id === b.dataset.t)));
      root.querySelector('#tAdd').onclick = () => testSheet(subj);
      if (S.ui.openTask) { const n = S.ui.openTask; delete S.ui.openTask; save(); taskSheet(subj, n); }
    },
  };
};
