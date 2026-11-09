# ☀️ Morgen-Dashboard

Ein persönliches Morgen-Dashboard als **Progressive Web App** für Android:
Bahn Dortmund ⇄ Bochum, Wetter für Dortmund, Bochum und deinen Standort und
die wichtigsten Nachrichten. Alles auf einer dunklen, handyoptimierten Seite.

GitHub baut die Seite jeden Werktag um **04:15 Uhr** automatisch neu, veröffentlicht
sie kostenlos auf **GitHub Pages** und schickt dir danach eine **lautlose
Push-Nachricht** über **ntfy**.

```
┌──────────────────────────────┐
│ ⚠️ Bahn-Warnung (nur > 5 Min) │
├──────────────────────────────┤
│ 🚆 Bahn  morgens / nachmitt. │
├──────────────┬───────────────┤
│ Dortmund ☁️ 5° │ Bochum 🌦 6° │
├──────────────┴───────────────┤
│ 📍 Mein Standort             │
├──────────────────────────────┤
│ 📍 Dortmund lokal  (5 News)  │
│ 🏛️ NRW · 🇩🇪 Deutschland · 🌍 Welt │
│ 🟡 BVB · ⚽ Bundesliga        │
└──────────────────────────────┘
```

---

## Inhalt

1. [Was das Dashboard kann](#was-das-dashboard-kann)
2. [Projektdateien](#projektdateien)
3. [Schritt-für-Schritt-Anleitung](#schritt-für-schritt-anleitung)
   1. [GitHub-Konto und Repository anlegen](#1-github-konto-und-repository-anlegen)
   2. [Dateien hochladen](#2-dateien-hochladen)
   3. [GitHub Pages aktivieren](#3-github-pages-aktivieren)
   4. [ntfy-App installieren und Topic abonnieren](#4-ntfy-app-installieren-und-topic-abonnieren)
   5. [Secrets setzen](#5-secrets-setzen)
   6. [Erster Testlauf](#6-erster-testlauf)
   7. [ntfy-Kanal auf lautlos stellen](#7-ntfy-kanal-auf-lautlos-stellen)
   8. [Seite zum Android-Startbildschirm hinzufügen](#8-seite-zum-android-startbildschirm-hinzufügen)
4. [Anpassen (config.json)](#anpassen-configjson)
5. [Lokal ausprobieren](#lokal-ausprobieren)
6. [Wie die Zeitsteuerung funktioniert](#wie-die-zeitsteuerung-funktioniert)
7. [Fehlersuche](#fehlersuche)

---

## Was das Dashboard kann

**Bahn** (über `v6.db.transport.rest`, nur Mo–Fr)
- Morgens 05:30–06:30: Dortmund Hbf → Bochum Hbf
- Nachmittags 14:30–16:00: Bochum Hbf → Dortmund Hbf
- Abfahrt, Gleis (Gleiswechsel gelb), Verspätung, Ausfälle, Umstiege, Störungshinweise
- **Ganz oben eine rote Bahn-Warnung**, sobald ein Zug mehr als 5 Minuten Verspätung hat.
  Ausfälle lösen die Warnung ebenfalls aus.
- Um 04:15 Uhr gibt es meist noch keine Echtzeitdaten. Deshalb lädt die Seite die
  Bahndaten **beim Öffnen live nach**. Am Nachmittag siehst du also die echten
  Verspätungen der Rückfahrt. Ohne Netz bleiben die Daten vom Morgen sichtbar.

**Wetter** (Open-Meteo, kein API-Key nötig)
- Dortmund und Bochum nebeneinander: aktuell, Min/Max, gefühlte Temperatur, Wind,
  Sonnenauf- und -untergang
- Tagesverlauf (06, 09, 12, 15, 18, 21 Uhr) und ein Balkendiagramm der
  Regenwahrscheinlichkeit von 5 bis 23 Uhr
- **Mein Standort**: Einmal auf den Knopf tippen und den Standort freigeben.
  Danach wird das Wetter für deinen Standort bei jedem Öffnen automatisch geladen.

**Nachrichten** (RSS, in `config.json` änderbar)
- Dortmund lokal (Ruhr Nachrichten, WAZ Dortmund, Google News), NRW (tagesschau NRW, WDR),
  Deutschland und Welt (tagesschau), BVB (kicker, Google News), Bundesliga (sportschau, kicker)
- Je Rubrik die 5 neuesten Meldungen mit Titel, Quelle und Link
- **Optional**: Mit einem Anthropic-API-Key schreibt Claude je Rubrik eine Kurzfassung
  in 2–3 Sätzen.

**Push** (ntfy, lautlos)
- Wetter, nächste Bahn, 3 Top-Schlagzeilen und der Link zur Seite
- Wird mit `Priority: min` gesendet: Die Nachricht kommt an, macht aber keinen Ton.

---

## Projektdateien

| Datei | Zweck |
|---|---|
| `config.json` | **Deine Einstellungen**: Orte, Züge, Zeitfenster, Feeds, Claude, Push |
| `build_dashboard.py` | Holt alle Daten und erzeugt `site/data.json` und `site/index.html` |
| `notify.py` | Schickt die Push-Nachricht über ntfy |
| `static/index.template.html` | Vorlage für die Seite |
| `static/app.js` | Darstellung, Live-Aktualisierung (Bahn/Wetter), „Mein Standort“ |
| `static/style.css` | Design (Dark Mode, mobil) |
| `static/manifest.json` | Macht die Seite installierbar (Name, Icon, Farben) |
| `static/sw.js` | Service Worker: Installierbarkeit und Offline-Ansicht |
| `.github/workflows/dashboard.yml` | Zeitplan, Build, Veröffentlichung, Push |
| `requirements.txt` | Python-Pakete |

Die App-Icons erzeugt das Skript selbst. Der Ordner `site/` wird nur beim Build
erzeugt und nicht ins Repository eingecheckt.

---

## Schritt-für-Schritt-Anleitung

> Du brauchst: einen Computer mit Browser (für die Einrichtung), dein Android-Handy
> und etwa 20 Minuten. Programmierkenntnisse sind nicht nötig.

### 1. GitHub-Konto und Repository anlegen

1. Gehe auf **https://github.com** und klicke auf **Sign up**. Lege ein kostenloses
   Konto an (E-Mail, Passwort, Benutzername) und bestätige deine E-Mail-Adresse.
2. Klicke oben rechts auf das **+** und dann auf **New repository**.
3. Fülle aus:
   - **Repository name**: z. B. `morgen-dashboard`
   - **Public** auswählen. GitHub Pages ist im kostenlosen Tarif nur für öffentliche
     Repositories verfügbar. Deine Secrets (API-Keys, Topic) bleiben trotzdem geheim.
   - Haken bei **Add a README file** darf gesetzt sein, muss aber nicht.
4. Klicke auf **Create repository**.

### 2. Dateien hochladen

**Variante A: im Browser (am einfachsten)**

1. Lade dieses Projekt als ZIP herunter und entpacke es auf deinem Computer.
2. Öffne dein neues Repository auf GitHub und klicke auf **Add file → Upload files**.
3. Ziehe **alle Dateien und Ordner** aus dem entpackten Projekt in das Browserfenster
   (`config.json`, `build_dashboard.py`, `notify.py`, `requirements.txt`, `README.md`,
   den Ordner `static` …).
4. **Wichtig:** Der Ordner `.github` beginnt mit einem Punkt und ist auf vielen
   Computern unsichtbar. Er wird beim Hochladen per Drag-and-drop oft vergessen.
   Prüfe danach, ob im Repository die Datei `.github/workflows/dashboard.yml` existiert.
   Falls nicht:
   - Klicke auf **Add file → Create new file**.
   - Tippe als Dateinamen `.github/workflows/dashboard.yml` ein. Die Schrägstriche
     legen die Ordner automatisch an.
   - Kopiere den Inhalt der Datei `dashboard.yml` aus dem Projekt hinein.
5. Unten auf **Commit changes** klicken.

**Variante B: mit Git (für Fortgeschrittene)**

```bash
git clone https://github.com/DEIN-NAME/morgen-dashboard.git
# Projektdateien in den Ordner kopieren, dann:
cd morgen-dashboard
git add .
git commit -m "Morgen-Dashboard"
git push
```

### 3. GitHub Pages aktivieren

1. Öffne im Repository den Reiter **Settings** (Zahnrad, oben rechts in der Leiste).
2. Klicke links im Menü auf **Pages**.
3. Wähle unter **Build and deployment → Source** den Eintrag **GitHub Actions**.
   Nicht „Deploy from a branch“.
4. Fertig. Du musst hier nichts speichern, die Auswahl gilt sofort.

Deine Seite ist später erreichbar unter:
`https://DEIN-NAME.github.io/morgen-dashboard/`

### 4. ntfy-App installieren und Topic abonnieren

ntfy ist ein kostenloser Push-Dienst. Du brauchst kein Konto. Nachrichten werden an
ein **Topic** geschickt, also einen frei wählbaren Kanalnamen. Wer den Namen kennt,
kann mitlesen. Wähle deshalb einen **langen, schwer zu erratenden Namen**.

1. Denk dir ein Topic aus, z. B. `morgen-dortmund-7f3k9q2x` (nur Buchstaben, Zahlen,
   `-` und `_`). Schreib es dir auf, du brauchst es gleich nochmal.
2. Installiere auf dem Handy die App **ntfy** aus dem
   [Google Play Store](https://play.google.com/store/apps/details?id=io.heckel.ntfy)
   oder aus [F-Droid](https://f-droid.org/packages/io.heckel.ntfy/).
3. Öffne die App und tippe unten rechts auf das **+**.
4. Gib bei **Topic name** dein Topic ein. Der Server bleibt `ntfy.sh`.
   Tippe auf **Subscribe** (Abonnieren).
5. Wenn Android fragt, ob ntfy Benachrichtigungen senden darf: **Zulassen**.
6. Optional: Damit Nachrichten zuverlässig um 04:30 Uhr ankommen, in den
   Android-Einstellungen bei **Apps → ntfy → Akku** „Nicht eingeschränkt“ wählen.

### 5. Secrets setzen

Secrets sind geheime Werte, die nur der Workflow lesen kann. Sie erscheinen nirgends
öffentlich.

1. Im Repository: **Settings → Secrets and variables → Actions**.
2. Klicke auf **New repository secret**.
3. Lege diese Secrets an, je Secret einmal auf **New repository secret** klicken:

| Name | Pflicht? | Wert |
|---|---|---|
| `NTFY_TOPIC` | **ja** | dein Topic aus Schritt 4, z. B. `morgen-dortmund-7f3k9q2x` |
| `ANTHROPIC_API_KEY` | nein | API-Key für die KI-Kurzfassungen (siehe unten) |
| `NTFY_SERVER` | nein | nur bei eigenem ntfy-Server, z. B. `https://ntfy.example.de` |
| `NTFY_TOKEN` | nein | nur bei geschütztem Topic (Access-Token) |

Der Name muss **genau so** geschrieben werden, inklusive Großbuchstaben.

**KI-Kurzfassungen (optional):** Lege unter https://console.anthropic.com ein
Konto an, lade unter *Billing* etwas Guthaben auf und erstelle unter *API Keys*
einen Schlüssel. Den Schlüssel (beginnt mit `sk-ant-`) speicherst du als Secret
`ANTHROPIC_API_KEY`. Ohne diesen Key läuft alles genauso, nur ohne Kurzfassungen.
Voreingestellt ist das Modell `claude-opus-5-5` mit niedrigem Aufwand (`effort: low`).
Pro Tag fällt nur eine einzige Anfrage an. Wenn es noch günstiger sein soll, trag in
`config.json` als Modell `claude-haiku-5-5` ein.

### 6. Erster Testlauf

1. Im Repository den Reiter **Actions** öffnen. Falls GitHub fragt, ob Workflows
   aktiviert werden sollen: **I understand my workflows, go ahead and enable them**.
2. Links auf **Morgen-Dashboard** klicken.
3. Rechts auf **Run workflow → Run workflow** klicken.
4. Nach 1–2 Minuten erscheint ein grüner Haken ✅. Ein Klick auf den Lauf zeigt oben
   den Link zu deiner Seite.
5. Auf dem Handy sollte eine ntfy-Nachricht ankommen.

Ab jetzt läuft alles automatisch, jeden Montag bis Freitag um 04:15 Uhr.

### 7. ntfy-Kanal auf lautlos stellen

Die Nachrichten werden mit `Priority: min` (niedrigste Priorität) verschickt.
Die ntfy-App sortiert jede Priorität in einen eigenen Android-Benachrichtigungskanal.
Diesen Kanal stellst du einmal auf lautlos:

1. Warte, bis die erste Nachricht angekommen ist (Schritt 6).
2. Öffne die Android-**Einstellungen → Apps → ntfy → Benachrichtigungen**.
   Alternativ: In der Benachrichtigungsleiste lange auf eine ntfy-Nachricht drücken
   und auf das Zahnrad tippen.
3. Du siehst eine Liste von Kanälen, z. B. „Min priority“, „Low priority“,
   „Default priority“ … (auf Deutsch z. B. „Minimale Priorität“).
4. Tippe auf den Kanal für die **minimale Priorität** und wähle **Lautlos**.
   Schalte bei Bedarf auch Vibration und „Pop-up auf dem Bildschirm“ aus.
5. Optional, falls die Nachricht wieder in der Statusleiste auftauchen soll:
   „Benachrichtigungen minimieren“ ausschalten. Je nach Hersteller (Samsung,
   Pixel, Xiaomi …) heißen die Punkte etwas anders.

In der ntfy-App kannst du zusätzlich beim Topic (antippen → ⋮ → **Einstellungen**)
die Benachrichtigungen feiner einstellen.

### 8. Seite zum Android-Startbildschirm hinzufügen

1. Öffne auf dem Handy **Chrome** und rufe deine Seite auf:
   `https://DEIN-NAME.github.io/morgen-dashboard/`
2. Tippe oben rechts auf **⋮** (drei Punkte).
3. Wähle **App installieren** oder **Zum Startbildschirm hinzufügen**
   (je nach Chrome-Version).
4. Bestätige mit **Installieren** bzw. **Hinzufügen**.
5. Auf dem Startbildschirm erscheint das Icon mit der aufgehenden Sonne. Die
   App öffnet sich ohne Browserleiste, wie eine normale App.

Tipp: Wenn du in der ntfy-Nachricht auf den Text tippst, öffnet sich die Seite direkt.

---

## Anpassen (config.json)

Alle Einstellungen stehen in `config.json`. Du kannst die Datei direkt auf GitHub
bearbeiten (Datei öffnen → Stift-Symbol → **Commit changes**). Die Änderung gilt ab
dem nächsten Lauf.

**Nachrichten-Rubrik hinzufügen oder ändern:**

```json
{
  "id": "vfl",
  "title": "VfL Bochum",
  "icon": "🔵",
  "feeds": [
    { "name": "Google News", "url": "https://news.google.com/rss/search?q=VfL+Bochum+when:2d&hl=de&gl=DE&ceid=DE:de" }
  ],
  "keywords": ["vfl", "bochum"]
}
```

- `feeds`: beliebig viele RSS-Feeds. Die Meldungen werden gemischt, nach Zeit sortiert
  und doppelte Titel entfernt.
- `keywords` (optional): nur Meldungen, die eines der Wörter enthalten.
- Für fast jedes Thema funktioniert ein Google-News-Feed:
  `https://news.google.com/rss/search?q=SUCHBEGRIFF&hl=de&gl=DE&ceid=DE:de`
- `items_per_section` (Standard 5) und `max_age_hours` (Standard 48) gelten für alle Rubriken.

**Weitere Einstellungen:**

| Schlüssel | Bedeutung |
|---|---|
| `weather.locations` | Orte mit Name, Breitengrad (`lat`), Längengrad (`lon`) |
| `weather.hours` | Stunden im Tagesverlauf |
| `train.connections` | Strecken: Bahnhofs-IDs (`from.id`, `to.id`) und Zeitfenster |
| `train.warn_delay_minutes` | ab wie vielen Minuten die Warnung erscheint (Standard 5) |
| `claude.enabled` | `false` schaltet die KI-Kurzfassungen ab |
| `claude.model` / `claude.effort` | Modell und Aufwand für die Kurzfassungen |
| `notify.headline_sections` | aus welchen Rubriken die 3 Push-Schlagzeilen kommen |

**Bahnhofs-ID herausfinden:** Rufe im Browser auf
`https://v6.db.transport.rest/locations?query=Essen%20Hbf&results=1`.
Die Zahl bei `"id"` (z. B. `8000098`) ist die ID.

---

## Lokal ausprobieren

Das ist optional und nur nötig, wenn du am Code etwas ändern willst.
Benötigt wird Python 3.10 oder neuer.

```bash
pip install -r requirements.txt

python build_dashboard.py --demo        # Beispieldaten, kein Internet nötig
python build_dashboard.py               # echte Daten
python build_dashboard.py --check-feeds # prüft alle RSS-Feeds aus config.json
python notify.py --dry-run              # zeigt die Push-Nachricht, ohne sie zu senden

python -m http.server 8000 -d site      # dann http://localhost:8000 im Browser öffnen
```

---

## Wie die Zeitsteuerung funktioniert

GitHub-Zeitpläne (cron) laufen immer in **UTC** und kennen keine Sommerzeit.
Deshalb gibt es zwei Einträge:

| Cron (UTC) | entspricht in Berlin | wann gültig |
|---|---|---|
| `15 3 * * 1-5` | 04:15 MEZ | Winterzeit (Ende Okt. bis Ende März) |
| `15 2 * * 1-5` | 04:15 MESZ | Sommerzeit (Ende März bis Ende Okt.) |

Jeden Werktag starten also zwei Läufe. Der erste Job (`zeitcheck`) prüft:

1. Ist es in Berlin gerade **04:xx Uhr**?
2. Passt der auslösende Cron-Eintrag zur aktuellen Zeitzone (Winter oder Sommer)?

Nur wenn beides stimmt, wird gebaut. Der andere Lauf endet nach wenigen Sekunden als
„übersprungen“. Die zweite Prüfung verhindert, dass bei verspäteten Läufen doppelt
gebaut wird. Ein manueller Start über **Run workflow** läuft immer.

Der Bau-Job hat ein Zeitlimit von 20 Minuten (`timeout-minutes: 20`). Normalerweise
dauert er 1–2 Minuten und ist damit lange vor 04:45 Uhr fertig.

> **Hinweis:** GitHub startet geplante Workflows bei hoher Last manchmal verspätet,
> in seltenen Fällen um mehr als 45 Minuten. Fällt der Start dadurch hinter 04:59 Uhr,
> wird der Lauf wegen der 04:xx-Regel übersprungen. Für diesen Tag bleibt dann die
> Seite vom Vortag stehen. Bahn und Wetter lädt die Seite trotzdem live nach.
> Außerdem pausiert GitHub Zeitpläne in Repositories, in denen 60 Tage lang nichts
> passiert ist. Dann kommt eine E-Mail, und ein Klick reaktiviert den Zeitplan.

Feiertage erkennt das Dashboard nicht. An Feiertagen zeigt es einfach den Fahrplan
des Tages.

---

## Fehlersuche

| Problem | Lösung |
|---|---|
| Workflow erscheint nicht unter *Actions* | Prüfen, ob `.github/workflows/dashboard.yml` hochgeladen wurde (Schritt 2.4). |
| Fehler bei „Auf GitHub Pages veröffentlichen“ | In *Settings → Pages* muss als Source **GitHub Actions** gewählt sein. |
| Keine Push-Nachricht | Secret `NTFY_TOPIC` genau so geschrieben? Gleiches Topic in der App abonniert? Im Workflow-Log den Schritt „Push-Nachricht“ ansehen. |
| Push macht doch Ton | Schritt 7: Den Kanal für die **minimale** Priorität auf lautlos stellen. |
| Eine Nachrichten-Rubrik ist leer | Ein Feed hat seine Adresse geändert. Unter der Kachel steht „Nicht erreichbar: …“. Mit `--check-feeds` testen und in `config.json` ersetzen, z. B. durch einen Google-News-Feed. |
| Bahn zeigt „nicht verfügbar“ | `v6.db.transport.rest` ist ein kostenloser Community-Dienst und manchmal kurz gestört. Auf ⟳ tippen oder später nochmal öffnen. |
| „Mein Standort“ geht nicht | Standortfreigabe für Chrome bzw. die Seite erlauben (*Einstellungen → Apps → Chrome → Berechtigungen → Standort*). |
| Seite zeigt alte Daten | Auf ⟳ tippen. Bahn und Wetter werden dann live geladen. Nachrichten gibt es nur vom morgendlichen Build. |

Datenquellen: [Open-Meteo](https://open-meteo.com) (CC BY 4.0),
[db-rest / transport.rest](https://v6.db.transport.rest), RSS-Feeds der genannten Medien.
