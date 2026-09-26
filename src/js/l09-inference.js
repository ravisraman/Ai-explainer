/* =====================================================================
   Layer 9 · Inference — (a) next-word generator (trigram model trained
   in the browser), (b) context window, (c) KV cache.
   ===================================================================== */

/* ---------- (a) Pick the next word ---------- */
defineMount("gen", (root) => {
  const CORPUS = `the robot looked at the sea and smiled .
the robot looked at the stars and counted them .
the robot looked at the cat and waved .
the robot looked at the garden and saw a flower .
the robot looked at the sky and wondered why it was blue .
the robot walked to the sea every morning .
the robot walked to the garden with a small bucket .
the robot walked along the beach and collected shells .
the robot listened to the waves and felt calm .
the robot listened to the cat and learned to purr .
the robot counted the stars until the sun came up .
the robot counted the shells and put them in a row .
the robot planted a flower in the garden .
the robot planted a tree near the old house .
the robot painted the old house blue .
the robot painted the sky on a small canvas .
the robot wanted to see the sea .
the robot wanted to learn how to swim .
the robot wanted to understand why people laugh .
the robot wanted a friend .
the cat looked at the robot and yawned .
the cat followed the robot to the sea .
the cat slept in the garden all afternoon .
the cat slept on the warm roof of the old house .
the cat watched the birds in the garden .
the cat chased a leaf across the garden .
every night , the old cat climbed onto the roof .
every night , the old cat watched the stars .
every night , the robot told the cat a story .
every night , the robot counted the stars .
every morning , the robot opened the window and listened to the birds .
every morning , the cat waited by the door .
at the edge of the sea , the robot found a bottle .
at the edge of the sea , the water was cold and bright .
at the edge of the garden , there was a small gate .
at the edge of the town , there was an old lighthouse .
the sea was calm and blue .
the sea was loud and grey in the storm .
the sea was full of light at sunset .
the stars were bright above the old house .
the stars were hidden behind the clouds .
the sky was clear and the stars were bright .
the garden was quiet in the morning .
the garden was full of flowers and bees .
the old house had a red door and a small window .
the old lighthouse stood at the edge of the sea .
the robot found a bottle with a message inside .
the message said that someone was waiting across the sea .
the robot decided to build a boat .
the robot built a small boat from old wood .
the boat was small but it did not sink .
the robot and the cat sailed across the sea .
the robot and the cat watched the sunset together .
the robot and the cat became friends .
the wind was cold and the waves were high .
the waves carried the boat toward the lighthouse .
a bird landed on the boat and sang a song .
a bird sang in the garden every morning .
a small light blinked in the old lighthouse .
the light in the lighthouse was warm and bright .
the robot smiled at the light .
the robot was tired but happy .
the robot was curious about everything .
the robot was not sure what to do next .
the cat was not afraid of the sea .
the cat was hungry so the robot caught a fish .
in the morning , the sun rose over the sea .
in the morning , the garden was wet with rain .
in the evening , the robot sat by the window .
in the evening , the sky turned orange and pink .
they walked home slowly under the stars .
they sailed home slowly under the stars .
someone was waiting at the lighthouse with a lamp .
it was the old woman who wrote the message .
she smiled at the robot and opened the door .
the robot looked at the old woman and said hello .`;
  const toks = CORPUS.split(/\s+/).filter(Boolean);
  const uni = new Map(), bi = new Map(), tri = new Map(), biCtx = new Map(), triCtx = new Map();
  const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  for (let i = 0; i < toks.length; i++) {
    inc(uni, toks[i]);
    if (i >= 1) { inc(bi, toks[i - 1] + " " + toks[i]); inc(biCtx, toks[i - 1]); }
    if (i >= 2) { inc(tri, toks[i - 2] + " " + toks[i - 1] + " " + toks[i]); inc(triCtx, toks[i - 2] + " " + toks[i - 1]); }
  }
  const VOCAB = [...uni.keys()];
  const NTOK = toks.length;
  /* interpolated trigram: P(w | u v) */
  function dist(u, v) {
    const ctx3 = triCtx.get(u + " " + v) || 0, ctx2 = biCtx.get(v) || 0;
    let l3 = ctx3 ? 0.62 : 0, l2 = ctx2 ? 0.3 : 0, l1 = 0.08;
    const s = l3 + l2 + l1; l3 /= s; l2 /= s; l1 /= s;
    return VOCAB.map((w) => ({
      w,
      p: l3 * (ctx3 ? (tri.get(u + " " + v + " " + w) || 0) / ctx3 : 0) + l2 * (ctx2 ? (bi.get(v + " " + w) || 0) / ctx2 : 0) + l1 * (uni.get(w) / NTOK),
    })).sort((a, b) => b.p - a.p);
  }
  function shape(d, T, topP) {
    let q;
    if (T <= 0.001) q = d.map((x, i) => ({ ...x, q: i === 0 ? 1 : 0 }));
    else {
      const lg = d.map((x) => Math.log(x.p) / T);
      const m = Math.max(...lg);
      const e = lg.map((x) => Math.exp(x - m));
      const z = e.reduce((a, b) => a + b, 0);
      q = d.map((x, i) => ({ ...x, q: e[i] / z }));
    }
    q.sort((a, b) => b.q - a.q);
    let cum = 0, cut = q.length;
    for (let i = 0; i < q.length; i++) { cum += q[i].q; if (cum >= topP - 1e-9) { cut = i + 1; break; } }
    const zz = q.slice(0, cut).reduce((a, x) => a + x.q, 0);
    q.forEach((x, i) => { x.inP = i < cut; x.final = i < cut ? x.q / zz : 0; });
    return { q, cut };
  }

  const PROMPTS = ["the robot looked at the", "every night , the old cat", "at the edge of the"];
  let prompt = PROMPTS[0].split(" "), gen = [];
  let T = 0.8, topP = 0.9, auto = 0, spin = null;
  const R = rng(17);

  const textEl = h("p", { class: "gen-text", "aria-live": "polite" });
  const barsEl = h("div", { class: "gen-bars", role: "group", "aria-label": "Candidate next words" });
  const promptChips = h("div", { class: "chips" }, PROMPTS.map((p) => h("button", { type: "button", class: "chip", onclick: () => { prompt = p.split(" "); gen = []; auto = 0; render(); } }, cap(p.replace(" ,", ",")) + "…")));
  const slT = slider({ label: "Temperature", min: 0, max: 2, step: 0.05, value: T, fmt: (v) => (v === 0 ? "0 (always the favorite)" : v.toFixed(2)), ticks: [{ v: 0, label: "0" }, { v: 1, label: "1" }, { v: 2, label: "2" }], onInput: (v) => { T = v; render(); } });
  const slP = slider({ label: "Top-p", min: 0.05, max: 1, step: 0.05, value: topP, fmt: (v) => v.toFixed(2), ticks: [{ v: 0.05, label: "0.05" }, { v: 0.5, label: "0.5" }, { v: 1, label: "1 (off)" }], onInput: (v) => { topP = v; render(); } });
  const bSample = button("Sample", () => sample(), { kind: "primary", icon: "dice" });
  const bTop = button("Take the favorite", () => choose(current().q[0].w), { small: true });
  const bAuto = button("Write 20 words", () => { auto = auto ? 0 : 20; syncAuto(); if (auto) sample(); }, { icon: "play", small: true });
  const bUndo = button("Undo", () => { gen.pop(); auto = 0; syncAuto(); render(); }, { icon: "back", small: true });
  const bReset = button("Reset", () => { gen = []; auto = 0; syncAuto(); render(); }, { icon: "reset", small: true });
  const syncAuto = () => bAuto.setLabel(auto ? "Stop" : "Write 20 words", auto ? "pause" : "play");
  root.append(promptChips, textEl, barsEl, h("div", { class: "ctl-row" }, slT.el, slP.el), h("div", { class: "btn-row", style: "margin-top:12px" }, bSample, bTop, bAuto, bUndo, bReset));
  const roChosen = readout("Last word's odds"), roRun = readout("Words in the running"), roTop = readout("Favorite's share");
  root.append(h("div", { class: "readouts" }, roChosen.el, roRun.el, roTop.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  const all = () => prompt.concat(gen.map((g) => g.w));
  function current() { const a = all(); return shape(dist(a[a.length - 2], a[a.length - 1]), T, topP); }
  function choose(w) {
    const cur = current();
    const x = cur.q.find((c) => c.w === w);
    gen.push({ w, p: x ? x.final : 0, raw: x ? x.p : 0, forced: x ? !x.inP : true });
    render();
  }
  function sample() {
    if (spin) return;
    const cur = current();
    let u = R(), pick = cur.q[0].w;
    for (const x of cur.q) { if (!x.inP) continue; u -= x.final; if (u <= 0) { pick = x.w; break; } }
    if (reducedMotion()) { choose(pick); afterAuto(); return; }
    // quick highlight flicker over the eligible bars, then land
    const eligible = cur.q.slice(0, 10).filter((x) => x.inP).map((x) => x.w);
    let k = 0;
    spin = setInterval(() => {
      k++;
      const w = k < 6 ? eligible[Math.floor(R() * eligible.length)] : pick;
      barsEl.querySelectorAll(".gen-bar").forEach((b) => b.classList.toggle("flash", b.dataset.w === w));
      if (k >= 6) { clearInterval(spin); spin = null; setTimeout(() => { choose(pick); afterAuto(); }, 120); }
    }, 55);
  }
  function afterAuto() {
    if (auto > 0) { auto--; syncAuto(); if (auto > 0) setTimeout(() => { if (auto > 0) sample(); }, 160); }
  }
  function render() {
    const words = all();
    const html = [];
    words.forEach((w, i) => {
      const isGen = i >= prompt.length;
      const g = isGen ? gen[i - prompt.length] : null;
      const txt = i === 0 || words[i - 1] === "." ? cap(w) : w;
      const sp = w === "," || w === "." ? "" : " ";
      html.push(`${i ? sp : ""}<span class="${isGen ? "gw" + (g.forced ? " forced" : "") : "pw"}" title="${isGen ? `chosen at ${fmtPct(g.p, 1)}` : "prompt"}">${escapeHTML(txt)}</span>`);
    });
    textEl.innerHTML = html.join("") + '<span class="caret" aria-hidden="true"></span>';
    const cur = current();
    const top = cur.q.slice(0, 10);
    const maxQ = Math.max(...top.map((x) => x.q), 1e-9);
    barsEl.replaceChildren(...top.map((x) => h("button", {
      type: "button", class: "gen-bar" + (x.inP ? "" : " out"), "data-w": x.w,
      "aria-label": `${x.w}: ${fmtPct(x.q, 1)}${x.inP ? "" : ", cut by top-p"}. Choose this word.`,
      onclick: () => { auto = 0; syncAuto(); choose(x.w); },
    }, h("span", { class: "gb-w" }, x.w), h("span", { class: "gb-track" }, h("i", { style: `width:${((x.q / maxQ) * 100).toFixed(1)}%` })), h("span", { class: "gb-p" }, x.q >= 0.001 ? fmtPct(x.q, x.q < 0.1 ? 1 : 0) : "<0.1%"))));
    const rest = cur.q.slice(10).reduce((a, x) => a + x.q, 0);
    barsEl.append(h("p", { class: "gen-rest" }, `+ ${cur.q.length - 10} other words sharing ${fmtPct(rest, rest < 0.1 ? 1 : 0)}`));
    const last = gen[gen.length - 1];
    roChosen.set(last ? fmtPct(last.p, 1) : "—", "", last ? (last.forced ? "you picked it by hand" : "after temperature and top-p") : "");
    roRun.set(fmtInt(cur.cut), "", `of ${VOCAB.length} words`);
    roTop.set(fmtPct(cur.q[0].q, 0));
    // status
    const tail = gen.slice(-12).map((g) => g.w).join(" ");
    const loops = gen.length >= 12 && /(.{12,})\1/.test(tail.replace(/ /g, "_") + "_" + tail.replace(/ /g, "_"));
    if (T === 0) status.innerHTML = "<b>Temperature 0:</b> the favorite wins every time, so the same prompt always gives the same text, and it can get stuck in a loop.";
    else if (T > 1.4 && topP >= 0.99) status.innerHTML = "<b>High temperature, no top-p:</b> unlikely words get a real chance, so the text drifts into nonsense. Lower top-p to cut off the tail.";
    else if (T > 1.4) status.innerHTML = "<b>High temperature, but top-p trims the tail:</b> more variety, while the wildest words stay excluded.";
    else if (loops) status.innerHTML = "It's repeating itself. Raise the temperature a little.";
    else status.innerHTML = "Tap <b>Sample</b> to draw a word at random, weighted by the bars. Tap any bar to choose it yourself.";
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  Actions.gen = (arg) => {
    if (arg === "greedy") { gen = []; slT.set(0, true); auto = 20; syncAuto(); sample(); }
  };
  render();
});

/* ---------- (b) The context window ---------- */
defineMount("context", (root) => {
  const SYS = "You are a helpful assistant.";
  const OPENING = [["user", "Hi! My name is Ada."], ["model", "Nice to meet you, Ada. How can I help?"]];
  const MORE = [
    ["user", "What is the tallest mountain on Earth?"],
    ["model", "Mount Everest, at about 8,849 meters above sea level."],
    ["user", "How long does light from the Sun take to reach us?"],
    ["model", "About eight minutes and twenty seconds."],
    ["user", "Can you suggest a name for a black cat?"],
    ["model", "How about Pepper, Shadow or Midnight?"],
    ["user", "Why is the sky blue?"],
    ["model", "Air scatters blue light more than red light, so blue reaches your eyes from every direction."],
    ["user", "What should I cook tonight?"],
    ["model", "A quick vegetable stir-fry with rice is hard to beat."],
  ];
  const DOC = "Here is a long report to summarize: " + "Quarterly sales rose in the north and fell in the south while costs stayed flat and the new warehouse opened on time with fewer staff than planned. ".repeat(2).trim();
  const words = (s) => s.split(/\s+/).filter(Boolean);
  let turns = OPENING.slice(), next = 0, W = 48, asked = null;

  const box = h("div", { class: "ctx", "aria-live": "polite" });
  const slW = slider({ label: "Window size", min: 24, max: 120, step: 4, value: W, fmt: (v) => `${v} words`, ticks: [{ v: 24, label: "24" }, { v: 120, label: "120" }], onInput: (v) => { W = v; render(); } });
  const bMsg = button("Chat more", () => { if (next < MORE.length) { turns.push(MORE[next], MORE[next + 1]); next += 2; } asked = null; render(); }, { small: true, icon: "plus" });
  const bDoc = button("Paste a document", () => { turns.push(["user", DOC]); turns.push(["model", "Sales grew in the north and shrank in the south; costs held steady."]); asked = null; render(); }, { small: true, icon: "plus" });
  const bAsk = button("Ask: “What's my name?”", () => { asked = true; render(); }, { kind: "primary" });
  const bReset = button("Reset", () => { turns = OPENING.slice(); next = 0; asked = null; render(); }, { small: true, icon: "reset" });
  root.append(h("div", { class: "ctl-row" }, slW.el), h("div", { class: "btn-row", style: "margin-top:10px" }, bMsg, bDoc, bAsk, bReset), box);
  const roUsed = readout("Words in the conversation"), roSeen = readout("Words the model sees"), roLost = readout("Forgotten");
  root.append(h("div", { class: "readouts" }, roUsed.el, roSeen.el, roLost.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  function render() {
    const all = turns.concat(asked ? [["user", "What's my name?"]] : []);
    const sysW = words(SYS);
    const flat = [];
    all.forEach(([who, text], t) => words(text).forEach((w) => flat.push({ w, who, t })));
    const budget = Math.max(0, W - sysW.length);
    const firstSeen = Math.max(0, flat.length - budget);
    const adaSeen = flat.some((x, i) => i >= firstSeen && /^Ada[.,!?]*$/.test(x.w));
    box.replaceChildren();
    const sysRow = h("div", { class: "ctx-turn sys" }, h("span", { class: "ctx-who" }, "System · pinned"), h("span", { class: "ctx-words" }, sysW.map((w) => h("span", { class: "cw in" }, w))));
    box.append(sysRow);
    let idx = 0;
    all.forEach(([who, text], t) => {
      const ws = words(text).map((w) => {
        const i = idx++;
        const cls = "cw" + (i >= firstSeen ? " in" : " out") + (/^Ada[.,!?]*$/.test(w) ? " name" : "");
        return h("span", { class: cls }, w);
      });
      box.append(h("div", { class: "ctx-turn " + who + (idx - 1 < firstSeen ? " gone" : "") }, h("span", { class: "ctx-who" }, who === "user" ? "You" : "Model"), h("span", { class: "ctx-words" }, ws)));
    });
    if (asked) {
      box.append(h("div", { class: "ctx-turn model answer" }, h("span", { class: "ctx-who" }, "Model"),
        h("span", { class: "ctx-words" }, adaSeen ? "Your name is Ada." : "I'm sorry, I don't know your name. Could you tell me?")));
    }
    const lost = firstSeen;
    roUsed.set(fmtInt(flat.length + sysW.length));
    roSeen.set(fmtInt(Math.min(W, flat.length + sysW.length)), "", `window: ${W}`);
    roLost.set(fmtInt(lost)); roLost.state(lost ? "bad" : null);
    if (asked) status.innerHTML = adaSeen ? "<b>“Ada” is still inside the window,</b> so the model can answer. Keep chatting, then ask again." : "<b>“Ada” has slid out of the window.</b> The model isn't being coy: it genuinely never sees that word anymore.";
    else if (lost) status.innerHTML = `The first <b>${lost} words</b> no longer fit and are dropped before each call. Is “Ada” still in view?`;
    else status.innerHTML = "Everything still fits. Chat more or paste a document until the start of the conversation falls out.";
  }
  render();
});

/* ---------- (c) KV cache ---------- */
defineMount("kv", (root) => {
  const WORDS = ["The", "cat", "sat", "on", "the", "warm", "mat", "and", "slowly", "fell", "asleep", "in", "the", "afternoon", "sun", "."];
  const PROMPT = 4, LAYERS = 6, MB = 0.33;
  let t = PROMPT, cache = true, autoOn = false, anim = 0, acc = 0;
  const workWith = (n) => n * LAYERS; // prefill counts once per token too
  const workWithout = (n) => { let s = PROMPT * LAYERS; for (let k = PROMPT + 1; k <= n; k++) s += k * LAYERS; return s; };

  const stage = new Stage(root, {
    label: "A grid of tokens by layers. Each step computes keys and values; with a cache, only the newest row is computed.",
    height: (w) => (w >= 560 ? clamp(w * 0.5, 290, 360) : clamp(w * 1.05, 360, 420)),
    draw: () => draw(),
  });
  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w) return;
    stage.clear();
    const wide = stage.w >= 560;
    const gridW = wide ? stage.w * 0.52 : stage.w;
    const gridH = wide ? stage.h - 10 : stage.h * 0.58;
    const labW = 78;
    const cw = Math.min(34, (gridW - labW - 10) / LAYERS), ch = Math.min(18, (gridH - 30) / WORDS.length);
    const x0 = labW, y0 = 22;
    const mono = Theme.mono;
    c.font = `600 10px ${mono}`; c.fillStyle = C.muted; c.textAlign = "left";
    c.fillText("TOKENS ↓   LAYERS →", 4, 12);
    const phase = anim; // 0..1 animation of the current step
    for (let r = 0; r < WORDS.length; r++) {
      const y = y0 + r * ch;
      const inCtx = r < t;
      c.fillStyle = inCtx ? C.text : C.faint; c.textAlign = "right"; c.font = `${r === t - 1 ? 700 : 500} 11px ${Theme.body}`;
      c.fillText(WORDS[r], x0 - 8, y + ch * 0.72);
      for (let l = 0; l < LAYERS; l++) {
        const x = x0 + l * cw;
        let fill = rgba(C.text, 0.06);
        if (inCtx) {
          const isNew = r === t - 1;
          const recompute = !cache && t > PROMPT;
          if (isNew || recompute) {
            const lit = phase < 1 && (isNew || recompute) && l / LAYERS <= phase + 0.001;
            fill = lit ? C.l9 : rgba(C.l9, 0.55);
            if (phase >= 1) fill = rgba(C.l9, 0.55);
          } else fill = rgba(C.l9, 0.25);
          if (cache && !isNew && t > PROMPT && phase < 1) { c.strokeStyle = rgba(C.l6, 0.9); c.lineWidth = 1; }
        }
        c.fillStyle = fill;
        roundRect(c, x + 1.5, y + 1.5, cw - 3, ch - 3, 2); c.fill();
        if (inCtx && cache && r < t - 1 && t > PROMPT && phase < 1) { c.strokeStyle = C.l6; c.lineWidth = 1.2; roundRect(c, x + 1.5, y + 1.5, cw - 3, ch - 3, 2); c.stroke(); }
      }
    }
    // cumulative work chart
    const cx0 = wide ? gridW + 24 : 8, cy0 = wide ? 16 : gridH + 16, cwid = wide ? stage.w - gridW - 30 : stage.w - 16, chh = wide ? stage.h - 40 : stage.h - gridH - 34;
    c.fillStyle = C.sunk; roundRect(c, cx0, cy0, cwid, chh + 18, 6); c.fill();
    c.fillStyle = C.muted; c.font = `600 10px ${mono}`; c.textAlign = "left";
    c.fillText("TOTAL WORK SO FAR", cx0 + 8, cy0 + 14);
    const maxW = workWithout(WORDS.length);
    const X = (n) => cx0 + 10 + ((n - PROMPT) / (WORDS.length - PROMPT)) * (cwid - 20);
    const Y = (v) => cy0 + chh + 6 - (v / maxW) * (chh - 26);
    for (const [fn, col, lab] of [[workWithout, C.bad, "no cache"], [workWith, C.l6, "with cache"]]) {
      c.strokeStyle = rgba(col, 0.3); c.lineWidth = 1.5; c.setLineDash([3, 3]);
      c.beginPath(); for (let n = PROMPT; n <= WORDS.length; n++) (n === PROMPT ? c.moveTo(X(n), Y(fn(n))) : c.lineTo(X(n), Y(fn(n)))); c.stroke();
      c.setLineDash([]); c.strokeStyle = col; c.lineWidth = 2.5;
      c.beginPath(); for (let n = PROMPT; n <= t; n++) (n === PROMPT ? c.moveTo(X(n), Y(fn(n))) : c.lineTo(X(n), Y(fn(n)))); c.stroke();
      c.fillStyle = col; c.beginPath(); c.arc(X(t), Y(fn(t)), 4, 0, Math.PI * 2); c.fill();
      c.textAlign = "right"; c.font = `600 10px ${mono}`;
      c.fillText(lab, cx0 + cwid - 10, Y(fn(WORDS.length)) + (lab === "no cache" ? 14 : -6));
    }
  }
  function tick(dt) {
    if (anim < 1) anim = Math.min(1, anim + dt * 2.2);
    if (autoOn && anim >= 1) { acc += dt; if (acc > 0.35) { acc = 0; stepFwd(); } }
    draw();
  }
  function stepFwd() {
    if (t >= WORDS.length) { autoOn = false; syncAuto(); return; }
    t++; anim = reducedMotion() ? 1 : 0; update(); Loop.wake();
  }
  const segC = segmented({ label: "KV cache", options: [{ value: true, label: "On" }, { value: false, label: "Off" }], value: cache, onChange: (v) => { cache = v; anim = 1; update(); draw(); } });
  const bNext = button("Next token", () => stepFwd(), { kind: "primary", icon: "step" });
  const bAuto = button("Auto", () => { autoOn = !autoOn; if (t >= WORDS.length) { t = PROMPT; } syncAuto(); Loop.wake(); }, { icon: "play", small: true });
  const bReset = button("Reset", () => { t = PROMPT; autoOn = false; syncAuto(); anim = 1; update(); draw(); }, { icon: "reset", small: true });
  const syncAuto = () => bAuto.setLabel(autoOn ? "Pause" : "Auto", autoOn ? "pause" : "play");
  root.append(h("div", { class: "ctl-row" }, segC.el, h("div", { class: "btn-row" }, bNext, bAuto, bReset)));
  const roW = readout("Work with cache"), roWO = readout("Work without"), roX = readout("Saved"), roM = readout("Cache memory, 70B model");
  root.append(h("div", { class: "readouts" }, roW.el, roWO.el, roX.el, roM.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);
  function update() {
    roW.set(fmtInt(workWith(t)), " units"); roW.state(cache ? "hi" : null);
    roWO.set(fmtInt(workWithout(t)), " units"); roWO.state(!cache ? "bad" : null);
    roX.set(fmtNum(workWithout(t) / workWith(t), 2), "×");
    roM.set(fmtNum(t * MB, 2), " MB", "grows with every token");
    const n = t - PROMPT;
    status.innerHTML = t === PROMPT
      ? "The prompt (4 tokens) has been read in one pass. Press <b>Next token</b> to generate."
      : cache
        ? `<b>With the cache:</b> token ${t} computes only its own row, and reads the ${t - 1} earlier rows from memory (outlined).`
        : `<b>Without a cache:</b> token ${t} recomputes all ${t} rows at every layer. After ${n} new tokens that's ${fmtNum(workWithout(t) / workWith(t), 2)}× the work.`;
  }
  Actions.kv = () => { segC.set(false, true); t = PROMPT; autoOn = true; syncAuto(); Loop.wake(); };
  Theme.on(draw);
  Loop.add(stage.canvas, tick, () => anim < 1 || autoOn);
  anim = 1;
  update();
});
