"""Copy the desktop app's databases into a sandbox directory.

The copy goes through SQLite's backup API on purpose: events.db keeps most of
its recent events in the -wal file, so copying the .db alone would produce a
stale event store.
"""

from __future__ import annotations

import pathlib
import sqlite3
import sys

DATABASE_NAMES = ("app.db", "events.db")


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: make_sandbox.py <source_dir> <target_dir>", file=sys.stderr)
        return 2

    source_dir = pathlib.Path(argv[0])
    target_dir = pathlib.Path(argv[1])
    target_dir.mkdir(parents=True, exist_ok=True)

    for name in DATABASE_NAMES:
        source_path = source_dir / name
        if not source_path.exists():
            print(f"missing {source_path}", file=sys.stderr)
            return 1

        target_path = target_dir / name
        if target_path.exists():
            target_path.unlink()

        source = sqlite3.connect(f"file:{source_path.as_posix()}?mode=ro", uri=True)
        target = sqlite3.connect(target_path.as_posix())
        try:
            source.backup(target)
            target.commit()
        finally:
            target.close()
            source.close()
        print(f"{name}: {target_path.stat().st_size} bytes")

    events = sqlite3.connect((target_dir / "events.db").as_posix())
    try:
        count = events.execute("select count(*) from events").fetchone()[0]
    finally:
        events.close()
    print(f"events: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
