/* =====================================================================
   Layer 5 · Systems software — split a model across GPUs.
   Timing model (per training step, fixed global batch):
     compute per GPU = C1 / N
     data:     + ring all-reduce of gradients (2 bytes/param)
     tensor:   + 4 all-reduces of activations per layer
     pipeline: + small point-to-point sends, plus the pipeline bubble
   Memory: 16 bytes per parameter of training state; 80 GB per GPU.
   ===================================================================== */

defineMount("parallel", (root) => {
  const MODELS = {
    1: { P: 1e9, d: 2048, L: 24 },
    7: { P: 7e9, d: 4096, L: 32 },
    70: { P: 70e9, d: 8192, L: 80 },
  };
  const BATCH = 262144; // tokens per step
  const FLOPS = 400e12; // effective FLOP/s per GPU
  const LINK = { fast: { bw: 400e9, lat: 10e-6, name: "fast links inside a rack" }, slow: { bw: 50e9, lat: 25e-6, name: "slower links between racks" } };
  const GPU_MEM = 80;
  let strat = "data", N = 8, msize = 1, link = "fast", micro = 4;

  function model() {
    const M = MODELS[msize], Lk = LINK[link];
    const C1 = (6 * M.P * BATCH) / FLOPS;
    const comp = C1 / N;
    const ring = (bytes) => (2 * (N - 1) / N) * bytes / Lk.bw + 2 * (N - 1) * Lk.lat;
    let comm = 0, idle = 0, memGB;
    if (strat === "data") {
      comm = ring(2 * M.P);
      memGB = (16 * M.P) / 1e9;
    } else if (strat === "tensor") {
      comm = 4 * M.L * ring(BATCH * M.d * 2);
      memGB = (16 * M.P) / 1e9 / N;
    } else {
      const m = micro;
      const tmb = comp / m;
      idle = (N - 1) * tmb;
      comm = N > 1 ? (4 * BATCH * M.d) / Lk.bw + 2 * m * Lk.lat : 0;
      memGB = (16 * M.P) / 1e9 / N;
    }
    if (N === 1) { comm = 0; idle = 0; }
    const step = comp + comm + idle;
    return { C1, comp, comm, idle, step, memGB, fits: memGB <= GPU_MEM, speedup: C1 / step, eff: C1 / step / N };
  }

  let L = {};
  let play = 0;
  const stage = new Stage(root, {
    label: "GPUs holding pieces of a model, with a timeline of computing, communicating and waiting for one training step.",
    height: (w) => (w >= 600 ? clamp(w * 0.64, 380, 460) : clamp(w * 1.25, 440, 520)),
    onResize: (w, hh) => { L = { w, hh, topH: Math.round(hh * 0.42) }; },
    draw: () => draw(),
  });

  const LAYERS_DRAWN = 16;
  function tick(dt) {
    play = (play + dt / 3.2) % 1.15;
    draw();
  }

  function segmentsFor(i, m) {
    // returns [{t0, t1, kind}] for GPU i over one step, in seconds
    const segs = [];
    if (strat === "data") {
      segs.push({ t0: 0, t1: m.comp, k: "comp" });
      if (m.comm) segs.push({ t0: m.comp, t1: m.comp + m.comm, k: "comm" });
    } else if (strat === "tensor") {
      const chunks = 8;
      const c = m.comp / chunks, k = m.comm / chunks;
      for (let j = 0; j < chunks; j++) {
        segs.push({ t0: j * (c + k), t1: j * (c + k) + c, k: "comp" });
        if (k) segs.push({ t0: j * (c + k) + c, t1: (j + 1) * (c + k), k: "comm" });
      }
    } else {
      const mm = micro;
      const tmb = m.comp / mm;
      const uf = tmb / 3, ub = (2 * tmb) / 3;
      const cm = m.comm / Math.max(1, 2 * mm);
      for (let j = 0; j < mm; j++) segs.push({ t0: (i + j) * uf, t1: (i + j + 1) * uf, k: "comp" });
      const b0 = (mm + N - 1) * uf;
      for (let j = 0; j < mm; j++) segs.push({ t0: b0 + (N - 1 - i + j) * ub, t1: b0 + (N - 1 - i + j + 1) * ub, k: "comp", back: true });
      if (cm > 0) {
        // tiny sends after each forward chunk
        for (let j = 0; j < mm; j++) { const t = (i + j + 1) * uf; segs.push({ t0: t, t1: t + Math.min(cm, uf * 0.2), k: "comm" }); }
      }
    }
    return segs;
  }

  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w || !L.w) return;
    stage.clear();
    const m = model();
    const acc = C.l5, net = C.l2, mono = Theme.mono;
    const rows = N > 8 ? 2 : 1, perRow = Math.min(N, 8);
    const gap = 8;
    const gw = Math.min(88, (L.w - gap * (perRow - 1)) / perRow);
    const gh = (L.topH - 26 - (rows - 1) * gap) / rows;
    const x0 = (L.w - (gw * perRow + gap * (perRow - 1))) / 2;
    const tNow = play * m.step;
    c.font = `600 10px ${mono}`; c.textAlign = "left"; c.fillStyle = C.muted;
    c.fillText(`${N} GPUS · WHAT EACH ONE HOLDS`, x0, 12);

    for (let i = 0; i < N; i++) {
      const gx = x0 + (i % perRow) * (gw + gap), gy = 20 + Math.floor(i / perRow) * (gh + gap);
      const segs = segmentsFor(i, m);
      const cur = segs.find((s) => tNow >= s.t0 && tNow < s.t1);
      const state = play > 1 ? "done" : cur ? cur.k : "idle";
      c.fillStyle = C.sunk;
      c.strokeStyle = !m.fits ? C.bad : state === "comp" ? acc : state === "comm" ? net : C["line-2"];
      c.lineWidth = state === "comp" || state === "comm" || !m.fits ? 2 : 1;
      roundRect(c, gx, gy, gw, gh, 6); c.fill(); c.stroke();
      // model layers
      const memW = 8;
      const lx = gx + 6, lw = gw - 18 - memW, ly = gy + 6, lh = gh - 12;
      const bh = lh / LAYERS_DRAWN;
      for (let l = 0; l < LAYERS_DRAWN; l++) {
        const y = ly + l * bh;
        const hue = rgba(acc, 0.15);
        c.fillStyle = hue; c.fillRect(lx, y + 0.5, lw, Math.max(1, bh - 1));
        let on = false, sx = lx, sw = lw;
        if (strat === "data") on = true;
        else if (strat === "tensor") { on = true; sw = lw / N; sx = lx + (lw * i) / N; }
        else on = Math.floor((l * N) / LAYERS_DRAWN) === i || (N > LAYERS_DRAWN && l === Math.floor(i * LAYERS_DRAWN / N));
        if (on) {
          c.fillStyle = state === "comp" ? acc : rgba(acc, 0.65);
          c.fillRect(sx, y + 0.5, Math.max(1, sw), Math.max(1, bh - 1));
        }
      }
      // memory bar
      const mx = gx + gw - memW - 5, my = gy + 6, mh = gh - 12;
      c.fillStyle = rgba(C.text, 0.1); c.fillRect(mx, my, memW, mh);
      const frac = m.memGB / GPU_MEM;
      c.fillStyle = frac > 1 ? C.bad : C.l7;
      const fh = Math.min(1, frac) * mh;
      c.fillRect(mx, my + mh - fh, memW, fh);
      if (frac > 1) { c.fillStyle = C.bad; c.fillRect(mx - 2, my - 4, memW + 4, 3); }
    }
    // links (for comm animation)
    if (N > 1) {
      const anyComm = segmentsFor(0, m).some((s) => s.k === "comm" && tNow >= s.t0 && tNow < s.t1);
      c.strokeStyle = anyComm ? net : rgba(net, 0.25); c.lineWidth = anyComm ? 2.5 : 1.5;
      const yl = 20 + rows * (gh + gap) - gap + 5;
      c.beginPath(); c.moveTo(x0, yl); c.lineTo(x0 + perRow * (gw + gap) - gap, yl); c.stroke();
      c.fillStyle = C.faint; c.textAlign = "right";
      c.fillText(link === "fast" ? "FAST LINKS" : "SLOW LINKS", x0 + perRow * (gw + gap) - gap, yl + 12);
    }

    // Gantt
    const gy0 = L.topH + 16, gH = L.hh - gy0 - 44;
    const labelW = 44;
    const gx0 = labelW, gx1 = L.w - 6;
    const tMax = Math.max(m.step, m.C1 / N) * 1.04;
    const X = (t) => gx0 + (t / tMax) * (gx1 - gx0);
    const rh = Math.min(22, gH / N);
    c.fillStyle = C.muted; c.textAlign = "left";
    c.fillText("ONE TRAINING STEP, GPU BY GPU  →  TIME", 0, gy0 - 4);
    for (let i = 0; i < N; i++) {
      const y = gy0 + 4 + i * rh;
      c.fillStyle = rgba(C.text, 0.05); c.fillRect(gx0, y, gx1 - gx0, rh - 2);
      if (rh >= 9) { c.fillStyle = C.faint; c.textAlign = "right"; c.font = `600 9px ${mono}`; c.fillText(`GPU ${i + 1}`, gx0 - 5, y + rh / 2 + 3); }
      for (const sg of segmentsFor(i, m)) {
        const xa = X(sg.t0), xb = X(sg.t1);
        if (sg.k === "comp") { c.fillStyle = sg.back ? rgba(acc, 0.7) : acc; c.fillRect(xa, y, Math.max(0.8, xb - xa), rh - 2); }
        else {
          c.fillStyle = rgba(net, 0.85);
          c.fillRect(xa, y, Math.max(0.8, xb - xa), rh - 2);
        }
      }
    }
    // perfect split marker
    const xp = X(m.C1 / N);
    c.setLineDash([3, 3]); c.strokeStyle = rgba(C.text, 0.5); c.lineWidth = 1;
    c.beginPath(); c.moveTo(xp, gy0); c.lineTo(xp, gy0 + 6 + N * rh); c.stroke(); c.setLineDash([]);
    c.fillStyle = C.muted; c.font = `600 9px ${mono}`; c.textAlign = xp > gx1 - 80 ? "right" : "left";
    c.fillText("PERFECT SPLIT", xp + (c.textAlign === "left" ? 4 : -4), gy0 + 18 + N * rh);
    // playhead
    if (play <= 1) {
      const xh = X(tNow);
      c.strokeStyle = C.text; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(xh, gy0 + 2); c.lineTo(xh, gy0 + 6 + N * rh); c.stroke();
    }
    // legend
    const ly2 = gy0 + 40 + N * rh;
    c.textAlign = "left"; c.font = `600 10px ${mono}`;
    let lx2 = gx0;
    for (const [col, txt] of [[acc, "computing"], [net, "communicating"], [rgba(C.text, 0.12), "idle"]]) {
      c.fillStyle = col; c.fillRect(lx2, ly2 - 8, 10, 10);
      c.fillStyle = C.muted; c.fillText(txt, lx2 + 14, ly2);
      lx2 += c.measureText(txt).width + 34;
    }
    if (!m.fits) {
      c.fillStyle = rgba(C.bg, 0.72); c.fillRect(0, gy0 - 14, L.w, L.hh - gy0 + 14);
      c.fillStyle = C.bad; c.textAlign = "center"; c.font = `700 14px ${Theme.body}`;
      c.fillText(`Doesn't fit: each GPU would need ${fmtInt(m.memGB)} GB, and has ${GPU_MEM} GB.`, L.w / 2, gy0 + gH / 2);
    }
  }

  const segS = segmented({
    label: "Strategy",
    options: [{ value: "data", label: "Data" }, { value: "tensor", label: "Tensor" }, { value: "pipeline", label: "Pipeline" }],
    value: strat, onChange: (v) => { strat = v; update(); },
  });
  const segN = segmented({
    label: "GPUs",
    options: [2, 4, 8, 16].map((v) => ({ value: v, label: String(v) })),
    value: N, onChange: (v) => { N = v; update(); },
  });
  const segM = segmented({
    label: "Model size",
    options: [{ value: 1, label: "1B" }, { value: 7, label: "7B" }, { value: 70, label: "70B" }],
    value: msize, onChange: (v) => { msize = v; update(); },
  });
  const segL = segmented({
    label: "Links",
    options: [{ value: "fast", label: "Fast" }, { value: "slow", label: "Slow" }],
    value: link, onChange: (v) => { link = v; update(); },
  });
  const slMicro = slider({
    label: "Micro-batches (pipeline)", min: 1, max: 32, step: 1, value: micro,
    fmt: (v) => String(v),
    ticks: [{ v: 1, label: "1" }, { v: 8, label: "8" }, { v: 16, label: "16" }, { v: 32, label: "32" }],
    onInput: (v) => { micro = v; update(); },
  });
  root.append(h("div", { class: "ctl-row" }, segS.el, segN.el), h("div", { class: "ctl-row" }, segM.el, segL.el, slMicro.el));
  const roSp = readout("Speed-up");
  const roEff = readout("Efficiency");
  const roMem = readout("Memory per GPU");
  const roCom = readout("Talking");
  const roIdle = readout("Idle");
  root.append(h("div", { class: "readouts" }, roSp.el, roEff.el, roMem.el, roCom.el, roIdle.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  function update() {
    const m = model();
    slMicro.el.classList.toggle("is-off", strat !== "pipeline");
    slMicro.input.disabled = strat !== "pipeline";
    roMem.set(fmtNum(m.memGB, 2), " GB", `of ${GPU_MEM} GB`); roMem.state(m.fits ? null : "bad");
    if (!m.fits) {
      roSp.set("—"); roEff.set("—"); roCom.set("—"); roIdle.set("—");
      roSp.state("bad");
      const need = Math.ceil((16 * MODELS[msize].P) / 1e9 / GPU_MEM);
      status.innerHTML = strat === "data"
        ? `<b class="bad">Data parallel keeps a full copy on every GPU,</b> so adding GPUs doesn't help: training a ${msize}B model needs ~${fmtInt(m.memGB)} GB for weights, gradients and optimizer state. Split the model with Tensor or Pipeline instead.`
        : `<b class="bad">Still too big:</b> split ${N} ways, each GPU needs ${fmtInt(m.memGB)} GB. This model needs at least ${need} GPUs.`;
    } else {
      roSp.set(fmtNum(m.speedup, 2), "×", `on ${N} GPUs`); roSp.state("hi");
      roEff.set(Math.round(m.eff * 100), "%"); roEff.state(m.eff < 0.5 ? "bad" : m.eff > 0.85 ? "good" : null);
      roCom.set(Math.round((m.comm / m.step) * 100), "%");
      roIdle.set(Math.round((m.idle / m.step) * 100), "%");
      const lk = LINK[link].name;
      if (strat === "data") status.innerHTML = `<b>Data parallel:</b> each GPU trains on its own slice of the batch, then they average gradients once per step over ${lk}. Cheap to coordinate, but every GPU must hold the whole model.${msize === 1 ? " Try the 7B model." : ""}`;
      else if (strat === "tensor") status.innerHTML = `<b>Tensor parallel:</b> every layer is sliced ${N} ways, so the GPUs swap partial results ${4 * MODELS[msize].L} times per step. ${link === "fast" ? "On fast links that's affordable. Try slow links." : "On slow links, talking swamps computing."}`;
      else status.innerHTML = `<b>Pipeline parallel:</b> each GPU holds ${N > 1 ? "a stretch of layers" : "every layer"} and passes activations to the next. Little talking, but GPUs sit idle while the pipeline fills and drains. ${micro < 8 ? "Split the batch into more micro-batches to shrink the idle time." : "More micro-batches shrink the idle wedge."}`;
    }
    Loop.wake();
  }
  Actions.parallel = (arg) => {
    if (arg === "slow") {
      segS.set("tensor", false); strat = "tensor"; segN.set(8, false); N = 8; segM.set(7, false); msize = 7; segL.set("fast", true);
      setTimeout(() => segL.set("slow", true), 1400);
    }
  };
  Theme.on(draw);
  Loop.add(stage.canvas, tick);
  update();
});
