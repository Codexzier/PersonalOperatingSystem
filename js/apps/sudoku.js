/* Sudoku – Generator mit eindeutiger Lösung, Timer startet mit der ersten Eingabe */
(function () {
  "use strict";

  const LEVELS = { easy: { label: "Leicht", holes: 38 }, medium: { label: "Mittel", holes: 48 }, hard: { label: "Schwer", holes: 55 } };

  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rowOf = (i) => Math.floor(i / 9), colOf = (i) => i % 9;
  const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

  function canPlace(g, i, v) {
    const r = rowOf(i), c = colOf(i), br = r - (r % 3), bc = c - (c % 3);
    for (let k = 0; k < 9; k++) {
      if (g[r * 9 + k] === v || g[k * 9 + c] === v) return false;
      if (g[(br + Math.floor(k / 3)) * 9 + bc + (k % 3)] === v) return false;
    }
    return true;
  }

  // Füllt das Gitter per Backtracking (zufällige Reihenfolge)
  function fill(g) {
    const i = g.indexOf(0);
    if (i < 0) return true;
    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (canPlace(g, i, v)) { g[i] = v; if (fill(g)) return true; g[i] = 0; }
    }
    return false;
  }

  // Zählt Lösungen bis zum Limit (für die Eindeutigkeitsprüfung)
  function countSolutions(g, limit = 2) {
    let best = -1, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      let n = 0;
      for (let v = 1; v <= 9; v++) if (canPlace(g, i, v)) n++;
      if (n < bestCount) { best = i; bestCount = n; if (n <= 1) break; }
    }
    if (best < 0) return 1;
    let total = 0;
    for (let v = 1; v <= 9 && total < limit; v++) {
      if (canPlace(g, best, v)) { g[best] = v; total += countSolutions(g, limit - total); g[best] = 0; }
    }
    return total;
  }

  function generate(holes) {
    const solution = new Array(81).fill(0);
    fill(solution);
    const puzzle = solution.slice();
    let removed = 0;
    for (const i of shuffle([...Array(81).keys()])) {
      if (removed >= holes) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle.slice()) !== 1) puzzle[i] = keep;
      else removed++;
    }
    return { puzzle, solution };
  }

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  window.Apps = window.Apps || {};
  window.Apps.sudoku = {
    title: "Sudoku",
    short: "SDKU",
    icon: "#",
    width: 460,
    height: 600,
    mount(body) {
      body.innerHTML = `
        <div class="game sudoku">
          <div class="game-bar">
            <div class="game-timer" title="Spielzeit"><span class="w-label">ZEIT</span><b data-ref="time">00:00</b></div>
            <div class="game-info" data-ref="info">Bereit – Timer startet mit der ersten Eingabe</div>
          </div>
          <div class="game-tools">
            <select data-ref="level" aria-label="Schwierigkeit">
              ${Object.entries(LEVELS).map(([k, l]) => `<option value="${k}"${k === "medium" ? " selected" : ""}>${l.label}</option>`).join("")}
            </select>
            <button data-act="new">Neues Spiel</button>
            <button data-act="notes" aria-pressed="false" title="Notizen (N)">✎ Notizen</button>
          </div>
          <div class="sdk-wrap"><div class="sdk-grid" data-ref="grid" role="grid" aria-label="Sudoku-Feld"></div></div>
          <div class="sdk-pad" data-ref="pad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-n="${n}">${n}</button>`).join("")}
            <button data-n="0" title="Löschen">⌫</button>
          </div>
        </div>`;
      const $ = (r) => body.querySelector(`[data-ref="${r}"]`);
      const gridEl = $("grid"), timeEl = $("time"), infoEl = $("info"), levelEl = $("level");
      const notesBtn = body.querySelector('[data-act="notes"]');

      let puzzle, solution, values, notes, selected = -1, cells = [];
      let seconds = 0, timer = null, started = false, solved = false, notesMode = false;

      function stopTimer() { clearInterval(timer); timer = null; }
      function startTimer() {
        if (started) return;
        started = true;
        timer = setInterval(() => { seconds++; timeEl.textContent = fmt(seconds); }, 1000);
      }

      function newGame() {
        stopTimer();
        started = false; solved = false; seconds = 0; selected = -1;
        timeEl.textContent = "00:00";
        infoEl.textContent = "Generiere …";
        infoEl.classList.remove("win");
        // Generator kurz verzögern, damit die Statusanzeige sichtbar wird
        setTimeout(() => {
          ({ puzzle, solution } = generate(LEVELS[levelEl.value].holes));
          values = puzzle.slice();
          notes = Array.from({ length: 81 }, () => new Set());
          build();
          infoEl.textContent = `${LEVELS[levelEl.value].label} · Timer startet mit der ersten Eingabe`;
        }, 10);
      }

      function build() {
        gridEl.innerHTML = "";
        cells = [];
        for (let i = 0; i < 81; i++) {
          const c = document.createElement("button");
          c.className = "sdk-cell";
          c.setAttribute("role", "gridcell");
          c.dataset.i = i;
          if (colOf(i) % 3 === 2 && colOf(i) < 8) c.classList.add("br");
          if (rowOf(i) % 3 === 2 && rowOf(i) < 8) c.classList.add("bb");
          if (puzzle[i]) c.classList.add("given");
          gridEl.appendChild(c);
          cells.push(c);
        }
        render();
      }

      function render() {
        const selVal = selected >= 0 ? values[selected] : 0;
        for (let i = 0; i < 81; i++) {
          const c = cells[i], v = values[i];
          if (v) c.textContent = v;
          else if (notes[i].size) {
            c.innerHTML = `<span class="sdk-notes">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<i>${notes[i].has(n) ? n : ""}</i>`).join("")}</span>`;
          } else c.textContent = "";
          const peer = selected >= 0 && (rowOf(i) === rowOf(selected) || colOf(i) === colOf(selected) || boxOf(i) === boxOf(selected));
          c.classList.toggle("sel", i === selected);
          c.classList.toggle("peer", peer && i !== selected);
          c.classList.toggle("same", !!selVal && v === selVal && i !== selected);
          c.classList.toggle("conflict", !!v && hasConflict(i));
          c.setAttribute("aria-label", `Zeile ${rowOf(i) + 1}, Spalte ${colOf(i) + 1}: ${v || "leer"}`);
        }
      }

      function hasConflict(i) {
        const v = values[i];
        for (let j = 0; j < 81; j++) {
          if (j !== i && values[j] === v && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) return true;
        }
        return false;
      }

      function input(n) {
        if (solved || selected < 0 || puzzle[selected]) return;
        if (notesMode && n) {
          values[selected] = 0;
          notes[selected].has(n) ? notes[selected].delete(n) : notes[selected].add(n);
        } else {
          values[selected] = values[selected] === n ? 0 : n;
          if (n) {
            notes[selected].clear();
            // Notizen dieser Zahl bei Nachbarn entfernen
            for (let j = 0; j < 81; j++) {
              if (rowOf(j) === rowOf(selected) || colOf(j) === colOf(selected) || boxOf(j) === boxOf(selected)) notes[j].delete(n);
            }
          }
        }
        if (n) startTimer(); // Zeitzähler beginnt mit der ersten Eingabe
        render();
        checkWin();
      }

      function checkWin() {
        if (values.every((v, i) => v === solution[i])) {
          solved = true;
          stopTimer();
          selected = -1;
          render();
          gridEl.classList.add("solved");
          setTimeout(() => gridEl.classList.remove("solved"), 1200);
          infoEl.textContent = `GELÖST in ${fmt(seconds)} ✓`;
          infoEl.classList.add("win");
        }
      }

      function select(i) { selected = i; render(); cells[i]?.focus({ preventScroll: true }); }

      gridEl.addEventListener("click", (e) => {
        const c = e.target.closest(".sdk-cell");
        if (c) select(+c.dataset.i);
      });
      body.querySelector(".sdk-pad").addEventListener("click", (e) => {
        const b = e.target.closest("button[data-n]");
        if (b) input(+b.dataset.n);
      });
      body.querySelector('[data-act="new"]').addEventListener("click", newGame);
      levelEl.addEventListener("change", newGame);
      function toggleNotes() {
        notesMode = !notesMode;
        notesBtn.setAttribute("aria-pressed", String(notesMode));
        notesBtn.classList.toggle("on", notesMode);
      }
      notesBtn.addEventListener("click", toggleNotes);

      newGame();

      return {
        onKey(e) {
          if (!cells.length) return false;
          if (/^[1-9]$/.test(e.key)) { input(+e.key); return true; }
          if (["0", "Backspace", "Delete"].includes(e.key)) { input(0); return true; }
          if (e.key.toLowerCase() === "n") { toggleNotes(); return true; }
          const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
          if (moves[e.key] !== undefined) {
            if (selected < 0) { select(0); return true; }
            const r = rowOf(selected), c = colOf(selected);
            if (e.key === "ArrowUp") select(((r + 8) % 9) * 9 + c);
            if (e.key === "ArrowDown") select(((r + 1) % 9) * 9 + c);
            if (e.key === "ArrowLeft") select(r * 9 + (c + 8) % 9);
            if (e.key === "ArrowRight") select(r * 9 + (c + 1) % 9);
            return true;
          }
          return false;
        },
        destroy() { stopTimer(); },
      };
    },
  };
  window.Apps.sudoku._generate = generate; // für Tests
})();
