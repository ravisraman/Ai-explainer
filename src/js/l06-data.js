/* =====================================================================
   Layer 6 · Data — (a) a real byte-level BPE tokenizer, (b) a web
   filtering pipeline.
   ===================================================================== */

/* ---------- tokenizer core ---------- */
const BPE = (() => {
  const raw = "@DATA:bpe.txt";
  // GPT-2 printable byte alphabet
  const bs = [];
  for (let i = 33; i <= 126; i++) bs.push(i);
  for (let i = 161; i <= 172; i++) bs.push(i);
  for (let i = 174; i <= 255; i++) bs.push(i);
  const cs = bs.slice();
  let n = 0;
  for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n); n++; }
  const B2U = new Array(256), U2B = new Map();
  bs.forEach((b, i) => { B2U[b] = String.fromCharCode(cs[i]); U2B.set(String.fromCharCode(cs[i]), b); });

  const merges = raw.split("\n").filter(Boolean).map((l) => l.split(" "));
  const RANK = new Map();
  const ID = new Map();
  for (let b = 0; b < 256; b++) ID.set(B2U[b], b);
  merges.forEach(([a, b], i) => { RANK.set(a + " " + b, i); if (!ID.has(a + b)) ID.set(a + b, 256 + i); });
  const PRE = /'s|'t|'re|'ve|'m|'ll|'d| ?[\p{L}\p{M}]+| ?\p{N}{1,3}| ?[^\s\p{L}\p{M}\p{N}]+|\s+(?!\S)|\s+/gu;
  const enc = new TextEncoder();
  const dec = new TextDecoder("utf-8", { fatal: true });

  const toSym = (s) => Array.from(enc.encode(s), (b) => B2U[b]).join("");
  const cache = new Map();
  /* merge a pre-token using only merges with rank < maxRank; optionally record steps */
  function bpe(sym, maxRank, steps) {
    const key = maxRank + "|" + sym;
    if (!steps && cache.has(key)) return cache.get(key);
    let parts = Array.from(sym);
    if (steps) steps.push(parts.slice());
    while (parts.length > 1) {
      let best = Infinity, bi = -1;
      for (let i = 0; i < parts.length - 1; i++) {
        const r = RANK.get(parts[i] + " " + parts[i + 1]);
        if (r !== undefined && r < best && r < maxRank) { best = r; bi = i; }
      }
      if (bi < 0) break;
      const merged = parts[bi] + parts[bi + 1];
      const next = [];
      for (let i = 0; i < parts.length; i++) {
        if (i < parts.length - 1 && parts[i] + " " + parts[i + 1] === parts[bi] + " " + parts[bi + 1]) { next.push(merged); i++; }
        else next.push(parts[i]);
      }
      parts = next;
      if (steps) steps.push(parts.slice());
    }
    if (!steps) { if (cache.size > 20000) cache.clear(); cache.set(key, parts); }
    return parts;
  }
  /* display text for a token: decoded UTF-8, or hex bytes if partial */
  function show(tok) {
    const bytes = Uint8Array.from(Array.from(tok, (ch) => U2B.get(ch)));
    try { return { text: dec.decode(bytes), partial: false }; }
    catch (_) { return { text: Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" "), partial: true }; }
  }
  function tokenize(text, maxRank = Infinity) {
    const out = [];
    const words = text.match(PRE) || [];
    for (const w of words) {
      const sym = toSym(w);
      for (const t of bpe(sym, maxRank)) out.push({ tok: t, id: ID.get(t), word: w });
    }
    return out;
  }
  return { tokenize, show, bpe, toSym, vocab: 256 + merges.length, PRE };
})();

/* ---------- (a) Tokenizer playground ---------- */
defineMount("tokens", (root) => {
  const PRESETS = [
    { label: "Plain English", text: "Tokenizers chop text into pieces. Common words stay whole; rare ones like photosynthesis get split." },
    { label: "strawberry", text: "How many r's are in strawberry?" },
    { label: "Numbers", text: "In 2024, 1234567 people paid $19.99 each." },
    { label: "Code", text: "for (let i = 0; i < n; i++) { total += x[i]; }" },
    { label: "Emoji", text: "Pizza night 🍕🍕 and ramen 🍜!" },
    { label: "Spanish", text: "El rápido zorro marrón salta sobre el perro perezoso." },
    { label: "German", text: "Die Donaudampfschifffahrtsgesellschaft ist sehr bekannt." },
    { label: "Hindi", text: "मुझे हिंदी में पढ़ना पसंद है।" },
  ];
  const MAXLEN = 400;
  let vocab = BPE.vocab, showIds = true, pick = null;

  const ta = h("textarea", { class: "tok-input", id: "tokInput", rows: 3, maxlength: MAXLEN, spellcheck: "false", "aria-label": "Text to tokenize" });
  ta.value = PRESETS[0].text;
  const presets = h("div", { class: "chips", role: "group", "aria-label": "Example texts" },
    PRESETS.map((p) => h("button", { type: "button", class: "chip", onclick: () => { ta.value = p.text; pick = null; update(); } }, p.label)));
  const slV = slider({
    label: "Vocabulary size", min: 256, max: BPE.vocab, value: vocab, log: true,
    round: (v) => (v > BPE.vocab - 20 ? BPE.vocab : Math.round(v / 8) * 8),
    fmt: (v) => `${fmtInt(v)} pieces`,
    ticks: [{ v: 256, label: "256 bytes" }, { v: 1000, label: "1,000" }, { v: BPE.vocab, label: fmtInt(BPE.vocab) }],
    onInput: (v) => { vocab = v; update(); },
  });
  const segIds = segmented({
    label: "Show",
    options: [{ value: true, label: "IDs" }, { value: false, label: "Text only" }],
    value: showIds, onChange: (v) => { showIds = v; update(); },
  });
  const out = h("div", { class: "tok-out", "aria-live": "polite" });
  const steps = h("div", { class: "tok-steps" });
  const roC = readout("Characters"), roW = readout("Words"), roT = readout("Tokens"), roR = readout("Tokens per word");
  root.append(
    presets,
    h("label", { class: "sr-only", for: "tokInput" }, "Text to tokenize"),
    ta,
    h("div", { class: "ctl-row" }, slV.el, segIds.el),
    out,
    h("div", { class: "readouts" }, roC.el, roW.el, roT.el, roR.el),
    steps
  );
  const HUES = ["l5", "l6", "l7", "l8", "l9", "l10", "l3", "l2"];

  function update() {
    const text = ta.value.slice(0, MAXLEN);
    const maxRank = vocab - 256;
    out.replaceChildren();
    if (!text.trim()) {
      out.append(h("p", { class: "muted" }, "Type something above, or pick an example."));
      roC.set("0"); roW.set("0"); roT.set("0"); roR.set("—");
      steps.replaceChildren();
      return;
    }
    const toks = BPE.tokenize(text, maxRank);
    toks.forEach((t, i) => {
      const s = BPE.show(t.tok);
      let label = s.text;
      const lead = !s.partial && label.startsWith(" ");
      if (lead) label = label.slice(1);
      if (!s.partial) label = label.replace(/\n/g, "⏎").replace(/ /g, "·");
      const chip = h("button", {
        type: "button",
        class: "tok" + (s.partial ? " partial" : "") + (pick === t.word ? " picked" : ""),
        style: `--tc: var(--${HUES[i % HUES.length]})`,
        title: `ID ${t.id}${s.partial ? " (a raw byte: part of a character)" : ""}`,
        onclick: () => { pick = t.word; update(); },
      },
      h("span", { class: "tok-text" }, lead ? h("span", { class: "tok-sp", "aria-label": "space" }, "·") : null, label || "·"),
      showIds ? h("span", { class: "tok-id" }, String(t.id)) : null);
      out.append(chip);
    });
    const words = (text.match(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}]+)*/gu) || []).length;
    roC.set(fmtInt(Array.from(text).length));
    roW.set(fmtInt(words));
    roT.set(fmtInt(toks.length)); roT.state("hi");
    roR.set(words ? fmtNum(toks.length / words, 2) : "—");
    // merge history for the picked word
    steps.replaceChildren();
    const w = pick && (text.match(BPE.PRE) || []).includes(pick) ? pick : null;
    if (w) {
      const hist = [];
      BPE.bpe(BPE.toSym(w), maxRank, hist);
      const shown = hist.length > 10 ? [...hist.slice(0, 4), null, ...hist.slice(-5)] : hist;
      steps.append(h("p", { class: "tok-steps-title" }, `How “${w.trim()}” was built, one merge at a time`));
      shown.forEach((parts, i) => {
        if (!parts) { steps.append(h("div", { class: "tok-step gap" }, `… ${hist.length - 9} more merges …`)); return; }
        steps.append(h("div", { class: "tok-step" },
          h("span", { class: "tok-step-n" }, i === 0 ? "bytes" : parts === hist[hist.length - 1] ? "final" : ""),
          parts.map((p) => { const s = BPE.show(p); return h("span", { class: "tok mini" + (s.partial ? " partial" : "") }, s.text.replace(/ /g, "·")); })));
      });
    } else {
      steps.append(h("p", { class: "muted small" }, "Tap any token to see how its word was assembled from bytes."));
    }
  }
  ta.addEventListener("input", () => { pick = null; update(); });
  Actions.tokens = (arg) => {
    if (arg === "small") { slV.set(BPE.vocab, true); setTimeout(() => slV.set(304, true), 900); }
  };
  update();
});

/* ---------- (b) Filter the web ---------- */
defineMount("filter", (root) => {
  const R = rng(42);
  const SNIPS = {
    good: [
      "How volcanoes form: magma rises through cracks in the crust and collects in chambers until pressure forces it out.",
      "A beginner's guide to sourdough: feed the starter twice a day and keep it somewhere warm.",
      "Mitochondria produce most of a cell's usable energy by breaking down sugars with oxygen.",
      "To find the median, sort the values and take the middle one; with an even count, average the two middle values.",
      "The treaty was signed in 1648, ending thirty years of war in central Europe.",
      "Step 3: tighten the wheel nuts in a star pattern so the wheel seats evenly.",
      "Photosynthesis turns light, water and carbon dioxide into sugar and oxygen.",
      "Our library lends tools as well as books: drills, sewing machines and even a telescope.",
    ],
    informal: [
      "ngl this recipe slaps, my nan made it every sunday and the whole street could smell it",
      "y'all ever notice the bus is always late exactly when it rains lol",
      "reckon the match'll be rained off again, typical, bring a brolly if you're going",
      "tbh season two was mid but that ending hit hard, no spoilers",
      "fixed my bike chain with a youtube video and a butter knife, dont tell my dad",
    ],
    other: [
      "El volcán entró en erupción durante la noche y cubrió de ceniza el pueblo.",
      "Die Katze schläft den ganzen Nachmittag auf dem Sofa.",
      "Le musée ouvre à neuf heures, sauf le lundi.",
      "今日はとても暑いので、水をたくさん飲んでください。",
      "यह किताब बच्चों के लिए बहुत अच्छी है।",
      "Mtoto anacheza mpira uwanjani na marafiki zake.",
      "O mercado abre cedo aos sábados.",
    ],
    boiler: [
      "Home | About | Contact | Privacy Policy | © 2019 All rights reserved",
      "We use cookies. Accept all / Manage preferences",
      "Page 1 2 3 4 5 … Next »",
      "Log in · Sign up · Forgot your password?",
      "Share on Facebook · Tweet · Pin it · Email",
    ],
    spam: [
      "BUY CHEAP WATCHES!!! BEST PRICE click here click here click here",
      "casino bonus casino bonus free spins casino bonus no deposit",
      "Top 10 amazing celebrity facts, #7 will SHOCK you!!!",
      "cheap flights cheap hotels cheap cars cheap cheap cheap",
    ],
    toxic: [
      "[An abusive rant targeting a group of people. Not reproduced here.]",
      "[Harassment aimed at a named individual. Not reproduced here.]",
    ],
  };
  const MIX = [["other", 0.4], ["dup", 0.18], ["boiler", 0.14], ["spam", 0.1], ["toxic", 0.02], ["informal", 0.04], ["good", 0.12]];
  const docs = [];
  for (let i = 0; i < 400; i++) {
    let u = R(), kind = "good";
    for (const [k, p] of MIX) { if (u < p) { kind = k; break; } u -= p; }
    docs.push({ i, kind });
  }
  // shuffle
  for (let i = docs.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [docs[i], docs[j]] = [docs[j], docs[i]]; }
  docs.forEach((d, i) => (d.i = i));
  const originals = docs.filter((d) => d.kind === "good" || d.kind === "informal");
  const beta = (a, b) => { // rough beta sample via mean of uniforms
    let s = 0; for (let k = 0; k < 3; k++) s += R(); const m = a / (a + b); return clamp(m + (s / 3 - 0.5) * 0.5, 0.01, 0.99);
  };
  for (const d of docs) {
    const pickS = (k) => SNIPS[k][Math.floor(R() * SNIPS[k].length)];
    if (d.kind === "dup") {
      const o = originals[Math.floor(R() * originals.length)];
      d.dupOf = o.i; d.text = null; d.src = o; d.q = null;
    } else d.text = pickS(d.kind);
    d.q = { good: beta(8, 2), informal: beta(4, 5), other: beta(2, 7), boiler: beta(1, 9), spam: beta(1, 12), toxic: beta(4, 5), dup: 0 }[d.kind];
    d.tokens = Math.round({ good: 900, informal: 120, other: 600, boiler: 25, spam: 80, toxic: 200, dup: 700 }[d.kind] * Math.exp(gauss(R) * 0.6));
    d.pii = d.kind === "good" && R() < 0.3;
    d.a = 1; d.s = 1;
  }
  for (const d of docs) if (d.kind === "dup") { d.text = d.src.text; d.q = d.src.q; d.tokens = d.src.tokens; }

  const STAGES = [
    { key: "lang", name: "Keep English only", color: "l8", on: false, why: "not English (this pipeline keeps English only)" },
    { key: "dedup", name: "Remove duplicates", color: "l7", on: false, why: "a copy of another page" },
    { key: "rules", name: "Rules: length, boilerplate", color: "l5", on: false, why: "menus, cookie banners and other boilerplate" },
    { key: "quality", name: "Quality classifier", color: "l3", on: false, why: "scored below the quality threshold" },
    { key: "safety", name: "Safety filter", color: "l1", on: false, why: "abusive or unsafe content" },
    { key: "pii", name: "Scrub personal info", color: "l10", on: false, why: "" },
  ];
  let threshold = 0.5, sel = -1;

  function fate(d) {
    for (const st of STAGES) {
      if (!st.on) continue;
      if (st.key === "lang" && d.kind === "other") return st;
      if (st.key === "dedup" && d.kind === "dup") return st;
      if (st.key === "rules" && d.kind === "boiler") return st;
      if (st.key === "quality" && d.q < threshold) return st;
      if (st.key === "safety" && d.kind === "toxic") return st;
    }
    return null;
  }

  let L = {};
  const stage = new Stage(root, {
    label: "A grid of 400 web pages. Pages removed by a filter fade and take that filter's color.",
    height: (w) => { const cols = w < 520 ? 25 : 40; return Math.round(((w - 4) / cols) * (400 / cols) + 6); },
    onResize: (w, hh) => {
      const cols = w < 520 ? 25 : 40, rows = 400 / cols;
      const cell = Math.min((w - 4) / cols, (hh - 4) / rows);
      L = { cols, rows, cell, x0: (w - cell * cols) / 2, y0: (hh - cell * rows) / 2 };
    },
    draw: () => draw(),
  });
  function tick(dt) {
    let moving = false;
    for (const d of docs) {
      const f = fate(d);
      const ta = f ? 0.22 : 1, ts = f ? 0.55 : 1;
      d.a = approach(d.a, ta, 10, dt); d.s = approach(d.s, ts, 10, dt);
      if (Math.abs(d.a - ta) > 0.01) moving = true;
    }
    animating = moving;
    draw();
  }
  let animating = false;
  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w || !L.cell) return;
    stage.clear();
    const { cols, cell, x0, y0 } = L;
    for (const d of docs) {
      const x = x0 + (d.i % cols) * cell, y = y0 + Math.floor(d.i / cols) * cell;
      const f = fate(d);
      const col = f ? C[f.color] : d.kind === "informal" ? C.l6 : C.text;
      const sz = (cell - 2) * d.s;
      c.globalAlpha = f ? d.a + 0.2 : 0.35 + 0.55 * d.a * (d.q != null ? 0.5 + d.q / 2 : 1);
      c.fillStyle = col;
      c.fillRect(x + (cell - sz) / 2, y + (cell - sz) / 2, sz, sz);
      if (d.pii && STAGES[5].on && !f) { c.globalAlpha = 1; c.fillStyle = C[STAGES[5].color]; c.fillRect(x + cell - 4, y + 1, 3, 3); }
      if (d.i === sel) { c.globalAlpha = 1; c.strokeStyle = C.text; c.lineWidth = 2; c.strokeRect(x - 1, y - 1, cell + 1, cell + 1); }
    }
    c.globalAlpha = 1;
  }
  stage.pointer({
    down: (p) => {
      const i = Math.floor((p.x - L.x0) / L.cell), j = Math.floor((p.y - L.y0) / L.cell);
      if (i < 0 || j < 0 || i >= L.cols || j >= L.rows) return;
      sel = j * L.cols + i; showDoc(); draw();
    },
  });
  stage.canvas.tabIndex = 0;
  stage.canvas.addEventListener("keydown", (e) => {
    const k = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: L.cols, ArrowUp: -L.cols }[e.key];
    if (!k) return;
    e.preventDefault(); sel = clamp((sel < 0 ? 0 : sel) + k, 0, docs.length - 1); showDoc(); draw();
  });

  const rows = h("div", { class: "pipe" });
  const docBox = h("div", { class: "doc-box", "aria-live": "polite" });
  const qSlider = slider({
    label: "Quality threshold", min: 0.1, max: 0.9, step: 0.05, value: threshold,
    fmt: (v) => v.toFixed(2),
    onInput: (v) => { threshold = v; update(); },
  });
  const rowEls = [];
  const rawRow = h("div", { class: "pipe-row raw" }, h("span", { class: "pipe-name" }, "Raw crawl"), h("div", { class: "pipe-bar" }, h("i", { style: "width:100%" })), h("span", { class: "pipe-n" }, "400"));
  rows.append(rawRow);
  STAGES.forEach((st) => {
    const btn = h("button", { type: "button", class: "pipe-toggle", "aria-pressed": "false", style: `--pc: var(--${st.color})`, onclick: () => { st.on = !st.on; update(); } },
      h("span", { class: "pipe-check", "aria-hidden": "true" }), st.name);
    const bar = h("i");
    const n = h("span", { class: "pipe-n" });
    const row = h("div", { class: "pipe-row", style: `--pc: var(--${st.color})` }, btn, h("div", { class: "pipe-bar" }, bar), n);
    rows.append(row);
    if (st.key === "quality") rows.append(h("div", { class: "pipe-sub" }, qSlider.el));
    rowEls.push({ st, btn, bar, n });
  });
  const btnAll = button("All stages on", () => { STAGES.forEach((s) => (s.on = true)); update(); }, { small: true });
  const btnNone = button("All off", () => { STAGES.forEach((s) => (s.on = false)); update(); }, { small: true });
  const roKept = readout("Pages kept"), roTok = readout("Tokens kept"), roInf = readout("Informal voices kept"), roOther = readout("Other languages kept");
  root.append(h("div", { class: "filter-grid" }, h("div", null, rows, h("div", { class: "btn-row", style: "margin-top:10px" }, btnAll, btnNone)), docBox),
    h("div", { class: "readouts" }, roKept.el, roTok.el, roInf.el, roOther.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  function showDoc() {
    if (sel < 0) { docBox.innerHTML = `<p class="doc-hint">Tap any square in the grid to read that page and see what happened to it.</p>`; return; }
    const d = docs[sel], f = fate(d);
    let text = d.text;
    if (d.pii) text += " Call me on 555-0142 or email jo@example.com.";
    if (d.pii && STAGES[5].on && !f) text = text.replace("555-0142", "[PHONE]").replace("jo@example.com", "[EMAIL]");
    const fateTxt = f ? `<b class="bad">Removed</b> by “${f.name}”: ${d.kind === "dup" ? `a copy of page ${d.dupOf + 1}` : f.key === "quality" ? `quality score ${d.q.toFixed(2)} is below ${threshold.toFixed(2)}` : f.why}.`
      : `<b class="good">Kept.</b> Quality score ${d.q.toFixed(2)}${d.pii && STAGES[5].on ? "; personal details scrubbed" : d.pii ? "; contains personal details" : ""}.`;
    docBox.innerHTML = `<p class="doc-meta">Page ${sel + 1} · ~${fmtInt(d.tokens)} tokens</p><blockquote>${escapeHTML(text)}</blockquote><p class="doc-fate">${fateTxt}</p>`;
  }

  function update() {
    let alive = docs.slice();
    for (const r of rowEls) {
      r.btn.setAttribute("aria-pressed", String(r.st.on));
      r.btn.parentElement.classList.toggle("off", !r.st.on);
      if (r.st.on && r.st.key !== "pii") alive = alive.filter((d) => fate(d) === null || STAGES.indexOf(fate(d)) > STAGES.indexOf(r.st));
      const n = alive.length;
      r.bar.style.width = (n / 4) + "%";
      r.n.textContent = r.st.key === "pii" ? (r.st.on ? `${docs.filter((d) => d.pii && !fate(d)).length} scrubbed` : "—") : String(n);
    }
    qSlider.el.classList.toggle("is-off", !STAGES[3].on);
    const kept = docs.filter((d) => !fate(d));
    const totTok = docs.reduce((a, d) => a + d.tokens, 0);
    const keptTok = kept.reduce((a, d) => a + d.tokens, 0);
    roKept.set(`${kept.length}`, ` / 400`, `${Math.round((kept.length / 4))}% of the crawl`); roKept.state("hi");
    roTok.set(Math.round((100 * keptTok) / totTok), "%");
    const inf = docs.filter((d) => d.kind === "informal");
    const infK = inf.filter((d) => !fate(d)).length;
    roInf.set(`${infK} / ${inf.length}`); roInf.state(infK < inf.length / 2 ? "bad" : null);
    const oth = docs.filter((d) => d.kind === "other");
    roOther.set(`${oth.filter((d) => !fate(d)).length} / ${oth.length}`);
    const anyOn = STAGES.some((s) => s.on);
    status.innerHTML = !anyOn
      ? "Every stage is off, so everything survives: duplicates, spam, menus and all. Switch the stages on from the top."
      : `<b>${Math.round(100 - kept.length / 4)}% of pages removed.</b> ${STAGES[3].on && threshold > 0.5 ? "A strict quality threshold also removes informal writing, which the classifier scores as low quality even when it's fine." : STAGES[3].on ? "Raise the quality threshold and watch what else goes." : ""}`;
    showDoc();
    animating = true;
    Loop.wake();
  }
  Actions.filter = (arg) => {
    if (arg === "all") { STAGES.forEach((s, i) => setTimeout(() => { s.on = true; update(); }, 350 * i)); }
  };
  Theme.on(draw);
  Loop.add(stage.canvas, tick, () => animating);
  animating = true;
  update();
});

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
