"""Без api_id: берёт посты из экспорта канала в Телеграме для ПК (⋮ → «Экспорт истории» → JSON) → ../tg-data.js.

То же, что sync.py: видео, файлы, ДЗ и посты со ссылками. Видео в экспорт не включать (гигабайты), а файлы можно:
тогда PDF с ДЗ и конспекты копируются в ../tg-files/ и открываются прямо с сайта, без Телеграма.

  python tg/from_export.py                  взять самые свежие экспорты из «Загрузки/Telegram Desktop»
  python tg/from_export.py путь/result.json  конкретный файл (можно несколько)
"""
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "tg-data.js"
FILES = HERE.parent / "tg-files"  # копии файлов из экспорта (в git не попадают)
EXPORTS = Path.home() / "Downloads" / "Telegram Desktop"
# тот же признак ДЗ, что в sync.py
HW_RE = re.compile(r"(?<![а-яё])(д\s*/?\s*з|домашк\w*|домашн\w+\s+(задани|работ)\w*)(?![а-яё])", re.I)


def subj_of(name):
    n = name.lower()
    if "мат" in n or "профил" in n:  # «ПРОФИЛЬ Сентябрь | SH» — профильная математика
        return "m"
    if "рус" in n:
        return "r"
    return None


def load_old():
    if not OUT.exists():
        return {}
    try:
        raw = OUT.read_text(encoding="utf-8")
        data = json.loads(raw[raw.index("{"): raw.rindex("}") + 1])
        return {p["key"]: p for p in data.get("posts", [])}
    except (ValueError, KeyError):
        return {}


def plain(text):
    """В экспорте text — строка или список кусков вида {"type": "bold", "text": "..."}"""
    if isinstance(text, str):
        return text
    return "".join(x if isinstance(x, str) else x.get("text", "") for x in text or [])


def urls_of(msg):
    out, seen = [], set()
    for e in msg.get("text_entities") or []:
        if e.get("type") == "text_link" and e.get("href"):
            u = {"url": e["href"], "t": e.get("text", "").strip()[:80]}
        elif e.get("type") == "link":
            t = e.get("text", "")
            u = {"url": t if t.startswith("http") else "https://" + t, "t": ""}
        else:
            continue
        if u["url"] not in seen:
            seen.add(u["url"])
            out.append(u)
    return out[:8]


def copy_file(export_dir, rel, cid, msg_id, fname):
    """Файл из экспорта → tg-files/<канал>/<номер поста>_<имя>; путь для сайта или None, если файла в экспорте нет"""
    if not rel or rel.startswith("("):  # «(File not included…)» — в экспорте сняли галочку «Файлы»
        return None
    src = export_dir / rel
    if not src.is_file():
        return None
    name = re.sub(r'[\\/:*?"<>|]', "_", fname or src.name)
    dst = FILES / str(cid) / f"{msg_id}_{name}"
    if not dst.exists() or dst.stat().st_size != src.stat().st_size:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    return dst.relative_to(HERE.parent).as_posix()


def read_export(path, posts):
    path = Path(path)
    data = json.loads(path.read_text(encoding="utf-8"))
    name, cid = data.get("name", "?"), data.get("id")
    subj = subj_of(name)
    if not subj:
        print(f"  ✗ {name}: не понял предмет по названию (нужно «мат» или «рус» в названии канала)")
        return
    chat = f"export:{cid}"
    new = copied = 0
    for m in data.get("messages", []):
        if m.get("type") != "message":
            continue
        text = plain(m.get("text")).strip()
        fname = m.get("file_name")
        is_video = m.get("media_type") == "video_file" or (m.get("mime_type") or "").startswith("video/")
        has_file = bool(m.get("file")) or bool(fname)
        links = urls_of(m)
        hw = bool(HW_RE.search(text) or (fname and HW_RE.search(fname.replace("_", " "))))
        if is_video:
            kind = "video"
        elif has_file:
            kind = "file"
        elif links:
            kind = "link"
        elif hw:
            kind = "note"
        else:
            continue
        dt = datetime.fromisoformat(m["date"])
        key = f"{chat}:{m['id']}"
        local = None if is_video else copy_file(path.parent, m.get("file"), cid, m["id"], fname)
        if not local and key in posts:  # в прошлый раз файл скопировали, а в этом экспорте его нет — копия остаётся
            local = posts[key].get("local")
        copied += bool(local)
        if key not in posts:
            new += 1
        posts[key] = {
            "key": key, "chat": chat, "msg": m["id"], "subj": subj,
            "date": dt.strftime("%Y-%m-%d"), "time": dt.strftime("%H:%M"),
            "kind": kind, "dur": m.get("duration_seconds") if is_video else None, "file": fname,
            "text": text[:400], "link": f"https://t.me/c/{cid}/{m['id']}",  # в экспорте нет @имени канала; ссылка откроется у участника
            "group": None, "hw": hw, "urls": links, "local": local,
        }
    print(f"  ✓ {name}: новых постов (видео, файлы, ДЗ, ссылки) — {new}; файлов на сайте — {copied}")


def newest_exports():
    """Самый свежий экспорт каждого канала из папки загрузок Телеграма"""
    if not EXPORTS.exists():
        return []
    best = {}
    for f in EXPORTS.glob("ChatExport_*/result.json"):
        try:
            name = json.loads(f.read_text(encoding="utf-8")).get("name", "")
        except ValueError:
            continue
        if name not in best or f.stat().st_mtime > best[name].stat().st_mtime:
            best[name] = f
    return list(best.values())


def main():
    files = [Path(a) for a in sys.argv[1:]] or newest_exports()
    if not files:
        sys.exit(f"Не нашёл экспорт. В Телеграме для ПК: канал → ⋮ → «Экспорт истории» → формат JSON (видео и файлы можно не включать).\nОн ляжет в {EXPORTS}")
    posts = load_old()
    for f in files:
        if f.is_dir():
            f = f / "result.json"
        print(f"Читаю {f}")
        read_export(f, posts)
    data = {
        "synced": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "posts": sorted(posts.values(), key=lambda p: (p["date"], p["time"], p["msg"])),
    }
    OUT.write_text("window.TG = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    print(f"\nГотово: всего постов {len(data['posts'])} (ДЗ: {sum(p['hw'] for p in data['posts'])}) → {OUT.name}. Страница обновится сама.")


if __name__ == "__main__":
    main()
