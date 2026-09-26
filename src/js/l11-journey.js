/* =====================================================================
   Finale · Follow one prompt — a packet descends the stack and returns
   as an answer, with a running tally of time, operations, energy, cost.
   Model: ~70B dense parameters, 16-bit, on a shared 8-GPU server
   (~10 kW), batched with ~48 other requests, ~50 tokens/s per user.
   ===================================================================== */

defineMount("journey", (root) => {
  const P = 70e9, SERVER_W = 10000, BATCH = 48, TPS = 50, PUE = 1.2, NET = 0.08, QUEUE = 0.1;
  const RENT = 16; // $/hour for the 8-GPU server
  const PRESETS = {
    quick: { label: "A quick question", prompt: "Why is the sky blue?", tin: 600, tout: 300, answer: "Sunlight contains every color. Air molecules scatter short, blue wavelengths far more than long, red ones, so blue light reaches your eyes from all across the sky." },
    essay: { label: "An essay", prompt: "Write a 1,000-word essay on the history of the printing press.", tin: 650, tout: 1500, answer: "The printing press did not appear from nowhere. Block printing had spread across East Asia for centuries before Johannes Gutenberg… (about 1,000 more words)" },
    reason: { label: "A hard reasoning problem", prompt: "Plan a 3-day trip to Kyoto under $900, with trains, food and two temples a day.", tin: 650, tout: 8000, answer: "Day 1: arrive at Kyoto Station, drop bags, then Fushimi Inari in the late afternoon… (after ~7,000 tokens of hidden reasoning)" },
  };
  let preset = "quick";
  const pr = () => PRESETS[preset];
  const prefillOps = () => 2 * P * pr().tin;
  const decodeOps = () => 2 * P * pr().tout;
  const prefillTime = () => prefillOps() / (8e15 * 0.4);
  const decodeTime = () => pr().tout / TPS;
  const share = SERVER_W / BATCH; // watts attributable to this request
  const wh = (sec) => (share * sec * PUE) / 3600;

  /* stops: layer, title, text(), and what they add to the tally */
  const STOPS = [
    { n: 10, dir: "down", title: "You hit Enter", text: () => `The app wraps “${pr().prompt}” in hidden instructions and the chat so far, about ${fmtInt(pr().tin)} tokens in all, and sends it to a data center.`, add: () => ({ t: NET }) },
    { n: 9, dir: "down", title: "A scheduler takes the request", text: () => `Your request joins a batch of about ${BATCH} others sharing one 8-GPU server. First comes “prefill”: reading all ${fmtInt(pr().tin)} tokens at once.`, add: () => ({ t: QUEUE }) },
    { n: 8, dir: "down", title: "Nothing is learned here", text: () => "The model's weights were fixed months ago by a training run that used on the order of 10²⁵ operations. Answering you doesn't change them.", add: () => ({}) },
    { n: 7, dir: "down", title: "Through the model", text: () => `Each token becomes a vector and flows through ~80 layers of attention and feed-forward math: about 2 × 70 billion operations per token, ${fmtSci(prefillOps(), 2)} for the prompt.`, add: () => ({ ops: prefillOps(), t: prefillTime(), tokens: pr().tin }) },
    { n: 6, dir: "down", title: "Your words are numbers now", text: () => "The tokenizer turned your question into IDs like these (the page's own small tokenizer):", tokens: true, add: () => ({}) },
    { n: 5, dir: "down", title: "Software fans it out", text: () => "Thousands of GPU kernels run for every token. Each layer is split across the 8 GPUs (tensor parallelism), which swap partial results over their fast links.", add: () => ({}) },
    { n: 4, dir: "down", title: "Chips do the math", text: () => "Tensor cores multiply the matrices. For every new word, the GPUs stream ~140 GB of weights from memory, so memory speed, not math, sets the pace.", add: () => ({}) },
    { n: 3, dir: "down", title: "Transistors switch", text: () => "About 640 billion transistors across the 8 GPUs (80 billion each, H100-class) switch on and off up to about two billion times a second.", add: () => ({}) },
    { n: 2, dir: "down", title: "Inside a rack, inside a hall", text: () => "The server sits in a rack beside hundreds of others in the hall. Your request uses a sliver of one of them for a few seconds.", add: () => ({}) },
    { n: 1, dir: "down", title: "Electricity in, heat out", text: () => `The server draws ~10 kW. Split across the batch, your share is ~${fmtInt(share)} W, plus ~20% for cooling. Every watt ends up as heat.`, add: () => ({ wh: wh(prefillTime() + QUEUE) }) },
    { n: 9, dir: "up", title: "Writing the answer, one token at a time", text: () => `Now “decode”: ${fmtInt(pr().tout)} tokens, each a full pass through all 80 layers, at about ${TPS} tokens per second${pr().tout > 3000 ? ". Most of these are hidden “reasoning” tokens you never see" : ""}.`, add: () => ({ ops: decodeOps(), t: decodeTime(), tokens: pr().tout, wh: wh(decodeTime()) }) },
    { n: 6, dir: "up", title: "Numbers back to words", text: () => "Each token ID is turned back into text as soon as it's chosen, so the answer can stream.", add: () => ({}) },
    { n: 10, dir: "up", title: "The answer appears", text: () => pr().answer, answer: true, add: () => ({ t: NET }) },
  ];
  let i = 0, playing = false, dwell = 0, anim = 1;
  let shown = { t: 0, ops: 0, wh: 0, tokens: 0 };

  const totals = (upto) => {
    const s = { t: 0, ops: 0, wh: 0, tokens: 0 };
    for (let k = 0; k <= upto; k++) { const a = STOPS[k].add(); for (const key in a) s[key] += a[key]; }
    return s;
  };

  /* ---------- layout ---------- */
  const stackWrap = h("div", { class: "jr-stack" });
  const stage = new Stage(stackWrap, {
    label: "The ten-layer stack with a packet moving between layers.",
    height: () => clamp(stackWrap.clientWidth * 3.2, 380, 520),
    draw: () => draw(),
  });
  const card = h("div", { class: "jr-card", "aria-live": "polite" });
  const dots = h("div", { class: "jr-dots", role: "group", "aria-label": "Stops" });
  STOPS.forEach((s, k) => dots.append(h("button", { type: "button", class: "jr-dot", "aria-label": `Stop ${k + 1}: ${s.title}`, onclick: () => go(k) })));
  const bPrev = button("", () => go(i - 1), { icon: "back", small: true, aria: "Previous stop" });
  const bPlay = button("Play", () => { playing = !playing; if (playing && i >= STOPS.length - 1) go(0); syncPlay(); Loop.wake(); }, { kind: "primary", icon: "play" });
  const bNext = button("", () => go(i + 1), { icon: "step", small: true, aria: "Next stop" });
  const syncPlay = () => bPlay.setLabel(playing ? "Pause" : "Play", playing ? "pause" : "play");
  const segP = segmented({
    label: "The prompt",
    options: Object.entries(PRESETS).map(([k, v]) => ({ value: k, label: v.label })),
    value: preset, onChange: (v) => { preset = v; go(0); },
  });
  const roT = readout("Time"), roTok = readout("Tokens"), roOps = readout("Operations"), roE = readout("Energy (rough)"), roC = readout("Cost to run");
  const cmp = h("p", { class: "jr-cmp" });
  root.append(
    h("div", { class: "ctl-row" }, segP.el),
    h("div", { class: "jr-grid" }, stackWrap, h("div", { class: "jr-right" }, card, h("div", { class: "jr-nav" }, bPrev, bPlay, bNext, dots))),
    h("div", { class: "readouts" }, roT.el, roTok.el, roOps.el, roE.el, roC.el),
    cmp
  );

  function renderCard() {
    const s = STOPS[i];
    const L = LAYERS[s.n - 1];
    card.style.setProperty("--c", `var(--l${s.n})`);
    card.replaceChildren(
      h("p", { class: "jr-kicker" }, `${s.dir === "down" ? "↓" : "↑"} Layer ${s.n} · ${L.name}`),
      h("h3", { class: "jr-title" }, s.title),
      h("p", { class: "jr-text" }, s.text())
    );
    if (s.tokens) {
      const toks = BPE.tokenize(pr().prompt);
      card.append(h("div", { class: "tok-out jr-toks" }, toks.map((t, k) => { const sh = BPE.show(t.tok); return h("span", { class: "tok", style: `--tc: var(--${["l5", "l6", "l7", "l8", "l9", "l10"][k % 6]})` }, h("span", { class: "tok-text" }, sh.text.replace(/^ /, "·")), h("span", { class: "tok-id" }, String(t.id))); })));
      card.append(h("p", { class: "jr-text small muted" }, `${toks.length} tokens for your question; the hidden instructions add the rest.`));
    }
    if (s.answer) card.append(h("blockquote", { class: "jr-answer" }, pr().answer));
    $$(".jr-dot", dots).forEach((d, k) => { d.classList.toggle("on", k === i); d.classList.toggle("past", k < i); d.setAttribute("aria-current", k === i ? "step" : "false"); });
    bPrev.disabled = i === 0;
    bNext.disabled = i === STOPS.length - 1;
    // tally
    const tot = totals(i);
    const from = { ...shown };
    tween(0, 1, 700, (k) => {
      const cur = {};
      for (const key in tot) cur[key] = lerp(from[key], tot[key], k);
      paintTally(cur);
    });
    shown = tot;
  }
  function paintTally(v) {
    roT.set(v.t < 1 ? fmtNum(v.t * 1000, 2) : fmtNum(v.t, 2), v.t < 1 ? " ms" : " s");
    roTok.set(fmtInt(v.tokens));
    roOps.set(v.ops ? fmtSci(Math.max(1, v.ops), 2) : "0");
    roE.set(v.wh < 0.01 ? fmtNum(v.wh * 1000, 2) : fmtNum(v.wh, 2), v.wh < 0.01 ? " mWh" : " Wh");
    roC.set(fmtMoney((RENT / BATCH) * (v.t / 3600)), "", "share of server rental");
    const secMicro = (v.wh * 3600) / 1000, minLED = (v.wh * 60) / 10;
    cmp.innerHTML = v.wh > 0 ? `Energy so far is about the same as running a microwave for <b>${fmtNum(secMicro, 2)} seconds</b>, or a 10 W LED bulb for <b>${fmtNum(minLED, 2)} minutes</b>.` : "The tally fills in as the request travels.";
  }
  function go(k) {
    const n = clamp(k, 0, STOPS.length - 1);
    if (n !== i) { prevN = STOPS[i].n; anim = reducedMotion() ? 1 : 0; }
    i = n; dwell = 0;
    renderCard();
    Loop.wake();
  }
  let prevN = 10;
  const RATE = 1 / 0.9;
  function tick(dt) {
    if (anim < 1) anim = Math.min(1, anim + dt * RATE);
    if (playing && anim >= 1) {
      dwell += dt;
      if (dwell > 3.4) { if (i < STOPS.length - 1) go(i + 1); else { playing = false; syncPlay(); } }
    }
    t += dt;
    draw();
  }
  let t = 0;
  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w) return;
    stage.clear();
    const n = 10, pad = 10;
    const slabH = (stage.h - pad * 2) / n;
    const yOf = (layer) => pad + (n - layer) * slabH + slabH / 2;
    const cur = STOPS[i].n;
    for (let l = 1; l <= n; l++) {
      const y = yOf(l) - slabH / 2 + 3;
      const col = C["l" + l];
      const on = l === cur;
      c.fillStyle = on ? rgba(col, 0.9) : rgba(col, 0.18);
      roundRect(c, 8, y, stage.w - 16, slabH - 6, 6); c.fill();
      c.fillStyle = on ? C["on-accent"] : C.muted;
      c.font = `${on ? 700 : 600} ${stage.w < 130 ? 10 : 11}px ${Theme.mono}`;
      c.textAlign = "left";
      const name = stage.w < 130 ? String(l) : `${l} ${LAYERS[l - 1].name.toUpperCase()}`;
      c.fillText(name, 16, y + (slabH - 6) / 2 + 4);
    }
    // packet
    const e = easeInOut(anim);
    const py = lerp(yOf(prevN), yOf(cur), e);
    const px = stage.w - 22;
    const up = STOPS[i].dir === "up";
    c.fillStyle = up ? C.l10 : C.text;
    c.shadowColor = up ? C.l10 : C.text; c.shadowBlur = 14;
    c.beginPath(); c.arc(px, py, 6, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    if (up && anim >= 1 && STOPS[i].n === 9) {
      // tokens streaming upward
      for (let k = 0; k < 6; k++) {
        const f = ((t * 0.6 + k / 6) % 1);
        c.fillStyle = rgba(C.l10, 1 - f);
        c.fillRect(px - 3, lerp(yOf(9), yOf(10), f) - 3, 6, 6);
      }
    }
  }
  document.addEventListener("keydown", (ev) => {
    const r = root.getBoundingClientRect();
    if (r.top > window.innerHeight || r.bottom < 0) return;
    if (ev.target.closest && ev.target.closest("input, textarea, select")) return;
    if (!root.contains(document.activeElement)) return;
    if (ev.key === "ArrowRight") { go(i + 1); ev.preventDefault(); }
    if (ev.key === "ArrowLeft") { go(i - 1); ev.preventDefault(); }
  });
  Theme.on(draw);
  Loop.add(stackWrap, tick, () => playing || anim < 1 || STOPS[i].dir === "up");
  renderCard();
});
