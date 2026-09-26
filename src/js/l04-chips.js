/* =====================================================================
   Layer 4 · Chips — (a) CPU vs GPU race, (b) the memory wall.
   ===================================================================== */

/* ---------- (a) CPU vs GPU ---------- */
defineMount("race", (root) => {
  const CPU = { cores: 16, cost: 1, launch: 0, name: "CPU", sub: "16 fast cores" };
  const GPU = { cores: 1024, cost: 4, launch: 200, name: "GPU", sub: "1,024 simple cores" };
  let N = 32;
  let clock = 0; // simulated time units elapsed
  let running = false, finished = false;
  let rate = 1; // time units per second of animation

  const total = (P) => P.launch + Math.ceil((N * N) / P.cores) * N * P.cost;
  /* completion time of output cell k on processor P */
  const doneAt = (P, k) => P.launch + (Math.floor(k / P.cores) + 1) * N * P.cost;
  const startAt = (P, k) => P.launch + Math.floor(k / P.cores) * N * P.cost;

  let L = {};
  const stage = new Stage(root, {
    label: "Two grids filling in as a CPU and a GPU compute each cell of a matrix product.",
    height: (w) => (w >= 560 ? clamp(w * 0.52, 300, 380) : clamp(w * 1.6, 520, 640)),
    onResize: (w, hh) => {
      const wide = w >= 560;
      const pw = wide ? (w - 24) / 2 : w;
      const ph = wide ? hh : hh / 2 - 6;
      L = { panels: [{ P: CPU, x: 0, y: 0, w: pw, h: ph }, { P: GPU, x: wide ? pw + 24 : 0, y: wide ? 0 : ph + 12, w: pw, h: ph }] };
    },
    draw: () => draw(),
  });

  function tick(dt) {
    if (running) {
      clock += dt * rate;
      const end = Math.max(total(CPU), total(GPU));
      if (clock >= end) { clock = end; running = false; finished = true; bRace.setLabel("Race again", "play"); showResult(); }
    }
    draw();
  }

  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w || !L.panels) return;
    stage.clear();
    const mono = Theme.mono;
    for (const pan of L.panels) {
      const { P, x, y, w, h: ph } = pan;
      const T = total(P);
      const acc = P === CPU ? C.l3 : C.l4;
      const isDone = clock >= T;
      // header
      c.textAlign = "left"; c.fillStyle = C.text; c.font = `700 15px ${Theme.body}`;
      c.fillText(P.name, x + 2, y + 16);
      c.fillStyle = C.muted; c.font = `500 12px ${Theme.body}`;
      c.fillText(P.sub, x + 2 + c.measureText(P.name).width * 1.25 + 10, y + 16);
      c.textAlign = "right"; c.font = `700 13px ${mono}`;
      c.fillStyle = isDone ? (winner() === P ? C.good : C.text) : C.muted;
      c.fillText(`${fmtInt(Math.min(clock, T))} ticks${isDone ? " ✓" : ""}`, x + w - 2, y + 16);
      // grid
      const gpuCw = Math.min(5, (w - 20) / 64);
      const coresH = P === CPU ? Math.min(22, (w - 20) / 16 - 3) : 16 * gpuCw * 0.9;
      const gs = Math.min(w - 4, ph - 28 - 12 - coresH - 22);
      const gx = x + (w - gs) / 2, gy = y + 28;
      const cs = gs / N;
      c.fillStyle = C.sunk; c.fillRect(gx, gy, gs, gs);
      const inLaunch = clock < P.launch;
      for (let k = 0; k < N * N; k++) {
        const i = k % N, j = Math.floor(k / N);
        const t0 = startAt(P, k), t1 = doneAt(P, k);
        let f = clamp((clock - t0) / (t1 - t0), 0, 1);
        if (f <= 0) continue;
        c.fillStyle = f >= 1 ? acc : rgba(acc, 0.25 + 0.5 * f);
        const g = cs > 4 ? 0.8 : 0;
        c.fillRect(gx + i * cs + g, gy + j * cs + g, cs - g * 2, cs - g * 2);
      }
      if (inLaunch && running) {
        c.fillStyle = rgba(C.bg, 0.6); c.fillRect(gx, gy, gs, gs);
        c.fillStyle = C.text; c.textAlign = "center"; c.font = `600 12px ${mono}`;
        c.fillText("starting the job…", gx + gs / 2, gy + gs / 2);
      }
      // cores strip
      const cy = gy + gs + 12;
      const busyCount = clock < P.launch || clock >= T ? 0 : Math.min(P.cores, N * N - Math.floor((clock - P.launch) / (N * P.cost)) * P.cores);
      if (P === CPU) {
        const cw = Math.min(22, (w - 20) / 16 - 3);
        const tot = 16 * (cw + 3);
        for (let k = 0; k < 16; k++) {
          c.fillStyle = k < busyCount ? acc : rgba(C.text, 0.12);
          roundRect(c, x + (w - tot) / 2 + k * (cw + 3), cy, cw, cw, 3); c.fill();
        }
      } else {
        const cols = 64, rows = 16;
        const cw = Math.min(5, (w - 20) / cols);
        const tot = cols * cw;
        for (let k = 0; k < cols * rows; k++) {
          c.fillStyle = k < busyCount ? acc : rgba(C.text, 0.12);
          c.fillRect(x + (w - tot) / 2 + (k % cols) * cw, cy + Math.floor(k / cols) * cw * 0.9, cw - 1, cw * 0.9 - 1);
        }
      }
      c.fillStyle = C.faint; c.font = `600 10px ${mono}`; c.textAlign = "center";
      c.fillText(running || finished ? `${busyCount} of ${fmtInt(P.cores)} cores busy` : `${fmtInt(P.cores)} cores`, x + w / 2, cy + coresH + 14);
    }
  }
  const winner = () => (total(CPU) <= total(GPU) ? CPU : GPU);

  const seg = segmented({
    label: "Matrix size",
    options: [8, 16, 32, 64].map((v) => ({ value: v, label: `${v}×${v}` })),
    value: N,
    onChange: (v) => { N = v; clock = 0; finished = false; running = false; bRace.setLabel("Race", "play"); status.innerHTML = describe(); draw(); },
  });
  const bRace = button("Race", () => {
    clock = 0; finished = false; running = true;
    rate = Math.max(total(CPU), total(GPU)) / 3.2;
    bRace.setLabel("Racing…", "play");
    status.innerHTML = describe();
    Loop.wake();
  }, { kind: "primary", icon: "play" });
  root.append(h("div", { class: "ctl-row" }, seg.el, h("div", { class: "btn-row" }, bRace)));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  function describe() {
    const cells = N * N;
    return `An ${N}×${N} answer has <b>${fmtInt(cells)} cells</b>, each a sum of ${N} multiplications. The CPU does 16 at a time; the GPU could do 1,024 at a time${cells < 1024 ? `, but only ${fmtInt(cells)} exist` : ""}.`;
  }
  function showResult() {
    const a = total(CPU), b = total(GPU);
    const w = winner();
    const r = w === CPU ? b / a : a / b;
    status.innerHTML = w === CPU
      ? `<b>The CPU wins by ${fmtNum(r, 2)}×.</b> Starting a GPU job costs time, and there isn't enough work to keep its cores busy. Try a bigger matrix.`
      : `<b>The GPU wins by ${fmtNum(r, 2)}×.</b> ${N >= 64 ? "The bigger the job, the bigger its lead: real AI matrices have thousands of rows." : "Try an even bigger matrix."}`;
    Announcer(status.textContent);
  }

  Actions.race = (arg) => {
    if (arg === "small") { seg.set(8, true); setTimeout(() => bRace.click(), 250); }
  };
  status.innerHTML = describe();
  Theme.on(draw);
  Loop.add(stage.canvas, tick, () => running);
});

/* ---------- (b) the memory wall ---------- */
defineMount("wall", (root) => {
  const WORK = [
    { v: 1, label: "Chat, 1 user", note: "one user: each weight read from memory is used once" },
    { v: 32, label: "32 users", note: "32 users share every weight read" },
    { v: 256, label: "256 users", note: "256 users share every weight read" },
    { v: 1000, label: "Training", note: "big training batches reuse each byte many times" },
  ];
  let bw = 3.35; // TB/s
  let peakMul = 1; // × 1,000 TFLOPS
  let I = 1; // operations per byte
  const peak = () => 1000 * peakMul;
  const achieved = () => Math.min(peak(), bw * I);
  const util = () => achieved() / peak();

  const tiles = Array.from({ length: 64 }, () => ({ on: 0, t: Math.random() }));
  const parts = [];
  const R = rng(3);
  let L = {};
  const stage = new Stage(root, {
    label: "Memory stacks feed a pipe of data into a grid of compute units; units light up only when data arrives.",
    height: (w) => (w >= 560 ? clamp(w * 0.62, 340, 430) : clamp(w * 1.3, 440, 560)),
    onResize: (w, hh) => {
      const wide = w >= 560;
      const chipH = wide ? hh * 0.52 : hh * 0.5;
      L = { wide, chip: { x: 0, y: 0, w, h: chipH }, chart: { x: 0, y: chipH + 16, w, h: hh - chipH - 16 } };
      parts.length = 0;
    },
    draw: () => draw(0),
  });

  function tick(dt) {
    const u = util();
    // particles: rate ∝ bandwidth
    const want = Math.round(clamp(8 + 26 * Math.log2(bw + 1), 8, 150));
    if (!reducedMotion()) {
      while (parts.length < want) parts.push({ s: R(), lane: R() });
      if (parts.length > want) parts.length = want;
      const sp = 0.35 + 0.25 * Math.log2(bw + 1);
      for (const p of parts) { p.s += dt * sp * 0.5; if (p.s > 1) { p.s -= 1; p.lane = R(); } }
      for (const t of tiles) {
        t.t -= dt;
        if (t.t <= 0) { t.on = R() < u ? 1 : 0; t.t = 0.15 + R() * 0.25; }
      }
    } else {
      tiles.forEach((t, i) => (t.on = i / tiles.length < u ? 1 : 0));
      if (!parts.length) for (let i = 0; i < want; i++) parts.push({ s: R(), lane: R() });
    }
    draw(dt);
  }

  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w || !L.chip) return;
    stage.clear();
    const acc = C.l4, dat = C.l6, mono = Theme.mono;
    const K = L.chip;
    // memory stacks
    const memW = Math.min(K.w * 0.2, 110), memX = K.x + 6;
    const stacks = 4, gridS0 = Math.min(K.h - 30, K.w * 0.36), sh = gridS0 / stacks;
    c.textAlign = "left"; c.fillStyle = C.muted; c.font = `600 10px ${mono}`;
    c.fillText("MEMORY (HBM)", memX, K.y + 12);
    for (let s = 0; s < stacks; s++) {
      const y = K.y + 22 + s * sh;
      for (let l = 0; l < 6; l++) {
        c.fillStyle = rgba(dat, 0.25 + l * 0.08);
        roundRect(c, memX + l * 1.5, y + l * ((sh - 14) / 8), memW - 12, (sh - 14) / 8 - 1, 2); c.fill();
      }
    }
    // compute grid
    const gridS = Math.min(K.h - 30, K.w * 0.36);
    const gx = K.x + K.w - gridS - 6, gy = K.y + 22;
    c.fillStyle = C.muted; c.textAlign = "left";
    c.fillText(`MATH UNITS${peakMul > 1 ? " (2× FASTER)" : ""}`, gx, K.y + 12);
    const n = 8, ts = gridS / n;
    tiles.forEach((t, i) => {
      const x = gx + (i % n) * ts, y = gy + Math.floor(i / n) * ts;
      c.fillStyle = t.on ? acc : rgba(C.text, 0.08);
      if (t.on) { c.shadowColor = acc; c.shadowBlur = 8; }
      roundRect(c, x + 2, y + 2, ts - 4, ts - 4, 3); c.fill();
      c.shadowBlur = 0;
    });
    // pipe
    const px0 = memX + memW, px1 = gx - 8;
    const pipeH = clamp(4 + 9 * Math.log2(bw + 1), 5, gridS * 0.8);
    const py = gy + gridS / 2;
    c.fillStyle = rgba(dat, 0.12);
    roundRect(c, px0, py - pipeH / 2, px1 - px0, pipeH, pipeH / 2); c.fill();
    c.strokeStyle = rgba(dat, 0.45); c.lineWidth = 1;
    roundRect(c, px0, py - pipeH / 2, px1 - px0, pipeH, pipeH / 2); c.stroke();
    for (const p of parts) {
      c.fillStyle = dat;
      c.beginPath(); c.arc(lerp(px0 + 4, px1 - 4, p.s), py - pipeH / 2 + 3 + p.lane * (pipeH - 6), 2.2, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = C.text; c.textAlign = "center"; c.font = `700 12px ${mono}`;
    c.fillText(`${fmtNum(bw, 3)} TB/s`, (px0 + px1) / 2, py - pipeH / 2 - 8);
    c.fillStyle = C.muted; c.font = `600 10px ${mono}`;
    const uu = util() * 100;
    c.fillText(`${uu < 1 ? fmtNum(uu, 1) : Math.round(uu)}% ${gridS > 170 ? "OF MATH UNITS " : ""}BUSY`, gx + gridS / 2, gy + gridS + 14);

    drawRoof(c, C, mono);
  }

  function drawRoof(c, C, mono) {
    const R2 = L.chart;
    const pl = 46, pr = 12, pt = 20, pb = 30;
    const x0 = R2.x + pl, x1 = R2.x + R2.w - pr, y0 = R2.y + R2.h - pb, y1 = R2.y + pt;
    const IMIN = 0.25, IMAX = 4096, FMIN = 0.1, FMAX = 5000;
    const X = (i) => lerp(x0, x1, invLerp(Math.log(IMIN), Math.log(IMAX), Math.log(i)));
    const Y = (f) => lerp(y0, y1, invLerp(Math.log(FMIN), Math.log(FMAX), Math.log(clamp(f, FMIN, FMAX))));
    c.textAlign = "left"; c.fillStyle = C.muted; c.font = `600 10px ${mono}`;
    c.fillText("SPEED (TRILLION OPS/S) VS OPERATIONS PER BYTE READ", R2.x, R2.y + 8);
    c.font = `500 10px ${mono}`;
    for (const f of [1, 10, 100, 1000]) {
      c.strokeStyle = C.line; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, Y(f)); c.lineTo(x1, Y(f)); c.stroke();
      c.fillStyle = C.faint; c.textAlign = "right"; c.fillText(fmtInt(f), x0 - 6, Y(f) + 3);
    }
    c.textAlign = "center";
    for (const i of [1, 4, 16, 64, 256, 1024, 4096]) { c.fillStyle = C.faint; c.fillText(String(i), X(i), y0 + 14); }
    // roof
    const ridge = peak() / bw;
    c.strokeStyle = C.l4; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(X(IMIN), Y(bw * IMIN)); c.lineTo(X(Math.min(ridge, IMAX)), Y(Math.min(peak(), bw * IMAX))); if (ridge < IMAX) c.lineTo(X(IMAX), Y(peak())); c.stroke();
    c.fillStyle = C.faint; c.textAlign = "left";
    if (ridge > IMIN && ridge < IMAX) {
      c.setLineDash([2, 3]); c.strokeStyle = rgba(C.text, 0.3); c.lineWidth = 1;
      c.beginPath(); c.moveTo(X(ridge), Y(peak())); c.lineTo(X(ridge), y0); c.stroke(); c.setLineDash([]);
      c.fillText("memory-bound ←", Math.max(x0 + 2, X(ridge) - 108), y0 - 6);
      if (X(ridge) + 110 < x1) c.fillText("→ compute-bound", X(ridge) + 4, y0 - 6);
    }
    // workload markers
    for (const wk of WORK) {
      c.fillStyle = wk.v === I ? C.text : C.faint;
      c.beginPath(); c.moveTo(X(wk.v), y0 + 2); c.lineTo(X(wk.v) - 4, y0 + 8); c.lineTo(X(wk.v) + 4, y0 + 8); c.fill();
    }
    // operating point
    const a = achieved();
    c.fillStyle = C.text; c.beginPath(); c.arc(X(I), Y(a), 6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = C.l4; c.lineWidth = 2; c.stroke();
    c.font = `700 11px ${mono}`;
    c.textAlign = X(I) > x1 - 90 ? "right" : "left";
    c.fillText(`${fmtNum(a, 3)} TFLOPS`, X(I) + (c.textAlign === "right" ? -10 : 10), Y(a) - 8);
  }

  const slBW = slider({
    label: "Memory bandwidth", min: 0.5, max: 16, value: bw, log: true,
    round: (v) => { for (const s of [0.9, 2, 3.35, 8]) if (Math.abs(Math.log(v / s)) < 0.04) return s; return roundSig(v, 2); },
    fmt: (v) => `${fmtNum(v, 3)} TB/s`,
    ticks: [{ v: 0.5, label: "0.5" }, { v: 0.9, label: "2017" }, { v: 3.35, label: "H100" }, { v: 8, label: "B200" }, { v: 16, label: "16" }],
    onInput: (v) => { bw = v; update(); },
  });
  const segW = segmented({
    label: "Workload",
    options: WORK.map((w) => ({ value: w.v, label: w.label })),
    value: I,
    onChange: (v) => { I = v; update(); },
  });
  const segP = segmented({
    label: "Math speed",
    options: [{ value: 1, label: "1×" }, { value: 2, label: "2×" }],
    value: 1,
    onChange: (v) => { peakMul = v; update(); },
  });
  root.append(h("div", { class: "ctl-row" }, slBW.el), h("div", { class: "ctl-row" }, segW.el, segP.el));
  const roA = readout("Achieved");
  const roU = readout("Math units busy");
  const roB = readout("Limited by");
  const roT = readout("70B model, tokens/s");
  root.append(h("div", { class: "readouts" }, roA.el, roU.el, roB.el, roT.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  function update() {
    const a = achieved(), u = util();
    roA.set(fmtNum(a, 3), " TFLOPS");
    roU.set(u < 0.01 ? fmtNum(u * 100, 1) : Math.round(u * 100), "%"); roU.state(u < 0.25 ? "bad" : u > 0.95 ? "good" : null);
    const memBound = bw * I < peak();
    roB.set(memBound ? "Memory" : "Math"); roB.state(memBound ? "bad" : "good");
    if (I <= 256) {
      // 70B params at 16-bit = 140 GB read per decode step; each step makes one token per user
      const steps = Math.min((bw * 1e12) / 140e9, (peak() * 1e12) / (2 * 70e9 * I));
      roT.set(fmtInt(steps * I), "", I === 1 ? "for one user" : `${fmtInt(steps)} per user`);
    } else roT.set("—", "", "not generating text");
    const wk = WORK.find((w) => w.v === I);
    status.innerHTML = memBound && u > 0.7
      ? `<b>Nearly balanced:</b> ${wk.note}, which almost keeps up with the math units. They're busy ${Math.round(u * 100)}% of the time.`
      : memBound
      ? `<b>Memory-bound:</b> ${wk.note}, so the math units wait. ${peakMul > 1 ? "Doubling the math speed changed nothing." : "Faster math wouldn't help here; more bandwidth or more reuse would."}`
      : `<b>Compute-bound:</b> ${wk.note}, so data arrives faster than the math units can use it. ${peakMul > 1 ? "Here, doubling the math speed does help." : "Only faster math would speed this up."}`;
    Loop.wake();
  }
  Actions.wall = (arg) => {
    if (arg === "chat") { segW.set(1, true); slBW.set(3.35, true); segP.set(1, true); setTimeout(() => segP.set(2, true), 1200); }
  };
  Theme.on(() => draw());
  Loop.add(stage.canvas, tick);
  update();
});
