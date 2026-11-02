/* Texteditor – Autosave im localStorage, Öffnen/Speichern als Datei */
(function () {
  "use strict";
  const KEY = "pos.editor";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
  }
  function store(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
  }

  window.Apps = window.Apps || {};
  window.Apps.editor = {
    title: "Texteditor",
    short: "EDIT",
    icon: "¶",
    width: 560,
    height: 420,
    mount(body, ctx) {
      body.appendChild(document.getElementById("tpl-editor").content.cloneNode(true));
      const $ = (r) => body.querySelector(`[data-ref="${r}"]`);
      const text = $("text"), name = $("name"), file = $("file"), stats = $("stats"), saved = $("saved");

      const initial = load();
      if (initial) { text.value = initial.text || ""; name.value = initial.name || "notiz.txt"; }

      let timer;
      function update() {
        const v = text.value;
        const lines = v ? v.split("\n").length : 1;
        const words = (v.trim().match(/\S+/g) || []).length;
        stats.textContent = `${v.length} Zeichen · ${words} Wörter · ${lines} Zeile${lines === 1 ? "" : "n"}`;
        ctx.setTitle(`Texteditor — ${name.value || "unbenannt"}`);
      }
      function autosave() {
        saved.textContent = "AUTOSAVE: …";
        clearTimeout(timer);
        timer = setTimeout(() => {
          saved.textContent = store({ text: text.value, name: name.value }) ? "AUTOSAVE: GESPEICHERT" : "AUTOSAVE: FEHLER";
        }, 400);
      }
      text.addEventListener("input", () => { update(); autosave(); });
      name.addEventListener("input", () => { update(); autosave(); });

      // Tab-Taste fügt Einrückung ein
      text.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const s = text.selectionStart, en = text.selectionEnd;
          text.setRangeText("  ", s, en, "end");
          text.dispatchEvent(new Event("input"));
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); download(); }
      });

      function download() {
        const blob = new Blob([text.value], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (name.value || "notiz.txt").replace(/[\\/:*?"<>|]/g, "_");
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }

      body.querySelector(".toolbar").addEventListener("click", (e) => {
        const act = e.target.closest("button")?.dataset.act;
        if (act === "new") {
          if (text.value && !confirm("Aktuellen Text verwerfen?")) return;
          text.value = ""; name.value = "notiz.txt"; update(); autosave(); text.focus();
        } else if (act === "open") {
          file.click();
        } else if (act === "save") {
          download();
        }
      });

      file.addEventListener("change", async () => {
        const f = file.files[0];
        if (!f) return;
        text.value = await f.text();
        name.value = f.name;
        file.value = "";
        update(); autosave();
      });

      update();
      setTimeout(() => text.focus(), 0);
      return { onFocus() { text.focus(); } };
    },
  };
})();
