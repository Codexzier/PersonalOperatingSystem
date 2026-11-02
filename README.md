# Personal OS

Eine Webseite im Look eines Cyberpunk-Betriebssystems – statisch, ohne Build-Schritt, direkt für **GitHub Pages** geeignet.

## Funktionen

- **System Bar (links)**: Start-Button, Uhr/Datum, Liste der geöffneten Programme (Tabs) mit Fokus/Minimieren per Klick.
- **Start-Menü** (oben links, oder `Alt+S`, Navigation mit ↑/↓ und Enter):
  - **Taschenrechner** – Grundrechenarten, Klammern, Modulo, Tastatureingabe; sicherer Parser ohne `eval`.
  - **Texteditor** – Autosave im Browser (localStorage), Datei öffnen, als Datei speichern (`Strg+S`).
  - **Wetter** – Temperatur, gefühlte Temperatur, **AQI (US)**, **UV-Index**, Luftfeuchte, Wind, PM2.5.
    Standort per GPS (Browser-Freigabe) oder per Städtesuche einstellbar; die Auswahl wird gespeichert.
- Fenster lassen sich verschieben, in der Größe ändern, maximieren (Doppelklick auf Titel), minimieren und schließen.

Wetterdaten: [Open-Meteo](https://open-meteo.com) (Wetter, Luftqualität, Geocoding – kein API-Key nötig).
Ortsname bei GPS-Ortung: BigDataCloud Reverse Geocoding (Client-API).

## Auf GitHub Pages veröffentlichen

1. Repository → **Settings** → **Pages**
2. Unter *Build and deployment* bei **Source** den Eintrag **GitHub Actions** wählen.
3. Der Workflow `.github/workflows/pages.yml` läuft bei jedem Push auf `main`
   (oder manuell unter **Actions → Deploy to GitHub Pages → Run workflow**).
4. Danach ist die Seite unter `https://<benutzername>.github.io/<repository>/` erreichbar.

Hinweis: Die GPS-Ortung funktioniert nur über HTTPS (bei GitHub Pages gegeben) bzw. `localhost`.

## Lokal starten

```bash
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen.

## Struktur

```
index.html          Oberfläche + App-Templates
css/style.css       Theme
js/os.js            Fenster-Manager, Start-Menü, System Bar
js/apps/*.js        Taschenrechner, Texteditor, Wetter
```
