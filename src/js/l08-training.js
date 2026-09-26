/* =====================================================================
   Layer 8 · Training — (a) loss landscape (map + 3-D), (b) a network
   fitting a drawn curve live, (c) scaling-law explorer.
   ===================================================================== */

/* ---------- (a) Roll downhill ---------- */
defineMount("landscape", (root) => {
  // valley: steep across (b = 2), gentle along (a = 0.2), rotated 45°, plus a shallow dip (local minimum)
  const A = 0.2, B = 2.0, DIP = { x: 1.8, y: 1.8, d: 0.5, s: 0.4 };
  const f = (x, y) => {
    const u = (x + y) / Math.SQRT2, v = (x - y) / Math.SQRT2;
    const g = Math.exp(-((x - DIP.x) ** 2 + (y - DIP.y) ** 2) / (2 * DIP.s * DIP.s));
    return 0.5 * (A * u * u + B * v * v) - DIP.d * g + DIP.d * Math.exp(-(DIP.x ** 2 + DIP.y ** 2) / (2 * DIP.s * DIP.s));
  };
  const grad = (x, y) => {
    const u = (x + y) / Math.SQRT2, v = (x - y) / Math.SQRT2;
    const du = A * u, dv = B * v;
    const g = Math.exp(-((x - DIP.x) ** 2 + (y - DIP.y) ** 2) / (2 * DIP.s * DIP.s));
    const k = (DIP.d * g) / (DIP.s * DIP.s);
    return [(du + dv) / Math.SQRT2 + k * (x - DIP.x), (du - dv) / Math.SQRT2 + k * (y - DIP.y)];
  };
  const RANGE = 3.2;
  let lr = 0.3, opt = "plain", view = "map";
  let start = [-2.3, 1.1];
  let path = [], vel = [0, 0], running = false, diverged = false, acc = 0;
  let yaw = -0.5, pitch = 0.55;
  function reset() { path = [start.slice()]; vel = [0, 0]; diverged = false; running = false; syncRun(); }

  function step() {
    if (diverged) return;
    const [x, y] = path[path.length - 1];
    const [gx, gy] = grad(x, y);
    if (opt === "momentum") { vel = [0.8 * vel[0] - lr * gx, 0.8 * vel[1] - lr * gy]; }
    else vel = [-lr * gx, -lr * gy];
    const nx = x + vel[0], ny = y + vel[1];
    path.push([nx, ny]);
    if (!isFinite(nx) || Math.abs(nx) > 40 || Math.abs(ny) > 40) { diverged = true; running = false; syncRun(); }
    if (path.length > 400) { running = false; syncRun(); }
  }

  let L = {};
  const stage = new Stage(root, {
    label: "A loss landscape with a long narrow valley and a shallow dip; a ball descends according to the learning rate.",
    height: (w) => (w >= 560 ? clamp(w * 0.62, 340, 440) : clamp(w * 1.12, 380, 460)),
    onResize: (w, hh) => { L = { w, hh, plotH: hh - 78 }; mapCache = null; },
    draw: () => draw(),
  });
  stage.canvas.style.touchAction = "pan-y";

  let mapCache = null;
  const lossColor = (val, C) => {
    const t = clamp(Math.log(1 + Math.max(0, val)) / Math.log(1 + 12), 0, 1);
    return t;
  };
  function hexRGB(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function buildMap() {
    const C = Theme.c;
    const sz = Math.min(L.w, L.plotH);
    const res = 110;
    const img = document.createElement("canvas");
    img.width = img.height = res;
    const cx = img.getContext("2d");
    const data = cx.createImageData(res, res);
    const lo = hexRGB(C.l8), hi = hexRGB(Theme.dark ? "#16141f" : "#ecebf3"), line = hexRGB(C.text);
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const x = (i / (res - 1) * 2 - 1) * RANGE, y = (1 - j / (res - 1) * 2) * RANGE;
      const t = lossColor(f(x, y), C);
      const band = Math.floor(t * 14);
      const tb = band / 14;
      const k = (j * res + i) * 4;
      // contour lines where the band changes
      const tr = lossColor(f(x + (2 * RANGE) / res, y), C), td = lossColor(f(x, y - (2 * RANGE) / res), C);
      const edge = Math.floor(tr * 14) !== band || Math.floor(td * 14) !== band;
      for (let ch = 0; ch < 3; ch++) {
        let v = lerp(lo[ch], hi[ch], Math.pow(tb, 0.8));
        if (edge) v = lerp(v, line[ch], 0.18);
        data.data[k + ch] = v;
      }
      data.data[k + 3] = 255;
    }
    cx.putImageData(data, 0, 0);
    mapCache = { img, sz };
  }
  const mapRect = () => { const s = Math.min(L.w, L.plotH); return { x: (L.w - s) / 2, y: 0, s }; };
  const toMap = (x, y) => { const M = mapRect(); return [M.x + ((x / RANGE + 1) / 2) * M.s, M.y + ((1 - y / RANGE) / 2) * M.s]; };
  const fromMap = (px, py) => { const M = mapRect(); return [((px - M.x) / M.s * 2 - 1) * RANGE, (1 - (py - M.y) / M.s * 2) * RANGE]; };

  /* 3-D projection (orthographic, camera tilted down by `pitch`) */
  const zOf = (val) => 3.2 * (1 - Math.exp(-Math.max(0, val) / 5));
  function proj3(x, y, val) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const X = x * cy - y * sy, Y = x * sy + y * cy;
    const Z = zOf(val);
    const v = Z * cp + Y * sp;
    const d = Y * cp - Z * sp;
    const F = fit3;
    return [L.w / 2 + (X - F.xm) * F.s, L.plotH / 2 - (v - F.vm) * F.s, d];
  }
  let fit3 = { s: 1, xm: 0, vm: 0 };
  /* size the surface to fill the plot for the current rotation */
  function fitSurface() {
    fit3 = { s: 1, xm: 0, vm: 0 };
    let x0 = Infinity, x1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    const L0 = L.w / 2, P0 = L.plotH / 2;
    for (let j = 0; j <= 12; j++) for (let i = 0; i <= 12; i++) {
      const x = (i / 12 * 2 - 1) * RANGE, y = (j / 12 * 2 - 1) * RANGE;
      const p = proj3(x, y, f(x, y));
      const X = p[0] - L0, v = P0 - p[1];
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const s = Math.min((L.w * 0.92) / (x1 - x0), (L.plotH * 0.92) / (v1 - v0));
    fit3 = { s, xm: (x0 + x1) / 2, vm: (v0 + v1) / 2 };
  }
  function draw3D(c, C) {
    fitSurface();
    const n = 34;
    const quads = [];
    const lo = C.l8;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x0 = (i / n * 2 - 1) * RANGE, x1 = ((i + 1) / n * 2 - 1) * RANGE;
      const y0 = (j / n * 2 - 1) * RANGE, y1 = ((j + 1) / n * 2 - 1) * RANGE;
      const zs = [f(x0, y0), f(x1, y0), f(x1, y1), f(x0, y1)];
      const pts = [proj3(x0, y0, zs[0]), proj3(x1, y0, zs[1]), proj3(x1, y1, zs[2]), proj3(x0, y1, zs[3])];
      const depth = pts.reduce((a, p) => a + p[2], 0) / 4;
      const zm = zs.reduce((a, b) => a + b, 0) / 4;
      quads.push({ pts, depth, t: lossColor(zm, C), shade: clamp(0.55 + (zs[1] - zs[0] + zs[2] - zs[3]) * 0.12 - (zs[3] - zs[0]) * 0.05, 0.25, 1) });
    }
    quads.sort((a, b) => b.depth - a.depth);
    const hi = Theme.dark ? "#1b1926" : "#e4e3ec";
    for (const q of quads) {
      c.fillStyle = mix(mix(lo, hi, Math.pow(q.t, 0.8)), Theme.dark ? "#000000" : "#ffffff", (1 - q.shade) * 0.5);
      c.strokeStyle = rgba(C.bg, 0.25);
      c.lineWidth = 0.5;
      c.beginPath(); q.pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); c.stroke();
    }
    // path
    c.strokeStyle = C.text; c.lineWidth = 2;
    c.beginPath();
    path.forEach(([x, y], k) => {
      if (Math.abs(x) > RANGE * 1.3 || Math.abs(y) > RANGE * 1.3) return;
      const p = proj3(x, y, f(x, y) + 0.08);
      k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]);
    });
    c.stroke();
    const [bx, by] = path[path.length - 1];
    if (Math.abs(bx) <= RANGE * 1.3 && Math.abs(by) <= RANGE * 1.3) {
      const p = proj3(bx, by, f(bx, by) + 0.12);
      c.fillStyle = C.l4; c.strokeStyle = C.bg; c.lineWidth = 2;
      c.beginPath(); c.arc(p[0], p[1], 7, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    c.fillStyle = C.faint; c.font = `600 10px ${Theme.mono}`; c.textAlign = "left";
    c.fillText("DRAG SIDEWAYS TO ROTATE", 8, 14);
  }

  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w || !L.w) return;
    stage.clear();
    if (view === "map") {
      if (!mapCache) buildMap();
      const M = mapRect();
      c.save(); roundRect(c, M.x, M.y, M.s, M.s, 10); c.clip();
      c.imageSmoothingEnabled = true;
      c.drawImage(mapCache.img, M.x, M.y, M.s, M.s);
      // path
      c.strokeStyle = C.text; c.lineWidth = 1.8;
      c.beginPath(); path.forEach(([x, y], k) => { const [px, py] = toMap(x, y); k ? c.lineTo(px, py) : c.moveTo(px, py); }); c.stroke();
      c.fillStyle = C.text;
      path.forEach(([x, y], k) => { if (k % 1 === 0 && path.length < 150) { const [px, py] = toMap(x, y); c.beginPath(); c.arc(px, py, 2, 0, Math.PI * 2); c.fill(); } });
      const [bx, by] = toMap(...path[path.length - 1]);
      c.fillStyle = C.l4; c.strokeStyle = C.bg; c.lineWidth = 2;
      c.beginPath(); c.arc(bx, by, 7, 0, Math.PI * 2); c.fill(); c.stroke();
      // markers
      const [gx, gy] = toMap(0, 0), [dx, dy] = toMap(DIP.x, DIP.y);
      c.font = `600 10px ${Theme.mono}`; c.textAlign = "center"; c.fillStyle = Theme.dark ? "#ffffff" : "#15131c";
      c.fillText("LOWEST POINT", gx, gy + 22);
      c.fillText("SHALLOW DIP", dx, dy - 16);
      c.restore();
      c.strokeStyle = C.line; c.lineWidth = 1; roundRect(c, M.x, M.y, M.s, M.s, 10); c.stroke();
    } else draw3D(c, C);
    // loss curve
    const y0 = L.plotH + 12, hh = L.hh - y0 - 4, x0 = 8, w = L.w - 16;
    c.fillStyle = C.sunk; roundRect(c, x0, y0, w, hh, 6); c.fill();
    c.fillStyle = C.muted; c.font = `600 10px ${Theme.mono}`; c.textAlign = "left";
    c.fillText("LOSS AT EACH STEP (LOG)", x0 + 8, y0 + 13);
    const losses = path.map(([x, y]) => f(x, y));
    const N = Math.max(40, losses.length);
    c.strokeStyle = C.l8; c.lineWidth = 2; c.beginPath();
    losses.forEach((v, k) => {
      const px = x0 + 8 + (k / (N - 1)) * (w - 16);
      const t = clamp(Math.log10(Math.max(1e-4, v + 1e-4)) / 5 + 0.8, 0, 1);
      const py = y0 + hh - 6 - t * (hh - 22);
      k ? c.lineTo(px, py) : c.moveTo(px, py);
    });
    c.stroke();
  }

  let dragging = null;
  stage.pointer({
    down: (p) => {
      if (view === "map") {
        const M = mapRect();
        if (p.x < M.x || p.x > M.x + M.s || p.y > M.s) return;
        start = fromMap(p.x, p.y); reset(); update(); draw();
      } else dragging = { x: p.x, yaw };
    },
    move: (p, e, down) => { if (view === "3d" && down && dragging) { yaw = dragging.yaw + (p.x - dragging.x) / 120; draw(); } },
    up: () => { dragging = null; },
  });

  function tick(dt) {
    if (running) {
      acc += dt;
      const every = 0.07;
      while (acc > every && running) { acc -= every; step(); }
      update();
    }
    draw();
  }
  const slLR = slider({
    label: "Learning rate (step size)", min: 0.01, max: 3, value: lr, log: true,
    round: (v) => roundSig(v, 2), fmt: (v) => fmtNum(v, 2),
    ticks: [{ v: 0.01, label: "0.01" }, { v: 0.1, label: "0.1" }, { v: 1, label: "1" }, { v: 3, label: "3" }],
    onInput: (v) => { lr = v; reset(); update(); draw(); },
  });
  const segO = segmented({ label: "Optimizer", options: [{ value: "plain", label: "Plain" }, { value: "momentum", label: "Momentum" }], value: opt, onChange: (v) => { opt = v; reset(); update(); draw(); } });
  const segV = segmented({ label: "View", options: [{ value: "map", label: "Map" }, { value: "3d", label: "3-D" }], value: view, onChange: (v) => { view = v; draw(); } });
  const bRun = button("Run", () => { if (diverged || path.length > 399) reset(); running = !running; syncRun(); Loop.wake(); }, { kind: "primary", icon: "play" });
  const bStep = button("Step", () => { running = false; syncRun(); step(); update(); draw(); }, { icon: "step", small: true });
  const bReset = button("Reset", () => { reset(); update(); draw(); }, { icon: "reset", small: true });
  const syncRun = () => bRun.setLabel && bRun.setLabel(running ? "Pause" : "Run", running ? "pause" : "play");
  root.append(h("div", { class: "ctl-row" }, slLR.el), h("div", { class: "ctl-row" }, segO.el, segV.el, h("div", { class: "btn-row" }, bRun, bStep, bReset)));
  const roS = readout("Steps"), roL = readout("Loss"), roState = readout("What's happening");
  root.append(h("div", { class: "readouts" }, roS.el, roL.el, roState.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  function classify() {
    if (diverged) return ["Diverged", "bad", "Each step overshoots by more than the last, so the loss explodes. Lower the learning rate."];
    const n = path.length;
    const [x, y] = path[n - 1];
    const L0 = f(x, y);
    if (n < 3) return ["Ready", null, "Press Run. The ball follows the slope downhill; the learning rate sets how far each step goes."];
    // zig-zag: the across-valley coordinate flips sign
    let flips = 0;
    for (let k = Math.max(1, n - 8); k < n; k++) {
      const v0 = (path[k - 1][0] - path[k - 1][1]), v1 = (path[k][0] - path[k][1]);
      if (v0 * v1 < 0 && Math.abs(v1) > 0.02) flips++;
    }
    const g = grad(x, y);
    const gm = Math.hypot(g[0], g[1]);
    if (L0 < 0.005) return ["Arrived", "good", `Reached the lowest point in ${n - 1} steps.`];
    if (gm < 0.01 && L0 > 0.05) return ["Stuck in a dip", "bad", "Stuck in the shallow dip: every direction goes uphill from here, even though a lower point exists. Momentum or a bigger step can carry it out."];
    if (flips >= 4) return ["Zig-zagging", null, "Each step overshoots the valley floor and bounces across it. Still converging, but wastefully. A bit higher and it flies off."];
    if (lr < 0.05) return ["Crawling", null, "Tiny steps: safe but slow. Real training runs are expensive, so this wastes money."];
    return ["Descending", null, "Rolling downhill. The valley is steep across and gentle along, so progress along it is slow."];
  }
  function update() {
    const [x, y] = path[path.length - 1];
    roS.set(fmtInt(path.length - 1));
    roL.set(diverged ? "∞" : fmtNum(f(x, y), 3));
    const [st, cls, msg] = classify();
    roState.set(st); roState.state(cls);
    status.innerHTML = msg;
  }
  Actions.landscape = (arg) => {
    if (arg === "hot") { view = "map"; segV.set("map"); slLR.set(1.1, true); running = true; syncRun(); Loop.wake(); }
  };
  Theme.on(() => { mapCache = null; draw(); });
  Loop.add(stage.canvas, tick, () => running);
  reset();
  update();
});

/* ---------- (b) Watch a network learn ---------- */
defineMount("fit", (root) => {
  const NP = 64;
  const XS = Array.from({ length: NP }, (_, i) => (i / (NP - 1)) * 2 - 1);
  const PRE = {
    wave: (x) => 0.7 * Math.sin(3.2 * x),
    step: (x) => (x < 0.1 ? -0.55 : 0.55),
    bump: (x) => 0.9 * Math.exp(-((x - 0.2) ** 2) / 0.05) - 0.4,
    zigzag: (x) => 0.8 * (2 * Math.abs(((x * 2 + 1.5) % 2) - 1) - 1),
  };
  let target = XS.map(PRE.wave);
  let H = 6, lr = 0.03, training = false, steps = 0;
  const lossHist = [];
  const R = rng(21);
  let w1, b1, w2, b2, adam;
  function init() {
    w1 = Array.from({ length: 24 }, () => gauss(R) * 2.5);
    b1 = Array.from({ length: 24 }, () => gauss(R) * 1.5);
    w2 = Array.from({ length: 24 }, () => gauss(R) * 0.3);
    b2 = 0;
    adam = { t: 0, m: new Float64Array(24 * 3 + 1), v: new Float64Array(24 * 3 + 1) };
    steps = 0; lossHist.length = 0;
  }
  init();
  const net = (x) => { let y = b2; for (let j = 0; j < H; j++) y += w2[j] * Math.tanh(w1[j] * x + b1[j]); return y; };
  function loss() { let s = 0; for (let i = 0; i < NP; i++) { const d = net(XS[i]) - target[i]; s += d * d; } return s / NP; }
  function trainStep() {
    const g = new Float64Array(H * 3 + 1);
    for (let i = 0; i < NP; i++) {
      const x = XS[i];
      let y = b2;
      const hs = new Array(H);
      for (let j = 0; j < H; j++) { hs[j] = Math.tanh(w1[j] * x + b1[j]); y += w2[j] * hs[j]; }
      const d = (2 * (y - target[i])) / NP;
      for (let j = 0; j < H; j++) {
        g[j * 3 + 2] += d * hs[j];
        const dh = d * w2[j] * (1 - hs[j] * hs[j]);
        g[j * 3] += dh * x; g[j * 3 + 1] += dh;
      }
      g[H * 3] += d;
    }
    adam.t++;
    const c1 = 1 - Math.pow(0.9, adam.t), c2 = 1 - Math.pow(0.999, adam.t);
    const up = (k, val) => {
      adam.m[k] = 0.9 * adam.m[k] + 0.1 * g[k];
      adam.v[k] = 0.999 * adam.v[k] + 0.001 * g[k] * g[k];
      return val - (lr * (adam.m[k] / c1)) / (Math.sqrt(adam.v[k] / c2) + 1e-8);
    };
    for (let j = 0; j < H; j++) { w1[j] = up(j * 3, w1[j]); b1[j] = up(j * 3 + 1, b1[j]); w2[j] = up(j * 3 + 2, w2[j]); }
    b2 = up(H * 3, b2);
    steps++;
  }

  let L = {};
  const stage = new Stage(root, {
    cls: "drag",
    label: "A curve drawn as dots, with the network's current fit drawn as a line; faint lines show each neuron's contribution.",
    height: (w) => (w >= 560 ? clamp(w * 0.5, 280, 360) : clamp(w * 0.9, 300, 380)),
    onResize: (w, hh) => { L = { w, hh, plotH: hh - 70 }; },
    draw: () => draw(),
  });
  const X = (x) => 10 + ((x + 1) / 2) * (L.w - 20);
  const Y = (y) => 10 + ((1 - y) / 2) * (L.plotH - 20) * 0.9 + (L.plotH - 20) * 0.05;
  const invX = (px) => ((px - 10) / (L.w - 20)) * 2 - 1;
  const invY = (py) => 1 - ((py - 10 - (L.plotH - 20) * 0.05) / ((L.plotH - 20) * 0.9)) * 2;

  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w || !L.w) return;
    stage.clear();
    c.fillStyle = C.sunk; roundRect(c, 0, 0, L.w, L.plotH, 10); c.fill();
    c.strokeStyle = C.line; c.lineWidth = 1;
    c.beginPath(); c.moveTo(10, Y(0)); c.lineTo(L.w - 10, Y(0)); c.stroke();
    // neuron contributions
    for (let j = 0; j < H; j++) {
      c.strokeStyle = rgba(C.l8, 0.28); c.lineWidth = 1.2; c.beginPath();
      for (let k = 0; k <= 80; k++) { const x = (k / 80) * 2 - 1; const y = w2[j] * Math.tanh(w1[j] * x + b1[j]); k ? c.lineTo(X(x), Y(clamp(y, -1.4, 1.4))) : c.moveTo(X(x), Y(clamp(y, -1.4, 1.4))); }
      c.stroke();
    }
    // target
    c.fillStyle = C.text;
    for (let i = 0; i < NP; i++) { c.beginPath(); c.arc(X(XS[i]), Y(target[i]), 2.6, 0, Math.PI * 2); c.fill(); }
    // fit
    c.strokeStyle = C.l8; c.lineWidth = 3; c.beginPath();
    for (let k = 0; k <= 120; k++) { const x = (k / 120) * 2 - 1; const y = clamp(net(x), -1.5, 1.5); k ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)); }
    c.stroke();
    c.fillStyle = C.faint; c.font = `600 10px ${Theme.mono}`; c.textAlign = "left";
    c.fillText("DRAW HERE", 16, 22);
    // loss chart
    const y0 = L.plotH + 10, hh = L.hh - y0 - 2;
    c.fillStyle = C.sunk; roundRect(c, 0, y0, L.w, hh, 6); c.fill();
    c.fillStyle = C.muted; c.fillText("LOSS (LOG SCALE)", 8, y0 + 13);
    if (lossHist.length > 1) {
      const n = lossHist.length;
      c.strokeStyle = C.l8; c.lineWidth = 2; c.beginPath();
      lossHist.forEach((v, k) => {
        const px = 8 + (k / Math.max(1, n - 1)) * (L.w - 16);
        const t = clamp((Math.log10(v + 1e-6) + 5) / 5, 0, 1);
        const py = y0 + hh - 4 - t * (hh - 20);
        k ? c.lineTo(px, py) : c.moveTo(px, py);
      });
      c.stroke();
    }
  }

  // drawing the target
  let last = null;
  function paint(p) {
    if (p.y > L.plotH) return;
    const x = clamp(invX(p.x), -1, 1), y = clamp(invY(p.y), -1.1, 1.1);
    const set = (xx, yy) => { const i = Math.round(((xx + 1) / 2) * (NP - 1)); if (i >= 0 && i < NP) target[i] = yy; };
    if (last) {
      const n = Math.ceil(Math.abs(x - last[0]) * NP) + 1;
      for (let k = 0; k <= n; k++) set(lerp(last[0], x, k / n), lerp(last[1], y, k / n));
    } else set(x, y);
    last = [x, y];
    lossHist.length = 0;
    draw(); refresh();
  }
  stage.pointer({ capture: true, down: (p) => { last = null; paint(p); }, move: (p, e, down) => { if (down) paint(p); }, up: () => { last = null; } });

  const presets = h("div", { class: "chips" }, Object.keys(PRE).map((k) => h("button", { type: "button", class: "chip", onclick: () => { target = XS.map(PRE[k]); lossHist.length = 0; refresh(); draw(); } }, { wave: "Wave", step: "Step", bump: "Bump", zigzag: "Zig-zag" }[k])));
  const stN = stepper({ label: "Neurons", value: H, min: 1, max: 24, onChange: (v) => { H = v; lossHist.length = 0; refresh(); draw(); } });
  const slLR = slider({
    label: "Learning rate", min: 0.001, max: 0.3, value: lr, log: true, round: (v) => roundSig(v, 2), fmt: (v) => fmtNum(v, 2),
    ticks: [{ v: 0.001, label: "0.001" }, { v: 0.01, label: "0.01" }, { v: 0.1, label: "0.1" }],
    onInput: (v) => { lr = v; },
  });
  const bTrain = button("Train", () => { training = !training; syncT(); Loop.wake(); }, { kind: "primary", icon: "play" });
  const bReset = button("New weights", () => { init(); refresh(); draw(); }, { icon: "dice", small: true });
  const syncT = () => bTrain.setLabel(training ? "Pause" : "Train", training ? "pause" : "play");
  root.append(presets, h("div", { class: "ctl-row" }, stN.el, slLR.el, h("div", { class: "btn-row" }, bTrain, bReset)));
  const roL = readout("Loss"), roS = readout("Steps"), roP = readout("Numbers learned");
  root.append(h("div", { class: "readouts" }, roL.el, roS.el, roP.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  function refresh() {
    const l = loss();
    roL.set(fmtNum(l, 2));
    roS.set(fmtInt(steps));
    roP.set(fmtInt(H * 3 + 1));
    if (!training && steps === 0) status.innerHTML = "Press <b>Train</b>. Then try fewer neurons, a higher learning rate, or draw your own curve.";
    else if (l < 0.003) status.innerHTML = `<b>Fitted.</b> ${H} neurons, each one S-shaped bend, add up to your curve.`;
    else if (steps > 1500 && H < 4) status.innerHTML = `<b>Not enough bends.</b> ${H} neuron${H > 1 ? "s" : ""} can't follow this curve. Add more.`;
    else if (lr > 0.15 && steps > 50) status.innerHTML = "<b>High learning rate:</b> the loss jumps around instead of settling.";
    else status.innerHTML = "Learning: each step nudges every weight a little way downhill on the loss.";
  }
  function tick() {
    if (!training) return;
    for (let k = 0; k < 12; k++) trainStep();
    const l = loss();
    lossHist.push(l);
    if (lossHist.length > 600) lossHist.splice(0, lossHist.length - 600);
    refresh(); draw();
    if (steps > 30000) { training = false; syncT(); }
  }
  Theme.on(draw);
  Loop.add(stage.canvas, tick, () => training);
  refresh();
});

/* ---------- (c) Scaling laws ---------- */
defineMount("scaling", (root) => {
  // Chinchilla functional form, constants from Besiroglu et al. (2024) re-fit of Hoffmann et al. (2022)
  const E = 1.8172, A = 482.01, B = 2085.43, al = 0.3478, be = 0.3658;
  const loss = (N, D) => E + A / Math.pow(N, al) + B / Math.pow(D, be);
  const G = Math.pow((al * A) / (be * B), 1 / (al + be));
  const Nopt = (C) => G * Math.pow(C / 6, be / (al + be));
  const EFF = 1e15 * 0.4; // FLOP/s per H100-class GPU at 40% utilization
  const USD = 2, KW = 1.5, PUE = 1.2;
  const REFS = [
    { name: "GPT-3", N: 175e9, D: 300e9 },
    { name: "Chinchilla", N: 70e9, D: 1.4e12 },
    { name: "Llama 3 8B", N: 8e9, D: 15e12 },
    { name: "Llama 3.1 405B", N: 405e9, D: 15.6e12 },
  ];
  const NMIN = 1e7, NMAX = 1e13, DMIN = 1e9, DMAX = 1e15;
  const DATA_STOCK = 3e14; // Epoch AI est. of public human text, tokens
  let N = 70e9, D = 1.4e12, mode = "free", C = 6 * N * D;

  let L = {};
  const stage = new Stage(root, {
    label: "A map of predicted loss over model size and training data, with lines of equal compute and famous models marked.",
    height: (w) => (w >= 560 ? clamp(w * 0.66, 360, 480) : clamp(w * 1.25, 420, 520)),
    onResize: (w, hh) => { L = { w, hh }; img = null; },
    draw: () => draw(),
  });
  let img = null;
  function hexRGB(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function plot() {
    const inset = mode === "budget" ? 120 : 0;
    const pl = 52, pr = 12, pt = 12, pb = 40 + inset;
    return { x0: pl, x1: L.w - pr, y0: L.hh - pb, y1: pt, inset };
  }
  const lx = (n, P) => lerp(P.x0, P.x1, invLerp(Math.log10(NMIN), Math.log10(NMAX), Math.log10(n)));
  const ly = (d, P) => lerp(P.y0, P.y1, invLerp(Math.log10(DMIN), Math.log10(DMAX), Math.log10(d)));
  function buildImg(P) {
    const C = Theme.c;
    const res = 90;
    const cv = document.createElement("canvas"); cv.width = cv.height = res;
    const cx = cv.getContext("2d"); const data = cx.createImageData(res, res);
    const lo = hexRGB(C.l8), hi = hexRGB(Theme.dark ? "#15131c" : "#f0eff5");
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const n = Math.pow(10, lerp(Math.log10(NMIN), Math.log10(NMAX), i / (res - 1)));
      const d = Math.pow(10, lerp(Math.log10(DMAX), Math.log10(DMIN), j / (res - 1)));
      const l = loss(n, d);
      const t = clamp((l - 1.85) / (4.5 - 1.85), 0, 1);
      const band = Math.floor(Math.pow(t, 0.6) * 16) / 16;
      const k = (j * res + i) * 4;
      for (let ch = 0; ch < 3; ch++) data.data[k + ch] = lerp(lo[ch], hi[ch], band);
      data.data[k + 3] = 255;
    }
    cx.putImageData(data, 0, 0);
    img = cv;
  }
  function draw() {
    const c = stage.ctx, Cc = Theme.c;
    if (!stage.w || !L.w) return;
    stage.clear();
    const P = plot();
    if (!img) buildImg(P);
    const mono = Theme.mono;
    c.imageSmoothingEnabled = true;
    c.drawImage(img, P.x0, P.y1, P.x1 - P.x0, P.y0 - P.y1);
    // axes
    c.font = `500 10px ${mono}`; c.fillStyle = Cc.faint;
    c.textAlign = "center";
    for (let e = 7; e <= 13; e++) c.fillText(fmtShort(10 ** e), lx(10 ** e, P), P.y0 + 14);
    c.fillText("PARAMETERS (MODEL SIZE) →", (P.x0 + P.x1) / 2, P.y0 + 30);
    c.textAlign = "right";
    for (let e = 9; e <= 15; e++) c.fillText(fmtShort(10 ** e), P.x0 - 6, ly(10 ** e, P) + 3);
    c.save(); c.translate(12, (P.y0 + P.y1) / 2); c.rotate(-Math.PI / 2); c.textAlign = "center"; c.fillText("TRAINING TOKENS →", 0, 0); c.restore();
    c.save(); c.beginPath(); c.rect(P.x0, P.y1, P.x1 - P.x0, P.y0 - P.y1); c.clip();
    // iso-compute lines
    c.strokeStyle = rgba(Cc.text, 0.25); c.lineWidth = 1; c.setLineDash([3, 4]);
    for (let e = 19; e <= 29; e += 2) {
      const Cv = 10 ** e;
      c.beginPath(); c.moveTo(lx(NMIN, P), ly(Cv / (6 * NMIN), P)); c.lineTo(lx(NMAX, P), ly(Cv / (6 * NMAX), P)); c.stroke();
      const nn = Math.sqrt(Cv / 6 / 20);
      const px = lx(clamp(nn * 0.3, NMIN, NMAX), P), py = ly(Cv / (6 * clamp(nn * 0.3, NMIN, NMAX)), P);
      c.fillStyle = rgba(Cc.text, 0.75); c.textAlign = "left";
      if (py > P.y1 + 22 && py < P.y0 - 4) c.fillText(`10${sup(e)} FLOP`, px + 4, py - 4);
    }
    c.setLineDash([]);
    // data stock line
    c.strokeStyle = rgba(Cc.bad, 0.7); c.setLineDash([6, 4]);
    c.beginPath(); c.moveTo(P.x0, ly(DATA_STOCK, P)); c.lineTo(P.x1, ly(DATA_STOCK, P)); c.stroke(); c.setLineDash([]);
    c.fillStyle = Cc.bad; c.textAlign = "left"; c.fillText("≈ ALL PUBLIC HUMAN TEXT (EST.)", P.x0 + 6, ly(DATA_STOCK, P) - 5);
    // compute-optimal line
    c.strokeStyle = Cc.l10; c.lineWidth = 2; c.beginPath();
    for (let e = 17; e <= 31; e += 0.25) { const Cv = 10 ** e; const n = Nopt(Cv); const d = Cv / (6 * n); const X = lx(n, P), Y = ly(d, P); e === 17 ? c.moveTo(X, Y) : c.lineTo(X, Y); }
    c.stroke();
    const labN = Nopt(1e21);
    c.fillStyle = Cc.l10; c.textAlign = "left"; c.font = `700 10px ${mono}`;
    c.fillText("BEST SPLIT (~20 TOKENS/PARAM)", lx(labN, P) + 8, ly(1e21 / (6 * labN), P) + 12);
    // refs
    c.font = `600 10px ${mono}`;
    for (const r of REFS) {
      const X = lx(r.N, P), Y = ly(r.D, P);
      c.fillStyle = Cc.text; c.beginPath(); c.arc(X, Y, 3.5, 0, Math.PI * 2); c.fill();
      c.textAlign = X > P.x1 - 90 ? "right" : "left";
      c.fillText(r.name, X + (c.textAlign === "left" ? 6 : -6), Y - 5);
    }
    // current
    const X = lx(N, P), Y = ly(D, P);
    c.strokeStyle = Cc.text; c.lineWidth = 2.5; c.beginPath(); c.arc(X, Y, 9, 0, Math.PI * 2); c.stroke();
    c.fillStyle = Cc.l8; c.beginPath(); c.arc(X, Y, 5, 0, Math.PI * 2); c.fill();
    c.restore();
    c.strokeStyle = Cc.line; c.strokeRect(P.x0 + 0.5, P.y1 + 0.5, P.x1 - P.x0 - 1, P.y0 - P.y1 - 1);

    if (mode === "budget") drawInset(c, Cc, P);
  }
  function drawInset(c, Cc, P) {
    const y0 = P.y0 + 44, hh = P.inset - 10, x0 = P.x0, w = P.x1 - P.x0;
    c.fillStyle = Cc.sunk; roundRect(c, x0 - 40, y0, w + 40, hh, 6); c.fill();
    c.fillStyle = Cc.muted; c.font = `600 10px ${Theme.mono}`; c.textAlign = "left";
    c.fillText(`AT A FIXED BUDGET OF ${fmtSci(C, 2)} FLOP: LOSS VS MODEL SIZE`, x0 - 32, y0 + 14);
    const nLo = Math.max(NMIN, C / (6 * DMAX)), nHi = Math.min(NMAX, C / (6 * DMIN));
    const pts = [];
    for (let k = 0; k <= 80; k++) { const n = Math.pow(10, lerp(Math.log10(nLo), Math.log10(nHi), k / 80)); pts.push([n, loss(n, C / (6 * n))]); }
    const lMin = Math.min(...pts.map((p) => p[1])), lMax = Math.min(lMin + 1.5, Math.max(...pts.map((p) => p[1])));
    const X = (n) => lx(n, P);
    const Y = (l) => y0 + hh - 8 - clamp((l - lMin) / (lMax - lMin + 1e-9), 0, 1) * (hh - 30);
    c.strokeStyle = Cc.l8; c.lineWidth = 2; c.beginPath();
    pts.forEach(([n, l], k) => (k ? c.lineTo(X(n), Y(l)) : c.moveTo(X(n), Y(l)))); c.stroke();
    const no = Nopt(C);
    c.fillStyle = Cc.l10; c.beginPath(); c.arc(X(no), Y(loss(no, C / (6 * no))), 4, 0, Math.PI * 2); c.fill();
    c.font = `600 10px ${Theme.mono}`; c.textAlign = "center";
    c.fillText("BEST", X(no), Y(loss(no, C / (6 * no))) + 16);
    c.fillStyle = Cc.faint; c.textAlign = "left";
    c.fillText("↑ worse", x0 - 34, y0 + 30);
    c.textAlign = "right";
    c.fillText("smaller model, more data  ·  bigger model, less data", x0 + w - 6, y0 + 14);
    c.strokeStyle = Cc.text; c.lineWidth = 2; c.beginPath(); c.arc(X(N), Y(loss(N, D)), 6, 0, Math.PI * 2); c.stroke();
  }
  const fmtShort = (x) => { const e = Math.round(Math.log10(x)); if (e >= 12) return `${10 ** (e - 12)}T`; if (e >= 9) return `${10 ** (e - 9)}B`; if (e >= 6) return `${10 ** (e - 6)}M`; return String(x); };

  const segM = segmented({ label: "Mode", options: [{ value: "free", label: "Choose both" }, { value: "budget", label: "Fixed budget" }], value: mode, onChange: (v) => { mode = v; if (v === "budget") { C = 6 * N * D; slC.set(C); } img = null; syncMode(); update(); } });
  const slN = slider({
    label: "Parameters", min: NMIN, max: NMAX, value: N, log: true, round: (v) => roundSig(v, 2),
    fmt: (v) => fmtWords(v, 2), onInput: (v) => {
      N = v;
      if (mode === "budget") { D = clamp(C / (6 * N), DMIN, DMAX); N = C / (6 * D); slD.set(D); }
      update();
    },
  });
  const slD = slider({
    label: "Training tokens", min: DMIN, max: DMAX, value: D, log: true, round: (v) => roundSig(v, 2),
    fmt: (v) => fmtWords(v, 2), onInput: (v) => { D = v; update(); },
  });
  const slC = slider({
    label: "Compute budget", min: 1e19, max: 1e27, value: C, log: true, round: (v) => roundSig(v, 2),
    fmt: (v) => `${fmtSci(v, 2)} FLOP`, onInput: (v) => { C = v; D = clamp(C / (6 * N), DMIN, DMAX); N = clamp(C / (6 * D), NMIN, NMAX); slN.set(N); slD.set(D); update(); },
  });
  const bOpt = button("Use the best split", () => { const n = Nopt(C); N = clamp(n, NMIN, NMAX); D = clamp(C / (6 * N), DMIN, DMAX); slN.set(N); slD.set(D); update(); }, { small: true });
  const rowFree = h("div", { class: "ctl-row" }, slN.el, slD.el);
  const rowBudget = h("div", { class: "ctl-row" }, slC.el, h("div", { class: "btn-row" }, bOpt));
  root.append(h("div", { class: "ctl-row" }, segM.el), rowFree, rowBudget);
  const roL = readout("Predicted loss"), roC = readout("Compute"), roR = readout("Tokens per parameter"), roH = readout("GPU-hours"), roUSD = readout("Compute cost"), roE = readout("Energy");
  root.append(h("div", { class: "readouts" }, roL.el, roC.el, roR.el, roH.el, roUSD.el, roE.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);
  function syncMode() {
    rowBudget.hidden = mode !== "budget";
    slD.el.classList.toggle("is-off", mode === "budget");
    slD.input.disabled = mode === "budget";
    stage.resize();
  }
  function update() {
    const l = loss(N, D);
    const Cv = 6 * N * D;
    const gpuh = Cv / EFF / 3600;
    roL.set(l.toFixed(3)); roL.state("hi");
    roC.set(fmtSci(Cv, 2), " FLOP");
    const tpp = D / N;
    roR.set(fmtNum(tpp, 2)); roR.state(tpp < 5 || tpp > 2000 ? "bad" : null);
    roH.set(fmtWords(gpuh, 2));
    roUSD.set(fmtMoney(gpuh * USD));
    roE.set(...siParts(gpuh * KW * PUE * 1000, "Wh", 2));
    const no = Nopt(Cv);
    const lBest = loss(no, Cv / (6 * no));
    let msg = `A ${fmtWords(N, 2)}-parameter model trained on ${fmtWords(D, 2)} tokens: predicted loss <b>${l.toFixed(3)}</b>.`;
    if (l - lBest > 0.01) msg += ` The same compute split the best way (${fmtWords(no, 2)} parameters, ${fmtWords(Cv / 6 / no, 2)} tokens) would reach ${lBest.toFixed(3)}.`;
    else msg += " That's close to the best split for this much compute.";
    if (D > DATA_STOCK) msg += ` <span class="bad">More tokens than all public human text (est.).</span>`;
    status.innerHTML = msg;
    draw();
  }
  Actions.scaling = (arg) => {
    if (arg === "budget") { segM.set("budget", true); C = 1e24; slC.set(C, true); N = 1e12; slN.set(N, true); setTimeout(() => bOpt.click(), 1400); }
  };
  Theme.on(() => { img = null; draw(); });
  syncMode();
  update();
});
