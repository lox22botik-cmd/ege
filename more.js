'use strict';
// «Ещё»: цель, даты, резервная копия, сброс.

VIEWS.more = () => ({
  title: 'Ещё',
  html: `
  <section class="card">
    <div class="card-title">Цель и даты</div>
    <label class="field">Цель в день, минут<input type="number" id="mG" inputmode="numeric" min="15" max="600" step="15" value="${S.settings.goal}"></label>
    <label class="field">Первый экзамен ЕГЭ<input type="date" id="mE" value="${S.settings.exam}"></label>
    <div class="muted small">Расписание ЕГЭ-2027 на момент создания ещё не вышло — стоит 1 июня примерно. Поменяй, когда Рособрнадзор опубликует даты.</div>
    <label class="field">Итоговое сочинение<input type="date" id="mI" value="${S.settings.essay}"></label>
    <div class="muted small">Обычно первая среда декабря. Сверь со школой.</div>
    <button class="btn wide" id="mSave">Сохранить</button>
  </section>

  <section class="card">
    <div class="card-title">Резервная копия</div>
    <div class="muted small">Всё хранится только в этом браузере. Раз в неделю сохраняй файл — если почистишь браузер, ничего не пропадёт.</div>
    <div class="btn-row"><button class="btn ghost" id="mExp">⬇ Сохранить файл</button><button class="btn ghost" id="mImp">⬆ Загрузить</button></div>
    <input type="file" id="mFile" accept=".json,application/json" hidden>
  </section>

  <section class="card">
    <div class="card-title">Что внутри</div>
    <div class="muted small">Уроков в курсах: ${allLessons().length} · занятий записано: ${S.sessions.length} · решений: ${S.practice.length} · пробников: ${S.tests.length}</div>
    <button class="btn danger wide" id="mReset">Сбросить всё</button>
  </section>`,
  mount: root => {
    root.querySelector('#mSave').onclick = () => {
      const g = parseInt(root.querySelector('#mG').value);
      if (g >= 15 && g <= 600) S.settings.goal = g;
      S.settings.exam = root.querySelector('#mE').value || S.settings.exam;
      S.settings.essay = root.querySelector('#mI').value || S.settings.essay;
      save(); render(); toast('Сохранено');
    };
    root.querySelector('#mExp').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
      a.download = 'ege-' + todayStr() + '.json'; a.click();
    };
    const f = root.querySelector('#mFile');
    root.querySelector('#mImp').onclick = () => f.click();
    f.onchange = async () => {
      try {
        const s = JSON.parse(await f.files[0].text());
        if (!s || s.v !== 1 || !s.les) throw new Error('это не файл этого приложения');
        if (!confirm('Заменить текущие данные данными из файла?')) return;
        localStorage.setItem(KEY, JSON.stringify(s)); S = load(); resetLessons(); render(); toast('Загружено');
      } catch (e) { alert('Не получилось загрузить: ' + e.message); }
    };
    root.querySelector('#mReset').onclick = () => {
      if (!confirm('Стереть все отметки, время и пробники? Расписания курсов останутся.')) return;
      S = fresh(); save(); resetLessons(); tickTimer(); render();
    };
  },
});
