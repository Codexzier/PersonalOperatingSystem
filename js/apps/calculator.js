/* Taschenrechner – sicherer Ausdrucksparser (kein eval) */
(function () {
  "use strict";

  function tokenize(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        let n = "";
        while (i < src.length && /[0-9.]/.test(src[i])) n += src[i++];
        if ((n.match(/\./g) || []).length > 1 || n === ".") throw new Error("Zahl ungültig");
        tokens.push({ t: "num", v: parseFloat(n) });
        continue;
      }
      if ("+-*/%()".includes(c)) { tokens.push({ t: c }); i++; continue; }
      throw new Error("Zeichen ungültig");
    }
    return tokens;
  }

  // Grammatik: expr = term (("+"|"-") term)* ; term = factor (("*"|"/"|"%") factor)* ;
  // factor = ("+"|"-") factor | primary ; primary = num | "(" expr ")"
  function evaluate(src) {
    const tokens = tokenize(src);
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];

    function expr() {
      let v = term();
      while (peek() && (peek().t === "+" || peek().t === "-")) {
        const op = next().t;
        const r = term();
        v = op === "+" ? v + r : v - r;
      }
      return v;
    }
    function term() {
      let v = factor();
      while (peek() && (peek().t === "*" || peek().t === "/" || peek().t === "%")) {
        const op = next().t;
        const r = factor();
        if ((op === "/" || op === "%") && r === 0) throw new Error("Division durch 0");
        v = op === "*" ? v * r : op === "/" ? v / r : v % r;
      }
      return v;
    }
    function factor() {
      const tk = peek();
      if (tk && (tk.t === "+" || tk.t === "-")) { next(); const v = factor(); return tk.t === "-" ? -v : v; }
      return primary();
    }
    function primary() {
      const tk = next();
      if (!tk) throw new Error("Unvollständig");
      if (tk.t === "num") return tk.v;
      if (tk.t === "(") {
        const v = expr();
        if (!peek() || peek().t !== ")") throw new Error("Klammer fehlt");
        next();
        return v;
      }
      throw new Error("Syntaxfehler");
    }

    if (!tokens.length) return 0;
    const result = expr();
    if (pos < tokens.length) throw new Error("Syntaxfehler");
    if (!isFinite(result)) throw new Error("Überlauf");
    return result;
  }

  function format(n) {
    const rounded = Math.round(n * 1e12) / 1e12;
    if (Math.abs(rounded) >= 1e15 || (Math.abs(rounded) < 1e-9 && rounded !== 0)) {
      return rounded.toExponential(8).replace(".", ",");
    }
    return rounded.toLocaleString("de-DE", { maximumFractionDigits: 10 });
  }

  const pretty = (s) => s.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−").replace(/\./g, ",");

  window.Apps = window.Apps || {};
  window.Apps.calculator = {
    title: "Taschenrechner",
    short: "CALC",
    icon: "±",
    width: 320,
    height: 440,
    mount(body) {
      body.appendChild(document.getElementById("tpl-calculator").content.cloneNode(true));
      const exprEl = body.querySelector('[data-ref="expr"]');
      const resEl = body.querySelector('[data-ref="result"]');
      let input = "";
      let justEvaluated = false;

      function render(preview = true) {
        exprEl.textContent = input ? pretty(input) : " ";
        resEl.classList.remove("error");
        if (!preview) return;
        try { resEl.textContent = format(evaluate(input)); }
        catch { /* während der Eingabe unvollständige Ausdrücke ignorieren */ }
      }

      function press(k) {
        if (k === "C") { input = ""; resEl.textContent = "0"; justEvaluated = false; render(false); return; }
        if (k === "⌫") { input = input.slice(0, -1); justEvaluated = false; render(); if (!input) resEl.textContent = "0"; return; }
        if (k === "=") {
          if (!input) return;
          try {
            const r = evaluate(input);
            exprEl.textContent = pretty(input) + " =";
            resEl.textContent = format(r);
            resEl.classList.remove("error");
            input = String(Math.round(r * 1e12) / 1e12);
            justEvaluated = true;
          } catch (e) {
            resEl.textContent = e.message;
            resEl.classList.add("error");
          }
          return;
        }
        // nach "=" startet eine Ziffer eine neue Rechnung, ein Operator rechnet weiter
        if (justEvaluated && /[0-9.(]/.test(k)) input = "";
        justEvaluated = false;
        if (input.length > 120) return;
        input += k;
        render();
      }

      body.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-k]");
        if (b) press(b.dataset.k);
      });

      const keyMap = { Enter: "=", "=": "=", Backspace: "⌫", Escape: "C", Delete: "C", ",": ".", x: "*", X: "*" };
      return {
        onKey(e) {
          let k = keyMap[e.key] || e.key;
          if (!/^[0-9.+\-*/%()=C⌫]$/.test(k)) return false;
          press(k);
          const btn = body.querySelector(`button[data-k="${CSS.escape(k)}"]`);
          if (btn) { btn.classList.add("pressed"); setTimeout(() => btn.classList.remove("pressed"), 110); }
          return true;
        },
      };
    },
  };

  window.Apps.calculator._evaluate = evaluate; // für Tests
})();
