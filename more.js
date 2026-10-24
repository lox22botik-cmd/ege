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
    <div class="card-title">📡 Видео, ДЗ и файлы из Телеграма</div>
    ${TG ? `<div class="muted small">Подключено · обновлено ${esc(TG.synced)} · постов: ${TG.posts.length} (ДЗ: ${TG.posts.filter(p => p.hw).length}). Новое подтягивается само каждые 30 минут, если один раз запущен <b class="txt">tg-auto-on.bat</b>; страница обновится сама. Вручную — <b class="txt">tg-sync.bat</b>.</div>`
      : `<div class="muted small">Скрипт берёт из каналов курса ссылки на видео, файлы с уроков, ДЗ и посты со ссылками — сами видео и файлы остаются в Телеграме. Ключи и вход хранятся только на этом компьютере.</div>
    <ol class="steps">
      <li>Запусти <code>tg-setup.bat</code> в папке приложения (один раз).</li>
      <li>На <a href="https://my.telegram.org" target="_blank" rel="noopener">my.telegram.org</a> → API development tools получи <b>api_id</b> и <b>api_hash</b>, впиши в <code>tg\\config.json</code>.</li>
      <li>Запусти <code>tg-chats.bat</code> — войди (телефон и код из Телеграма) и посмотри список каналов.</li>
      <li>Впиши каналы курсов в <code>config.json</code> — можно просто названием, например <code>"ЕГЭ мат проф"</code> (<code>"m"</code> — математика, <code>"r"</code> — русский).</li>
      <li>Запусти <code>tg-sync.bat</code> — появятся первые посты.</li>
      <li>Запусти <code>tg-auto-on.bat</code> — дальше всё будет приходить само каждые 30 минут.</li>
    </ol>`}
    <div class="muted small">Не выходит получить api_id? В Телеграме для ПК: канал → ⋮ → «Экспорт истории» → формат JSON, галочку «Видео» снять, «Файлы» оставить — тогда ДЗ и конспекты откроются прямо отсюда. Потом запусти <code>tg-import.bat</code>. Повторяй, когда выходят новые уроки.</div>
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
