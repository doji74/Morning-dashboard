#!/usr/bin/env python3
"""Schickt die Morgen-Zusammenfassung lautlos per ntfy aufs Handy.

Umgebungsvariablen:
    NTFY_TOPIC   (Pflicht)  Name des ntfy-Topics – als GitHub-Secret hinterlegen
    NTFY_SERVER  (optional) Standard: https://ntfy.sh
    NTFY_TOKEN   (optional) Access-Token, falls das Topic geschützt ist
    PAGE_URL     (optional) Link zur Dashboard-Seite
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import requests


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="site/data.json")
    ap.add_argument("--dry-run", action="store_true", help="nur anzeigen, nicht senden")
    args = ap.parse_args()

    data = json.loads(Path(args.data).read_text(encoding="utf-8"))
    page_url = os.environ.get("PAGE_URL", "").strip()
    body = data.get("push_text") or "Dein Morgen-Dashboard ist aktualisiert."
    if page_url:
        body += f"\n\n{page_url}"

    headers = {
        "Title": "Guten Morgen - Dashboard ist fertig",
        "Priority": "min",          # lautlos: kein Ton, keine Vibration
        "Tags": "sunrise",
    }
    if page_url:
        headers["Click"] = page_url  # Tippen auf die Nachricht öffnet die Seite
    token = os.environ.get("NTFY_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    if args.dry_run:
        print(json.dumps(headers, indent=1, ensure_ascii=False))
        print(body)
        return 0

    topic = os.environ.get("NTFY_TOPIC", "").strip()
    if not topic:
        print("NTFY_TOPIC ist nicht gesetzt – keine Push-Nachricht verschickt.", file=sys.stderr)
        return 0
    server = os.environ.get("NTFY_SERVER", "").strip() or "https://ntfy.sh"
    resp = requests.post(f"{server.rstrip('/')}/{topic}", data=body.encode("utf-8"),
                         headers=headers, timeout=20)
    if resp.ok:
        print("Push-Nachricht verschickt.")
        return 0
    print(f"ntfy-Fehler {resp.status_code}: {resp.text[:200]}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
