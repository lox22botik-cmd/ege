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
    ach: {}, // достижения: id → дата открытия
    tg: { link: {}, hidden: {} }, // link[урок] = ключ поста или '' (видео нет); hidden[пост] = скрыт из «не привязанных»
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
// 24.10: 05.10 и 08.10 по математике досмотрены только наполовину — снять старую стартовую отметку (свою отметку не трогаем)
if (!S.fix24) { for (const id of ['m-2026-10-05', 'm-2026-10-08']) if (S.les[id] && S.les[id].hw === 'old') delete S.les[id]; S.fix24 = 1; save(); }
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
function resetLessons() { LCACHE = null; TGMAP = null; }
const lessonsOf = subj => allLessons().filter(l => l.subj === subj);
const lesById = id => allLessons().find(l => l.id === id);
// Пункты плана на день (PLAN в data.js): { l: урок, half, opt } или { t: текст }
function planOf(subj, date) {
  const day = ((typeof PLAN !== 'undefined' ? PLAN : {})[subj] || {})[date.slice(8) + '.' + date.slice(5, 7)] || [];
  return day.map(x => {
    const m = x.match(/^(\d\d\.\d\d)([½?]?)$/);
    const l = m && lesById(subj + '-' + ddmm(m[1]));
    return l ? { l, half: m[2] === '½', opt: m[2] === '?' } : { t: x.replace(/\s*·\s*[\d,]+\s*ч$/, ''), subj, h: parseFloat((x.match(/·\s*([\d,]+)\s*ч$/) || [0, '0'])[1].replace(',', '.')) };
  });
}
const planDay = date => ['m', 'r', 'i'].flatMap(subj => planOf(subj, date));
// Оценка времени: урок ≈ 1 ч видео на 1,5× + ~1 ч ДЗ; половинка и веб ≈ 1 ч; стрим 6 ч
const planHours = x => !x.l ? x.h || 0 : x.l.time === 'стрим' ? 6 : x.half || /^Веб/.test(x.l.title) ? 1 : 2;
const st = id => S.les[id] || {};
const isWatched = l => !!st(l.id).w;
const isDebt = l => !isWatched(l) && l.date < todayStr();
const hwDebt = l => isWatched(l) && st(l.id).hw === 'todo';
function setWatched(id, on) {
  if (on) { const b = document.querySelector(`[data-watch="${id}"]`); if (b) { const r = b.getBoundingClientRect(); setTimeout(() => confetti(r.left + r.width / 2, r.top + r.height / 2, 45), 30); } }
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

// ---------- ссылки из Телеграма (tg-data.js пишет tg/sync.py) ----------
let TG = window.TG || null;
const tgPosts = () => TG ? TG.posts : [];
const tgByKey = k => tgPosts().find(p => p.key === k);
// Видео одного альбома — один урок: берём первое
const tgVideos = subj => tgPosts().filter(p => p.subj === subj && p.kind === 'video' && !tgPosts().some(q => q.group && q.group === p.group && q.kind === 'video' && q.msg < p.msg));
let TGMAP = null;
// Слова длиннее 3 букв, обрезанные до 5: «Простая планиметрия» ≈ «Планиметрия простая»
const stems = t => new Set((t.toLowerCase().match(/[а-яёa-z]{4,}/g) || []).map(w => w.slice(0, 5)));
// Автопривязка: видео — к ближайшему по дате уроку, который прошёл не позже чем через день после поста
// и не раньше чем за 3 недели. Общие слова в названии сильно помогают; номера заданий, если есть в подписи, обязаны совпасть.
function tgMap() {
  if (TGMAP) return TGMAP;
  const map = {}, used = new Set();
  for (const id in S.tg.link) { map[id] = { key: S.tg.link[id], manual: true }; if (S.tg.link[id]) used.add(S.tg.link[id]); }
  for (const subj of ['m', 'r']) {
    const ls = lessonsOf(subj);
    for (const p of tgVideos(subj)) {
      if (used.has(p.key)) continue;
      const nums = tagTasks(p.text), words = stems(p.text);
      let best = null, bestScore = Infinity;
      for (const l of ls) {
        const gap = daysBetween(l.date, p.date);
        if (map[l.id] || gap < -1 || gap > 21) continue;
        if (nums.length && !l.tasks.some(n => nums.includes(n))) continue;
        const score = gap - 3 * [...stems(l.title)].filter(w => words.has(w)).length;
        if (score < bestScore) { best = l; bestScore = score; }
      }
      if (best) { map[best.id] = { key: p.key, manual: false }; used.add(p.key); }
    }
  }
  return (TGMAP = map);
}
function resetTg() { TGMAP = null; }
const videoOf = l => { const m = tgMap()[l.id]; return m && m.key ? Object.assign({ manual: m.manual }, tgByKey(m.key)) : null; };
const tgUnlinked = subj => { const used = new Set(Object.values(tgMap()).map(m => m.key)); return tgVideos(subj).filter(p => !used.has(p.key) && !S.tg.hidden[p.key]); };
// Посты без видео рядом с уроком: ДЗ (по слову «ДЗ»/«домашка» в подписи или имени файла) — до 2 дней после урока,
// остальные файлы и ссылки (конспекты, презентации) — в день урока и следующий
const nearPosts = (l, days) => tgPosts().filter(p => p.subj === l.subj && p.kind !== 'video' && p.date >= l.date && p.date <= addDays(l.date, days));
const hwOf = l => nearPosts(l, 2).filter(p => p.hw);
const filesOf = l => nearPosts(l, 1).filter(p => !p.hw && p.kind !== 'note');
// Ссылки поста: сам пост в Телеграме + адреса из текста
// Если файл скопирован из экспорта (tg/from_export.py) — открывается с сайта, пост в Телеграме — второй ссылкой
const postLinks = (p, icon) => (p.local
  ? `<a class="ext" href="${esc(encodeURI(p.local))}" target="_blank" rel="noopener">${icon} ${esc(p.file || 'Файл')} <span class="muted">— ${fmtShort(p.date)}, открыть</span></a>
     <a class="ext sub" href="${esc(p.link)}" target="_blank" rel="noopener">✈ пост в Телеграме ↗</a>`
  : `<a class="ext" href="${esc(p.link)}" target="_blank" rel="noopener">${icon} ${esc(p.file || firstLine(p.text).slice(0, 80) || 'Пост')} <span class="muted">— ${fmtShort(p.date)}</span> ↗</a>`)
  + (p.urls || []).map(u => `<a class="ext sub" href="${esc(u.url)}" target="_blank" rel="noopener">🔗 ${esc(u.t || u.url.replace(/^https?:\/\//, '').slice(0, 60))} ↗</a>`).join('');
// Свежая выгрузка без перезагрузки: tg/sync.py по расписанию переписывает tg-data.js, страница раз в 5 минут перечитывает его
async function tgPoll() {
  if (document.hidden) return;
  try {
    const raw = await (await fetch('tg-data.js', { cache: 'no-store' })).text();
    const d = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    if (TG && TG.synced === d.synced && TG.posts.length === d.posts.length) return;
    TG = d; resetTg(); render();
  } catch { }
}
setInterval(tgPoll, 5 * 60000);
document.addEventListener('visibilitychange', tgPoll);
const firstLine = t => (t || '').split('\n').map(x => x.trim()).find(Boolean) || '';
function openVideo(l) {
  const v = videoOf(l);
  if (v) window.open(v.link, '_blank', 'noopener');
  if (!S.timer) startTimer(l.subj, l.title, l.id);
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
  if (el.hasAttribute('data-tip')) { tip.innerHTML = el.getAttribute('data-tip'); tip.classList.remove('pre'); }
  else { tip.textContent = el.getAttribute('data-tipr'); tip.classList.add('pre'); }
  tip.classList.remove('hidden');
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2)) + 'px';
  tip.style.top = Math.max(8, y - r.height - 14) + 'px';
}
document.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip],[data-tipr]'); if (el) showTip(el, e.clientX, e.clientY); });
document.addEventListener('pointermove', e => {
  const el = e.target.closest('[data-tip],[data-tipr]'); if (el) showTip(el, e.clientX, e.clientY); else tip.classList.add('hidden');
  // подсветка карточки под курсором: позиция пятна — своими переменными у самой карточки
  const c = e.target.closest('.card, .kpi2');
  if (c) { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }
});
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

// ---------- запрос на проверку для Claude Code ----------
// x: { l: урок } или пункт плана текстом { subj, t }. Ответ Claude заканчивается строкой «ДЗ: 7/10, ошибки: 3, 8».
function checkPrompt(x) {
  if (x.l) {
    const l = x.l, sb = SUBJECTS[l.subj], s = st(l.id);
    return [
      `Проверь ДЗ · ${sb.full}${sb.course ? ' · ' + sb.course : ''}`,
      `Урок: «${l.title}» — ${l.block.toLowerCase()}, урок от ${fmtShort(l.date)}${l.tasks.length ? ' (задания ЕГЭ: №' + l.tasks.join(', №') + ')' : ''}`,
      s.hwN ? `Заданий в ДЗ: ${s.hwN}` : null,
      'Фото заданий и моего решения — ниже.',
      '',
      'Как проверить:',
      '1. Пройди по каждому номеру: верно / неверно и правильный ответ.',
      '2. Где ошибка — коротко объясни, в чём она и как решать правильно.',
      '3. Если тема провисает — дай 2–3 похожие задачи на отработку.',
      '4. Последней строкой для сайта: ДЗ: X/Y, ошибки: номера через запятую',
    ].filter(v => v !== null).join('\n');
  }
  const sb = SUBJECTS[x.subj];
  return [
    `Проверь пробник · ${sb.full}`,
    `${x.t.replace(/\s*·\s*[\d,]+\s*ч$/, '')}`,
    'Ниже мои ответы по номерам (и фото развёрнутой части, если есть).',
    '',
    'Как проверить:',
    '1. Сверь каждый ответ: верно / неверно и правильный ответ.',
    '2. Посчитай первичный и тестовый балл.',
    '3. Скажи, какие номера проседают и что повторить в первую очередь.',
    '4. Последней строкой для сайта: Пробник: первичный X/Y, тестовый Z, ошибки: номера через запятую',
  ].join('\n');
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { } ta.remove(); return ok;
  }
}
function copyPrompt(x) { copyText(checkPrompt(x)).then(ok => toast(ok ? 'Запрос скопирован — вставь в Claude Code и приложи фото' : 'Не получилось скопировать')); }
// «ДЗ: 7/10, ошибки: 3, 8» → { ok: 7, n: 10, err: '3, 8' }
function parseCheck(line) {
  const m = String(line).match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const e = String(line).match(/ошибк[а-яё]*\s*:?\s*([\d,\s]+)/i);
  return { ok: +m[1], n: +m[2], err: e ? e[1].replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim().replace(/,$/, '') : '' };
}
// Поле «строка от Claude»: заполняет заданий / верно / ошибки
function bindCheckLine(root, ids) {
  const inp = root.querySelector(ids.line); if (!inp) return;
  inp.oninput = () => {
    const r = parseCheck(inp.value); if (!r) return;
    root.querySelector(ids.n).value = r.n; root.querySelector(ids.ok).value = Math.min(r.ok, r.n);
    if (r.err) root.querySelector(ids.err).value = r.err;
    inp.classList.add('parsed');
  };
}
const CHECK_LINE = id => `<label class="field">Строка от Claude после проверки<input id="${id}" class="cline" placeholder="вставь: ДЗ: 7/10, ошибки: 3, 8 — поля ниже заполнятся сами"></label>`;

// Итог занятия (вместо таймера): что делал, сколько времени, досмотрен ли урок, результат ДЗ — одной записью.
// pre: { l: урок } или пункт плана текстом { subj, t, h }
function summarySheet(pre) {
  pre = pre || {};
  const keyOf = x => x.l ? 'l:' + x.l.id : 't:' + x.subj + ':' + x.t;
  // На выбор: план сегодня + не досмотренные уроки вчерашнего плана
  const opts = planDay(todayStr()).concat(planDay(addDays(todayStr(), -1)).filter(x => x.l && !isWatched(x.l)))
    .filter((x, i, a) => a.findIndex(y => keyOf(y) === keyOf(x)) === i);
  if (pre.l && !opts.some(x => x.l === pre.l)) opts.unshift({ l: pre.l });
  if (pre.t && !opts.some(x => keyOf(x) === keyOf(pre))) opts.unshift(pre);
  const cur = pre.l || pre.t ? keyOf(pre) : opts.length ? keyOf(opts[0]) : 'other';
  const minDefault = x => x && x.l ? 120 : x && x.h ? Math.round(x.h * 60) : 60;
  openSheet('Итог занятия', `
    <label class="field">Что делал<select id="smW">
      ${opts.map(x => `<option value="${esc(keyOf(x))}" ${keyOf(x) === cur ? 'selected' : ''}>${SUBJECTS[x.l ? x.l.subj : x.subj].short} · ${esc((x.l ? x.l.title : x.t).slice(0, 70))}</option>`).join('')}
      <option value="other" ${cur === 'other' ? 'selected' : ''}>Другое…</option>
    </select></label>
    <div id="smOther" class="hidden">
      <div class="seg" id="smS">${SUBJ_ORDER.map(k => `<button data-s="${k}" class="${k === 'm' ? 'on' : ''}" style="--c:${SUBJECTS[k].color}">${SUBJECTS[k].name}</button>`).join('')}</div>
      <label class="field">Что именно<input id="smT" placeholder="например: разбор №8 на YouTube"></label>
    </div>
    <label class="field">Сколько времени потратил, минут<input type="number" id="smM" inputmode="numeric" min="1" max="720"></label>
    <div class="chips">${[30, 60, 90, 120, 180, 240].map(m => `<button class="chip" data-m="${m}">${fmtMin(m)}</button>`).join('')}</div>
    <div id="smL">
      <label class="check"><input type="checkbox" id="smD" checked> Урок досмотрен</label>
      <div class="checkbox-row"><button type="button" class="btn ghost" id="smCopy">Скопировать запрос на проверку ДЗ</button><span class="muted small">при сохранении скопируется сам</span></div>
      ${CHECK_LINE('smLine')}
      <div class="row2">
        <label class="field">Заданий в ДЗ<input type="number" id="smN" inputmode="numeric" min="0" max="200" placeholder="10"></label>
        <label class="field">Решено верно<input type="number" id="smOk" inputmode="numeric" min="0" max="200" placeholder="8"></label>
      </div>
      <label class="field">Номера с ошибками<input id="smE" placeholder="например 3, 7"></label>
    </div>
    <div id="smP" class="hidden"><div class="checkbox-row"><button type="button" class="btn ghost" id="smCopyP">Скопировать запрос на проверку пробника</button></div>
      <div class="muted small">Балл и номера с ошибками после проверки впиши во вкладке «Практика» → «Пробники» — оттуда график в «Итогах».</div></div>
    <label class="field">Заметка<textarea id="smNote" rows="2" placeholder="что не понял, к чему вернуться"></textarea></label>
    <button class="btn wide" id="smGo">Записать итог</button>`, b => {
    let s = 'm';
    const sel = b.querySelector('#smW');
    const item = () => opts.find(x => keyOf(x) === sel.value);
    const sync = () => {
      const x = item();
      b.querySelector('#smOther').classList.toggle('hidden', !!x);
      b.querySelector('#smL').classList.toggle('hidden', !(x && x.l));
      b.querySelector('#smP').classList.toggle('hidden', !(x && !x.l && /пробник/i.test(x.t)));
      b.querySelector('#smM').value = minDefault(x);
      if (x && x.l) {
        const r = st(x.l.id);
        b.querySelector('#smN').value = r.hwN || ''; b.querySelector('#smOk').value = r.hwN ? r.hwOk : ''; b.querySelector('#smE').value = r.hwErr || '';
      }
    };
    sel.onchange = sync; sync();
    bindCheckLine(b, { line: '#smLine', n: '#smN', ok: '#smOk', err: '#smE' });
    b.querySelector('#smCopy').onclick = () => { const x = item(); if (x) copyPrompt(x); };
    b.querySelector('#smCopyP').onclick = () => { const x = item(); if (x) copyPrompt(x); };
    b.querySelectorAll('[data-s]').forEach(x => x.onclick = () => { s = x.dataset.s; b.querySelectorAll('[data-s]').forEach(y => y.classList.toggle('on', y === x)); });
    b.querySelectorAll('[data-m]').forEach(x => x.onclick = () => { b.querySelector('#smM').value = x.dataset.m; });
    b.querySelector('#smGo').onclick = () => {
      const min = parseInt(b.querySelector('#smM').value), x = item();
      if (!(min > 0 && min <= 720)) { toast('Укажи минуты от 1 до 720'); return; }
      const what = x ? (x.l ? x.l.title : x.t) : b.querySelector('#smT').value.trim();
      const note = b.querySelector('#smNote').value.trim();
      const rec = { id: uid(), date: todayStr(), subj: x ? (x.l ? x.l.subj : x.subj) : s, min, what: what + (note ? ' — ' + note : '') };
      if (x && x.l) rec.lesson = x.l.id;
      if (x && !x.l) rec.plan = x.t;
      if (x && x.ahead) rec.planDay = x.ahead; // пункт завтрашнего плана, сделанный заранее
      S.sessions.push(rec);
      if (x && x.l) {
        if (b.querySelector('#smD').checked && !isWatched(x.l)) setWatched(x.l.id, true);
        const r = S.les[x.l.id] || (S.les[x.l.id] = {});
        const n = parseInt(b.querySelector('#smN').value), ok = parseInt(b.querySelector('#smOk').value);
        if (n > 0 && ok >= 0) { r.hwN = n; r.hwOk = Math.min(ok, n); r.hwP = Math.round(r.hwOk / n * 100); r.hw = 'done'; }
        const e = b.querySelector('#smE').value.trim();
        if (e) r.hwErr = e;
        if (note) r.note = r.note ? r.note + '\n' + note : note;
      }
      save(); closeSheet(); render();
      const needCheck = x && (x.l ? !st(x.l.id).hwN : /пробник/i.test(x.t));
      if (needCheck) copyText(checkPrompt(x)).then(ok => toast('Итог записан: ' + fmtMin(min) + (ok ? ' · запрос на проверку скопирован' : '')));
      else toast('Итог записан: ' + fmtMin(min));
    };
  });
}
// Пункт плана текстом (пробник, инфа) сделан, если по нему записан итог в этот день
const planTextDone = (x, date) => S.sessions.some(s => s.plan === x.t && s.subj === x.subj && (s.date === date || s.planDay === date));

// ---------- шапка и боковая панель: данные справа от названия и под меню ----------
function renderTop() {
  const td = todayStr(), t = todayMin();
  const ph = sum(planDay(td).filter(x => !x.opt).map(planHours)), g = ph ? ph * 60 : S.settings.goal;
  const left = daysBetween(td, S.settings.exam), essay = daysBetween(td, S.settings.essay);
  $('#topDetail').innerHTML = `
    <div class="td-row"><span class="muted">сегодня</span> <b class="mono">${fmtMin(t)}</b> <span class="muted">из ${fmtMin(g)}${ph ? ' плана' : ''}</span></div>
    <div class="td-bar"><i style="width:${Math.min(100, pct(t, g))}%"></i></div>`;
  // серия: последние 14 дней
  const days = [...Array(14)].map((_, i) => addDays(td, i - 13));
  const lv = levelOf(progressFacts());
  $('#sideInfo').innerHTML = `
    <a class="rank" href="#home" data-tipr="${'Опыт: ' + lv.xp + ' XP\nчас занятий — 10 · урок — 25 · верное задание ДЗ — 2\nпробник — 60 · закрытый день плана — 40'}">
      <div class="rank-ring" style="--p:${Math.round(lv.p * 100)}"><b class="mono">${lv.lv}</b></div>
      <div class="rank-t"><span>Уровень ${lv.lv}</span><b>${lv.name}</b>
        <div class="rank-bar"><i style="width:${Math.round(lv.p * 100)}%"></i></div>
        <small class="mono">${lv.xp}${lv.next ? ' / ' + lv.next : ''} XP</small></div>
    </a>
    <div class="cd${essay <= 45 ? ' hot' : ''}"><span>Итоговое сочинение</span><b class="mono">${essay}</b><small>${plural(essay, 'день', 'дня', 'дней')} · ${fmtShort(S.settings.essay)} · допуск к ЕГЭ</small></div>
    <div class="cd"><span>ЕГЭ · первый экзамен</span><b class="mono">${left}</b><small>${plural(left, 'день', 'дня', 'дней')} · ~${fmtShort(S.settings.exam)}</small></div>
    <div class="side-streak"><span>Серия · <b class="txt">${streak()} ${plural(streak(), 'день', 'дня', 'дней')}</b></span>
      <div class="ss">${days.map(d => { const m = minutesOn(d) + (d === td ? timerMin() : 0); return `<i class="${m >= 240 ? 'l3' : m >= 60 ? 'l2' : m >= 20 ? 'l1' : ''}${d === td ? ' now' : ''}" data-tipr="${fmtDate(d)} · ${m ? fmtMin(m) : 'не занимался'}"></i>`; }).join('')}</div>
      <small class="muted">14 дней · ярче — больше часов</small></div>`;
}

// ---------- эффекты ----------
// Числа «набегают» от нуля при открытии вкладки (только .cnt с числом внутри)
function countUp(root) {
  root.querySelectorAll('.cnt').forEach(el => {
    const txt = el.textContent.trim(), to = parseFloat(txt.replace(',', '.'));
    if (!isFinite(to) || to === 0) return;
    const dec = (txt.split(/[.,]/)[1] || '').length, t0 = performance.now(), dur = 700 + Math.min(500, Math.abs(to) * 8);
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (to * e).toFixed(dec).replace('.', ',');
      if (k < 1) requestAnimationFrame(step); else el.textContent = txt;
    };
    requestAnimationFrame(step);
  });
}
// Салют: короткий взрыв частиц на холсте поверх страницы
function confetti(x, y, n = 140) {
  const cv = $('#fx'), cx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cx.scale(dpr, dpr);
  const cols = Object.values(SUBJECTS).map(s => s.color).concat(['#f2c94c', '#ffffff', '#8b9dff']);
  const P = [...Array(n)].map(() => { const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, r: 3 + Math.random() * 4, c: cols[Math.random() * cols.length | 0], rot: Math.random() * 6, vr: Math.random() * .4 - .2 }; });
  const t0 = performance.now();
  const frame = now => {
    const k = (now - t0) / 1600;
    cx.clearRect(0, 0, innerWidth, innerHeight);
    if (k >= 1) return;
    for (const p of P) {
      p.vy += .32; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      cx.save(); cx.globalAlpha = 1 - k; cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.c; cx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); cx.restore();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
let ENTER = true; // анимация появления — только при смене вкладки, не на каждое нажатие

// ---------- уровень и достижения: всё считается из настоящих записей ----------
const LEVELS = [0, 150, 400, 750, 1200, 1800, 2500, 3400, 4500, 6000];
const LEVEL_NAMES = ['Старт', 'Разгон', 'В ритме', 'Упорный', 'Практик', 'Сильный', 'Мастер', 'Профи', 'Элита', 'Легенда'];
const HOLIDAY_FROM = '2026-10-24', FINAL_FROM = '2026-11-07';
function progressFacts() {
  const td = todayStr(), mins = sum(S.sessions.map(s => s.min));
  const les = Object.values(S.les);
  const watched = les.filter(x => x.w && x.hw !== 'old').length;
  const checked = les.filter(x => x.hwN), correct = sum(checked.map(x => x.hwOk));
  const tests = S.tests.filter(x => x.date >= HOLIDAY_FROM);
  // лучшая серия: подряд дни от 20 минут
  const days = [...new Set(S.sessions.map(s => s.date))].filter(d => minutesOn(d) >= 20).sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  // закрытые дни плана
  const pd = new Set(['m', 'r', 'i'].flatMap(k => Object.keys((typeof PLAN !== 'undefined' && PLAN[k]) || {})));
  const closed = [...pd].map(k => ddmm(k)).filter(d => d <= td).filter(d => {
    const it = planDay(d).filter(x => !x.opt);
    return it.length && it.every(x => x.l ? isWatched(x.l) : planTextDone(x, d));
  }).length;
  const debtOf = subj => lessonsOf(subj).filter(isDebt).length, outOf = subj => lessonsOf(subj).filter(l => l.date <= td).length;
  return { mins, watched, checked: checked.length, correct, perfect: checked.some(x => x.hwOk === x.hwN), tests, best, closed,
    mDebt: debtOf('m'), rDebt: debtOf('r'), mOut: outOf('m'), rOut: outOf('r') };
}
function levelOf(f) {
  const xp = Math.round(f.mins / 6) + f.watched * 25 + f.correct * 2 + f.tests.length * 60 + f.closed * 40;
  let lv = 0; while (lv < LEVELS.length - 1 && xp >= LEVELS[lv + 1]) lv++;
  const next = LEVELS[lv + 1];
  return { xp, lv: lv + 1, name: LEVEL_NAMES[lv], from: LEVELS[lv], next, p: next ? (xp - LEVELS[lv]) / (next - LEVELS[lv]) : 1 };
}
function achList(f) {
  const subjTests = from => new Set(S.tests.filter(x => x.date >= from).map(x => x.subj)).size;
  const h = f.mins / 60;
  return [
    { id: 'first', ic: 'step', t: 'Первый шаг', d: 'записать первый итог занятия', cur: S.sessions.length, goal: 1 },
    { id: 'probe', ic: 'target', t: 'Точка отсчёта', d: 'стартовые пробники по трём предметам', cur: subjTests(HOLIDAY_FROM), goal: 3 },
    { id: 'day1', ic: 'check', t: 'День закрыт', d: 'выполнить план дня целиком', cur: f.closed, goal: 1 },
    { id: 's3', ic: 'flame', t: 'Искра', d: 'серия 3 дня подряд', cur: f.best, goal: 3 },
    { id: 's7', ic: 'flame', t: 'Пламя', d: 'серия 7 дней подряд', cur: f.best, goal: 7 },
    { id: 'h10', ic: 'clock', t: '10 часов', d: 'всего занятий', cur: Math.floor(h), goal: 10 },
    { id: 'hw10', ic: 'book', t: 'Проверено', d: '10 ДЗ с результатом', cur: f.checked, goal: 10 },
    { id: 'ace', ic: 'star', t: 'Чисто', d: 'ДЗ без единой ошибки', cur: f.perfect ? 1 : 0, goal: 1 },
    { id: 'week', ic: 'cal', t: 'Неделя без хвостов', d: '7 закрытых дней плана', cur: f.closed, goal: 7 },
    { id: 'mat', ic: 'flag', t: 'Математика догнана', d: 'ноль долгов по курсу', cur: f.mOut - f.mDebt, goal: f.mOut },
    { id: 'rus', ic: 'flag', t: 'Русский догнан', d: 'ноль долгов по курсу', cur: f.rOut - f.rDebt, goal: f.rOut },
    { id: 'h50', ic: 'clock', t: '50 часов', d: 'всего занятий', cur: Math.floor(h), goal: 50 },
    { id: 's14', ic: 'flame', t: 'Пожар', d: 'серия 14 дней подряд', cur: f.best, goal: 14 },
    { id: 'final', ic: 'trophy', t: 'Финиш каникул', d: 'итоговые пробники по трём предметам', cur: subjTests(FINAL_FROM), goal: 3 },
    { id: 'h100', ic: 'crown', t: '100 часов', d: 'всего занятий', cur: Math.floor(h), goal: 100 },
  ].map(a => Object.assign(a, { done: a.goal > 0 && a.cur >= a.goal }));
}
const ACH_IC = {
  step: '<path d="M7 17l4-4 3 3 5-6M14 10h5v5"/>', target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', flame: '<path d="M12 21c-4 0-7-2.8-7-6.6 0-3.1 2-5 3.4-6.6.3 1.6 1.2 2.7 2.3 3.2C10.6 7.5 12.4 4.6 15 3c-.4 2.6.5 4.4 1.9 6.1 1.3 1.5 2.1 3.1 2.1 5.3C19 18.2 16 21 12 21z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>', cal: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 21h7M10 17h4v4h-4z"/>',
  crown: '<path d="M4 18h16M5 18L3.5 8l5 4L12 5l3.5 7 5-4L19 18"/>',
};
const achIcon = k => `<svg viewBox="0 0 24 24">${ACH_IC[k] || ACH_IC.star}</svg>`;
// Новые достижения — тост и салют (при самом первом запуске — молча отметить уже заслуженные)
function checkAch() {
  const quiet = !S.achInit;
  if (quiet) { S.achInit = 1; save(); }
  const list = achList(progressFacts()).filter(a => a.done && !S.ach[a.id]);
  if (!list.length) return;
  list.forEach(a => { S.ach[a.id] = todayStr(); });
  save();
  if (quiet) return;
  list.forEach((a, i) => setTimeout(() => { toast('Достижение открыто: ' + a.t); confetti(innerWidth / 2, innerHeight * .25, 110); }, 400 + i * 1600));
}

// ---------- роутинг ----------
const VIEWS = {};
function render() {
  const tab = (location.hash || '#home').slice(1).split('/')[0];
  const v = VIEWS[tab] || VIEWS.home;
  $$('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === (VIEWS[tab] ? tab : 'home')));
  const r = v();
  $('#title').textContent = r.title;
  $('#crumb').textContent = r.crumb || 'Моя школа · ЕГЭ 2027';
  $('#hsub').innerHTML = r.sub || '';
  const view = $('#view');
  view.innerHTML = r.html;
  view.classList.toggle('dash-view', tab === 'home' || !VIEWS[tab]);
  if (ENTER) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); countUp(view); ENTER = false; }
  r.mount && r.mount(view);
  renderTop();
  checkAch();
}
window.addEventListener('hashchange', () => { closeSheet(); ENTER = true; render(); scrollTo(0, 0); });
window.addEventListener('load', () => { tickTimer(); render(); });
// После полуночи — пересчитать «сегодня»
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });

// Общие кусочки разметки
const dot = subj => `<i class="sdot" style="background:${SUBJECTS[subj].color}"></i>`;
function bar(p, color) { return `<div class="pbar"><i style="width:${Math.max(0, Math.min(100, p))}%;${color ? 'background:' + color : ''}"></i></div>`; }
