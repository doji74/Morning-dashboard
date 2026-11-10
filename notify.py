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
import re
import sys
from urllib.parse import urlparse
from pathlib import Path

import requests


TOPIC_RE = re.compile(r"^[-_A-Za-z0-9]{1,64}$")


def resolve_target(topic_raw: str, server_raw: str) -> tuple[str, str]:
    """Ermittelt Server und Topic – auch wenn im Secret versehentlich die ganze
    Adresse steht (z. B. "https://ntfy.sh/mein-topic" oder "ntfy.sh/mein-topic")."""
    topic = topic_raw.strip().strip('"').strip("'").strip()
    server = server_raw.strip().rstrip("/") or "https://ntfy.sh"
    if "/" in topic:
        url = topic if "://" in topic else "https://" + topic.lstrip("/")
        parsed = urlparse(url)
        parts = [p for p in parsed.path.split("/") if p]
        if parsed.netloc and parts:
            if not server_raw.strip():
                server = f"{parsed.scheme}://{parsed.netloc}"
            topic = parts[-1]
    return server, topic


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
        "Priority": "low",          # sichtbar in der Benachrichtigungsleiste, ohne Ton
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
    server, topic = resolve_target(topic, os.environ.get("NTFY_SERVER", ""))
    if not TOPIC_RE.match(topic):
        print("NTFY_TOPIC ist ungültig: Erlaubt sind nur Buchstaben (ohne Umlaute), Zahlen, "
              "'-' und '_' (max. 64 Zeichen), keine Leerzeichen. Beispiel: "
              "morgen-dortmund-7f3k9q2x. Bitte das Secret korrigieren.", file=sys.stderr)
        return 1
    resp = requests.post(f"{server}/{topic}", data=body.encode("utf-8"),
                         headers=headers, timeout=20)
    if resp.ok:
        print(f"Push-Nachricht an {server} verschickt.")
        return 0
    print(f"ntfy-Fehler {resp.status_code}: {resp.text[:200]}", file=sys.stderr)
    if resp.status_code == 404:
        print("Hinweis: 404 heißt meist, dass das Topic oder NTFY_SERVER nicht stimmt. "
              "Im Secret NTFY_TOPIC nur den Topic-Namen eintragen, z. B. "
              "morgen-dortmund-7f3k9q2x. NTFY_SERVER leer lassen oder nur "
              "https://ntfy.sh eintragen.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
