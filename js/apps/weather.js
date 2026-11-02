/* Wetter – Daten von Open-Meteo (kein API-Key nötig) */
(function () {
  "use strict";
  const KEY = "pos.weather.location";
  const DEFAULT = { name: "Berlin", detail: "Deutschland", lat: 52.52, lon: 13.405, auto: false };

  const WMO = {
    0: "Klar", 1: "Überwiegend klar", 2: "Teilweise bewölkt", 3: "Bedeckt",
    45: "Nebel", 48: "Reifnebel",
    51: "Leichter Nieselregen", 53: "Nieselregen", 55: "Starker Nieselregen",
    56: "Gefrierender Niesel", 57: "Gefrierender Niesel",
    61: "Leichter Regen", 63: "Regen", 65: "Starker Regen",
    66: "Gefrierender Regen", 67: "Gefrierender Regen",
    71: "Leichter Schneefall", 73: "Schneefall", 75: "Starker Schneefall", 77: "Schneegriesel",
    80: "Regenschauer", 81: "Regenschauer", 82: "Heftige Schauer",
    85: "Schneeschauer", 86: "Schneeschauer",
    95: "Gewitter", 96: "Gewitter mit Hagel", 99: "Gewitter mit Hagel",
  };

  // US-AQI-Kategorien (EPA)
  function aqiInfo(v) {
    if (v <= 50) return ["Gut", "#5fd38d"];
    if (v <= 100) return ["Mäßig", "#f2d14b"];
    if (v <= 150) return ["Ungesund für Empfindliche", "#ff9a3c"];
    if (v <= 200) return ["Ungesund", "#ff3b4f"];
    if (v <= 300) return ["Sehr ungesund", "#b84bff"];
    return ["Gefährlich", "#9b1d32"];
  }
  // UV-Index-Kategorien (WHO)
  function uvInfo(v) {
    if (v < 3) return ["Niedrig", "#5fd38d"];
    if (v < 6) return ["Mäßig", "#f2d14b"];
    if (v < 8) return ["Hoch", "#ff9a3c"];
    if (v < 11) return ["Sehr hoch", "#ff3b4f"];
    return ["Extrem", "#b84bff"];
  }

  function loadLoc() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
  }
  function saveLoc(loc) {
    try { localStorage.setItem(KEY, JSON.stringify(loc)); } catch { /* ignorieren */ }
  }

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function fetchWeather(loc) {
    const q = `latitude=${loc.lat}&longitude=${loc.lon}&timezone=auto`;
    const [wx, aq] = await Promise.all([
      getJSON(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,uv_index,is_day&daily=uv_index_max&forecast_days=1`),
      getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=us_aqi,pm2_5,uv_index`).catch(() => null),
    ]);
    return { wx, aq };
  }

  async function reverseGeocode(lat, lon) {
    try {
      const d = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=de`);
      return { name: d.city || d.locality || "Aktueller Standort", detail: [d.principalSubdivision, d.countryName].filter(Boolean).join(", ") };
    } catch {
      return { name: "Aktueller Standort", detail: "" };
    }
  }

  function geolocate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation wird nicht unterstützt"));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4) }),
        (e) => reject(new Error(e.code === 1 ? "Standortzugriff verweigert" : "Standort nicht ermittelbar")),
        { timeout: 10000, maximumAge: 600000 }
      );
    });
  }

  window.Apps = window.Apps || {};
  window.Apps.weather = {
    title: "Wetter",
    short: "WTHR",
    icon: "☼",
    width: 460,
    height: 520,
    mount(body) {
      body.appendChild(document.getElementById("tpl-weather").content.cloneNode(true));
      const $ = (r) => body.querySelector(`[data-ref="${r}"]`);
      const status = $("status"), grid = $("grid"), settings = $("settings"), results = $("results"), query = $("query");
      let loc = loadLoc();
      let refreshTimer;

      function setStatus(msg, isError = false) {
        status.hidden = !msg;
        status.textContent = msg || "";
        status.classList.toggle("error", isError);
      }

      function showLoc() {
        $("place").textContent = loc.name;
        $("coords").textContent = `${loc.detail ? loc.detail + " · " : ""}${loc.lat.toFixed(2)}°, ${loc.lon.toFixed(2)}°${loc.auto ? " · GPS" : ""}`;
      }

      function setMeter(ref, value, max, color) {
        const el = $(ref);
        el.style.width = Math.min(100, (value / max) * 100) + "%";
        el.style.background = color;
      }

      async function refresh() {
        showLoc();
        setStatus("> Verbinde mit Wetterdienst …");
        try {
          const { wx, aq } = await fetchWeather(loc);
          const c = wx.current;
          $("temp").textContent = Math.round(c.temperature_2m);
          $("feels").textContent = Math.round(c.apparent_temperature);
          $("cond").textContent = WMO[c.weather_code] ?? "—";
          $("hum").textContent = Math.round(c.relative_humidity_2m);
          $("wind").textContent = Math.round(c.wind_speed_10m);

          const uv = c.uv_index ?? aq?.current?.uv_index;
          if (uv != null) {
            const [t, col] = uvInfo(uv);
            $("uv").textContent = uv.toFixed(1).replace(".", ",");
            $("uvText").textContent = t;
            $("uv").style.color = col;
            setMeter("uvBar", uv, 11, col);
          }
          const uvMax = wx.daily?.uv_index_max?.[0];
          $("uvMax").textContent = uvMax != null ? uvMax.toFixed(1).replace(".", ",") : "--";

          const aqi = aq?.current?.us_aqi;
          if (aqi != null) {
            const [t, col] = aqiInfo(aqi);
            $("aqi").textContent = Math.round(aqi);
            $("aqiText").textContent = t;
            $("aqi").style.color = col;
            setMeter("aqiBar", aqi, 300, col);
          } else {
            $("aqi").textContent = "--";
            $("aqiText").textContent = "Keine Daten";
          }
          const pm = aq?.current?.pm2_5;
          $("pm25").textContent = pm != null ? pm.toFixed(1).replace(".", ",") : "--";

          grid.hidden = false;
          setStatus("");
          $("updated").textContent = `Aktualisiert: ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · Daten: Open-Meteo.com`;
        } catch (e) {
          setStatus(`! Fehler beim Laden: ${e.message}`, true);
        }
      }

      async function useGeo() {
        setStatus("> Ermittle Standort …");
        try {
          const pos = await geolocate();
          const place = await reverseGeocode(pos.lat, pos.lon);
          loc = { ...pos, ...place, auto: true };
          saveLoc(loc);
          settings.hidden = true;
          refresh();
        } catch (e) {
          if (!loc) loc = DEFAULT;
          settings.hidden = false;
          await refresh();
          setStatus(`! ${e.message} – zeige ${loc.name}. Standort oben einstellbar.`, true);
        }
      }

      settings.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = query.value.trim();
        if (!name) return;
        results.innerHTML = "<li class='w-label'>Suche …</li>";
        try {
          const d = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=de&format=json`);
          results.innerHTML = "";
          if (!d.results?.length) { results.innerHTML = "<li class='w-label'>Keine Treffer</li>"; return; }
          for (const r of d.results) {
            const li = document.createElement("li");
            const b = document.createElement("button");
            b.type = "button";
            const detail = [r.admin1, r.country].filter(Boolean).join(", ");
            b.append(r.name + " ");
            const s = document.createElement("small");
            s.textContent = detail;
            b.append(s);
            b.addEventListener("click", () => {
              loc = { name: r.name, detail, lat: r.latitude, lon: r.longitude, auto: false };
              saveLoc(loc);
              settings.hidden = true;
              results.innerHTML = "";
              query.value = "";
              refresh();
            });
            li.append(b);
            results.append(li);
          }
        } catch (err) {
          results.innerHTML = "";
          setStatus(`! Suche fehlgeschlagen: ${err.message}`, true);
        }
      });

      body.addEventListener("click", (e) => {
        const act = e.target.closest("button[data-act]")?.dataset.act;
        if (act === "refresh") refresh();
        if (act === "settings") { settings.hidden = !settings.hidden; if (!settings.hidden) query.focus(); }
        if (act === "geo") useGeo();
      });

      if (loc) { loc.auto ? useGeo() : refresh(); }
      else useGeo(); // Erster Start: aktuellen Standort versuchen, sonst Berlin

      refreshTimer = setInterval(() => { if (loc) refresh(); }, 15 * 60 * 1000);
      return { destroy() { clearInterval(refreshTimer); } };
    },
  };
})();
