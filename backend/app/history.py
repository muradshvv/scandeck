import json
import threading
from datetime import datetime, timezone

MAX_ENTRIES = 300

_lock = threading.Lock()


def _index_path(history_dir):
    return history_dir / "index.json"


def _load(history_dir):
    path = _index_path(history_dir)
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []

def _save(history_dir, entries):
    path = _index_path(history_dir)
    temp_path = path.with_suffix(".tmp")
    temp_path.write_text(json.dumps(entries, indent=2), encoding="utf-8")
    temp_path.replace(path)


def add_entry(history_dir, entry):
    with _lock:
        entries = _load(history_dir)
        entries = [e for e in entries if e["id"] != entry["id"]]
        entries.insert(0, entry)

        overflow = entries[MAX_ENTRIES:]
        entries = entries[:MAX_ENTRIES]
        for old in overflow:
            (history_dir / old["filename"]).unlink(missing_ok=True)

        _save(history_dir, entries)


def list_entries(history_dir):
    with _lock:
        return _load(history_dir)


def delete_entry(history_dir, entry_id):
    with _lock:
        entries = _load(history_dir)
        remaining = [e for e in entries if e["id"] != entry_id]
        removed = [e for e in entries if e["id"] == entry_id]
        for e in removed:
            (history_dir / e["filename"]).unlink(missing_ok=True)
        _save(history_dir, remaining)
        return len(removed) > 0

def clear_all(history_dir):
    with _lock:
        entries = _load(history_dir)
        for e in entries:
            (history_dir / e["filename"]).unlink(missing_ok=True)
        _save(history_dir, [])



def now_iso():
    return datetime.now(timezone.utc).isoformat()
