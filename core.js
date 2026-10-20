'use strict';
// Ядро: хранение, даты, уроки, окна, таймер, роутинг. Всё живёт в localStorage этого браузера.

const KEY = 'ege-v1';
const DAY = 864e5;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// ---------- даты и форматирование ----------
const z2 = n => String(n).padStart(2, '0');
function todayStr(d = new Date()) { return d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate()); }
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return todayStr(d); }
function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / DAY); }
function mondayOf(s) { const d = parseDate(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return todayStr(d); }
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
function fmtShort(s) { const d = parseDate(s); return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
function fmtDate(s) { const d = parseDate(s); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + WD[d.getDay()]; }
function dayLabel(s) { const t = todayStr(); return s === t ? 'Сегодня' : s === addDays(t, -1) ? 'Вчера' : s === addDays(t, 1) ? 'Завтра' : fmtDate(s); }
function fmtMin(m) { m = Math.round(m); if (m < 60) return m + ' мин'; const h = Math.floor(m / 60), r = m % 60; return h + ' ч' + (r ? ' ' + r + ' мин' : ''); }
function fmtH(m) { return String(Math.round(m / 6) / 10).replace('.', ','); }
function mmss(s) { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + z2(m) : m) + ':' + z2(s % 60); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let uidN = 0;
function uid() { return Date.now().toString(36) + (uidN++).toString(36); }
const sum = a => a.reduce((x, y) => x + y, 0);
const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; };
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

// ---------- хранение ----------
const ddmm = (s, y = 2026) => { const [d, m] = s.split('.'); return y + '-' + z2(m) + '-' + z2(d); };
function fresh() {
  const les = {};
  for (const subj in START_WATCHED) for (const d of START_WATCHED[subj]) les[subj + '-' + ddmm(d)] = { w: ddmm(d), hw: 'old' };
  return {
    v: 1, les, custom: [], sessions: [], timer: null, practice: [], tests: [], tasks: { m: {}, r: {}, i: {} },
    settings: { goal: 120, exam: '2027-06-01', essay: '2026-12-02' },
    ui: { course: 'm', prac: 'i' },
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) { const f = fresh(); for (const k in f) if (s[k] === undefined) s[k] = f[k]; s.settings = Object.assign(f.settings, s.settings); return s; }
  } catch (e) { }
  return fresh();
}
let S = load();
let saveWarned = false;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { if (!saveWarned) { saveWarned = true; alert('Не получилось сохранить данные: ' + e.message); } }
}
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }

// ---------- уроки ----------
// Номера заданий из названия: «№6, 7», «Задание 8», «Задания 4–8», «Практикум. Задания 9, 10».
function tagTasks(title) {
  const m = title.match(/(?:№|Задани[ея])\s*(\d+(?:\s*[,–-]\s*\d+)*)/);
  if (!m) return [];
  const out = [];
  for (const part of m[1].split(',')) {
    const [a, b] = part.split(/[–-]/).map(x => parseInt(x));
    for (let n = a; n <= (b || a); n++) if (n > 0 && n < 40) out.push(n);
  }
  return out;
}
let LCACHE = null;
function allLessons() {
  if (LCACHE) return LCACHE;
  const out = [];
  for (const subj in COURSE_RAW) for (const b of COURSE_RAW[subj]) for (const [d, t, title] of b.lessons) {
    const date = ddmm(d);
    out.push({ id: subj + '-' + date, subj, block: b.block, date, time: t, title, tasks: tagTasks(title) });
  }
  for (const c of S.custom) out.push(Object.assign({ tasks: tagTasks(c.title) }, c));
  out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  return (LCACHE = out);
}
function resetLessons() { LCACHE = null; }
const lessonsOf = subj => allLessons().filter(l => l.subj === subj);
const lesById = id => allLessons().find(l => l.id === id);
const st = id => S.les[id] || {};
const isWatched = l => !!st(l.id).w;
const isDebt = l => !isWatched(l) && l.date < todayStr();
const hwDebt = l => isWatched(l) && st(l.id).hw === 'todo';
function setWatched(id, on) {
  const s = S.les[id] || (S.les[id] = {});
  if (on) { s.w = todayStr(); if (!s.hw) s.hw = 'todo'; } else { delete s.w; if (s.hw === 'todo') delete s.hw; }
  save();
}
// Подписи номеров математики берём из уроков курса: «№9. Производная» → 9: «Производная».
function taskName(subj, n) {
  if (TASK_NAMES[subj][n]) return TASK_NAMES[subj][n];
  const l = lessonsOf(subj).find(l => l.tasks.length === 1 && l.tasks[0] === n);
  return l ? l.title.replace(/^№\s*\d+\.\s*/, '') : '';
}

// ---------- время занятий ----------
const minutesOn = (date, subj) => sum(S.sessions.filter(s => s.date === date && (!subj || s.subj === subj)).map(s => s.min));
function timerMin() { return S.timer ? (Date.now() - S.timer.start) / 60000 : 0; }
function todayMin() { return minutesOn(todayStr()) + timerMin(); }
// Серия: дни подряд с занятиями от 20 минут (сегодняшний день ещё не обнуляет серию).
function streak() {
  let d = todayStr(), n = 0;
  if (todayMin() >= 20) n++;
  d = addDays(d, -1);
  while (minutesOn(d) >= 20) { n++; d = addDays(d, -1); }
  return n;
}

// ---------- окно снизу ----------
function openSheet(title, html, mount) {
  closeSheet();
  const w = document.createElement('div');
  w.className = 'sheet-wrap';
  w.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="sheet-head"><h2>${esc(title)}</h2><button class="x" data-close aria-label="Закрыть">✕</button></div><div class="sheet-body">${html}</div></div>`;
  w.addEventListener('click', e => { if (e.target === w || e.target.closest('[data-close]')) closeSheet(); });
  document.body.appendChild(w);
  requestAnimationFrame(() => w.classList.add('open'));
  mount && mount(w.querySelector('.sheet-body'));
}
function closeSheet() { document.querySelectorAll('.sheet-wrap').forEach(x => x.remove()); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
}

// ---------- подсказки на графиках (наведение и касание) ----------
const tip = $('#tip');
function showTip(el, x, y) {
  tip.innerHTML = el.getAttribute('data-tip');
  tip.classList.remove('hidden');
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2)) + 'px';
  tip.style.top = Math.max(8, y - r.height - 14) + 'px';
}
document.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (el) showTip(el, e.clientX, e.clientY); });
document.addEventListener('pointermove', e => { const el = e.target.closest('[data-tip]'); if (el) showTip(el, e.clientX, e.clientY); else tip.classList.add('hidden'); });
document.addEventListener('scroll', () => tip.classList.add('hidden'), true);

// ---------- таймер ----------
function startTimer(subj, what, lid) {
  if (S.timer) { toast('Таймер уже идёт — сначала останови его'); return; }
  S.timer = { subj, start: Date.now(), what: what || '', lid: lid || null };
  save(); tickTimer(); render();
}
function stopTimer() {
  if (!S.timer) return;
  const t = S.timer, min = Math.round(timerMin()), l = t.lid && lesById(t.lid);
  openSheet('Записать занятие', `
    <div class="big-num mono">${fmtMin(min)}</div>
    <p class="muted center">${esc(SUBJECTS[t.subj].name)}${t.what ? ' · ' + esc(t.what) : ''}</p>
    ${l && !isWatched(l) ? `<label class="check"><input type="checkbox" id="stW" checked> Урок досмотрен</label>` : ''}
    <div class="btn-row"><button class="btn ghost" id="stDrop">Не записывать</button><button class="btn" id="stSave">Записать</button></div>
    <button class="btn ghost wide" id="stBack">Продолжить таймер</button>`, b => {
    b.querySelector('#stSave').onclick = () => {
      if (min >= 1) S.sessions.push({ id: uid(), date: todayStr(), subj: t.subj, min, what: t.what });
      const w = b.querySelector('#stW');
      if (w && w.checked) setWatched(l.id, true);
      S.timer = null; save(); closeSheet(); tickTimer(); render();
      toast(min >= 1 ? 'Записано: ' + fmtMin(min) : 'Меньше минуты — не записано');
    };
    b.querySelector('#stDrop').onclick = () => { S.timer = null; save(); closeSheet(); tickTimer(); render(); };
    b.querySelector('#stBack').onclick = closeSheet;
  });
}
let tickH = null;
function tickTimer() {
  const box = $('#timer');
  clearInterval(tickH);
  if (!S.timer) { box.classList.add('hidden'); document.body.classList.remove('has-timer'); return; }
  box.classList.remove('hidden'); document.body.classList.add('has-timer');
  $('#timerDot').style.background = SUBJECTS[S.timer.subj].color;
  $('#timerLabel').textContent = SUBJECTS[S.timer.subj].name + (S.timer.what ? ' · ' + S.timer.what : '');
  const upd = () => { $('#timerTime').textContent = mmss(Math.floor((Date.now() - S.timer.start) / 1000)); };
  upd(); tickH = setInterval(() => { upd(); if (Math.floor(Date.now() / 1000) % 30 === 0) renderTop(); }, 1000);
}
$('#timerStop').onclick = stopTimer;

// Ручное добавление времени
function addTimeSheet(subj) {
  openSheet('Добавить время', `
    <div class="seg" id="atS">${SUBJ_ORDER.map(k => `<button data-s="${k}" class="${k === (subj || 'm') ? 'on' : ''}" style="--c:${SUBJECTS[k].color}">${SUBJECTS[k].name}</button>`).join('')}</div>
    <label class="field">Минут<input type="number" id="atM" inputmode="numeric" min="1" max="600" value="60"></label>
    <div class="chips">${[30, 45, 60, 90, 120].map(m => `<button class="chip" data-m="${m}">${fmtMin(m)}</button>`).join('')}</div>
    <label class="field">Что делал (необязательно)<input id="atW" placeholder="например: вариант на kompege"></label>
    <label class="field">День<input type="date" id="atD" value="${todayStr()}" max="${todayStr()}"></label>
    <button class="btn wide" id="atOk">Добавить</button>`, b => {
    let s = subj || 'm';
    b.querySelectorAll('[data-s]').forEach(x => x.onclick = () => { s = x.dataset.s; b.querySelectorAll('[data-s]').forEach(y => y.classList.toggle('on', y === x)); });
    b.querySelectorAll('[data-m]').forEach(x => x.onclick = () => { b.querySelector('#atM').value = x.dataset.m; });
    b.querySelector('#atOk').onclick = () => {
      const min = parseInt(b.querySelector('#atM').value);
      if (!(min > 0 && min <= 600)) { toast('Укажи минуты от 1 до 600'); return; }
      S.sessions.push({ id: uid(), date: b.querySelector('#atD').value || todayStr(), subj: s, min, what: b.querySelector('#atW').value.trim() });
      save(); closeSheet(); render(); toast('Добавлено: ' + fmtMin(min));
    };
  });
}

// ---------- шапка: деталь с данными справа ----------
function renderTop() {
  const t = todayMin(), g = S.settings.goal, left = daysBetween(todayStr(), S.settings.exam);
  $('#topDetail').innerHTML = `
    <div class="td-row"><b class="mono">${fmtMin(t)}</b> <span class="muted">из ${fmtMin(g)}</span></div>
    <div class="td-bar"><i style="width:${Math.min(100, pct(t, g))}%"></i></div>
    <div class="td-sub muted">до ЕГЭ ~${left} ${plural(left, 'день', 'дня', 'дней')}</div>`;
}

// ---------- роутинг ----------
const VIEWS = {};
function render() {
  const tab = (location.hash || '#home').slice(1).split('/')[0];
  const v = VIEWS[tab] || VIEWS.home;
  $$('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === (VIEWS[tab] ? tab : 'home')));
  const r = v();
  $('#title').textContent = r.title;
  $('#view').innerHTML = r.html;
  r.mount && r.mount($('#view'));
  renderTop();
}
window.addEventListener('hashchange', () => { closeSheet(); render(); scrollTo(0, 0); });
window.addEventListener('load', () => { tickTimer(); render(); });
// После полуночи — пересчитать «сегодня»
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });

// Общие кусочки разметки
const dot = subj => `<i class="sdot" style="background:${SUBJECTS[subj].color}"></i>`;
function bar(p, color) { return `<div class="pbar"><i style="width:${Math.max(0, Math.min(100, p))}%;${color ? 'background:' + color : ''}"></i></div>`; }
