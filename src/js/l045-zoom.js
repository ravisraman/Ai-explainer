/* =====================================================================
   Interlude · Scale zoom — one continuous zoom from a transistor to a
   campus. Every level is drawn to scale inside the next (plan view).
   World units are meters; the camera shows F meters across.
   ===================================================================== */

defineMount("zoom", (root) => {
  const DENS = 130e6; // transistors per mm² (B200 average)
  /* Each level: its size (w×h, m), where its focus child sits (offset from
     this level's center), and what's in view at this scale. */
  const LV = [
    { key: "transistor", name: "Transistor", w: 1e-7, h: 1e-7, view: 1.2e-6, gpus: 0, t: 1, watts: null,
      text: "A single transistor: a gate (gold) across a few silicon fins (blue). It switches on and off billions of times a second." },
    { key: "logic", name: "Logic block", w: 2e-5, h: 2e-5, view: 5e-5, gpus: 0, t: 4e-4 * DENS, watts: null,
      text: "Rows of transistors wired into logic cells: adders, multipliers and memory bits. This square is thinner than a human hair." },
    { key: "sm", name: "Compute unit", w: 2.4e-3, h: 2e-3, view: 6e-3, gpus: 0, t: 4.8 * DENS, watts: null,
      text: "One compute unit (NVIDIA calls it a streaming multiprocessor): four blocks of tensor cores for matrix math, plus registers and cache. Each die has dozens." },
    { key: "die", name: "Die", w: 0.026, h: 0.031, view: 0.05, gpus: 0.5, t: 104e9, watts: 500,
      text: "One die: the largest piece of silicon a scanner can print in one exposure, holding ~104 billion transistors." },
    { key: "package", name: "GPU", w: 0.09, h: 0.075, view: 0.15, gpus: 1, t: 208e9, watts: 1200,
      text: "One GPU: two dies joined side by side, surrounded by eight stacks of high-bandwidth memory. About 1,000–1,400 W." },
    { key: "tray", name: "Compute tray", w: 0.44, h: 0.86, view: 1.2, gpus: 4, t: 4 * 208e9, watts: 6000,
      text: "One compute tray: four GPUs and two CPUs on cold plates, with coolant pipes. It slides into a rack like a drawer." },
    { key: "rack", name: "Rack", w: 0.6, h: 1.07, view: 3.2, gpus: 72, t: 72 * 208e9, watts: 130e3,
      text: "One rack, seen from above: 18 compute trays and 9 network-switch trays stacked on top of each other. 72 GPUs, ~130 kW, about 1.4 tonnes." },
    { key: "hall", name: "Data hall", w: 20, h: 28, view: 40, gpus: 140 * 72, t: 140 * 72 * 208e9, watts: 140 * 130e3,
      text: "One data hall: 140 racks in rows, with coolant units at the ends of each row. About 10,000 GPUs and ~18 MW." },
    { key: "campus", name: "Campus", w: 420, h: 260, view: 560, gpus: 1400 * 72, t: 1400 * 72 * 208e9, watts: 1400 * 130e3 * 1.2,
      text: "The campus: ten halls in five buildings, a substation and cooling yards. About 100,000 GPUs, ~20 quadrillion transistors, ~220 MW." },
  ];
  /* focus-child offsets (child center relative to parent center), meters */
  const OFF = {
    transistor: [2.05e-6, -1.95e-6],
    logic: [-0.0009, -0.0006],
    sm: [-0.0075, 0.0069],
    die: [-0.0135, 0],
    package: [-0.1, -0.2],
    tray: [0, 0],
    rack: null, // computed from the hall layout
    hall: [-107, 30],
  };
  /* hall layout: 10 rows × 14 racks (two groups of 7) */
  const RACK_POS = [];
  for (let r = 0; r < 10; r++) {
    for (let j = 0; j < 14; j++) {
      const x = -4.8 + j * 0.6 + (j >= 7 ? 1.8 : 0) - 0.9 + 0.3;
      const y = -11.7 + r * 2.6;
      RACK_POS.push([x, y]);
    }
  }
  const FOCUS_RACK = 4 * 14 + 5;
  OFF.rack = RACK_POS[FOCUS_RACK];
  /* building layout on the campus */
  const BUILDINGS = [-180, -90, 0, 90, 180].map((x) => [x, 30]);
  const HALL_IN_BLD = [[-12, 0], [12, 0]];
  OFF.hall = [BUILDINGS[1][0] + HALL_IN_BLD[0][0], BUILDINGS[1][1] + HALL_IN_BLD[0][1]];

  /* absolute centers of the focus chain, from the campus down */
  const POS = {};
  POS.campus = [0, 0];
  const chain = ["campus", "hall", "rack", "tray", "package", "die", "sm", "logic", "transistor"];
  for (let i = 1; i < chain.length; i++) {
    const p = POS[chain[i - 1]], o = OFF[chain[i]];
    POS[chain[i]] = [p[0] + o[0], p[1] + o[1]];
  }

  const FMIN = 6e-7, FMAX = 700;
  let sized = false;
  let logF = Math.log(LV[4].view);
  let target = logF, animFrom = logF, animT = 1;

  /* field width that fits a level's object on this canvas */
  const viewFor = (l) => Math.max(l.view, (l.h * 1.25 * (stage.w || 700)) / (stage.h || 400));
  function camCenter(F) {
    const lf = Math.log(F);
    for (let i = 0; i < LV.length - 1; i++) {
      const a = Math.log(viewFor(LV[i])), b = Math.log(viewFor(LV[i + 1]));
      if (lf <= a) return POS[LV[i].key];
      if (lf < b) {
        const t = easeInOut(invLerp(a, b, lf));
        const p = POS[LV[i].key], q = POS[LV[i + 1].key];
        return [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
      }
    }
    return POS.campus;
  }
  function currentLevel(F) {
    let best = 0, bd = 1e9;
    LV.forEach((l, i) => { const d = Math.abs(Math.log(F / viewFor(l))); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  const stage = new Stage(root, {
    cls: "zoom-stage",
    label: "A continuous zoom from a single transistor out to a data-center campus, drawn to scale.",
    height: (w) => (w >= 600 ? clamp(w * 0.56, 340, 520) : clamp(w * 0.8, 300, 400)),
    onResize: () => {
      if (!sized) { sized = true; logF = target = animFrom = Math.log(viewFor(LV[4])); if (sl) sl.set(Math.exp(logF)); }
    },
    draw: () => draw(),
  });

  /* ---------- drawing ---------- */
  let T = null; // transform
  function makeT() {
    const F = Math.exp(logF);
    const k = stage.w / F; // px per meter
    const [cx, cy] = camCenter(F);
    return {
      F, k,
      x: (x) => (x - cx) * k + stage.w / 2,
      y: (y) => (y - cy) * k + stage.h / 2,
      vis: (x, y, w, hh) => {
        const sx = (x - cx) * k + stage.w / 2, sy = (y - cy) * k + stage.h / 2;
        return sx + (w * k) / 2 > -2 && sx - (w * k) / 2 < stage.w + 2 && sy + (hh * k) / 2 > -2 && sy - (hh * k) / 2 < stage.h + 2;
      },
    };
  }
  /* centered rect in world coords */
  function rect(c, x, y, w, hh, fill, stroke, lw) {
    const sx = T.x(x - w / 2), sy = T.y(y - hh / 2), sw = w * T.k, sh = hh * T.k;
    if (sx > stage.w || sy > stage.h || sx + sw < 0 || sy + sh < 0) return;
    if (fill) { c.fillStyle = fill; c.fillRect(sx, sy, sw, sh); }
    if (stroke && sw > 3) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1); }
  }
  const px = (w) => w * T.k;

  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w) return;
    T = makeT();
    c.fillStyle = Theme.dark ? "#0b0a0f" : "#e9e8ef";
    c.fillRect(0, 0, stage.w, stage.h);
    drawCampus(c, C);
    drawLabels(c, C);
    drawScaleBar(c, C);
  }

  function drawCampus(c, C) {
    const [ox, oy] = POS.campus;
    if (px(420) < 2000) {
      rect(c, ox, oy, 460, 290, Theme.dark ? "#121118" : "#dcdbe3");
      // roads
      c.strokeStyle = rgba(C.muted, 0.35); c.lineWidth = Math.max(1, px(6));
      c.strokeRect(T.x(ox - 215), T.y(oy - 75), px(430), px(190));
      // substation
      rect(c, ox + 170, oy - 105, 50, 30, rgba(C.l1, 0.25), C.l1);
      if (px(50) > 30) {
        c.strokeStyle = rgba(C.l1, 0.8); c.lineWidth = 1;
        for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(T.x(ox + 150 + i * 10), T.y(oy - 118)); c.lineTo(T.x(ox + 150 + i * 10), T.y(oy - 92)); c.stroke(); }
      }
      // power line in
      c.strokeStyle = rgba(C.l1, 0.6); c.lineWidth = Math.max(1, px(2));
      c.beginPath(); c.moveTo(T.x(ox + 230), T.y(oy - 140)); c.lineTo(T.x(ox + 195), T.y(oy - 105)); c.stroke();
    }
    BUILDINGS.forEach(([bx, by], bi) => {
      if (!T.vis(bx, by, 60, 60)) return;
      // cooling yard south of each building
      if (px(420) < 3000) {
        const yy = by + 26;
        for (let i = 0; i < 8; i++) {
          const cx = bx - 21 + i * 6;
          if (px(4) > 1.5) { c.fillStyle = rgba(C.l6, 0.35); c.beginPath(); c.arc(T.x(cx), T.y(yy), px(2.2), 0, Math.PI * 2); c.fill(); }
        }
      }
      rect(c, bx, by, 52, 34, Theme.dark ? "#1b1a24" : "#c9c8d3", rgba(C.muted, 0.6));
      HALL_IN_BLD.forEach(([hx, hy], hi) => {
        const cx = bx + hx, cy = by + hy;
        drawHall(c, C, cx, cy, bi === 1 && hi === 0);
      });
    });
  }

  function drawHall(c, C, x, y, focus) {
    if (!T.vis(x, y, 20, 28)) return;
    rect(c, x, y, 20, 28, Theme.dark ? "#16151d" : "#d6d5de", rgba(C.l2, 0.5));
    const k = T.k;
    if (px(20) < 20) { rect(c, x, y, 12, 26, rgba(C.l2, 0.35)); return; }
    // CDUs at row ends
    for (let r = 0; r < 10; r++) {
      const ry = -11.7 + r * 2.6;
      rect(c, x - 7.4, y + ry, 1, 1.07, rgba(C.l6, 0.35));
      rect(c, x + 7.4, y + ry, 1, 1.07, rgba(C.l6, 0.35));
    }
    if (k * 0.6 < 1.2) {
      // racks too small: draw rows as bars
      for (let r = 0; r < 10; r++) {
        const ry = -11.7 + r * 2.6;
        rect(c, x - 2.7, y + ry, 4.2, 1.07, rgba(C.l2, 0.55));
        rect(c, x + 2.7, y + ry, 4.2, 1.07, rgba(C.l2, 0.55));
      }
      return;
    }
    RACK_POS.forEach(([rx, ry], i) => drawRack(c, C, x + rx, y + ry, focus && i === FOCUS_RACK));
  }

  function drawRack(c, C, x, y, focus) {
    if (!T.vis(x, y, 0.6, 1.07)) return;
    rect(c, x, y, 0.6, 1.07, Theme.dark ? "#23212d" : "#bdbbc8", focus ? C.l2 : rgba(C.l2, 0.55), focus ? 2 : 1);
    if (px(0.6) < 8) return;
    // coolant manifolds and bus bar at the back
    rect(c, x - 0.24, y + 0.47, 0.03, 0.08, rgba(C.l6, 0.8));
    rect(c, x + 0.24, y + 0.47, 0.03, 0.08, rgba(C.l1, 0.8));
    drawTray(c, C, x, y, focus);
  }

  function drawTray(c, C, x, y, focus) {
    rect(c, x, y, 0.44, 0.86, Theme.dark ? "#1a1c28" : "#cfd3dc", rgba(C.muted, 0.5));
    if (px(0.44) < 16) return;
    // front: network ports
    for (let i = 0; i < 8; i++) rect(c, x - 0.19 + i * 0.054, y - 0.41, 0.03, 0.02, rgba(C.text, 0.4));
    // two superchip boards: CPU + 2 GPUs each
    [-0.1, 0.1].forEach((bx, b) => {
      const gpus = [[bx, -0.2], [bx, 0.02]];
      const cpu = [bx, 0.22];
      // coolant pipes
      if (px(0.44) > 40) {
        c.strokeStyle = rgba(C.l6, 0.7); c.lineWidth = Math.max(1, px(0.008));
        c.beginPath(); c.moveTo(T.x(bx - 0.06), T.y(0.4 + y)); c.lineTo(T.x(bx - 0.06), T.y(y - 0.28)); c.stroke();
        c.strokeStyle = rgba(C.l1, 0.7);
        c.beginPath(); c.moveTo(T.x(bx + 0.06), T.y(0.4 + y)); c.lineTo(T.x(bx + 0.06), T.y(y - 0.28)); c.stroke();
      }
      rect(c, x + cpu[0], y + cpu[1], 0.06, 0.06, rgba(C.l7, 0.55), C.l7);
      gpus.forEach(([gx, gy], gi) => drawPackage(c, C, x + gx, y + gy, focus && b === 0 && gi === 0));
    });
  }

  function drawPackage(c, C, x, y, focus) {
    rect(c, x, y, 0.09, 0.075, Theme.dark ? "#2a2735" : "#b5b2c3", focus ? C.l4 : rgba(C.muted, 0.6), focus ? 1.5 : 1);
    if (px(0.09) < 10) { rect(c, x, y, 0.055, 0.032, rgba(C.l4, 0.8)); return; }
    // HBM stacks: two above and two below each die
    [-1, 1].forEach((side) => {
      const dx = x + side * 0.0135;
      [-1, 1].forEach((v) => {
        [-1, 1].forEach((hh) => rect(c, dx + hh * 0.0065, y + v * 0.0225, 0.011, 0.012, rgba(C.l6, 0.55), rgba(C.l6, 0.9)));
      });
      drawDie(c, C, dx, y, focus && side === -1);
    });
  }

  function drawDie(c, C, x, y, focus) {
    rect(c, x, y, 0.026, 0.031, rgba(C.l4, Theme.dark ? 0.75 : 0.85), focus && px(0.026) > 40 ? C.text : null, 1.5);
    if (px(0.026) < 60) return;
    // SM grid 8 × 10 around an L2 band
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 10; j++) {
        const sx = x - 0.0105 + i * 0.003;
        const sy = y - 0.0135 + j * 0.0027 + (j >= 5 ? 0.0015 : 0);
        const isF = focus && i === 1 && j === 7;
        if (isF) drawSM(c, C, sx, sy, true);
        else rect(c, sx, sy, 0.0024, 0.002, Theme.dark ? "#3b3320" : "#a88a1e", rgba(C.bg, 0.4));
      }
    }
    rect(c, x, y - 0.0003, 0.024, 0.0012, rgba(C.l6, 0.45)); // L2 band
  }

  function drawSM(c, C, x, y, focus) {
    rect(c, x, y, 0.0024, 0.002, Theme.dark ? "#4a3f22" : "#b59625", focus ? C.text : null, 1);
    if (px(0.0024) < 50) return;
    // four processing blocks with tensor cores (gold) and registers (blue), L1 below
    for (let q = 0; q < 4; q++) {
      const qx = x - 0.0009 + q * 0.0006;
      rect(c, qx, y - 0.0003, 0.00054, 0.0012, rgba(C.bg, 0.25));
      rect(c, qx, y - 0.0006, 0.00046, 0.0004, rgba(C.l4, 0.7)); // tensor cores
      rect(c, qx, y - 0.0001, 0.00046, 0.0004, rgba(C.l6, 0.5)); // registers
      if (focus && q === 0) drawLogic(c, C, x + OFF.logic[0], y + OFF.logic[1], true);
    }
    rect(c, x, y + 0.00065, 0.0022, 0.0004, rgba(C.l7, 0.45)); // L1 / shared memory
  }

  function drawLogic(c, C, x, y) {
    rect(c, x, y, 2e-5, 2e-5, Theme.dark ? "#2b2618" : "#8f7a2a", C.text, 1);
    const k = T.k;
    if (px(2e-5) < 30) return;
    // standard-cell rows (0.4 µm tall) with alternating shades
    const rowH = 4e-7;
    const x0 = x - 1e-5, y0 = y - 1e-5;
    const r0 = Math.max(0, Math.floor((T.y(y0) < 0 ? (-T.y(y0)) / (rowH * k) : 0)));
    const nRows = 50;
    for (let r = r0; r < nRows; r++) {
      const ry = y0 + r * rowH;
      const sy = T.y(ry);
      if (sy > stage.h) break;
      if (rowH * k < 1.5) { if (r % 2) rect(c, x, ry + rowH / 2, 2e-5, rowH, rgba(C.l4, 0.2)); continue; }
      rect(c, x, ry + rowH / 2, 2e-5, rowH * 0.9, r % 2 ? rgba(C.l4, 0.18) : rgba(C.l6, 0.12));
    }
    // transistor-level detail: gates every 50 nm, fins every 30 nm (only when visible)
    if (5e-8 * k > 3) {
      const cx = x + OFF.transistor[0], cy = y + OFF.transistor[1];
      const left = (0 - T.x(x0)) / k + x0, right = (stage.w - T.x(x0)) / k + x0;
      const top = (0 - T.y(y0)) / k + y0, bot = (stage.h - T.y(y0)) / k + y0;
      const gx0 = Math.max(x0, left), gx1 = Math.min(x0 + 2e-5, right);
      const gy0 = Math.max(y0, top), gy1 = Math.min(y0 + 2e-5, bot);
      // fins: pairs every 0.4 µm row, 2 fins per device region
      c.fillStyle = rgba(C.l6, 0.7);
      for (let fy = Math.floor((gy0 - y0) / 3e-8) * 3e-8 + y0; fy < gy1; fy += 3e-8) {
        const inRow = ((fy - y0) % rowH) / rowH;
        if (inRow < 0.15 || inRow > 0.85 || (inRow > 0.42 && inRow < 0.58)) continue;
        c.fillRect(T.x(gx0), T.y(fy), (gx1 - gx0) * k, Math.max(1, 8e-9 * k));
      }
      c.fillStyle = rgba(C.l3, 0.95);
      for (let gx = Math.floor((gx0 - x0) / 5e-8) * 5e-8 + x0; gx < gx1; gx += 5e-8) {
        c.fillRect(T.x(gx), T.y(gy0), Math.max(1, 1.6e-8 * k), (gy1 - gy0) * k);
      }
      // highlight one transistor
      const hx = T.x(cx), hy = T.y(cy);
      const hr = 6e-8 * k;
      c.strokeStyle = C.text; c.lineWidth = 2;
      c.strokeRect(hx - hr, hy - hr * 0.9, hr * 2, hr * 1.8);
    }
  }

  function drawLabels(c, C) {
    const F = T.F;
    const mono = Theme.mono;
    c.font = `600 11px ${mono}`;
    const placed = [];
    for (let i = LV.length - 1; i >= 0; i--) {
      const l = LV[i];
      const p = POS[l.key];
      const sw = l.w * T.k;
      if (sw < 36 || sw > stage.w * 0.9) continue;
      const sx = T.x(p[0]), sy = T.y(p[1] - l.h / 2) - 8;
      if (placed.some(([x, y]) => Math.abs(x - sx) < 90 && Math.abs(y - sy) < 22)) continue;
      placed.push([sx, sy]);
      const label = l.key === "transistor" ? "ONE TRANSISTOR" : l.name.toUpperCase();
      const tw = c.measureText(label).width + 12;
      c.fillStyle = rgba(C.bg, 0.85);
      roundRect(c, sx - tw / 2, sy - 13, tw, 18, 5); c.fill();
      c.fillStyle = C.text; c.textAlign = "center";
      c.fillText(label, sx, sy);
    }
    void F;
  }

  function drawScaleBar(c, C) {
    const target = T.F / 5;
    const e = Math.pow(10, Math.floor(Math.log10(target)));
    let len = e;
    for (const m of [1, 2, 5]) if (m * e <= target) len = m * e;
    const w = len * T.k;
    const x = 14, y = stage.h - 16;
    c.fillStyle = rgba(C.bg, 0.8); roundRect(c, x - 6, y - 22, Math.max(w, 60) + 12, 30, 6); c.fill();
    c.fillStyle = C.text; c.fillRect(x, y, w, 3);
    c.fillRect(x, y - 4, 1.5, 7); c.fillRect(x + w - 1.5, y - 4, 1.5, 7);
    c.font = `600 11px ${Theme.mono}`; c.textAlign = "left";
    c.fillText(fmtLen(len), x, y - 8);
  }
  function fmtLen(m) {
    if (m >= 1000) return fmtNum(m / 1000, 2) + " km";
    if (m >= 1) return fmtNum(m, 2) + " m";
    if (m >= 1e-2) return fmtNum(m * 100, 2) + " cm";
    if (m >= 1e-3) return fmtNum(m * 1000, 2) + " mm";
    if (m >= 1e-6) return fmtNum(m * 1e6, 2) + " µm";
    return fmtNum(m * 1e9, 2) + " nm";
  }

  /* ---------- interaction ---------- */
  function tick(dt) {
    if (animT < 1) {
      animT = Math.min(1, animT + dt / 1.4);
      logF = lerp(animFrom, target, easeInOut(animT));
      sl.set(Math.exp(logF));
      sync();
    }
    draw();
  }
  function flyTo(F) {
    animFrom = logF; target = Math.log(clamp(F, FMIN, FMAX)); animT = reducedMotion() ? 1 : 0;
    if (reducedMotion()) { logF = target; sl.set(Math.exp(logF)); sync(); draw(); }
    Loop.wake();
  }
  // pinch: two pointers, or trackpad pinch (ctrl + wheel)
  const pts = new Map();
  let pinch0 = null;
  stage.canvas.style.touchAction = "pan-y";
  stage.canvas.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), lf: logF }; } });
  stage.canvas.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch0) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      logF = clamp(pinch0.lf - Math.log(d / pinch0.d) * 2, Math.log(FMIN), Math.log(FMAX));
      animT = 1; sl.set(Math.exp(logF)); sync(); draw();
    }
  });
  const endP = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null; };
  stage.canvas.addEventListener("pointerup", endP);
  stage.canvas.addEventListener("pointercancel", endP);
  stage.canvas.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return; // plain wheel scrolls the page
    e.preventDefault();
    logF = clamp(logF + e.deltaY * 0.01, Math.log(FMIN), Math.log(FMAX));
    animT = 1; sl.set(Math.exp(logF)); sync(); draw();
  }, { passive: false });

  var sl = slider({
    label: "Zoom", min: FMIN, max: FMAX, value: Math.exp(logF), log: true,
    fmt: (v) => `${fmtLen(v)} across`,
    ticks: [{ v: 1e-6, label: "1 µm" }, { v: 1e-3, label: "1 mm" }, { v: 1, label: "1 m" }, { v: 500, label: "500 m" }],
    onInput: (v) => { logF = Math.log(v); animT = 1; sync(); draw(); },
  });
  const seg = segmented({
    label: "Jump to",
    scroll: true,
    options: LV.map((l, i) => ({ value: i, label: l.name })),
    value: 4,
    onChange: (i) => flyTo(viewFor(LV[i])),
  });
  root.append(h("div", { class: "ctl-row" }, sl.el), h("div", { class: "ctl-row" }, seg.el));
  const roName = readout("In view");
  const roG = readout("GPUs");
  const roT = readout("Transistors");
  const roW = readout("Power");
  root.append(h("div", { class: "readouts" }, roName.el, roG.el, roT.el, roW.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  let lastLevel = -1;
  function sync() {
    const i = currentLevel(Math.exp(logF));
    if (i === lastLevel) return;
    lastLevel = i;
    const l = LV[i];
    seg.set(i);
    roName.set(l.name);
    roG.set(l.gpus >= 1 ? fmtInt(l.gpus) : l.gpus > 0 ? "½" : "—");
    roT.set(l.t >= 1e6 ? fmtWords(l.t, 2) : fmtInt(roundSig(l.t, 2)));
    roW.set(l.watts ? fmtSI(l.watts, "W", 2) : "tiny");
    status.innerHTML = `<b>${l.name}.</b> ${l.text}`;
  }
  Theme.on(draw);
  Loop.add(stage.canvas, tick, () => animT < 1);
  sync();
});
