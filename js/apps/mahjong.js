/* Mahjong-Solitär – lösbare Verteilung, Rückgängig, Timer ab dem ersten abgeräumten Paar */
(function () {
  "use strict";

  /* ---------- Layout (x/y in Steinbreiten, z = Ebene) ---------- */
  function buildLayout() {
    const pos = [];
    // Ebene 0: 8 / 10 / 10 / 10 / 10 / 8
    for (let y = 0; y < 6; y++) {
      const wide = y > 0 && y < 5;
      for (let x = wide ? 0 : 1; x <= (wide ? 9 : 8); x++) pos.push({ x, y, z: 0 });
    }
    pos.push({ x: -1, y: 2.5, z: 0 }, { x: 10, y: 2.5, z: 0 }); // Seitensteine
    for (let y = 1; y <= 4; y++) for (let x = 2; x <= 7; x++) pos.push({ x, y, z: 1 }); // Ebene 1: 6×4
    for (let y = 2; y <= 3; y++) for (let x = 3; x <= 6; x++) pos.push({ x, y, z: 2 }); // Ebene 2: 4×2
    pos.push({ x: 4, y: 2.5, z: 3 }, { x: 5, y: 2.5, z: 3 }); // Spitze
    return pos; // 92 Steine
  }

  /* ---------- Steintypen ---------- */
  const SUITS = [
    { key: "c", sym: "◉", cls: "s-dot" },
    { key: "b", sym: "▥", cls: "s-bam" },
    { key: "k", sym: "字", cls: "s-chr" },
  ];
  const TYPES = [];
  for (const s of SUITS) for (let n = 1; n <= 9; n++) TYPES.push({ id: s.key + n, big: String(n), small: s.sym, cls: s.cls });
  for (const [id, g] of [["wN", "N"], ["wE", "E"], ["wS", "S"], ["wW", "W"]]) TYPES.push({ id, big: g, small: "風", cls: "s-wind" });
  TYPES.push({ id: "dR", big: "中", small: "RED", cls: "s-drag-r" });
  TYPES.push({ id: "dG", big: "發", small: "GRN", cls: "s-drag-g" });
  TYPES.push({ id: "dW", big: "▢", small: "WHT", cls: "s-drag-w" });

  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  /* ---------- Regeln ---------- */
  const overlapsY = (a, b) => Math.abs(a.y - b.y) < 1;
  function isFree(t, tiles) {
    let left = false, right = false;
    for (const o of tiles) {
      if (o === t || o.removed) continue;
      if (o.z === t.z + 1 && Math.abs(o.x - t.x) < 1 && overlapsY(o, t)) return false; // bedeckt
      if (o.z === t.z && overlapsY(o, t)) {
        if (Math.abs(o.x - (t.x - 1)) < 0.01) left = true;
        if (Math.abs(o.x - (t.x + 1)) < 0.01) right = true;
      }
    }
    return !(left && right);
  }

  // Lösbare Verteilung: Spiel rückwärts simulieren und jeweils zwei freie Positionen paaren
  function deal(layout) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const tiles = layout.map((p, i) => ({ ...p, i, removed: false, type: null }));
      const pairTypes = shuffle(Array.from({ length: tiles.length / 2 }, (_, k) => TYPES[k % TYPES.length]));
      let ok = true;
      for (const type of pairTypes) {
        const free = tiles.filter((t) => !t.removed && isFree(t, tiles));
        if (free.length < 2) { ok = false; break; }
        shuffle(free);
        free[0].type = free[1].type = type;
        free[0].removed = free[1].removed = true;
      }
      if (ok) { tiles.forEach((t) => (t.removed = false)); return tiles; }
    }
    throw new Error("Keine lösbare Verteilung gefunden");
  }

  /* ---------- App ---------- */
  const TW = 46, TH = 60, DEPTH = 5; // Steinmaße (px) und 3D-Versatz pro Ebene

  window.Apps = window.Apps || {};
  window.Apps.mahjong = {
    title: "Mahjong",
    short: "MHJG",
    icon: "▦",
    width: 780,
    height: 600,
    mount(body) {
      body.innerHTML = `
        <div class="game mahjong">
          <div class="game-bar">
            <div class="game-timer" title="Spielzeit"><span class="w-label">ZEIT</span><b data-ref="time">00:00</b></div>
            <div class="mj-stats">
              <span><span class="w-label">STEINE</span><b data-ref="left">0</b></span>
              <span><span class="w-label">ZÜGE MÖGLICH</span><b data-ref="moves">0</b></span>
            </div>
            <div class="game-tools">
              <button data-act="undo" title="Rückgängig (Strg+Z / U)">↶ Rückgängig</button>
              <button data-act="hint" title="Hinweis (H)">? Hinweis</button>
              <button data-act="new">Neues Spiel</button>
            </div>
          </div>
          <div class="game-info" data-ref="info">Timer startet mit dem ersten abgeräumten Stein</div>
          <div class="mj-viewport" data-ref="viewport"><div class="mj-board" data-ref="board"></div></div>
        </div>`;
      const $ = (r) => body.querySelector(`[data-ref="${r}"]`);
      const board = $("board"), viewport = $("viewport"), timeEl = $("time"), infoEl = $("info");
      const undoBtn = body.querySelector('[data-act="undo"]');
      const layout = buildLayout();
      const minX = Math.min(...layout.map((p) => p.x)), maxX = Math.max(...layout.map((p) => p.x));
      const maxY = Math.max(...layout.map((p) => p.y)), maxZ = Math.max(...layout.map((p) => p.z));
      const boardW = (maxX - minX + 1) * TW + maxZ * DEPTH + 8;
      const boardH = (maxY + 1) * TH + maxZ * DEPTH + 8;
      board.style.width = boardW + "px";
      board.style.height = boardH + "px";

      let tiles = [], history = [], selected = null, seconds = 0, timer = null, started = false, over = false;

      function stopTimer() { clearInterval(timer); timer = null; }
      function startTimer() {
        if (started) return;
        started = true;
        timer = setInterval(() => { seconds++; timeEl.textContent = fmt(seconds); }, 1000);
      }

      function newGame() {
        stopTimer();
        started = false; over = false; seconds = 0; history = []; selected = null;
        timeEl.textContent = "00:00";
        tiles = deal(layout);
        board.innerHTML = "";
        for (const t of tiles) {
          const el = document.createElement("button");
          el.className = `mj-tile ${t.type.cls}`;
          el.innerHTML = `<span class="mj-big">${t.type.big}</span><span class="mj-small">${t.type.small}</span>`;
          // höhere Ebenen nach oben links versetzt => räumlicher Eindruck
          el.style.left = (t.x - minX) * TW + (maxZ - t.z) * DEPTH + "px";
          el.style.top = t.y * TH + (maxZ - t.z) * DEPTH + "px";
          el.style.zIndex = t.z * 1000 + Math.round(t.y * 2) * 30 + Math.round((t.x - minX) * 2);
          el.addEventListener("click", () => clickTile(t));
          t.el = el;
          board.appendChild(el);
        }
        setInfo("Timer startet mit dem ersten abgeräumten Stein");
        update();
        fit();
      }

      function setInfo(msg, cls = "") {
        infoEl.textContent = msg;
        infoEl.className = "game-info" + (cls ? " " + cls : "");
      }

      function freePairs() {
        const free = tiles.filter((t) => !t.removed && isFree(t, tiles));
        const pairs = [];
        for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++) if (free[a].type.id === free[b].type.id) pairs.push([free[a], free[b]]);
        return pairs;
      }

      function update() {
        for (const t of tiles) {
          t.el.hidden = t.removed;
          t.el.classList.toggle("blocked", !t.removed && !isFree(t, tiles));
          t.el.classList.toggle("sel", t === selected);
          t.el.classList.remove("hint");
        }
        const left = tiles.filter((t) => !t.removed).length;
        const moves = freePairs().length;
        $("left").textContent = left;
        $("moves").textContent = moves;
        undoBtn.disabled = history.length === 0;
        if (left === 0) {
          over = true; stopTimer();
          setInfo(`ALLE STEINE ABGERÄUMT in ${fmt(seconds)} ✓`, "win");
        } else if (moves === 0) {
          setInfo("Keine Züge mehr möglich – mache Schritte rückgängig oder starte neu.", "error");
        }
      }

      function shake(el) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }

      function clickTile(t) {
        if (over || t.removed) return;
        if (!isFree(t, tiles)) { shake(t.el); return; }
        if (selected === t) { selected = null; update(); return; }
        if (selected && selected.type.id === t.type.id) {
          selected.removed = t.removed = true;
          history.push([selected, t]);
          selected = null;
          startTimer(); // Zeit läuft ab dem ersten abgeräumten Paar
          setInfo(`${history.length} Paar${history.length === 1 ? "" : "e"} abgeräumt`);
          update();
          return;
        }
        selected = t;
        update();
      }

      function undo() {
        const last = history.pop();
        if (!last) return;
        last.forEach((t) => (t.removed = false));
        selected = null;
        if (over) { over = false; if (started) { started = false; startTimer(); } }
        setInfo(history.length ? `Rückgängig – ${history.length} Paar${history.length === 1 ? "" : "e"} abgeräumt` : "Rückgängig – Ausgangsstellung");
        update();
      }

      function hint() {
        const p = freePairs();
        if (!p.length) return;
        const [a, b] = p[Math.floor(Math.random() * p.length)];
        [a, b].forEach((t) => { t.el.classList.remove("hint"); void t.el.offsetWidth; t.el.classList.add("hint"); });
      }

      // Brett an die Fenstergröße anpassen
      function fit() {
        const s = Math.max(0.3, Math.min(viewport.clientWidth / boardW, viewport.clientHeight / boardH, 1.4));
        board.style.transform = `scale(${s})`;
        board.style.left = Math.max(0, (viewport.clientWidth - boardW * s) / 2) + "px";
        board.style.top = Math.max(0, (viewport.clientHeight - boardH * s) / 2) + "px";
      }
      const ro = new ResizeObserver(fit);
      ro.observe(viewport);

      body.querySelector(".game-tools").addEventListener("click", (e) => {
        const act = e.target.closest("button[data-act]")?.dataset.act;
        if (act === "undo") undo();
        if (act === "hint") hint();
        if (act === "new") newGame();
      });
      // Strg+Z wird vom OS nicht weitergereicht – daher eigener Listener am Fenster
      body.closest(".win")?.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      });

      newGame();

      return {
        onKey(e) {
          const k = e.key.toLowerCase();
          if (k === "u" || k === "backspace") { undo(); return true; }
          if (k === "h") { hint(); return true; }
          if (k === "escape" && selected) { selected = null; update(); return true; }
          return false;
        },
        destroy() { stopTimer(); ro.disconnect(); },
      };
    },
  };
  window.Apps.mahjong._deal = deal;
  window.Apps.mahjong._layout = buildLayout;
  window.Apps.mahjong._isFree = isFree;
})();
