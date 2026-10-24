'use strict';
// «Сегодня» — рабочий стол: полоса дня, план, маршрут каникул, лента уроков курсов, тепловая карта занятий, пробники.

// Пункт плана сделан: урок — досмотрен, текстовый пункт — записан итог в его день
const itemDone = (x, date) => x.l ? isWatched(x.l) : planTextDone(x, date);
const planHrsOf = a => sum(a.filter(x => !x.opt).map(planHours));
const hstr = h => String(Math.round(h * 10) / 10).replace('.', ',');
// Все дни плана по порядку
function planDates() {
  const keys = new Set(['m', 'r', 'i'].flatMap(k => Object.keys((typeof PLAN !== 'undefined' && PLAN[k]) || {})));
  return [...keys].map(k => ddmm(k)).sort();
}
const IC = {
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  fire: '<svg viewBox="0 0 24 24"><path d="M12 21c-4 0-7-2.8-7-6.6 0-3.1 2-5 3.4-6.6.3 1.6 1.2 2.7 2.3 3.2C10.6 7.5 12.4 4.6 15 3c-.4 2.6.5 4.4 1.9 6.1 1.3 1.5 2.1 3.1 2.1 5.3C19 18.2 16 21 12 21z"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

// Карточка пункта плана
function planCard(x, date, i) {
  const done = itemDone(x, date), subj = x.l ? x.l.subj : x.subj, h = planHours(x);
  const tag = x.half ? '<span class="tag warn">досмотреть</span>' : x.opt ? '<span class="tag">по желанию</span>' : '';
  if (x.l) {
    const s = st(x.l.id);
    const hw = s.hwN ? `<span class="tag ${s.hwOk === s.hwN ? 'ok' : 'warn'}">ДЗ ${s.hwOk}/${s.hwN}</span>` : done ? '<span class="tag warn">ДЗ на проверку</span>' : '';
    const ask = done && !s.hwN ? `<button class="pc-act ask" data-prompt="${x.l.id}" data-tipr="Скопировать запрос на проверку ДЗ — вставь в Claude Code и приложи фото">Запрос на проверку</button>` : '';
    return `<div class="pcard${done ? ' done' : ''}" style="--c:${SUBJECTS[subj].color};--i:${i}">
      <button class="pc-check" data-watch="${x.l.id}" aria-label="${done ? 'Снять отметку' : 'Урок досмотрен'}">${IC.check}</button>
      <button class="pc-main" data-open="${x.l.id}">
        <span class="pc-subj">${SUBJECTS[subj].name}<i>·</i>${esc(x.l.block)}<i>·</i>урок от ${fmtShort(x.l.date)}</span>
        <span class="pc-title">${esc(x.l.title)}</span>
        <span class="pc-tags">${tag}${hw}</span>
      </button>
      <div class="pc-side"><b class="mono">≈${hstr(h)} ч</b>${ask}<button class="pc-act" data-sum="${x.l.id}">${IC.pen}Итог</button></div>
    </div>`;
  }
  const k = planDay(date).filter(y => !y.l).indexOf(x);
  return `<div class="pcard txt${done ? ' done' : ''}" style="--c:${SUBJECTS[subj].color};--i:${i}">
    <span class="pc-check static">${done ? IC.check : IC.flag}</span>
    <div class="pc-main"><span class="pc-subj">${SUBJECTS[subj].name}${/пробник/i.test(x.t) ? '<i>·</i>контрольная точка' : ''}</span><span class="pc-title">${esc(x.t)}</span></div>
    <div class="pc-side">${h ? `<b class="mono">≈${hstr(h)} ч</b>` : ''}${done ? '<span class="tag ok">записано</span>' : `<button class="pc-act" data-sumt="${k}">${IC.pen}Итог</button>`}</div>
  </div>`;
}

// Маршрут каникул: столбик на день — высота = часы плана, заливка = сделано; флажки этапов
function routeHtml(t) {
  const days = planDates();
  if (!days.length) return '';
  const maxH = Math.max(...days.map(d => planHrsOf(planDay(d))), 1);
  const lastOf = subj => days.filter(d => planDay(d).some(x => x.l && x.l.subj === subj && !x.opt)).pop();
  const flags = {};
  const addF = (d, s) => { if (d) (flags[d] = flags[d] || []).push(s); };
  addF(lastOf('m'), 'мат закрыта'); addF(lastOf('r'), 'рус закрыт');
  days.forEach(d => { if (planDay(d).some(x => !x.l && /пробник/i.test(x.t))) addF(d, /итогов/i.test(planDay(d).map(x => x.t || '').join(' ')) ? 'финиш' : 'старт'); });
  let total = 0, doneH = 0;
  const cols = days.map(d => {
    const items = planDay(d).filter(x => !x.opt), h = planHrsOf(items), dn = items.filter(x => itemDone(x, d));
    const fr = items.length ? dn.length / items.length : 0;
    total += h; doneH += planHrsOf(dn);
    const cls = d === t ? 'today' : d < t ? (fr === 1 ? 'ok' : fr > 0 ? 'part' : 'miss') : 'fut';
    const wd = WD[parseDate(d).getDay()], busy = /вт|чт|сб/.test(wd);
    return `<div class="rcol ${cls}${busy ? ' busy' : ''}" data-tipr="${esc(fmtDate(d) + ' · ≈' + hstr(h) + ' ч · сделано ' + dn.length + ' из ' + items.length + '\n' + items.map(x => (itemDone(x, d) ? '✓ ' : '○ ') + SUBJECTS[x.l ? x.l.subj : x.subj].short + ' ' + (x.l ? x.l.title : x.t)).join('\n'))}">
      <div class="rflags">${(flags[d] || []).map(f => `<span>${IC.flag}${f}</span>`).join('')}</div>
      <div class="rbar" style="--h:${h / maxH}"><i style="--f:${fr}"></i><em class="mono">${hstr(h)}</em></div>
      <div class="rday"><b class="mono">${parseDate(d).getDate()}</b><span>${wd}</span></div>
      ${d === t ? '<div class="rnow">ты здесь</div>' : ''}
    </div>`;
  }).join('');
  const first = days[0], last = days[days.length - 1], dayN = Math.min(days.length, Math.max(0, daysBetween(first, t) + 1));
  return `<section class="card route span12">
    <div class="card-head"><div><div class="card-title">Маршрут каникул</div><div class="muted small">${fmtShort(first)} — ${fmtShort(last)} · день ${dayN} из ${days.length} · план ≈${hstr(total)} ч</div></div>
      <div class="route-sum"><b class="mono cnt">${pct(doneH, total)}</b><span>% маршрута<br>пройдено</span></div></div>
    <div class="rgrid" style="--n:${days.length}">${cols}</div>
    <div class="rlegend muted small"><span><i class="lg ok"></i>день выполнен</span><span><i class="lg part"></i>частично</span><span><i class="lg miss"></i>пропущен</span><span><i class="lg fut"></i>впереди</span><span>светлее — свободные дни, темнее — вт/чт/сб</span></div>
  </section>`;
}

// Лента уроков курса: клетка на урок
function ribbonHtml(subj, t) {
  const ls = lessonsOf(subj), out = ls.filter(l => l.date <= t), w = ls.filter(isWatched).length, debt = ls.filter(isDebt).length;
  const lastPlan = planDates().filter(d => planDay(d).some(x => x.l && x.l.subj === subj && !x.opt)).pop();
  const blocks = [...new Set(ls.map(l => l.block))];
  return `<div class="rib" style="--c:${SUBJECTS[subj].color}">
    <div class="rib-top"><b>${SUBJECTS[subj].name}</b><span class="muted small">${esc(SUBJECTS[subj].course || '')}</span><span class="rib-n mono"><b class="cnt">${w}</b>/${out.length}</span></div>
    ${blocks.map(bl => `<div class="rib-row"><span class="rib-bl">${esc(bl.replace('Блок ', 'Б'))}</span><div class="rib-cells">${ls.filter(l => l.block === bl).map(l => {
      const c = isWatched(l) ? 'w' : isDebt(l) ? 'd' : l.date === t ? 'n' : 'f';
      return `<button class="cell ${c}" data-open="${l.id}" data-tipr="${esc(l.title + '\n' + fmtDate(l.date) + ' · ' + ({ w: 'пройден', d: 'долг', n: 'выходит сегодня', f: 'впереди' })[c])}"></button>`;
    }).join('')}</div></div>`).join('')}
    <div class="rib-foot small">${debt ? `<span class="warn-t">долг ${debt} ${plural(debt, 'урок', 'урока', 'уроков')}</span>${lastPlan ? ` · по плану закроешь <b>${fmtShort(lastPlan)}</b>` : ''}` : '<span class="ok-t">долгов нет — идёшь вместе с курсом</span>'}</div>
  </div>`;
}

// Тепловая карта: 12 недель занятий
function heatHtml(t) {
  const weeks = 12, start = addDays(mondayOf(t), -7 * (weeks - 1));
  let cols = '', tot = 0, active = 0, best = 0;
  for (let w = 0; w < weeks; w++) {
    let c = '';
    for (let d = 0; d < 7; d++) {
      const day = addDays(start, w * 7 + d), m = minutesOn(day);
      if (day > t) { c += '<i class="hc x"></i>'; continue; }
      tot += m; if (m >= 20) active++; best = Math.max(best, m);
      const lv = m <= 0 ? 0 : m < 60 ? 1 : m < 150 ? 2 : m < 300 ? 3 : 4;
      c += `<i class="hc l${lv}${day === t ? ' now' : ''}" data-tipr="${esc(fmtDate(day) + ' · ' + (m ? fmtMin(m) : 'не занимался'))}"></i>`;
    }
    cols += `<div class="hw">${c}</div>`;
  }
  return `<section class="card span8 heat">
    <div class="card-head"><div class="card-title">Занятия за 12 недель</div><div class="muted small">всего <b class="txt">${fmtH(tot)} ч</b> · дней с занятиями <b class="txt">${active}</b> · рекорд за день <b class="txt">${best ? fmtMin(best) : '—'}</b></div></div>
    <div class="heat-wrap"><div class="hdays muted"><span>пн</span><span></span><span>ср</span><span></span><span>пт</span><span></span><span>вс</span></div><div class="hgrid">${cols}</div></div>
    <div class="hlegend muted small">меньше <i class="hc l0"></i><i class="hc l1"></i><i class="hc l2"></i><i class="hc l3"></i><i class="hc l4"></i> больше · до 1 ч · 1–2,5 ч · 2,5–5 ч · 5+ ч</div>
  </section>`;
}

// Пробники: старт каникул → последний, по предметам
function testsHtml() {
  const from = planDates()[0] || '2026-10-24', goal = { i: 60 };
  const rows = SUBJ_ORDER.map(k => {
    const ts = S.tests.filter(x => x.subj === k && x.date >= from && x.test !== '').sort((a, b) => a.date.localeCompare(b.date));
    const first = ts[0], last = ts.length > 1 ? ts[ts.length - 1] : null;
    const d = first && last ? last.test - first.test : null;
    return `<div class="trow2" style="--c:${SUBJECTS[k].color}">
      <span class="tr-name">${dot(k)}${SUBJECTS[k].short}</span>
      <span class="tr-v mono">${first ? `<b class="cnt">${first.test}</b>` : '<span class="muted">—</span>'}</span>
      <span class="tr-ar">${IC.arrow}</span>
      <span class="tr-v mono">${last ? `<b class="cnt">${last.test}</b>` : '<span class="muted">08.11</span>'}</span>
      <span class="tr-d mono ${d > 0 ? 'ok-t' : d < 0 ? 'warn-t' : 'muted'}">${d == null ? (goal[k] ? 'цель ' + goal[k] : '') : (d > 0 ? '+' : '') + d}</span>
    </div>`;
  }).join('');
  return `<section class="card span4 tests"><div class="card-title">Пробники: старт → финиш</div>
    <div class="muted small">тестовые баллы · запиши во вкладке «Практика»</div>${rows}</section>`;
}

// «Жидкий» шар: уровень волны = доля времени дня
function liquidHtml(p) {
  const y = 118 - Math.min(100, p) / 100 * 116;
  const wave = 'M0 0 Q15 -7 30 0 T60 0 T90 0 T120 0 T150 0 T180 0 T210 0 T240 0 V140 H0 Z';
  return `<div class="liquid" data-tipr="Записано времени от плана дня">
    <svg viewBox="0 0 120 120"><defs>
      <clipPath id="lqc"><circle cx="60" cy="60" r="53"/></clipPath>
      <linearGradient id="lqg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3a683"/><stop offset=".45" stop-color="#ee8fb0"/><stop offset="1" stop-color="#9d8cff"/></linearGradient>
    </defs>
      <circle cx="60" cy="60" r="57.5" class="lq-rim"/><circle cx="60" cy="60" r="53" class="lq-bg"/>
      <g clip-path="url(#lqc)"><g style="transform:translateY(${y}px)" class="lq-lvl">
        <path class="lq-w2" d="${wave}"/><path class="lq-w1" d="${wave}"/></g></g>
      <circle cx="44" cy="38" r="9" class="lq-shine"/>
    </svg>
    <div class="lq-txt"><b class="mono cnt">${p}</b><span class="mono">%</span><small>времени дня</small></div>
  </div>`;
}

// Виджет: часы и отсчёт до ближайшего этапа (тикает раз в секунду)
function milestones() {
  const days = planDates(), out = [];
  const lastOf = subj => days.filter(d => planDay(d).some(x => x.l && x.l.subj === subj && !x.opt)).pop();
  const fin = days.find(d => planDay(d).some(x => !x.l && /итогов/i.test(x.t)));
  if (lastOf('m')) out.push({ d: lastOf('m'), t: 'Математика догнана' });
  if (fin) out.push({ d: fin, t: 'Итоговые пробники' });
  if (lastOf('r')) out.push({ d: lastOf('r'), t: 'Русский догнан' });
  out.push({ d: '2026-11-09', t: 'Конец каникул' });
  out.push({ d: S.settings.essay, t: 'Итоговое сочинение' });
  return out.sort((a, b) => a.d.localeCompare(b.d));
}
function clockWidget(t) {
  const ms = milestones().filter(m => m.d > t), next = ms[0];
  return `<section class="card span4 w-clock">
    <div class="w-head"><span class="w-ic">${IC.clock}</span>Сейчас</div>
    <div class="clk mono" id="wClock">--:--<small>:--</small></div>
    <div class="muted small">${fmtDate(t)}</div>
    ${next ? `<div class="w-next"><span class="muted small">до этапа «<b class="txt">${next.t}</b>» · ${fmtShort(next.d)}</span>
      <div class="cdn mono" id="wCount" data-to="${next.d}">—</div></div>
      <div class="w-mile">${ms.slice(1, 4).map(m => `<span><i></i>${m.t} <b class="mono">${daysBetween(t, m.d)} дн</b></span>`).join('')}</div>` : ''}
  </section>`;
}
let clockTick = null;
function startClock() {
  clearInterval(clockTick);
  const upd = () => {
    const c = document.getElementById('wClock'); if (!c) { clearInterval(clockTick); return; }
    const n = new Date(); c.innerHTML = z2(n.getHours()) + ':' + z2(n.getMinutes()) + `<small>:${z2(n.getSeconds())}</small>`;
    const k = document.getElementById('wCount');
    if (k) {
      const left = Math.max(0, parseDate(k.dataset.to) - n), d = Math.floor(left / DAY), h = Math.floor(left % DAY / 36e5), m = Math.floor(left % 36e5 / 6e4), s = Math.floor(left % 6e4 / 1e3);
      k.innerHTML = `<b>${d}</b><small>д</small> <b>${z2(h)}</b><small>:</small><b>${z2(m)}</b><small>:</small><b>${z2(s)}</b>`;
    }
  };
  upd(); clockTick = setInterval(upd, 1000);
}

// Виджет: календарь месяца — интенсивность плана, отметки выполнения, время занятий
function calWidget(t) {
  const d0 = parseDate(t), y = d0.getFullYear(), mo = d0.getMonth();
  const first = todayStr(new Date(y, mo, 1)), dim = new Date(y, mo + 1, 0).getDate(), lead = (new Date(y, mo, 1).getDay() + 6) % 7;
  const maxH = Math.max(1, ...planDates().map(d => planHrsOf(planDay(d))));
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<i class="cd0"></i>';
  for (let n = 1; n <= dim; n++) {
    const d = addDays(first, n - 1), items = planDay(d).filter(x => !x.opt), h = planHrsOf(items), m = minutesOn(d);
    const fr = items.length ? items.filter(x => itemDone(x, d)).length / items.length : 0;
    const st = !items.length ? '' : d > t ? 'fut' : fr === 1 ? 'ok' : d === t ? 'now' : fr > 0 ? 'part' : 'miss';
    cells += `<i class="cdd ${st}${d === t ? ' today' : ''}" style="--h:${h / maxH}" data-tipr="${esc(fmtDate(d) + (items.length ? ' · план ≈' + hstr(h) + ' ч · сделано ' + Math.round(fr * 100) + '%' : '') + (m ? '\nзаписано ' + fmtMin(m) : ''))}"><b>${n}</b>${m >= 20 ? '<em></em>' : ''}</i>`;
  }
  return `<section class="card span4 w-cal">
    <div class="w-head"><span class="w-ic">${IC.flag}</span>${['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'][mo]} ${y}</div>
    <div class="cal-wd">${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(w => `<span>${w}</span>`).join('')}</div>
    <div class="cal">${cells}</div>
    <div class="cal-lg muted"><span><i class="ok"></i>закрыт</span><span><i class="miss"></i>пропуск</span><span><i class="fut"></i>план — ярче, где больше часов</span></div>
  </section>`;
}

// Виджет: следующий шаг — первый несделанный пункт
function nextWidget(t, tail, plan) {
  const x = tail.concat(plan).find(y => !y.opt && !itemDone(y, t));
  const tm = planDay(addDays(t, 1)).find(y => !y.opt);
  if (!x) return `<section class="card span4 w-next2 done"><div class="w-head"><span class="w-ic">${IC.check}</span>Следующий шаг</div>
    <div class="ns-title">План на сегодня закрыт</div><div class="muted small">${tm ? 'Завтра начнёшь с: <b class="txt">' + esc(tm.l ? tm.l.title : tm.t.replace(/\s*·\s*[\d,]+\s*ч$/, '')) + '</b>' : 'Завтра по плану свободно'}</div></section>`;
  const subj = x.l ? x.l.subj : x.subj, title = x.l ? x.l.title : x.t.replace(/\s*·\s*[\d,]+\s*ч$/, '');
  return `<section class="card span4 w-next2" style="--c:${SUBJECTS[subj].color}">
    <div class="w-head"><span class="w-ic">${IC.arrow}</span>Следующий шаг</div>
    <div class="ns-subj">${SUBJECTS[subj].name}${x.half ? ' · досмотреть' : ''}${tail.includes(x) ? ' · хвост' : ''}</div>
    <div class="ns-title">${esc(title)}</div>
    <div class="muted small">≈${hstr(planHours(x))} ч${x.l ? ' · урок от ' + fmtShort(x.l.date) : ''}</div>
    <div class="ns-btns">${x.l ? `<button class="btn ghost" data-open="${x.l.id}">Открыть урок</button><button class="btn" data-sum="${x.l.id}">${IC.pen}Итог</button>`
      : `<button class="btn" data-sumt="${plan.filter(y => !y.l).indexOf(x)}">${IC.pen}Итог</button>`}</div>
  </section>`;
}

VIEWS.home = () => {
  const t = todayStr(), sk = streak();
  const all = allLessons();
  const plan = planDay(t), planReal = plan.filter(x => !x.opt);
  const tail = [];
  for (let d = addDays(t, -1); planDay(d).length; d = addDays(d, -1))
    for (const x of planDay(d)) if (x.l && !x.opt && !isWatched(x.l) && !tail.some(y => y.l === x.l)) tail.unshift(x);
  const tomorrow = planDay(addDays(t, 1));
  const doneN = planReal.filter(x => itemDone(x, t)).length;
  const planH = planHrsOf(plan), doneMin = minutesOn(t);
  const goalMin = planH ? planH * 60 : S.settings.goal;
  const todayNew = all.filter(l => l.date === t && !plan.some(x => x.l === l));
  const hw = all.filter(hwDebt);
  const sess = S.sessions.filter(s => s.date === t);
  // неделя: часы факт против плана
  const mon = mondayOf(t), wkDays = [...Array(7)].map((_, i) => addDays(mon, i));
  const wkMin = sum(wkDays.map(d => minutesOn(d))), wkPlan = sum(wkDays.map(d => planHrsOf(planDay(d))));
  // полоса дня: сегменты по пунктам плана
  const seg = planReal.map(x => `<i class="${itemDone(x, t) ? 'on' : ''}" style="--w:${planHours(x) || 1};--c:${SUBJECTS[x.l ? x.l.subj : x.subj].color}" data-tipr="${esc((x.l ? x.l.title : x.t) + ' · ≈' + hstr(planHours(x)) + ' ч')}"></i>`).join('');
  const allDone = planReal.length && doneN === planReal.length;

  // приветствие и живая фраза из цифр
  const hr = new Date().getHours();
  const hello = hr < 5 ? 'Доброй ночи' : hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер';
  const left = planReal.filter(x => !itemDone(x, t)), leftH = planHrsOf(left);
  const pdays = planDates(), lastM = pdays.filter(d => planDay(d).some(x => x.l && x.l.subj === 'm' && !x.opt)).pop();
  const mDebt = lessonsOf('m').filter(isDebt).length;
  const sub = [
    planReal.length ? (left.length ? `Сегодня осталось <b>${left.length} ${plural(left.length, 'пункт', 'пункта', 'пунктов')}</b> · ≈${hstr(leftH)} ч` : '<b class="ok-t">План дня закрыт</b> — отдыхай с чистой совестью') : 'Сегодня по плану свободно',
    mDebt && lastM && lastM >= t ? `математика будет догнана через <b>${daysBetween(t, lastM)} ${plural(daysBetween(t, lastM), 'день', 'дня', 'дней')}</b>` : '',
  ].filter(Boolean).join(' · ');
  const achs = achList(progressFacts()), achDone = achs.filter(a => a.done).length;
  const achNext = achs.filter(a => !a.done).sort((a, b) => b.cur / b.goal - a.cur / a.goal).slice(0, 1)[0];

  return {
    title: hello, crumb: 'Сегодня · ' + fmtDate(t), sub,
    html: `<div class="dash">
    <section class="card hero span8">
      <div class="hero-l">
        <div class="eyebrow">${planReal.length ? (allDone ? 'План дня выполнен' : 'План на сегодня') : 'Свободный день'}</div>
        <div class="hero-num"><b class="mono cnt">${doneN}</b><span class="mono">/${planReal.length}</span><small>${planReal.length ? 'пунктов плана' : 'по плану ничего нет'}</small></div>
        <div class="dayseg">${seg || '<i style="--w:1"></i>'}</div>
        <div class="hero-sub muted">≈${hstr(planH)} ч по плану · записано <b class="txt">${fmtMin(doneMin)}</b>${tomorrow.length ? ` · завтра ≈${hstr(planHrsOf(tomorrow))} ч` : ''}</div>
      </div>
      <div class="hero-r">
        ${liquidHtml(pct(doneMin, goalMin))}
        <button class="btn glow" id="sumBtn">${IC.pen}Записать итог занятия</button>
      </div>
    </section>
    <section class="span4 kpis3">
      <div class="kpi2 fire"><span class="k-ic">${IC.fire}</span><b class="mono cnt">${sk}</b><span>${plural(sk, 'день', 'дня', 'дней')} подряд<br><small class="muted">от 20 мин в день</small></span></div>
      <div class="kpi2"><span class="k-ic">${IC.clock}</span><b class="mono"><span class="cnt">${fmtH(wkMin)}</span><small>/${hstr(wkPlan)} ч</small></b><span>за неделю<br><small class="muted">факт / по плану</small></span></div>
    </section>

    ${nextWidget(t, tail, plan)}
    ${clockWidget(t)}
    ${calWidget(t)}

    <section class="card span8 plan">
      <div class="card-head"><div class="card-title">План на сегодня</div><div class="muted small">отметь урок — нажми на кружок · после занятия — «Итог»</div></div>
      ${tail.length ? `<div class="sub-h warn-t">Хвост с прошлых дней · ${tail.length}</div>${tail.map((x, i) => planCard(x, t, i)).join('')}<div class="sub-h">Сегодня</div>` : ''}
      ${plan.length ? plan.map((x, i) => planCard(x, t, i + tail.length)).join('') : '<div class="empty">На сегодня в плане пусто — хороший день, чтобы закрыть ошибки из ДЗ</div>'}
      ${todayNew.length ? `<div class="sub-h">Вышло сегодня в курсе — посмотришь по плану позже</div><div class="lessons">${todayNew.map(l => lessonRow(l, true)).join('')}</div>` : ''}
      ${tomorrow.length ? `<div class="plan-next"><span class="muted">Завтра · ≈${hstr(planHrsOf(tomorrow))} ч</span>${tomorrow.map(x => `<span class="nx" style="--c:${SUBJECTS[x.l ? x.l.subj : x.subj].color}">${esc(x.l ? x.l.title : x.t.replace(/\s*\(.*$/, ''))}</span>`).join('')}</div>` : ''}
    </section>
    <section class="card span4 courses">
      <div class="card-title">Курсы</div>
      ${['m', 'r'].map(k => ribbonHtml(k, t)).join('')}
      <div class="rib-legend muted small"><span><i class="cell w"></i>пройден</span><span><i class="cell d"></i>долг</span><span><i class="cell f"></i>впереди</span></div>
    </section>

    ${routeHtml(t)}

    <section class="card span12 ach">
      <div class="card-head"><div><div class="card-title">Достижения · ${achDone} из ${achs.length}</div>
        <div class="muted small">${achNext ? `ближе всего: <b class="txt">${achNext.t}</b> — ${achNext.cur} из ${achNext.goal}` : 'все открыты'}</div></div></div>
      <div class="ach-grid">${achs.map(a => `<div class="badge${a.done ? ' on' : ''}" data-tipr="${esc(a.t + ' — ' + a.d + (a.done ? '\nоткрыто ' + fmtShort(S.ach[a.id] || t) : '\n' + Math.min(a.cur, a.goal) + ' из ' + a.goal))}">
        <span class="b-ic">${achIcon(a.ic)}</span><b>${a.t}</b><small>${a.done ? 'открыто' : Math.min(a.cur, a.goal) + ' / ' + a.goal}</small>
        ${a.done ? '' : `<i class="b-bar"><i style="width:${pct(Math.min(a.cur, a.goal), a.goal)}%"></i></i>`}</div>`).join('')}</div>
    </section>

    ${heatHtml(t)}
    ${testsHtml()}

    ${hw.length ? `<section class="card span6"><div class="card-title">ДЗ ждёт проверки · ${hw.length}</div><div class="lessons">${hw.map(l => lessonRow(l, true)).join('')}</div></section>` : ''}
    <section class="card ${hw.length ? 'span6' : 'span12'}">
      <div class="card-head"><div class="card-title">Записано сегодня</div><div class="muted small">${sess.length ? fmtMin(doneMin) + ' за ' + sess.length + ' ' + plural(sess.length, 'занятие', 'занятия', 'занятий') : ''}</div></div>
      ${sess.length ? sess.map(s => `<div class="srow">${dot(s.subj)}<span>${SUBJECTS[s.subj].name}${s.what ? ' <span class="muted">· ' + esc(s.what) + '</span>' : ''}</span><b class="mono">${fmtMin(s.min)}</b><button class="x" data-del="${s.id}" aria-label="Удалить">✕</button></div>`).join('') : '<div class="empty">Пока пусто. Позанимался — нажми «Записать итог занятия»</div>'}
    </section>
    </div>`,
    mount: root => {
      root.querySelector('#sumBtn').onclick = () => summarySheet();
      root.querySelectorAll('[data-sumt]').forEach(b => b.onclick = () => summarySheet(plan.filter(x => !x.l)[+b.dataset.sumt]));
      root.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        if (!confirm('Удалить запись?')) return;
        S.sessions = S.sessions.filter(s => s.id !== b.dataset.del); save(); render();
      });
      bindLessons(root);
      startClock();
      root.querySelectorAll('[data-prompt]').forEach(b => b.onclick = e => { e.stopPropagation(); copyPrompt({ l: lesById(b.dataset.prompt) }); });
      // День закрыт — салют, один раз за день
      if (allDone && S.ui.cheer !== t) { S.ui.cheer = t; save(); setTimeout(() => confetti(innerWidth / 2, innerHeight / 3), 350); }
    },
  };
};
