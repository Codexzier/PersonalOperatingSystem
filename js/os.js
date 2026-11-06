/* Personal OS – Fenster-Manager, Start-Menü, System Bar */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const desktop = $("#desktop");
  const winLayer = $("#windows");
  const taskList = $("#taskList");
  const startBtn = $("#startBtn");
  const startMenu = $("#startMenu");

  const windows = new Map(); // id -> { el, app, api, minimized, task }
  let zTop = 10;
  let pidCounter = 1000 + Math.floor(Math.random() * 8000);
  let focusedId = null;
  const isSmall = () => window.matchMedia("(max-width: 760px)").matches;

  /* ---------- Fenster ---------- */
  function openApp(appId) {
    const app = window.Apps[appId];
    if (!app) return;
    // Jede App läuft als einzelne Instanz – erneutes Öffnen holt sie nach vorn
    for (const [id, w] of windows) if (w.appId === appId) { restore(id); return; }

    const id = "w" + ++pidCounter;
    const el = document.createElement("section");
    el.className = "win";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", app.title);
    el.innerHTML = `
      <div class="win-titlebar">
        <span class="win-title"></span>
        <span class="win-pid">PID ${pidCounter}</span>
        <div class="win-controls">
          <button class="min" title="Minimieren" aria-label="Minimieren">_</button>
          <button class="max" title="Maximieren" aria-label="Maximieren">□</button>
          <button class="close" title="Schließen" aria-label="Schließen">✕</button>
        </div>
      </div>
      <div class="win-body"></div>
      <div class="win-resize" aria-hidden="true"></div>`;
    el.querySelector(".win-title").textContent = app.title.toUpperCase();

    // Position: kaskadiert, innerhalb des Desktops
    const dw = desktop.clientWidth, dh = desktop.clientHeight;
    const w = Math.min(app.width, dw - 20), h = Math.min(app.height, dh - 20);
    const n = windows.size;
    el.style.width = w + "px";
    el.style.height = h + "px";
    el.style.left = Math.max(10, Math.min(dw - w - 10, 130 + n * 36)) + "px";
    el.style.top = Math.max(10, Math.min(dh - h - 10, 30 + n * 30)) + "px";
    if (isSmall()) el.classList.add("maximized");

    winLayer.appendChild(el);

    const task = document.createElement("li");
    task.innerHTML = `<button class="task"><span></span><small>${app.short} · ${pidCounter}</small></button>`;
    task.querySelector("span").textContent = app.title;
    taskList.appendChild(task);

    const rec = { el, app, appId, api: null, minimized: false, task };
    windows.set(id, rec);

    const ctx = {
      setTitle(t) { el.querySelector(".win-title").textContent = t.toUpperCase(); },
      close: () => closeWin(id),
    };
    rec.api = app.mount(el.querySelector(".win-body"), ctx) || {};

    // Events
    el.addEventListener("pointerdown", () => focus(id), true);
    el.querySelector(".min").addEventListener("click", () => minimize(id));
    el.querySelector(".max").addEventListener("click", () => toggleMax(id));
    el.querySelector(".close").addEventListener("click", () => closeWin(id));
    el.querySelector(".win-titlebar").addEventListener("dblclick", (e) => { if (!e.target.closest("button")) toggleMax(id); });
    task.querySelector("button").addEventListener("click", () => {
      if (rec.minimized) restore(id);
      else if (focusedId === id) minimize(id);
      else focus(id);
    });
    makeDraggable(el, el.querySelector(".win-titlebar"));
    makeResizable(el, el.querySelector(".win-resize"));

    focus(id);
    updateTaskInfo();
  }

  function focus(id) {
    const rec = windows.get(id);
    if (!rec) return;
    if (focusedId !== id) {
      rec.el.style.zIndex = ++zTop;
      rec.api.onFocus?.();
    }
    focusedId = id;
    for (const [wid, w] of windows) {
      w.el.classList.toggle("focused", wid === id);
      w.task.querySelector(".task").classList.toggle("active", wid === id);
    }
  }

  function focusTopmost() {
    let best = null, z = -1;
    for (const [id, w] of windows) {
      if (w.minimized) continue;
      const wz = +w.el.style.zIndex || 0;
      if (wz > z) { z = wz; best = id; }
    }
    focusedId = null;
    if (best) focus(best);
    else for (const w of windows.values()) { w.el.classList.remove("focused"); w.task.querySelector(".task").classList.remove("active"); }
  }

  function minimize(id) {
    const rec = windows.get(id);
    if (!rec) return;
    rec.minimized = true;
    rec.el.hidden = true;
    rec.task.querySelector(".task").classList.add("minimized");
    focusTopmost();
  }

  function restore(id) {
    const rec = windows.get(id);
    if (!rec) return;
    rec.minimized = false;
    rec.el.hidden = false;
    rec.task.querySelector(".task").classList.remove("minimized");
    focusedId = null;
    focus(id);
  }

  function toggleMax(id) {
    const rec = windows.get(id);
    if (rec) rec.el.classList.toggle("maximized");
  }

  function closeWin(id) {
    const rec = windows.get(id);
    if (!rec) return;
    rec.api.destroy?.();
    windows.delete(id);
    rec.task.remove();
    rec.el.classList.add("closing");
    setTimeout(() => rec.el.remove(), 140);
    if (focusedId === id) focusTopmost();
    updateTaskInfo();
  }

  function updateTaskInfo() {
    $("#taskCount").textContent = windows.size;
    $("#taskEmpty").hidden = windows.size > 0;
  }

  /* ---------- Drag & Resize ---------- */
  function makeDraggable(el, handle) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button") || el.classList.contains("maximized")) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      const ox = el.offsetLeft, oy = el.offsetTop;
      handle.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const maxX = desktop.clientWidth - 60, maxY = desktop.clientHeight - 34;
        el.style.left = Math.max(-el.offsetWidth + 60, Math.min(maxX, ox + ev.clientX - sx)) + "px";
        el.style.top = Math.max(0, Math.min(maxY, oy + ev.clientY - sy)) + "px";
      };
      const up = () => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  }

  function makeResizable(el, grip) {
    grip.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, w0 = el.offsetWidth, h0 = el.offsetHeight;
      grip.setPointerCapture(e.pointerId);
      const move = (ev) => {
        el.style.width = Math.max(260, w0 + ev.clientX - sx) + "px";
        el.style.height = Math.max(180, h0 + ev.clientY - sy) + "px";
      };
      const up = () => { grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); };
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", up);
    });
  }

  /* ---------- Start-Menü ---------- */
  const gamesBtn = $("#gamesBtn");
  const gamesMenu = $("#gamesMenu");
  const subOpen = () => !gamesMenu.hidden;
  // Menüpunkte der aktuell aktiven Ebene (Hauptmenü oder Untermenü)
  const levelItems = (inSub) => inSub
    ? [...gamesMenu.querySelectorAll('button[role="menuitem"]')]
    : [...startMenu.querySelectorAll(':scope > ul > li > button[role="menuitem"]')];

  function setSub(open, focusFirst = false) {
    gamesMenu.hidden = !open;
    gamesBtn.setAttribute("aria-expanded", String(open));
    gamesBtn.classList.toggle("open", open);
    if (open && focusFirst) levelItems(true)[0].focus();
  }
  function setMenu(open) {
    startMenu.hidden = !open;
    startBtn.setAttribute("aria-expanded", String(open));
    setSub(false);
    if (open) {
      startMenu.style.zIndex = ++zTop + 1000;
      levelItems(false)[0].focus();
    }
  }
  startBtn.addEventListener("click", () => setMenu(startMenu.hidden));
  startMenu.addEventListener("click", (e) => {
    if (e.target.closest("#gamesBtn")) { setSub(!subOpen(), true); return; }
    const b = e.target.closest("button[data-app]");
    if (b) { setMenu(false); openApp(b.dataset.app); }
  });
  // Untermenü per Maus öffnen/schließen (nur bei Geräten mit Hover)
  const hasHover = () => window.matchMedia("(hover: hover)").matches;
  const subLi = gamesBtn.parentElement;
  subLi.addEventListener("mouseenter", () => { if (hasHover()) setSub(true); });
  subLi.addEventListener("mouseleave", () => {
    if (!hasHover()) return;
    setSub(false);
    if (gamesMenu.contains(document.activeElement)) gamesBtn.focus();
  });
  // Andere Hauptmenüpunkte schließen das Untermenü beim Überfahren
  levelItems(false).forEach((b) => b.addEventListener("mouseenter", () => { if (b !== gamesBtn && hasHover()) setSub(false); }));

  startMenu.addEventListener("keydown", (e) => {
    const inSub = gamesMenu.contains(document.activeElement);
    const items = levelItems(inSub);
    const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === "ArrowRight" && document.activeElement === gamesBtn) { e.preventDefault(); setSub(true, true); }
    else if ((e.key === "ArrowLeft" || e.key === "Escape") && inSub) {
      e.preventDefault(); e.stopPropagation(); setSub(false); gamesBtn.focus();
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!startMenu.hidden && !startMenu.contains(e.target) && !startBtn.contains(e.target)) setMenu(false);
  });

  document.querySelectorAll(".desk-icon").forEach((b) => b.addEventListener("dblclick", () => openApp(b.dataset.app)));
  document.querySelectorAll(".desk-icon").forEach((b) => b.addEventListener("keydown", (e) => { if (e.key === "Enter") openApp(b.dataset.app); }));
  // Touch-Geräte: einfacher Tap öffnet
  document.querySelectorAll(".desk-icon").forEach((b) => b.addEventListener("click", (e) => { if (e.pointerType === "touch") openApp(b.dataset.app); }));

  /* ---------- Tastatur ---------- */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !startMenu.hidden) { setMenu(false); startBtn.focus(); return; }
    if (e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); setMenu(startMenu.hidden); return; }
    // Tasten an das fokussierte Fenster weitergeben, wenn kein Eingabefeld aktiv ist
    const t = e.target;
    if (t.matches?.("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
    const rec = focusedId && windows.get(focusedId);
    if (rec && !rec.minimized && rec.api.onKey && rec.api.onKey(e)) e.preventDefault();
  });

  /* ---------- System-Anzeigen ---------- */
  const start = Date.now();
  function tick() {
    const now = new Date();
    $("#clock").textContent = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    $("#date").textContent = now.toLocaleDateString("de-DE");
    const s = Math.floor((Date.now() - start) / 1000);
    $("#uptime").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    $("#ping").textContent = 30 + Math.floor(Math.random() * 30) + "MS";
    $("#sysVolt").textContent = (3.1 + Math.random() * 0.08).toFixed(2) + "V";
  }
  tick();
  setInterval(tick, 1000);

  const bin = $("#binary");
  const bits = (n) => Array.from({ length: n }, () => (Math.random() > 0.5 ? 1 : 0)).join("");
  function binaryTick() {
    bin.textContent = "CONNECTION 0.55\n" + Array.from({ length: 40 }, () => bits(10)).join("\n");
  }
  bin.style.whiteSpace = "pre";
  binaryTick();
  setInterval(binaryTick, 1500);

  const hexRow = () => Array.from({ length: 8 }, () => bits(8)).join(" ");
  $("#hexstrip").textContent = Array.from({ length: 6 }, hexRow).join("\n");
  $("#serial").textContent = Math.floor(Math.random() * 0xfffffff).toString(16).toUpperCase().padStart(7, "0");

  window.addEventListener("resize", () => {
    if (isSmall()) for (const w of windows.values()) w.el.classList.add("maximized");
  });

  updateTaskInfo();
  window.PersonalOS = { openApp, closeWin };
})();
