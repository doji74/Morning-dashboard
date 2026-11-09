/* Morgen-Dashboard – Darstellung und Live-Aktualisierung im Browser.
 *
 * Die Seite enthält die Daten vom morgendlichen Build (eingebettet als JSON).
 * Beim Öffnen werden Bahn und Wetter zusätzlich live nachgeladen, damit z. B.
 * am Nachmittag echte Verspätungen angezeigt werden. Schlägt das fehl (offline),
 * bleiben die Daten vom Morgen sichtbar.
 */
(() => {
  "use strict";

  const DATA = JSON.parse(document.getElementById("data").textContent);
  const TZ = DATA.timezone || "Europe/Berlin";
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------------ Helfer
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hhmm = (iso) => (iso ? String(iso).slice(11, 16) : "–");
  const round = (n) => (n == null || isNaN(n) ? "–" : Math.round(n));

  function berlinNow() {
    const parts = {};
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
    }).formatToParts(new Date()).forEach((p) => { parts[p.type] = p.value; });
    const y = +parts.year, m = +parts.month, d = +parts.day;
    const h = +parts.hour, mi = +parts.minute;
    const offsetMin = Math.round((Date.UTC(y, m - 1, d, h, mi) - Date.now()) / 60000);
    return {
      y, m, d, h, mi, offsetMin,
      date: `${parts.year}-${parts.month}-${parts.day}`,
      weekend: parts.weekday === "Sat" || parts.weekday === "Sun",
      time: `${parts.hour}:${parts.minute}`,
    };
  }

  // Berliner Uhrzeit "HH:MM" von heute -> Unix-Millisekunden
  function berlinTs(now, hm) {
    const [h, mi] = hm.split(":").map(Number);
    return Date.UTC(now.y, now.m - 1, now.d, h, mi) - now.offsetMin * 60000;
  }

  function relTime(iso) {
    if (!iso) return "";
    const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (min < 1) return "gerade eben";
    if (min < 60) return `vor ${min} Min.`;
    const h = Math.round(min / 60);
    if (h < 24) return `vor ${h} Std.`;
    const d = Math.round(h / 24);
    return d === 1 ? "gestern" : `vor ${d} Tagen`;
  }

  const WX = {
    0: ["Klar", "☀️"], 1: ["Überwiegend klar", "🌤️"], 2: ["Teilweise bewölkt", "⛅"],
    3: ["Bedeckt", "☁️"], 45: ["Nebel", "🌫️"], 48: ["Reifnebel", "🌫️"],
    51: ["Leichter Niesel", "🌦️"], 53: ["Niesel", "🌦️"], 55: ["Starker Niesel", "🌧️"],
    56: ["Gefrierender Niesel", "🌧️"], 57: ["Gefrierender Niesel", "🌧️"],
    61: ["Leichter Regen", "🌦️"], 63: ["Regen", "🌧️"], 65: ["Starker Regen", "🌧️"],
    66: ["Gefrierender Regen", "🌧️"], 67: ["Gefrierender Regen", "🌧️"],
    71: ["Leichter Schnee", "🌨️"], 73: ["Schnee", "🌨️"], 75: ["Starker Schnee", "❄️"],
    77: ["Schneegriesel", "🌨️"], 80: ["Leichte Schauer", "🌦️"], 81: ["Schauer", "🌧️"],
    82: ["Heftige Schauer", "⛈️"], 85: ["Schneeschauer", "🌨️"], 86: ["Schneeschauer", "❄️"],
    95: ["Gewitter", "⛈️"], 96: ["Gewitter mit Hagel", "⛈️"], 99: ["Gewitter mit Hagel", "⛈️"],
  };
  const wx = (code) => WX[code] || ["–", "🌡️"];

  async function fetchJson(url, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  }

  // ------------------------------------------------------------------ Kopf
  function renderHeader(liveAt) {
    const gen = new Date(DATA.generated);
    const dateStr = new Intl.DateTimeFormat("de-DE", {
      timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric",
    }).format(new Date());
    let sub = `${dateStr} · Stand ${hhmm(DATA.generated)}`;
    if (berlinNow().date !== DATA.generated.slice(0, 10)) {
      sub += ` (vom ${gen.toLocaleDateString("de-DE", { timeZone: TZ })})`;
    }
    if (liveAt) sub += ` · live ${liveAt}`;
    $("subtitle").innerHTML = esc(sub) + (DATA.demo ? ' <span class="badge demo">Demo-Daten</span>' : "");
  }

  // ------------------------------------------------------------------ Bahn
  function delayInfo(min, cancelled) {
    if (cancelled) return '<span class="delay d-bad">Ausfall</span>';
    if (min == null) return '<span class="delay muted">–</span>';
    if (min <= 0) return '<span class="delay d-ok">+0</span>';
    const cls = min > (DATA.train.config?.warn_delay_minutes ?? 5) ? "d-bad" : "d-mid";
    return `<span class="delay ${cls}">+${min}</span>`;
  }

  function journeyHtml(j) {
    const lines = j.legs.map((l) => l.line).join(" → ");
    const umst = j.transfers === 0 ? "direkt" : `${j.transfers} Umstieg${j.transfers > 1 ? "e" : ""}`;
    const arrDelay = j.arr_delay > 0 ? ` <span class="d-mid">(+${j.arr_delay})</span>` : "";
    let details = `an ${hhmm(j.arr_planned)}${arrDelay} · ${umst}`;
    if (j.transfers > 0) {
      details += " · " + j.legs.map((l) => `${esc(l.line)} bis ${esc(l.to)} (${hhmm(l.arr_planned)})`).join(", ");
    }
    const remarks = (j.remarks || []).map((r) => `<div class="remark">⚠ ${esc(r)}</div>`).join("");
    return `<li class="journey${j.cancelled ? " cancelled" : ""}">
      <span class="time">${hhmm(j.dep_planned)}</span>
      ${delayInfo(j.dep_delay, j.cancelled)}
      <span class="line">${esc(lines)}</span>
      <span class="plat${j.platform_changed ? " changed" : ""}">Gl. ${esc(j.platform || "?")}</span>
      <span class="details">${details}</span>
      ${remarks}
    </li>`;
  }

  function renderTrain(train, live) {
    const el = $("train");
    const badge = live ? '<span class="badge live">live</span>' : '<span class="badge">Stand Morgen</span>';
    let body = "";
    if (!train.active) {
      body = `<p class="muted">${esc(train.note || "Heute keine Pendelzüge.")}</p>`;
    } else {
      body = train.connections.map((c) => {
        const head = `<h3>${esc(c.label)} <span>· ${esc(c.from.name)} → ${esc(c.to.name)} · ${esc(c.start)}–${esc(c.end)}</span></h3>`;
        if (c.error) return `<div class="conn">${head}<p class="muted">${esc(c.error)}</p></div>`;
        if (!c.journeys.length) return `<div class="conn">${head}<p class="muted">Keine Verbindungen in diesem Zeitraum.</p></div>`;
        return `<div class="conn">${head}<ul class="journeys">${c.journeys.map(journeyHtml).join("")}</ul></div>`;
      }).join("");
    }
    el.innerHTML = `<h2>🚆 Bahn ${badge}</h2>${body}`;
  }

  function renderWarning(train) {
    const el = $("warning");
    const w = train.active ? train.warnings || [] : [];
    if (!w.length) { el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    el.innerHTML = `<h2>⚠️ Bahn-Warnung</h2><ul>${w.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  }

  function computeWarnings(train) {
    const threshold = train.config?.warn_delay_minutes ?? 5;
    const out = [];
    for (const c of train.connections || []) {
      for (const j of c.journeys || []) {
        const line = j.legs.map((l) => l.line).join(" / ");
        if (j.cancelled) { out.push(`${hhmm(j.dep_planned)} ${line} (${c.from.name}) fällt aus`); continue; }
        const d = Math.max(j.dep_delay || 0, j.arr_delay || 0);
        if (d > threshold) out.push(`${hhmm(j.dep_planned)} ${line} (${c.from.name}) +${d} Min`);
      }
    }
    return out;
  }

  // Gleiche Aufbereitung wie normalize_journey() in build_dashboard.py
  function normalizeJourney(j) {
    const legs = (j.legs || []).filter((l) => !l.walking);
    if (!legs.length) return null;
    const first = legs[0], last = legs[legs.length - 1];
    const mins = (s) => (s == null ? null : Math.round(s / 60));
    const remarks = [];
    for (const l of legs) for (const r of l.remarks || []) {
      if (r.type === "warning" || r.type === "status") {
        const t = (r.summary || r.text || "").trim();
        if (t && !remarks.includes(t)) remarks.push(t);
      }
    }
    const plat = first.departurePlatform || first.plannedDeparturePlatform;
    return {
      dep_planned: first.plannedDeparture,
      dep: first.departure || first.prognosedDeparture,
      dep_delay: mins(first.departureDelay),
      platform: plat,
      platform_changed: !!(plat && first.plannedDeparturePlatform && plat !== first.plannedDeparturePlatform),
      arr_planned: last.plannedArrival,
      arr: last.arrival || last.prognosedArrival,
      arr_delay: mins(last.arrivalDelay),
      cancelled: legs.some((l) => l.cancelled),
      transfers: legs.length - 1,
      legs: legs.map((l) => ({
        line: (l.line && l.line.name) || "?",
        from: l.origin && l.origin.name, to: l.destination && l.destination.name,
        dep_planned: l.plannedDeparture, dep_delay: mins(l.departureDelay),
        arr_planned: l.plannedArrival,
        platform: l.departurePlatform || l.plannedDeparturePlatform,
        cancelled: !!l.cancelled,
      })),
      remarks: remarks.slice(0, 3),
    };
  }

  async function fetchConnectionLive(api, conn, now) {
    const start = berlinTs(now, conn.start), end = berlinTs(now, conn.end);
    let params = new URLSearchParams({
      from: conn.from.id, to: conn.to.id, departure: new Date(start).toISOString(),
      results: "8", stopovers: "false", remarks: "true", language: "de",
    });
    const journeys = [], seen = new Set();
    for (let page = 0; page < 4; page++) {
      const data = await fetchJson(`${api.replace(/\/$/, "")}/journeys?${params}`);
      let pastEnd = false;
      for (const raw of data.journeys || []) {
        const j = normalizeJourney(raw);
        if (!j || !j.dep_planned) continue;
        const dep = Date.parse(j.dep_planned);
        if (dep > end) { pastEnd = true; continue; }
        const key = j.dep_planned + "|" + j.legs.map((l) => l.line).join("/");
        if (dep >= start && !seen.has(key)) { seen.add(key); journeys.push(j); }
      }
      if (pastEnd || !data.laterRef) break;
      params = new URLSearchParams({
        from: conn.from.id, to: conn.to.id, laterThan: data.laterRef,
        results: "8", stopovers: "false", remarks: "true", language: "de",
      });
    }
    journeys.sort((a, b) => Date.parse(a.dep_planned) - Date.parse(b.dep_planned));
    return { ...conn, journeys };
  }

  async function refreshTrainLive() {
    const cfg = DATA.train.config;
    if (!cfg) return false;
    const now = berlinNow();
    if (cfg.weekdays_only && now.weekend) {
      DATA.train = { active: false, note: "Wochenende – keine Pendelzüge.", config: cfg, connections: [], warnings: [] };
      renderTrain(DATA.train, true); renderWarning(DATA.train);
      return true;
    }
    const conns = await Promise.all(cfg.connections.map((c) =>
      fetchConnectionLive(cfg.api, c, now).catch(() => null)));
    if (conns.some((c) => c === null)) {
      // Teilweise Fehler: vorhandene Morgen-Daten für fehlende Verbindungen behalten
      conns.forEach((c, i) => {
        if (c === null) conns[i] = (DATA.train.connections || []).find((x) => x.id === cfg.connections[i].id)
          || { ...cfg.connections[i], journeys: [], error: "Live-Daten nicht verfügbar" };
      });
    }
    DATA.train = { active: true, config: cfg, connections: conns };
    DATA.train.warnings = computeWarnings(DATA.train);
    renderTrain(DATA.train, true);
    renderWarning(DATA.train);
    return true;
  }

  // ------------------------------------------------------------------ Wetter
  function weatherTileHtml(w, extraBadge = "") {
    if (w.error) return `<h2>${esc(w.name)}</h2><p class="muted">${esc(w.error)}</p>`;
    const [desc, icon] = wx(w.current.code);
    const nowH = berlinNow().h;
    const hours = (DATA.weather_hours || [6, 9, 12, 15, 18, 21]).map((h) => {
      const x = w.hourly.find((e) => e.hour === h);
      if (!x) return "";
      return `<div class="${h < nowH ? "past" : ""}">
        <div class="h">${String(h).padStart(2, "0")}h</div>
        <div class="i">${wx(x.code)[1]}</div>
        <div class="t">${round(x.temp)}°</div>
        <div class="r">${x.rain_prob ?? 0}%</div></div>`;
    }).join("");
    const bars = w.hourly.filter((e) => e.hour >= 5 && e.hour <= 23).map((e) =>
      `<span class="${e.hour === nowH ? "now" : ""}" style="height:${Math.max(4, e.rain_prob || 0)}%" title="${e.hour} Uhr: ${e.rain_prob ?? 0} %"></span>`).join("");
    const t = w.today;
    return `<h2>${esc(w.name)} ${extraBadge}</h2>
      <div class="wx-now">
        <span class="wx-icon" aria-hidden="true">${icon}</span>
        <div><div class="wx-temp">${round(w.current.temp)}°</div>
        <div class="wx-desc muted">${esc(desc)}</div></div>
      </div>
      <div class="wx-facts">
        <b>${round(t.min)}° / ${round(t.max)}°</b> · gefühlt ${round(w.current.feels)}°<br>
        Regen <b>${t.rain_prob ?? 0}%</b> (${(t.precip_sum ?? 0).toFixed(1)} mm) · Wind ${round(w.current.wind)} km/h<br>
        🌅 ${esc(t.sunrise)} · 🌇 ${esc(t.sunset)}
      </div>
      <div class="wx-hours">${hours}</div>
      <div class="rainbars" aria-label="Regenwahrscheinlichkeit im Tagesverlauf">${bars}</div>
      <div class="rainaxis"><span>5h</span><span>Regen %</span><span>23h</span></div>`;
  }

  function renderWeather(live) {
    const badge = live ? '<span class="badge live">live</span>' : "";
    $("weather").innerHTML = DATA.weather.map((w) =>
      `<section class="tile">${weatherTileHtml(w, badge)}</section>`).join("");
  }

  const OM_PARAMS = {
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,precipitation,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset",
    forecast_days: "1", wind_speed_unit: "kmh",
  };

  // Gleiche Aufbereitung wie normalize_weather() in build_dashboard.py
  async function fetchWeather(name, lat, lon) {
    const p = new URLSearchParams({ ...OM_PARAMS, latitude: lat, longitude: lon, timezone: TZ });
    const raw = await fetchJson(`https://api.open-meteo.com/v1/forecast?${p}`);
    const c = raw.current, d = raw.daily, h = raw.hourly;
    return {
      name,
      current: { temp: c.temperature_2m, feels: c.apparent_temperature, humidity: c.relative_humidity_2m,
        precip: c.precipitation, wind: c.wind_speed_10m, code: c.weather_code },
      today: { max: d.temperature_2m_max[0], min: d.temperature_2m_min[0],
        rain_prob: d.precipitation_probability_max[0], precip_sum: d.precipitation_sum[0],
        code: d.weather_code[0], sunrise: d.sunrise[0].slice(11, 16), sunset: d.sunset[0].slice(11, 16) },
      hourly: h.time.map((ts, i) => ({ hour: +ts.slice(11, 13), temp: h.temperature_2m[i],
        rain_prob: h.precipitation_probability[i], precip: h.precipitation[i], code: h.weather_code[i] })),
    };
  }

  async function refreshWeatherLive() {
    const locs = DATA.weather_locations || [];
    if (!locs.length) return false;
    const fresh = await Promise.all(locs.map((l) => fetchWeather(l.name, l.lat, l.lon).catch(() => null)));
    fresh.forEach((w, i) => { if (w) DATA.weather[i] = w; });
    renderWeather(fresh.every(Boolean));
    return fresh.some(Boolean);
  }

  // ------------------------------------------------------------------ Mein Standort
  const GEO_KEY = "dashboard.geo";
  function geoWanted() { try { return localStorage.getItem(GEO_KEY) === "1"; } catch { return false; } }
  function setGeoWanted(v) { try { v ? localStorage.setItem(GEO_KEY, "1") : localStorage.removeItem(GEO_KEY); } catch { /* egal */ } }

  function renderMyLocPrompt(msg) {
    $("myloc").innerHTML = `<h2>📍 Mein Standort</h2>
      <div class="row"><button id="geo-btn" class="btn" type="button">Wetter für meinen Standort</button>
      <span class="muted small">${esc(msg || "Nutzt die Standortfreigabe des Browsers.")}</span></div>`;
    $("geo-btn").addEventListener("click", () => loadMyLocation(true));
  }

  function loadMyLocation(userClicked) {
    if (!("geolocation" in navigator)) { renderMyLocPrompt("Dieser Browser kann keinen Standort ermitteln."); return; }
    $("myloc").innerHTML = '<h2>📍 Mein Standort</h2><p class="muted">Standort wird ermittelt …</p>';
    navigator.geolocation.getCurrentPosition(async (pos) => {
      setGeoWanted(true);
      try {
        const w = await fetchWeather("📍 Mein Standort", pos.coords.latitude.toFixed(3), pos.coords.longitude.toFixed(3));
        $("myloc").innerHTML = weatherTileHtml(w, '<span class="badge live">live</span>');
      } catch {
        renderMyLocPrompt("Wetterdaten konnten nicht geladen werden (offline?).");
      }
    }, (err) => {
      if (err.code === err.PERMISSION_DENIED) setGeoWanted(false);
      renderMyLocPrompt(err.code === err.PERMISSION_DENIED
        ? "Standortfreigabe abgelehnt – in den Browser-Einstellungen änderbar."
        : "Standort konnte nicht ermittelt werden.");
    }, { enableHighAccuracy: false, timeout: userClicked ? 20000 : 10000, maximumAge: 15 * 60 * 1000 });
  }

  async function initMyLocation() {
    if (!geoWanted()) { renderMyLocPrompt(); return; }
    // Nur automatisch laden, wenn die Freigabe schon erteilt ist (keine Abfrage ohne Klick)
    try {
      if (navigator.permissions) {
        const st = await navigator.permissions.query({ name: "geolocation" });
        if (st.state !== "granted") { renderMyLocPrompt(); return; }
      }
    } catch { /* ältere Browser: einfach versuchen */ }
    loadMyLocation(false);
  }

  // ------------------------------------------------------------------ Nachrichten
  function renderNews() {
    $("news").innerHTML = DATA.news.map((s) => {
      const summary = s.summary
        ? `<div class="summary"><span class="label">✨ Kurzfassung (KI)</span>${esc(s.summary)}</div>` : "";
      const items = s.items.length
        ? `<ul class="news-list">${s.items.map((i) => `<li>
            <a href="${esc(i.link)}" target="_blank" rel="noopener noreferrer">${esc(i.title)}</a>
            <div class="meta">${esc(i.source)}${i.published ? " · " + esc(relTime(i.published)) : ""}</div></li>`).join("")}</ul>`
        : '<p class="muted">Keine aktuellen Meldungen.</p>';
      const failed = s.failed_feeds && s.failed_feeds.length
        ? `<p class="muted small">Nicht erreichbar: ${esc(s.failed_feeds.join(", "))}</p>` : "";
      return `<section class="tile"><h2>${esc(s.icon)} ${esc(s.title)}</h2>${summary}${items}${failed}</section>`;
    }).join("");
  }

  // ------------------------------------------------------------------ Start
  let lastLive = 0;
  async function refreshLive() {
    if (DATA.demo || !navigator.onLine) return;
    const btn = $("refresh");
    btn.classList.add("spin");
    try {
      const [t, w] = await Promise.all([
        refreshTrainLive().catch(() => false),
        refreshWeatherLive().catch(() => false),
      ]);
      if (t || w) { lastLive = Date.now(); renderHeader(berlinNow().time); }
    } finally {
      btn.classList.remove("spin");
    }
  }

  renderHeader();
  renderWarning(DATA.train);
  renderTrain(DATA.train, false);
  renderWeather(false);
  renderNews();
  initMyLocation();
  refreshLive();

  $("refresh").addEventListener("click", () => { refreshLive(); if (geoWanted()) loadMyLocation(true); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastLive > 3 * 60 * 1000) refreshLive();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
