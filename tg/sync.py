"""Синхронизация с Телеграмом: собирает из каналов курсов видео, файлы, ДЗ и посты со ссылками → ../tg-data.js.

Только читает: ничего не отправляет и не скачивает сами видео — берёт подпись, дату и ссылку на пост.

  python tg/sync.py --chats   список твоих чатов и каналов (чтобы вписать нужные в config.json)
  python tg/sync.py           обновить ссылки
  python tg/sync.py --auto    то же без вопросов — для задачи Windows (tg-auto-on.bat), пишет в tg/sync.log
"""
import argparse
import asyncio
import json
import re
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
AUTO = "--auto" in sys.argv
if AUTO or sys.stdout is None:  # pythonw из планировщика: окна нет, весь вывод — в лог
    log = HERE / "sync.log"
    if log.exists() and log.stat().st_size > 200_000:  # лог не растёт бесконечно: оставить свежий хвост
        log.write_text(log.read_text(encoding="utf-8", errors="replace")[-50_000:], encoding="utf-8")
    sys.stdout = sys.stderr = open(log, "a", encoding="utf-8", buffering=1)
    print(f"--- {datetime.now():%Y-%m-%d %H:%M}")
else:
    sys.stdout.reconfigure(encoding="utf-8")

try:
    from telethon import TelegramClient
    from telethon.tl.types import Channel, MessageMediaDocument, MessageEntityUrl, MessageEntityTextUrl
except ImportError:
    sys.exit("Нет библиотеки telethon. Запусти tg-setup.bat (или: pip install telethon)")

CONFIG = HERE / "config.json"
SESSION = HERE / "ege"  # ege.session — это доступ к аккаунту, в git не попадает
OUT = HERE.parent / "tg-data.js"


def load_config():
    if not CONFIG.exists():
        sys.exit(f"Нет {CONFIG.name}. Скопируй config.example.json в config.json и впиши api_id, api_hash и каналы.")
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    if not cfg.get("api_id") or not cfg.get("api_hash") or "ВПИШИ" in str(cfg.get("api_hash")):
        sys.exit("В config.json не заполнены api_id и api_hash (их выдают на https://my.telegram.org → API development tools).")
    return cfg


def load_old():
    """Посты из прошлых запусков: tg-data.js = 'window.TG = {...};'"""
    if not OUT.exists():
        return {}
    try:
        raw = OUT.read_text(encoding="utf-8")
        data = json.loads(raw[raw.index("{"): raw.rindex("}") + 1])
        return {p["key"]: p for p in data.get("posts", [])}
    except (ValueError, KeyError):
        return {}


def post_link(entity, msg_id):
    if getattr(entity, "username", None):
        return f"https://t.me/{entity.username}/{msg_id}"
    return f"https://t.me/c/{entity.id}/{msg_id}"  # закрытый канал — откроется у участника


def media_info(msg):
    """('video', длительность в сек, имя файла) / ('file', None, имя) / None"""
    if not isinstance(msg.media, MessageMediaDocument) or not msg.document:
        return None
    name = None
    duration = None
    for a in msg.document.attributes:
        if hasattr(a, "file_name"):
            name = a.file_name
        if hasattr(a, "duration") and hasattr(a, "w"):  # DocumentAttributeVideo
            duration = int(a.duration)
    if msg.video or duration is not None:
        return "video", duration, name
    return "file", None, name


# «ДЗ», «д/з», «домашка», «домашнее задание», «домашняя работа»
HW_RE = re.compile(r"(?<![а-яё])(д\s*/?\s*з|домашк\w*|домашн\w+\s+(задани|работ)\w*)(?![а-яё])", re.I)


def urls_of(msg):
    """Ссылки из текста поста: и голые адреса, и спрятанные под словом."""
    out = []
    text = msg.message or ""
    for ent, inner in (msg.get_entities_text() if msg.entities else []):
        if isinstance(ent, MessageEntityTextUrl):
            out.append({"url": ent.url, "t": inner.strip()[:80]})
        elif isinstance(ent, MessageEntityUrl):
            url = inner if inner.startswith("http") else "https://" + inner
            out.append({"url": url, "t": ""})
    seen, res = set(), []
    for u in out:
        if u["url"] not in seen:
            seen.add(u["url"])
            res.append(u)
    return res[:8]


async def list_chats(client):
    print("Каналы и группы (впиши в config.json значение из колонки chat):\n")
    async for d in client.iter_dialogs():
        if isinstance(d.entity, Channel):
            chat = "@" + d.entity.username if d.entity.username else str(d.id)
            print(f"  {chat:<24} {d.name}")


async def find_chat(client, chat):
    """@имя, числовой id или просто название канала, как в списке чатов («ЕГЭ мат проф»)."""
    chat = str(chat).strip()
    if chat.lstrip("-").isdigit():
        return await client.get_entity(int(chat))
    if chat.startswith("@") or "t.me/" in chat:
        return await client.get_entity(chat)
    want = chat.lower()
    found = [d async for d in client.iter_dialogs() if isinstance(d.entity, Channel) and want in (d.name or "").lower()]
    exact = [d for d in found if d.name.lower() == want]
    if exact or len(found) == 1:
        return (exact or found)[0].entity
    raise ValueError("нет канала с таким названием" if not found else "подходит несколько: " + ", ".join(d.name for d in found[:5]))


async def sync(client, cfg):
    old = load_old()
    posts = dict(old)
    limit = int(cfg.get("limit", 1000))
    for ch in cfg["channels"]:
        subj = ch["subj"]
        chat = ch["chat"]
        try:
            entity = await find_chat(client, chat)
        except Exception as e:  # неверное имя или нет доступа — остальные каналы всё равно обновим
            print(f"  ✗ {chat}: не нашёл канал ({e})")
            continue
        last = max([p["msg"] for p in old.values() if p["chat"] == str(chat)] or [0])
        new = 0
        async for msg in client.iter_messages(entity, limit=limit, min_id=last):
            text = (msg.message or "").strip()
            info = media_info(msg)
            links = urls_of(msg)
            hw = bool(HW_RE.search(text) or (info and info[2] and HW_RE.search(info[2].replace("_", " "))))
            if not info:
                if not links and not hw:  # просто болтовня в канале — не нужна
                    continue
                info = ("link" if links else "note", None, None)
            kind, duration, fname = info
            key = f"{chat}:{msg.id}"
            posts[key] = {
                "key": key, "chat": str(chat), "msg": msg.id, "subj": subj,
                "date": msg.date.astimezone().strftime("%Y-%m-%d"),
                "time": msg.date.astimezone().strftime("%H:%M"),
                "kind": kind, "dur": duration, "file": fname,
                "text": text[:400], "link": post_link(entity, msg.id),
                "group": msg.grouped_id and str(msg.grouped_id),
                "hw": hw, "urls": links,
            }
            new += 1
        print(f"  ✓ {getattr(entity, 'title', chat)}: новых постов (видео, файлы, ДЗ, ссылки) — {new}")
    data = {
        "synced": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "posts": sorted(posts.values(), key=lambda p: (p["date"], p["time"], p["msg"])),
    }
    OUT.write_text("window.TG = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    print(f"\nГотово: всего постов {len(data['posts'])} → {OUT.name}. Обнови страницу приложения.")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chats", action="store_true", help="показать список каналов")
    ap.add_argument("--auto", action="store_true", help="тихий запуск из планировщика")
    args = ap.parse_args()
    cfg = load_config()
    if AUTO:  # без человека: если входа ещё не было — не висеть в ожидании кода, а честно выйти
        client = TelegramClient(str(SESSION), int(cfg["api_id"]), cfg["api_hash"])
        await client.connect()
        try:
            if not await client.is_user_authorized():
                sys.exit("Вход в Телеграм не выполнен — один раз запусти tg-sync.bat и введи код.")
            await sync(client, cfg)
        finally:
            await client.disconnect()
        return
    # Первый запуск спросит телефон и код из Телеграма — прямо здесь, в консоли.
    async with TelegramClient(str(SESSION), int(cfg["api_id"]), cfg["api_hash"]) as client:
        if args.chats:
            await list_chats(client)
        else:
            await sync(client, cfg)


if __name__ == "__main__":
    asyncio.run(main())
