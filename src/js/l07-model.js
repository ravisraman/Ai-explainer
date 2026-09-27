/* =====================================================================
   Layer 7 · The model — (a) neural-network playground, (b) embedding
   map with vector arithmetic, (c) multi-head attention.
   ===================================================================== */

/* ---------- (a) Tune a network by hand ---------- */
defineMount("nn", (root) => {
  const R = rng(5);
  const DATA = {
    groups: () => {
      const pts = [];
      for (let i = 0; i < 40; i++) {
        const c = i % 2;
        pts.push([clamp((c ? 0.45 : -0.45) + gauss(R) * 0.22, -0.95, 0.95), clamp((c ? 0.35 : -0.35) + gauss(R) * 0.22, -0.95, 0.95), c]);
      }
      return pts;
    },
    xor: () => {
      const pts = [];
      for (let i = 0; i < 48; i++) {
        const sx = i % 2 ? 1 : -1, sy = Math.floor(i / 2) % 2 ? 1 : -1;
        pts.push([clamp(sx * 0.5 + gauss(R) * 0.16, -0.95, 0.95), clamp(sy * 0.5 + gauss(R) * 0.16, -0.95, 0.95), sx * sy > 0 ? 1 : 0]);
      }
      return pts;
    },
    circle: () => {
      const pts = [];
      for (let i = 0; i < 56; i++) {
        const c = i % 2;
        const r = c ? R() * 0.4 : 0.62 + R() * 0.3, a = R() * Math.PI * 2;
        pts.push([r * Math.cos(a), r * Math.sin(a), c]);
      }
      return pts;
    },
  };
  let dsName = "xor", pts = DATA.xor(), H = 3;
  let W1, b1, W2, b2;
  let adam;
  function scramble() {
    W1 = Array.from({ length: 6 }, () => [gauss(R) * 1.4, gauss(R) * 1.4]);
    b1 = Array.from({ length: 6 }, () => gauss(R) * 0.4);
    W2 = Array.from({ length: 6 }, () => gauss(R) * 1.2);
    b2 = 0;
    adam = { t: 0, m: new Float64Array(25), v: new Float64Array(25) };
  }
  scramble();
  const sig = (z) => 1 / (1 + Math.exp(-z));
  function forward(x, y) {
    const hs = [];
    let z = b2;
    for (let j = 0; j < H; j++) { const a = Math.tanh(W1[j][0] * x + W1[j][1] * y + b1[j]); hs.push(a); z += W2[j] * a; }
    return { hs, p: sig(z) };
  }
  function lossAcc() {
    let L = 0, ok = 0;
    for (const [x, y, c] of pts) { const p = clamp(forward(x, y).p, 1e-7, 1 - 1e-7); L += -(c ? Math.log(p) : Math.log(1 - p)); if ((p > 0.5) === !!c) ok++; }
    return { loss: L / pts.length, acc: ok / pts.length };
  }
  /* one full-batch Adam step on cross-entropy */
  function trainStep(lr = 0.05) {
    const g = new Float64Array(25);
    for (const [x, y, c] of pts) {
      const { hs, p } = forward(x, y);
      const dz = p - c;
      for (let j = 0; j < H; j++) {
        g[18 + j] += dz * hs[j];
        const dh = dz * W2[j] * (1 - hs[j] * hs[j]);
        g[j * 2] += dh * x; g[j * 2 + 1] += dh * y; g[12 + j] += dh;
      }
      g[24] += dz;
    }
    const n = pts.length;
    adam.t++;
    const b1c = 1 - Math.pow(0.9, adam.t), b2c = 1 - Math.pow(0.999, adam.t);
    const upd = (k, get, set) => {
      const gk = g[k] / n;
      adam.m[k] = 0.9 * adam.m[k] + 0.1 * gk;
      adam.v[k] = 0.999 * adam.v[k] + 0.001 * gk * gk;
      set(get() - (lr * (adam.m[k] / b1c)) / (Math.sqrt(adam.v[k] / b2c) + 1e-8));
    };
    for (let j = 0; j < H; j++) {
      upd(j * 2, () => W1[j][0], (v) => (W1[j][0] = clamp(v, -8, 8)));
      upd(j * 2 + 1, () => W1[j][1], (v) => (W1[j][1] = clamp(v, -8, 8)));
      upd(12 + j, () => b1[j], (v) => (b1[j] = clamp(v, -8, 8)));
      upd(18 + j, () => W2[j], (v) => (W2[j] = clamp(v, -8, 8)));
    }
    upd(24, () => b2, (v) => (b2 = clamp(v, -8, 8)));
  }

  /* ---------- drawing ---------- */
  let L = {};
  let sel = { kind: "w1", j: 0, i: 0 };
  let hover = null, learning = false, steps = 0;
  const stage = new Stage(root, {
    label: "A small neural network diagram next to a map of its output over the input plane, with colored data points.",
    height: (w) => (w >= 560 ? clamp(w * 0.5, 300, 380) : clamp(w * 1.5, 480, 580)),
    onResize: (w, hh) => {
      const wide = w >= 560;
      const mapS = wide ? Math.min(hh - 20, w * 0.44) : Math.min(w - 10, hh * 0.55);
      L = wide
        ? { wide, net: { x: 0, y: 0, w: w - mapS - 24, h: hh }, map: { x: w - mapS - 4, y: (hh - mapS) / 2, s: mapS } }
        : { wide, net: { x: 0, y: mapS + 16, w, h: hh - mapS - 16 }, map: { x: (w - mapS) / 2, y: 4, s: mapS } };
      layoutNet();
    },
    draw: () => draw(),
  });
  let nodes = {};
  function layoutNet() {
    const N = L.net;
    const xi = N.x + 26, xh = N.x + N.w * 0.52, xo = N.x + N.w - 30;
    const cy = N.y + N.h / 2;
    const hs = Math.min(64, (N.h - 30) / Math.max(H, 1));
    const r = Math.min(24, hs * 0.42);
    nodes = {
      inp: [[xi, cy - 44], [xi, cy + 44]],
      hid: Array.from({ length: H }, (_, j) => [xh, cy + (j - (H - 1) / 2) * hs]),
      out: [xo, cy], r,
    };
  }
  const edges = () => {
    const E = [];
    for (let j = 0; j < H; j++) for (let i = 0; i < 2; i++) E.push({ kind: "w1", j, i, a: nodes.inp[i], b: nodes.hid[j] });
    for (let j = 0; j < H; j++) E.push({ kind: "w2", j, a: nodes.hid[j], b: nodes.out });
    return E;
  };
  const getW = (e) => (e.kind === "w1" ? W1[e.j][e.i] : e.kind === "w2" ? W2[e.j] : e.kind === "b1" ? b1[e.j] : b2);
  const setW = (e, v) => { v = clamp(v, -8, 8); if (e.kind === "w1") W1[e.j][e.i] = v; else if (e.kind === "w2") W2[e.j] = v; else if (e.kind === "b1") b1[e.j] = v; else b2 = v; };
  const same = (a, b) => a && b && a.kind === b.kind && a.j === b.j && (a.i ?? 0) === (b.i ?? 0);

  const mapImg = document.createElement("canvas");
  const RES = 48;
  mapImg.width = mapImg.height = RES;
  const mctx = mapImg.getContext("2d");
  const hidImg = document.createElement("canvas");
  hidImg.width = hidImg.height = 16;
  const hctx = hidImg.getContext("2d");
  function hexRGB(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  function paintMap() {
    const C = Theme.c;
    const A = hexRGB(C.l2), B = hexRGB(C.l7), bg = hexRGB(Theme.dark ? "#0d0c12" : "#ffffff");
    const img = mctx.createImageData(RES, RES);
    for (let py = 0; py < RES; py++) for (let px = 0; px < RES; px++) {
      const x = (px / (RES - 1)) * 2 - 1, y = 1 - (py / (RES - 1)) * 2;
      const p = forward(x, y).p;
      const t = Math.abs(p - 0.5) * 2;
      const col = p > 0.5 ? B : A;
      const k = (py * RES + px) * 4;
      for (let ch = 0; ch < 3; ch++) img.data[k + ch] = Math.round(lerp(bg[ch], col[ch], 0.15 + 0.6 * t));
      img.data[k + 3] = 255;
    }
    mctx.putImageData(img, 0, 0);
  }
  function paintHidden(j) {
    const C = Theme.c;
    const A = hexRGB(C.l2), B = hexRGB(C.l7), bg = hexRGB(Theme.dark ? "#0d0c12" : "#ffffff");
    const img = hctx.createImageData(16, 16);
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const x = (px / 15) * 2 - 1, y = 1 - (py / 15) * 2;
      const a = Math.tanh(W1[j][0] * x + W1[j][1] * y + b1[j]);
      const col = a > 0 ? B : A;
      const k = (py * 16 + px) * 4;
      for (let ch = 0; ch < 3; ch++) img.data[k + ch] = Math.round(lerp(bg[ch], col[ch], 0.1 + 0.8 * Math.abs(a)));
      img.data[k + 3] = 255;
    }
    hctx.putImageData(img, 0, 0);
  }

  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w || !L.map) return;
    stage.clear();
    const pos = C.l7, neg = C.l2, mono = Theme.mono;
    // edges
    for (const e of edges()) {
      const w = getW(e);
      const isSel = same(e, sel), isHov = same(e, hover);
      c.strokeStyle = w >= 0 ? pos : neg;
      c.globalAlpha = isSel || isHov ? 1 : 0.35 + 0.5 * Math.min(1, Math.abs(w) / 3);
      c.lineWidth = 1 + Math.min(9, Math.abs(w) * 1.6) + (isSel ? 2 : 0);
      c.beginPath(); c.moveTo(e.a[0], e.a[1]); c.lineTo(e.b[0], e.b[1]); c.stroke();
      c.globalAlpha = 1;
      if (isSel) {
        const mx = lerp(e.a[0], e.b[0], 0.5), my = lerp(e.a[1], e.b[1], 0.5);
        const t = (w >= 0 ? "+" : "") + w.toFixed(2);
        c.font = `700 11px ${mono}`;
        const tw = c.measureText(t).width + 10;
        c.fillStyle = C.text; roundRect(c, mx - tw / 2, my - 10, tw, 18, 5); c.fill();
        c.fillStyle = C.bg; c.textAlign = "center"; c.fillText(t, mx, my + 3);
      }
    }
    // input nodes
    c.font = `700 13px ${mono}`; c.textAlign = "center";
    nodes.inp.forEach(([x, y], i) => {
      c.fillStyle = C.raised; c.strokeStyle = C.muted; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, y, 18, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = C.text; c.fillText(i ? "y" : "x", x, y + 4.5);
    });
    // hidden nodes with mini maps
    const r = nodes.r;
    nodes.hid.forEach(([x, y], j) => {
      paintHidden(j);
      c.save();
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
      c.imageSmoothingEnabled = true;
      c.drawImage(hidImg, x - r, y - r, r * 2, r * 2);
      c.restore();
      const isSel = sel.kind === "b1" && sel.j === j;
      c.strokeStyle = isSel ? C.text : C.muted; c.lineWidth = isSel ? 3 : 1.5;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    });
    // output node
    const [ox, oy] = nodes.out;
    c.fillStyle = C.raised; c.strokeStyle = sel.kind === "b2" ? C.text : C.muted; c.lineWidth = sel.kind === "b2" ? 3 : 1.5;
    c.beginPath(); c.arc(ox, oy, 20, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = C.text; c.font = `700 11px ${mono}`; c.fillText("out", ox, oy + 4);
    c.fillStyle = C.faint; c.font = `600 10px ${mono}`;
    c.fillText("INPUTS", nodes.inp[0][0], L.net.y + 14);
    c.fillText("HIDDEN", nodes.hid[0][0], L.net.y + 14);
    c.fillText("OUTPUT", ox, L.net.y + 14);

    // output map
    paintMap();
    const M = L.map;
    c.imageSmoothingEnabled = true;
    c.save(); roundRect(c, M.x, M.y, M.s, M.s, 10); c.clip();
    c.drawImage(mapImg, M.x, M.y, M.s, M.s);
    c.restore();
    c.strokeStyle = C.line; c.lineWidth = 1; roundRect(c, M.x, M.y, M.s, M.s, 10); c.stroke();
    for (const [x, y, cl] of pts) {
      const sx = M.x + ((x + 1) / 2) * M.s, sy = M.y + ((1 - y) / 2) * M.s;
      c.fillStyle = cl ? pos : neg; c.strokeStyle = Theme.dark ? "#ffffff" : "#15131c"; c.lineWidth = 1.3;
      c.beginPath(); c.arc(sx, sy, Math.max(3.5, M.s / 70), 0, Math.PI * 2); c.fill(); c.stroke();
    }
  }

  /* ---------- interaction: drag edges (mouse, pen, touch) ---------- */
  function hit(p) {
    for (let j = 0; j < H; j++) { const [x, y] = nodes.hid[j]; if (Math.hypot(p.x - x, p.y - y) < nodes.r) return { kind: "b1", j }; }
    if (Math.hypot(p.x - nodes.out[0], p.y - nodes.out[1]) < 20) return { kind: "b2", j: 0 };
    let best = null, bd = 12;
    for (const e of edges()) {
      const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1];
      const t = clamp(((p.x - e.a[0]) * dx + (p.y - e.a[1]) * dy) / (dx * dx + dy * dy), 0.08, 0.92);
      const d = Math.hypot(p.x - (e.a[0] + t * dx), p.y - (e.a[1] + t * dy));
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  let drag = null;
  const posOf = (cx, cy) => { const r = stage.canvas.getBoundingClientRect(); return { x: cx - r.left, y: cy - r.top }; };
  function startDrag(p) {
    const e = hit(p);
    if (!e) return false;
    sel = e; drag = { e, y0: p.y, w0: getW(e) };
    learning = false; syncLearn();
    syncSel(); draw();
    return true;
  }
  function moveDrag(p) {
    if (!drag) return;
    setW(drag.e, drag.w0 + (drag.y0 - p.y) / 22);
    wSlider.set(getW(drag.e)); steps = 0; refresh();
  }
  stage.canvas.addEventListener("mousedown", (ev) => { if (startDrag(posOf(ev.clientX, ev.clientY))) ev.preventDefault(); });
  window.addEventListener("mousemove", (ev) => {
    if (drag) { moveDrag(posOf(ev.clientX, ev.clientY)); return; }
    const p = posOf(ev.clientX, ev.clientY);
    if (p.x < 0 || p.y < 0 || p.x > stage.w || p.y > stage.h) return;
    const e = hit(p);
    if (!same(e, hover)) { hover = e; stage.canvas.style.cursor = e ? "ns-resize" : ""; draw(); }
  });
  window.addEventListener("mouseup", () => { drag = null; });
  stage.canvas.addEventListener("touchstart", (ev) => {
    const t = ev.touches[0];
    if (ev.touches.length === 1 && startDrag(posOf(t.clientX, t.clientY))) ev.preventDefault();
  }, { passive: false });
  stage.canvas.addEventListener("touchmove", (ev) => { if (drag) { ev.preventDefault(); const t = ev.touches[0]; moveDrag(posOf(t.clientX, t.clientY)); } }, { passive: false });
  stage.canvas.addEventListener("touchend", () => { drag = null; });

  /* ---------- controls ---------- */
  const wSlider = slider({
    label: "Selected weight", min: -8, max: 8, step: 0.05, value: getW(sel),
    fmt: (v) => (v >= 0 ? "+" : "") + v.toFixed(2),
    ticks: [{ v: -8, label: "−8" }, { v: 0, label: "0" }, { v: 8, label: "+8" }],
    onInput: (v) => { setW(sel, v); learning = false; syncLearn(); steps = 0; refresh(); },
  });
  const selLabel = h("span", { class: "nn-sel" });
  const segD = segmented({
    label: "Data",
    options: [{ value: "groups", label: "Two groups" }, { value: "xor", label: "XOR" }, { value: "circle", label: "Circle" }],
    value: dsName, onChange: (v) => { dsName = v; pts = DATA[v](); steps = 0; refresh(); },
  });
  const stH = stepper({ label: "Hidden neurons", value: H, min: 1, max: 6, onChange: (v) => { H = v; if (sel.j >= H) sel = { kind: "w2", j: 0 }; layoutNet(); syncSel(); refresh(); } });
  const bLearn = button("Learn", () => { learning = !learning; syncLearn(); Loop.wake(); }, { kind: "primary", icon: "play" });
  const bStep = button("Step", () => { for (let k = 0; k < 10; k++) trainStep(); steps += 10; wSlider.set(getW(sel)); refresh(); }, { icon: "step", small: true });
  const bScr = button("Scramble", () => { scramble(); steps = 0; wSlider.set(getW(sel)); refresh(); }, { icon: "dice", small: true });
  const syncLearn = () => bLearn.setLabel(learning ? "Pause" : "Learn", learning ? "pause" : "play");
  root.append(
    h("div", { class: "ctl-row" }, h("div", { class: "ctl nn-wctl" }, wSlider.el, selLabel)),
    h("div", { class: "ctl-row" }, segD.el, stH.el, h("div", { class: "btn-row" }, bLearn, bStep, bScr))
  );
  const roL = readout("Loss"), roA = readout("Accuracy"), roS = readout("Learning steps");
  root.append(h("div", { class: "readouts" }, roL.el, roA.el, roS.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  function syncSel() {
    wSlider.set(getW(sel));
    const nm = sel.kind === "w1" ? `from input ${sel.i ? "y" : "x"} to hidden neuron ${sel.j + 1}`
      : sel.kind === "w2" ? `from hidden neuron ${sel.j + 1} to the output`
      : sel.kind === "b1" ? `bias of hidden neuron ${sel.j + 1}` : "bias of the output";
    selLabel.textContent = `Selected: ${nm}. Drag any line or circle in the diagram, or use this slider.`;
  }
  function refresh() {
    const { loss, acc } = lossAcc();
    roL.set(loss.toFixed(3));
    roA.set(Math.round(acc * 100), "%"); roA.state(acc >= 0.98 ? "good" : null);
    roS.set(fmtInt(steps));
    if (dsName === "xor" && H === 1 && steps > 150) status.innerHTML = `<b>Stuck at ${Math.round(acc * 100)}%.</b> One hidden neuron draws one straight boundary, and XOR needs two. Add a neuron and keep learning.`;
    else if (acc >= 0.98) status.innerHTML = `<b>Solved.</b> Each hidden neuron splits the plane with one straight line (see its little map); the output blends them into the boundary you see.`;
    else if (learning) status.innerHTML = `Learning: every step nudges all ${3 * H + H + 1} numbers slightly downhill on the loss.`;
    else status.innerHTML = `Drag the lines to set weights by hand, or press <b>Learn</b> and let gradient descent set them.`;
    draw();
  }
  function tick() {
    if (learning) {
      for (let k = 0; k < 4; k++) trainStep();
      steps += 4;
      if (!drag) wSlider.set(getW(sel));
      refresh();
      if (steps > 4000) { learning = false; syncLearn(); }
    }
  }
  Actions.nn = (arg) => {
    if (arg === "xor1") { segD.set("xor", true); stH.set(1); H = 1; sel = { kind: "w2", j: 0 }; layoutNet(); scramble(); steps = 0; syncSel(); learning = true; syncLearn(); refresh(); Loop.wake(); }
  };
  Theme.on(draw);
  Loop.add(stage.canvas, tick, () => learning);
  syncSel();
  refresh();
});

/* ---------- (b) Words as points ---------- */
defineMount("embed", (root) => {
  // dims: 0 royal 1 female 2 young 3 person 4 animal 5 canine 6 feline 7 wild
  // 8 capital 9 country 10 FR 11 JP 12 IT 13 EG 14 food 15 verb 16 past
  // 17 walk 18 swim 19 run 20 eat 21 national dish 22 staple 23 bread-ness 24 apple-ness
  const D = 25;
  const W = {};
  const v = (pairs) => { const a = new Array(D).fill(0); for (const [k, x] of pairs) a[k] = x; return a; };
  const P = [3, 1];
  Object.assign(W, {
    king: v([[0, 1], [1, -1], P]), queen: v([[0, 1], [1, 1], P]),
    prince: v([[0, 1], [1, -1], [2, 1], P]), princess: v([[0, 1], [1, 1], [2, 1], P]),
    man: v([[1, -1], P]), woman: v([[1, 1], P]), boy: v([[1, -1], [2, 1], P]), girl: v([[1, 1], [2, 1], P]),
    dog: v([[4, 1], [5, 1]]), puppy: v([[4, 1], [5, 1], [2, 1]]), cat: v([[4, 1], [6, 1]]), kitten: v([[4, 1], [6, 1], [2, 1]]),
    wolf: v([[4, 1], [5, 0.8], [7, 1]]), tiger: v([[4, 1], [6, 0.8], [7, 1]]),
    France: v([[9, 1], [10, 1]]), Paris: v([[8, 1], [10, 1]]), Japan: v([[9, 1], [11, 1]]), Tokyo: v([[8, 1], [11, 1]]),
    Italy: v([[9, 1], [12, 1]]), Rome: v([[8, 1], [12, 1]]), Egypt: v([[9, 1], [13, 1]]), Cairo: v([[8, 1], [13, 1]]),
    croissant: v([[14, 1], [21, 1], [10, 0.7]]), sushi: v([[14, 1], [21, 1], [11, 0.7]]), pizza: v([[14, 1], [21, 1], [12, 0.7]]), falafel: v([[14, 1], [21, 1], [13, 0.7]]),
    bread: v([[14, 1], [22, 1], [23, 1], [10, 0.15], [12, 0.15]]), rice: v([[14, 1], [22, 1], [11, 0.3]]), apple: v([[14, 1], [22, 1], [24, 1]]),
    walk: v([[15, 1], [17, 1]]), walked: v([[15, 1], [16, 1], [17, 1]]), swim: v([[15, 1], [18, 1]]), swam: v([[15, 1], [16, 1], [18, 1]]),
    run: v([[15, 1], [19, 1]]), ran: v([[15, 1], [16, 1], [19, 1]]), eat: v([[15, 1], [20, 1], [14, 0.15]]), ate: v([[15, 1], [16, 1], [20, 1], [14, 0.15]]),
  });
  const R = rng(9);
  for (const k in W) W[k] = W[k].map((x) => x + (R() - 0.5) * 0.04);
  const WORDS = Object.keys(W);
  const GROUPS = {
    PEOPLE: ["king", "queen", "prince", "princess", "man", "woman", "boy", "girl"],
    ANIMALS: ["dog", "puppy", "cat", "kitten", "wolf", "tiger"],
    PLACES: ["France", "Paris", "Japan", "Tokyo", "Italy", "Rome", "Egypt", "Cairo"],
    FOOD: ["croissant", "sushi", "pizza", "falafel", "bread", "rice", "apple"],
    VERBS: ["walk", "walked", "swim", "swam", "run", "ran", "eat", "ate"],
  };
  // hand-built linear projection to 2-D (so arithmetic stays parallel on screen)
  const PX = new Array(D).fill(0), PY = new Array(D).fill(0);
  const set2 = (k, x, y) => { PX[k] = x; PY[k] = y; };
  set2(3, -1.7, 1.25); set2(0, 0, 0.8); set2(1, 0.42, 0); set2(2, 0, -0.42);
  set2(4, -1.7, -0.75); set2(5, -0.4, 0); set2(6, 0.4, 0); set2(7, 0, 0.5);
  set2(9, 0.55, 1.2); set2(8, 1.45, 1.2); set2(10, 0, 0.51); set2(11, 0, 0.17); set2(12, 0, -0.17); set2(13, 0, -0.51);
  set2(14, 0.95, -0.9); set2(21, 0.5, 0); set2(22, -0.45, 0); set2(23, 0, 0.4); set2(24, 0, -0.4);
  set2(15, -0.15, -1.7); set2(16, 0, -0.42); set2(17, -1.05, 0); set2(18, -0.35, 0); set2(19, 0.35, 0); set2(20, 1.05, 0);
  const proj = (a) => [a.reduce((s, x, k) => s + x * PX[k], 0), a.reduce((s, x, k) => s + x * PY[k], 0)];
  const P2 = {};
  for (const k of WORDS) P2[k] = proj(W[k]);
  const dot = (a, b) => a.reduce((s, x, k) => s + x * b[k], 0);
  const cos = (a, b) => dot(a, b) / (Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b)) + 1e-9);
  const nearest = (vec, exclude = [], n = 3) => WORDS.filter((w) => !exclude.includes(w)).map((w) => ({ w, s: cos(vec, W[w]) })).sort((a, b) => b.s - a.s).slice(0, n);

  const PRESETS = [["king", "man", "woman"], ["Paris", "France", "Japan"], ["walked", "walk", "swim"], ["puppy", "dog", "cat"], ["sushi", "Japan", "Italy"]];
  let A = "king", B = "man", Cw = "woman", hoverW = null, showArith = true;

  let bounds = null;
  const stage = new Stage(root, {
    label: "A 2-D map of words: people, animals, places, foods and verbs cluster in groups.",
    height: (w) => (w >= 560 ? clamp(w * 0.62, 340, 460) : clamp(w * 1.05, 360, 440)),
    onResize: () => { bounds = null; },
    draw: () => draw(),
  });
  function toScreen([x, y]) {
    if (!bounds) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const k of WORDS) { const [a, b] = P2[k]; x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }
      bounds = { x0: x0 - 0.1, x1: x1 + 0.55, y0: y0 - 0.15, y1: y1 + 0.35 };
    }
    const pad = 24;
    return [pad + invLerp(bounds.x0, bounds.x1, x) * (stage.w - pad * 2), stage.h - pad - invLerp(bounds.y0, bounds.y1, y) * (stage.h - pad * 2)];
  }
  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w) return;
    stage.clear();
    const acc = C.l7, mono = Theme.mono;
    const res = showArith ? W[A].map((x, k) => x - W[B][k] + W[Cw][k]) : null;
    const top = res ? nearest(res, [A, B, Cw]) : [];
    // group labels
    c.font = `600 10px ${mono}`; c.fillStyle = C.faint; c.textAlign = "center";
    for (const g in GROUPS) {
      const ps = GROUPS[g].map((w) => P2[w]);
      const gx = ps.reduce((a, p) => a + p[0], 0) / ps.length + 0.12;
      const gy = Math.max(...ps.map((p) => p[1])) + 0.3;
      const [x, y] = toScreen([gx, gy]); c.fillText(g, x, y);
    }
    // hover neighbor lines
    if (hoverW) {
      const nb = nearest(W[hoverW], [hoverW], 3);
      const [hx, hy] = toScreen(P2[hoverW]);
      c.strokeStyle = rgba(C.text, 0.4); c.lineWidth = 1; c.setLineDash([3, 3]);
      for (const n of nb) { const [x, y] = toScreen(P2[n.w]); c.beginPath(); c.moveTo(hx, hy); c.lineTo(x, y); c.stroke(); }
      c.setLineDash([]);
    }
    // arithmetic arrows
    if (res) {
      const pa = toScreen(P2[A]), pb = toScreen(P2[B]), pc = toScreen(P2[Cw]), pr = toScreen(proj(res));
      arrow(c, pb, pc, rgba(C.l10, 0.9), true);
      arrow(c, pa, pr, C.l10, false);
      c.fillStyle = C.l10;
      star(c, pr[0], pr[1], 8);
      c.font = `700 11px ${mono}`; c.textAlign = "left";
      c.fillText("result", pr[0] + 10, pr[1] + 18);
    }
    // words
    c.font = `600 12px ${Theme.body}`;
    for (const k of WORDS) {
      const [x, y] = toScreen(P2[k]);
      const inArith = res && (k === A || k === B || k === Cw);
      const isTop = res && top[0] && top[0].w === k;
      c.fillStyle = isTop ? C.l10 : inArith ? C.text : hoverW === k ? C.text : rgba(acc, 0.85);
      c.beginPath(); c.arc(x, y, isTop ? 5 : 3.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = isTop ? C.l10 : inArith || hoverW === k ? C.text : C.muted;
      c.font = `${isTop || inArith ? 700 : 500} 12px ${Theme.body}`;
      c.textAlign = "left"; c.fillText(k, x + 6, y + 4);
    }
  }
  function arrow(c, [x1, y1], [x2, y2], col, dashed) {
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2; c.setLineDash(dashed ? [5, 4] : []);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.setLineDash([]);
    const a = Math.atan2(y2 - y1, x2 - x1);
    c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - 9 * Math.cos(a - 0.4), y2 - 9 * Math.sin(a - 0.4)); c.lineTo(x2 - 9 * Math.cos(a + 0.4), y2 - 9 * Math.sin(a + 0.4)); c.closePath(); c.fill();
  }
  function star(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill();
  }
  function pickWord(p) {
    let best = null, bd = 22;
    for (const k of WORDS) { const [x, y] = toScreen(P2[k]); const d = Math.hypot(p.x - x - 12, p.y - y); if (d < bd) { bd = d; best = k; } }
    return best;
  }
  stage.pointer({
    move: (p) => { const k = pickWord(p); if (k !== hoverW) { hoverW = k; draw(); showHover(); } },
    down: (p) => { const k = pickWord(p); hoverW = k; draw(); showHover(); },
    leave: () => { hoverW = null; draw(); showHover(); },
  });

  const mkSel = (id, val, on) => {
    const s = h("select", { class: "sel", id, "aria-label": id }, WORDS.slice().sort((a, b) => a.localeCompare(b)).map((w) => h("option", { value: w, selected: w === val ? true : null }, w)));
    s.addEventListener("change", () => on(s.value));
    return s;
  };
  const sA = mkSel("Word A", A, (x) => { A = x; update(); });
  const sB = mkSel("Minus word B", B, (x) => { B = x; update(); });
  const sC = mkSel("Plus word C", Cw, (x) => { Cw = x; update(); });
  const presetRow = h("div", { class: "chips" }, PRESETS.map(([a, b, cc]) => h("button", { type: "button", class: "chip", onclick: () => { A = a; B = b; Cw = cc; sA.value = a; sB.value = b; sC.value = cc; update(); } }, `${a} − ${b} + ${cc}`)));
  const eq = h("div", { class: "emb-eq" }, sA, h("span", { class: "op" }, "−"), sB, h("span", { class: "op" }, "+"), sC, h("span", { class: "op" }, "≈"), h("output", { class: "emb-res" }));
  const hoverBox = h("p", { class: "status small" });
  root.append(presetRow, eq, hoverBox);
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  function showHover() {
    if (!hoverW) { hoverBox.innerHTML = "Hover over or tap any word to see its three nearest neighbors."; return; }
    const nb = nearest(W[hoverW], [hoverW], 3);
    hoverBox.innerHTML = `Nearest to <b>${hoverW}</b>: ${nb.map((n) => `${n.w} <span class="muted">(${n.s.toFixed(2)})</span>`).join(", ")}`;
  }
  function update() {
    const res = W[A].map((x, k) => x - W[B][k] + W[Cw][k]);
    const top = nearest(res, [A, B, Cw], 3);
    $(".emb-res", root).textContent = top[0].w;
    status.innerHTML = `<b>${A} − ${B} + ${Cw} ≈ ${top[0].w}</b> (similarity ${top[0].s.toFixed(2)}). Runners-up: ${top.slice(1).map((t) => `${t.w} (${t.s.toFixed(2)})`).join(", ")}. The dashed arrow is the step from ${B} to ${Cw}; the solid arrow takes the same step from ${A}.`;
    draw();
  }
  Theme.on(draw);
  showHover();
  update();
});

/* ---------- (c) Attention ---------- */
defineMount("attn", (root) => {
  const BASE = ["The", "animal", "didn't", "cross", "the", "street", "because", "it", "was", "too", "tired", "."];
  let variant = "tired", head = 1, focus = 10, sharp = 1, view = window.innerWidth < 600 ? "grid" : "arcs";
  const toks = () => BASE.map((t, i) => (i === 10 ? variant : t));
  /* hand-set scores s[i][j] for j <= i; softmax per row */
  function scores(hd, i, j) {
    const T = toks();
    if (hd === 0) return j === i - 1 ? 4 : j === i ? 1.5 : 0; // previous word
    if (hd === 1) { // who is "it"?
      if (i === 7) return j === 1 || j === 5 ? 3 : j === 7 ? 1 : 0;
      if (i === 10) return variant === "tired" ? (j === 1 ? 4 : j === 7 ? 2.5 : 0) : (j === 5 ? 4 : j === 7 ? 2.5 : 0);
      if (i === 11) return variant === "tired" ? (j === 1 ? 2.5 : j === 10 ? 1.5 : 0) : (j === 5 ? 2.5 : j === 10 ? 1.5 : 0);
      if (i === 8 || i === 9) return j === 7 ? 3 : 0;
      return j === i ? 2 : 0;
    }
    if (hd === 2) { // verb → subject
      if (i === 2 || i === 3) return j === 1 ? 3.5 : j === 0 ? 1 : 0;
      if (i === 8) return j === 7 ? 3.5 : 0;
      if (i === 10) return j === 8 ? 2.5 : j === 7 ? 2 : 0;
      if (i === 5) return j === 3 ? 3 : 0;
      return j === i ? 1.5 : 0;
    }
    return j === 0 ? 3.5 : j === i ? 1.2 : 0; // first-token sink
    void T;
  }
  function weights(hd, i) {
    const s = [];
    for (let j = 0; j <= i; j++) s.push(scores(hd, i, j) * sharp);
    const m = Math.max(...s);
    const e = s.map((x) => Math.exp(x - m));
    const z = e.reduce((a, b) => a + b, 0);
    return e.map((x) => x / z);
  }
  const HEADS = [
    { name: "Previous word", note: "This head mostly looks one word back, a pattern found in almost every model." },
    { name: "Who is “it”?", note: "This head links words that refer to the same thing." },
    { name: "Verb → subject", note: "This head links verbs to the words doing the action." },
    { name: "First word", note: "This head parks attention on the first token when nothing else matters, a real quirk called an attention sink." },
  ];

  const wrap = h("div", { class: "attn-wrap" });
  const svg = sv("svg", { class: "attn-svg", role: "group", "aria-label": "Sentence with attention arcs" });
  wrap.append(svg);
  const bars = h("div", { class: "attn-bars", "aria-live": "polite" });
  const segH = segmented({ label: "Head", options: HEADS.map((hd, i) => ({ value: i, label: hd.name })), value: head, scroll: true, onChange: (v) => { head = v; render(); } });
  const segV = segmented({ label: "Sentence ends", options: [{ value: "tired", label: "…too tired" }, { value: "wide", label: "…too wide" }], value: variant, onChange: (v) => { variant = v; render(); } });
  const segView = segmented({ label: "View", options: [{ value: "arcs", label: "Arcs" }, { value: "grid", label: "Grid" }], value: view, onChange: (v) => { view = v; render(); } });
  const slS = slider({
    label: "Sharpness", min: 0.2, max: 2.5, step: 0.05, value: sharp, fmt: (v) => `×${v.toFixed(2)}`,
    onInput: (v) => { sharp = v; render(); },
  });
  root.append(h("div", { class: "ctl-row" }, segH.el), wrap, bars, h("div", { class: "ctl-row" }, segV.el, segView.el, slS.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  function render() {
    const T = toks(), C = Theme.c;
    const acc = "var(--l7)";
    svg.replaceChildren();
    const n = T.length;
    if (view === "arcs") {
      const Hh = 230, y = 190;
      const xs = [];
      let x = 14;
      const widths = T.map((t) => t.length * 9.5 + 18);
      const total = widths.reduce((a, b) => a + b, 0) + (n - 1) * 4;
      const W = Math.max(640, total + 28);
      svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
      svg.style.minWidth = "600px";
      x = (W - total) / 2;
      T.forEach((t, i) => { xs.push(x + widths[i] / 2); x += widths[i] + 4; });
      const w = weights(head, focus);
      w.forEach((wt, j) => {
        if (wt < 0.015) return;
        const x1 = xs[focus], x2 = xs[j];
        const hgt = Math.min(170, 24 + Math.abs(x1 - x2) * 0.42);
        const d = j === focus
          ? `M ${x1 - 8} ${y - 24} C ${x1 - 26} ${y - 70}, ${x1 + 26} ${y - 70}, ${x1 + 8} ${y - 24}`
          : `M ${x1} ${y - 24} Q ${(x1 + x2) / 2} ${y - 24 - hgt} ${x2} ${y - 24}`;
        svg.append(sv("path", { d, fill: "none", stroke: acc, "stroke-width": 1 + wt * 12, "stroke-opacity": 0.25 + wt * 0.75, "stroke-linecap": "round" }));
        if (wt > 0.06) {
          const lx = j === focus ? x1 : (x1 + x2) / 2, ly = j === focus ? y - 62 : y - 24 - hgt / 2 - 4;
          svg.append(sv("text", { x: lx, y: ly, "text-anchor": "middle", class: "attn-pct", text: `${Math.round(wt * 100)}%` }));
        }
      });
      T.forEach((t, i) => {
        const g = sv("g", { class: "attn-tok" + (i === focus ? " is-focus" : "") + (i > focus ? " is-future" : ""), tabindex: 0, role: "button", "aria-label": `${t}, token ${i + 1}` });
        const wdt = widths[i];
        g.append(sv("rect", { x: xs[i] - wdt / 2, y: y - 22, width: wdt, height: 34, rx: 7 }));
        g.append(sv("text", { x: xs[i], y: y, "text-anchor": "middle", text: t }));
        const pick = () => { focus = i; render(); };
        g.addEventListener("mouseenter", pick);
        g.addEventListener("click", pick);
        g.addEventListener("focus", pick);
        g.addEventListener("keydown", (e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); focus = clamp(focus + (e.key === "ArrowRight" ? 1 : -1), 0, n - 1); render(); svg.querySelectorAll(".attn-tok")[focus].focus(); }
        });
        svg.append(g);
      });
      svg.append(sv("text", { x: 14, y: 16, class: "attn-cap", text: "LOOKS BACK AT ↑ (ONLY EARLIER WORDS)" }));
      // keep the focused word visible when the sentence is wider than the screen
      requestAnimationFrame(() => {
        if (wrap.scrollWidth <= wrap.clientWidth) return;
        const k = svg.clientWidth / W;
        wrap.scrollLeft = clamp(xs[focus] * k - wrap.clientWidth / 2, 0, wrap.scrollWidth - wrap.clientWidth);
      });
    } else {
      const cell = 30, lab = 78, top = 70;
      const W = lab + n * cell + 10, Hh = top + n * cell + 10;
      svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
      svg.style.minWidth = "0";
      T.forEach((t, j) => svg.append(sv("text", { x: lab + j * cell + cell / 2, y: top - 8, class: "attn-col", transform: `rotate(-50 ${lab + j * cell + cell / 2} ${top - 8})`, text: t })));
      for (let i = 0; i < n; i++) {
        const w = weights(head, i);
        const row = sv("g", { class: "attn-row" + (i === focus ? " is-focus" : ""), tabindex: 0, role: "button", "aria-label": `Row for ${T[i]}` });
        row.append(sv("text", { x: lab - 8, y: top + i * cell + cell / 2 + 4, "text-anchor": "end", text: T[i] }));
        for (let j = 0; j < n; j++) {
          const wt = j <= i ? w[j] : 0;
          row.append(sv("rect", { x: lab + j * cell + 1, y: top + i * cell + 1, width: cell - 2, height: cell - 2, rx: 3, fill: j <= i ? acc : "none", "fill-opacity": j <= i ? 0.08 + wt * 0.92 : 0, stroke: j > i ? C.line : "none" }));
        }
        const pick = () => { focus = i; render(); };
        row.addEventListener("mouseenter", pick);
        row.addEventListener("click", pick);
        row.addEventListener("focus", pick);
        svg.append(row);
      }
    }
    // bars
    const w = weights(head, focus);
    const order = w.map((x, j) => [x, j]).sort((a, b) => b[0] - a[0]).slice(0, 4);
    bars.replaceChildren(
      h("p", { class: "attn-bars-t" }, `“${T[focus]}” draws on`),
      ...order.map(([x, j]) => h("div", { class: "attn-bar" }, h("span", { class: "attn-bar-w" }, T[j] + (j === focus ? " (itself)" : "")), h("span", { class: "attn-bar-track" }, h("i", { style: `width:${(x * 100).toFixed(1)}%` })), h("span", { class: "attn-bar-v" }, `${Math.round(x * 100)}%`)))
    );
    let msg = `<b>${HEADS[head].name}.</b> ${HEADS[head].note}`;
    if (head === 1 && focus === 7) msg += " At “it”, the model can't tell yet: “animal” and “street” get similar weight.";
    if (head === 1 && focus === 10) msg += variant === "tired" ? " “tired” looks back at “animal”: animals get tired, streets don't." : " “wide” looks back at “street”: streets are wide, animals aren't.";
    if (head === 1 && focus !== 7 && focus !== 10) msg += " Try hovering over “it”, then “" + variant + "”.";
    status.innerHTML = msg;
  }
  Actions.attn = (arg) => {
    if (arg === "it") { segH.set(1, false); head = 1; focus = 7; render(); setTimeout(() => { focus = 10; render(); }, 1500); }
  };
  Theme.on(render);
  render();
});
