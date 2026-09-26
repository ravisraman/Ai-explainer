/* =====================================================================
   Layer 3 · Silicon — (a) shrinking transistors, (b) wafer yield.
   ===================================================================== */

/* ---------- (a) Shrink the transistor ---------- */
defineMount("node", (root) => {
  // transistors, die area (mm²), process label
  const CHIPS = [
    { name: "Intel 4004", year: 1971, t: 2300, area: 12, node: "10 µm" },
    { name: "Intel 386", year: 1985, t: 275e3, area: 104, node: "1.5 µm" },
    { name: "Intel Pentium", year: 1993, t: 3.1e6, area: 294, node: "0.8 µm" },
    { name: "Intel Pentium 4", year: 2000, t: 42e6, area: 217, node: "180 nm" },
    { name: "Intel Core 2 Duo", year: 2006, t: 291e6, area: 143, node: "65 nm" },
    { name: "NVIDIA GTX 480", year: 2010, t: 3.0e9, area: 529, node: "40 nm" },
    { name: "NVIDIA P100", year: 2016, t: 15.3e9, area: 610, node: "16 nm" },
    { name: "NVIDIA V100", year: 2017, t: 21.1e9, area: 815, node: "12 nm" },
    { name: "NVIDIA A100", year: 2020, t: 54.2e9, area: 826, node: "7 nm" },
    { name: "NVIDIA H100", year: 2022, t: 80e9, area: 814, node: "4N (5 nm class)" },
    { name: "NVIDIA B200", year: 2024, t: 208e9, area: 1600, est: true, node: "4NP, two dies" },
  ];
  // side of the average square each transistor occupies, in µm
  const cellUm = (ch) => Math.sqrt(ch.area / ch.t) * 1000;
  const REFS = [
    { name: "human hair", um: 70, kind: "hair" },
    { name: "red blood cell", um: 7.5, kind: "cell" },
    { name: "bacterium", um: 2, kind: "rod" },
    { name: "flu virus", um: 0.1, kind: "virus" },
  ];
  let idx = 0;
  let dispLogCell = Math.log(cellUm(CHIPS[0]));
  let dispLogLens = Math.log(lensFor(cellUm(CHIPS[0])));
  let dispLogT = Math.log(CHIPS[0].t);

  function lensFor(cell) {
    const raw = cell * 7;
    const e = Math.floor(Math.log10(raw));
    for (const m of [1, 2, 5, 10]) if (m * Math.pow(10, e) >= raw) return m * Math.pow(10, e);
    return 10 * Math.pow(10, e);
  }

  let L = {};
  const stage = new Stage(root, {
    label: "A magnifying lens over transistors at true relative size, the chip's outline, and a chart of transistor counts from 1971 to 2024.",
    height: (w) => (w >= 600 ? clamp(w * 0.66, 380, 470) : w * 0.56 + 215),
    onResize: (w, hh) => {
      const wide = w >= 600;
      const chartH = wide ? 150 : 170;
      const topH = hh - chartH - 12;
      const lens = wide ? Math.min(topH - 30, w * 0.46) : Math.min(w * 0.56, topH - 30);
      const dx = lens + (wide ? 40 : 18);
      L = {
        wide,
        lens: { x: wide ? 10 : 2, y: 22, s: lens },
        die: { x: dx, y: 22, w: w - dx - 6, h: topH - 22 },
        chart: { x: wide ? 10 : 2, y: topH + 12, w: w - (wide ? 20 : 4), h: chartH - 4 },
      };
    },
    draw: () => draw(),
  });

  function tick(dt) {
    const ch = CHIPS[idx];
    const tc = Math.log(cellUm(ch)), tl = Math.log(lensFor(cellUm(ch))), tt = Math.log(ch.t);
    dispLogCell = approach(dispLogCell, tc, 6, dt);
    dispLogLens = approach(dispLogLens, tl, 4, dt);
    dispLogT = approach(dispLogT, tt, 6, dt);
    draw();
  }
  const settled = () => {
    const ch = CHIPS[idx];
    return Math.abs(dispLogCell - Math.log(cellUm(ch))) > 0.002 || Math.abs(dispLogLens - Math.log(lensFor(cellUm(ch)))) > 0.002;
  };

  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w || !L.lens) return;
    stage.clear();
    const acc = C.l3, mono = Theme.mono;
    const ch = CHIPS[idx];
    const cell = Math.exp(dispLogCell), lensW = Math.exp(dispLogLens);
    const { x: lx, y: ly, s } = L.lens;
    const px = s / lensW; // pixels per µm

    // lens
    c.save();
    c.fillStyle = C.sunk; roundRect(c, lx, ly, s, s, 12); c.fill();
    c.beginPath(); roundRect(c, lx, ly, s, s, 12); c.clip();
    const cp = cell * px;
    const n = Math.ceil(s / cp) + 1;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = lx + i * cp, y = ly + j * cp;
        if (cp < 5) {
          c.fillStyle = rgba(acc, 0.5);
          c.fillRect(x + cp * 0.2, y + cp * 0.2, Math.max(0.8, cp * 0.6), Math.max(0.8, cp * 0.6));
          continue;
        }
        // transistor footprint: active area (fin) + gate across it + contacts
        c.fillStyle = rgba(C.text, 0.06);
        c.fillRect(x + cp * 0.06, y + cp * 0.06, cp * 0.88, cp * 0.88);
        c.fillStyle = rgba(C.l6, 0.45);
        c.fillRect(x + cp * 0.14, y + cp * 0.36, cp * 0.72, cp * 0.28);
        c.fillStyle = acc;
        c.fillRect(x + cp * 0.44, y + cp * 0.16, cp * 0.12, cp * 0.68);
        if (cp > 14) {
          c.fillStyle = rgba(C.text, 0.55);
          c.fillRect(x + cp * 0.2, y + cp * 0.44, cp * 0.1, cp * 0.12);
          c.fillRect(x + cp * 0.7, y + cp * 0.44, cp * 0.1, cp * 0.12);
        }
      }
    }
    // reference object at the same scale
    let ref = null, best = 1e9;
    for (const r of REFS) {
      const ratio = r.um / lensW;
      if (ratio < 0.04 || ratio > 1.2) continue;
      const score = Math.abs(Math.log(ratio / 0.35));
      if (score < best) { best = score; ref = r; }
    }
    if (ref) {
      const rp = ref.um * px;
      const cx = lx + s * 0.62, cy = ly + s * 0.6;
      c.fillStyle = rgba(C.l9, 0.28); c.strokeStyle = rgba(C.l9, 0.95); c.lineWidth = 2;
      c.beginPath();
      if (ref.kind === "hair") { c.rect(lx - 5, cy - rp / 2, s + 10, rp); }
      else if (ref.kind === "rod") { roundRect(c, cx - rp / 2, cy - rp / 4, rp, rp / 2, rp / 4); }
      else { c.arc(cx, cy, rp / 2, 0, Math.PI * 2); }
      c.fill(); c.stroke();
      if (ref.kind === "virus" && rp > 10) {
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2;
          c.beginPath(); c.moveTo(cx + Math.cos(a) * rp / 2, cy + Math.sin(a) * rp / 2);
          c.lineTo(cx + Math.cos(a) * rp * 0.62, cy + Math.sin(a) * rp * 0.62); c.stroke();
        }
      }
      c.fillStyle = C.text; c.font = `600 11px ${mono}`; c.textAlign = "center";
      const ty = ref.kind === "hair" ? cy - rp / 2 - 8 : cy - (ref.kind === "rod" ? rp / 4 : rp / 2) - 8;
      pill(c, `${ref.name} · ${fmtUm(ref.um)}`, ref.kind === "hair" ? lx + s / 2 : cx, Math.max(ly + 16, ty), C);
    }
    c.restore();
    c.strokeStyle = C["line-2"]; c.lineWidth = 1.5; roundRect(c, lx, ly, s, s, 12); c.stroke();
    // scale bar
    const barUm = niceBelow(lensW / 3);
    const barPx = barUm * px;
    c.fillStyle = C.text;
    c.fillRect(lx + 12, ly + s - 18, barPx, 3);
    c.font = `600 11px ${mono}`; c.textAlign = "left";
    pill(c, fmtUm(barUm), lx + 12 + barPx / 2, ly + s - 30, C);
    c.fillStyle = C.muted; c.font = `600 10px ${mono}`; c.textAlign = "left";
    c.fillText(`LENS: ${fmtUm(lensW)} ACROSS`, lx, ly - 8);

    // die
    const D = L.die;
    c.textAlign = "left";
    c.fillStyle = C.muted; c.font = `600 10px ${mono}`;
    c.fillText(L.wide ? "THE WHOLE CHIP, TO SCALE" : "WHOLE CHIP", D.x, D.y - 8);
    const maxSide = Math.sqrt(1600 / 2) * 2; // widest: B200's two dies side by side
    const scale = Math.min((D.w - 4) / maxSide, (D.h - 76) / 33);
    const dies = ch.area > 900 ? 2 : 1;
    const side = Math.sqrt(ch.area / dies) * scale;
    const dy = D.y + 8;
    for (let k = 0; k < dies; k++) {
      const dx = D.x + k * (side + 4);
      const g = c.createLinearGradient(dx, dy, dx + side, dy + side);
      g.addColorStop(0, rgba(acc, 0.55)); g.addColorStop(1, rgba(C.l2, 0.35));
      c.fillStyle = g; c.fillRect(dx, dy, side, side);
      c.strokeStyle = acc; c.lineWidth = 1; c.strokeRect(dx + 0.5, dy + 0.5, side - 1, side - 1);
      if (side > 30) {
        c.strokeStyle = rgba(C.bg, 0.35); c.lineWidth = 1;
        const blocks = 4;
        for (let b = 1; b < blocks; b++) {
          c.beginPath(); c.moveTo(dx + (side * b) / blocks, dy); c.lineTo(dx + (side * b) / blocks, dy + side); c.stroke();
          c.beginPath(); c.moveTo(dx, dy + (side * b) / blocks); c.lineTo(dx + side, dy + (side * b) / blocks); c.stroke();
        }
      }
    }
    // reticle limit outline
    const rs = 33 * scale;
    c.setLineDash([3, 3]); c.strokeStyle = C.faint; c.strokeRect(D.x + 0.5, dy + 0.5, 26 * scale, rs); c.setLineDash([]);
    c.fillStyle = C.faint; c.font = `600 9px ${mono}`;
    c.fillText("MAX ONE EXPOSURE", D.x, dy + rs + 12);
    c.fillStyle = C.text; c.font = `700 ${L.wide ? 15 : 13}px ${Theme.body}`;
    const ty0 = dy + Math.max(rs, side) + 34;
    c.fillText(L.wide ? `${ch.name} · ${ch.year}` : ch.name, D.x, ty0);
    c.fillStyle = C.muted; c.font = `500 ${L.wide ? 13 : 12}px ${Theme.body}`;
    if (L.wide) c.fillText(`${ch.est ? "~" : ""}${fmtNum(ch.area, 3)} mm²${ch.est ? " (est.)" : ""} · process "${ch.node}"`, D.x, ty0 + 19);
    else { c.fillText(`${ch.year} · ${ch.est ? "~" : ""}${fmtNum(ch.area, 3)} mm²`, D.x, ty0 + 17); c.fillText(`"${ch.node.split(",")[0]}"`, D.x, ty0 + 33); }

    drawChart(c, C, mono);
  }

  function pill(c, text, x, y, C) {
    const w = c.measureText(text).width + 12;
    c.fillStyle = rgba(C.bg, 0.8);
    roundRect(c, x - w / 2, y - 11, w, 16, 5); c.fill();
    c.fillStyle = C.text; c.textAlign = "center";
    c.fillText(text, x, y + 1);
  }

  function drawChart(c, C, mono) {
    const R = L.chart;
    const pl = 30, pr = 10, pt = 18, pb = 20;
    const x0 = R.x + pl, x1 = R.x + R.w - pr, y0 = R.y + R.h - pb, y1 = R.y + pt;
    const X = (yr) => lerp(x0, x1, invLerp(1970, 2026, yr));
    const Y = (t) => lerp(y0, y1, invLerp(3, 12, Math.log10(t)));
    c.fillStyle = C.muted; c.font = `600 10px ${mono}`; c.textAlign = "left";
    c.fillText("TRANSISTORS PER CHIP (LOG SCALE)", R.x, R.y + 8);
    c.strokeStyle = C.line; c.lineWidth = 1;
    c.font = `500 10px ${mono}`;
    for (let e = 3; e <= 12; e += 3) {
      c.beginPath(); c.moveTo(x0, Y(10 ** e)); c.lineTo(x1, Y(10 ** e)); c.stroke();
      c.fillStyle = C.faint; c.textAlign = "right";
      c.fillText({ 3: "1k", 6: "1M", 9: "1B", 12: "1T" }[e], x0 - 6, Y(10 ** e) + 3);
    }
    c.textAlign = "center";
    for (const yr of [1970, 1980, 1990, 2000, 2010, 2020]) { c.fillStyle = C.faint; c.fillText(String(yr), X(yr), y0 + 14); }
    // trend: doubling every 2 years from the 4004
    c.strokeStyle = rgba(C.text, 0.25); c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(X(1971), Y(2300)); c.lineTo(X(2024), Y(2300 * Math.pow(2, (2024 - 1971) / 2))); c.stroke(); c.setLineDash([]);
    c.fillStyle = C.faint; c.textAlign = "left";
    const tx = X(1996), tyy = Y(2300 * Math.pow(2, (1996 - 1971) / 2));
    if (L.wide) c.fillText("doubling every 2 years", tx + 8, tyy + 14);
    // points
    CHIPS.forEach((ch, i) => {
      const cur = i === idx;
      c.fillStyle = cur ? C.l3 : rgba(C.l3, 0.45);
      c.beginPath(); c.arc(X(ch.year), Y(ch.t), cur ? 6 : 3.5, 0, Math.PI * 2); c.fill();
      if (cur) { c.strokeStyle = C.text; c.lineWidth = 1.5; c.stroke(); }
    });
    // moving marker for smooth transitions
    const cur = CHIPS[idx];
    c.fillStyle = C.text; c.font = `700 11px ${mono}`;
    const lab = fmtWords(Math.exp(dispLogT), 2);
    const lx = X(cur.year), ly = Y(cur.t) - 12;
    c.textAlign = lx > x1 - 60 ? "right" : lx < x0 + 60 ? "left" : "center";
    c.fillText(lab, lx, ly);
  }

  const niceBelow = (x) => { const e = Math.pow(10, Math.floor(Math.log10(x))); for (const m of [5, 2, 1]) if (m * e <= x) return m * e; return e; };
  const fmtUm = (um) => (um = roundSig(um, 3), um >= 1000 ? fmtNum(um / 1000, 2) + " mm" : um >= 1 ? fmtNum(um, 2) + " µm" : fmtNum(um * 1000, 2) + " nm");

  const sl = slider({
    label: "Year and chip",
    values: CHIPS.map((_, i) => i), value: 0,
    fmt: (i) => `${CHIPS[i].year} · ${CHIPS[i].name}`,
    ticks: [{ v: 0, label: "1971" }, { v: 3, label: "2000" }, { v: 6, label: "2016" }, { v: 10, label: "2024" }],
    onInput: (i) => { idx = i; update(); },
  });
  root.append(h("div", { class: "ctl-row" }, sl.el));
  const roT = readout("Transistors");
  const roCell = readout("Space per transistor");
  const roX = readout("Growth since 1971");
  root.append(h("div", { class: "readouts" }, roT.el, roCell.el, roX.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  function update() {
    const ch = CHIPS[idx];
    roT.set(fmtWords(ch.t, 3));
    roCell.set(fmtUm(cellUm(ch)), "");
    roX.set(fmtWords(ch.t / 2300, 2), "×");
    const cell = cellUm(ch);
    let cmp;
    if (cell > 30) cmp = "about the width of a human hair";
    else if (cell > 5) cmp = "about the size of a red blood cell";
    else if (cell > 1) cmp = "about the size of a bacterium";
    else if (cell > 0.3) cmp = "a few times wider than a flu virus";
    else if (cell > 0.095) cmp = "about the size of a flu virus";
    else cmp = "a little smaller than a flu virus";
    let extra = "";
    if (idx >= 8) extra = ` Process names like "7 nm" and "4N" are labels; no feature on the chip measures that. Transistor gates sit roughly 50–60 nm apart.`;
    if (idx === 10) extra = " One exposure prints at most ~858 mm², so the B200 joins two dies of roughly that size (areas est.).";
    status.innerHTML = `<b>${ch.name} (${ch.year}): ${fmtWords(ch.t, 3)} transistors.</b> Each one, with its share of wiring, takes up a square ${fmtUm(cell)} across, ${cmp}.${extra}`;
    Loop.wake();
  }
  Theme.on(draw);
  Loop.add(stage.canvas, tick, settled);
  update();
});

/* ---------- (b) Wafer yield ---------- */
defineMount("wafer", (root) => {
  const WAFER_D = 300, EDGE = 3, COST = 20000;
  const RU = WAFER_D / 2 - EDGE; // usable radius, mm
  const AREA_CM2 = (Math.PI * RU * RU) / 100;
  let D0 = 0.1, A = 400, seed = 11;
  let cand = [], uCount = 0.5;

  function reroll() {
    const R = rng(seed);
    uCount = clamp(R(), 0.02, 0.98);
    cand = [];
    while (cand.length < 3000) {
      const x = (R() * 2 - 1) * RU, y = (R() * 2 - 1) * RU;
      if (x * x + y * y <= RU * RU) cand.push([x, y]);
    }
  }
  reroll();
  /* Poisson quantile so that raising the defect rate adds defects */
  function poissonQ(u, mean) {
    if (mean > 200) return Math.round(mean + Math.sqrt(mean) * Math.SQRT2 * erfinv(2 * u - 1));
    let k = 0, p = Math.exp(-mean), cdf = p;
    while (cdf < u && k < 3000) { k++; p *= mean / k; cdf += p; }
    return k;
  }
  function erfinv(x) {
    const a = 0.147, ln = Math.log(1 - x * x);
    const t = 2 / (Math.PI * a) + ln / 2;
    return Math.sign(x) * Math.sqrt(Math.sqrt(t * t - ln / a) - t);
  }
  function layoutDies(area) {
    const s = Math.sqrt(area);
    let best = null;
    for (const ox of [0, 0.5]) for (const oy of [0, 0.5]) {
      const dies = [];
      const n = Math.ceil(RU / s) + 1;
      for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
        const x = (i - ox) * s, y = (j - oy) * s;
        const corners = [[x, y], [x + s, y], [x, y + s], [x + s, y + s]];
        const inside = corners.every(([a, b]) => a * a + b * b <= RU * RU);
        const touches = corners.some(([a, b]) => a * a + b * b <= (WAFER_D / 2) ** 2);
        if (inside) dies.push({ x, y, s, whole: true });
        else if (touches) dies.push({ x, y, s, whole: false });
      }
      const whole = dies.filter((d) => d.whole).length;
      if (!best || whole > best.whole) best = { dies, whole };
    }
    return best;
  }
  function simulate() {
    const lay = layoutDies(A);
    const k = Math.min(cand.length, poissonQ(uCount, D0 * AREA_CM2));
    const defects = cand.slice(0, k);
    for (const d of lay.dies) d.bad = false;
    for (const [x, y] of defects) {
      for (const d of lay.dies) {
        if (d.whole && x >= d.x && x < d.x + d.s && y >= d.y && y < d.y + d.s) { d.bad = true; break; }
      }
    }
    const good = lay.dies.filter((d) => d.whole && !d.bad).length;
    return { ...lay, defects, good };
  }
  /* analytic model for the curve */
  const grossModel = (a) => Math.max(0, (Math.PI * RU * RU) / a - (Math.PI * 2 * RU) / Math.sqrt(2 * a));
  const yieldModel = (a, d0) => Math.exp(-d0 * a / 100);
  const costModel = (a, d0) => COST / Math.max(1e-9, grossModel(a) * yieldModel(a, d0));

  let sim = simulate();
  let L = {};
  const stage = new Stage(root, {
    label: "A 300 mm silicon wafer divided into chips, with random defects. Working chips are lit; chips hit by a defect are dark.",
    height: (w) => (w >= 600 ? clamp(w * 0.5, 320, 400) : clamp(w * 1.5, 480, 600)),
    onResize: (w, hh) => {
      const wide = w >= 600;
      const ws = wide ? Math.min(hh - 16, w * 0.52) : Math.min(w - 16, hh * 0.58);
      L = {
        wafer: { cx: wide ? ws / 2 + 8 : w / 2, cy: wide ? hh / 2 : ws / 2 + 8, r: ws / 2 - 4 },
        chart: wide ? { x: ws + 30, y: 10, w: w - ws - 38, h: hh - 20 } : { x: 8, y: ws + 26, w: w - 16, h: hh - ws - 34 },
      };
    },
    draw: () => draw(),
  });

  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w || !L.wafer) return;
    stage.clear();
    const { cx, cy, r } = L.wafer;
    const k = r / (WAFER_D / 2);
    const acc = C.l3, mono = Theme.mono;
    // wafer disc
    const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, Theme.dark ? "#3a3a4a" : "#d9d9e3"); g.addColorStop(1, Theme.dark ? "#1f1f2a" : "#b9b9c8");
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    // notch
    c.fillStyle = C.panel; c.beginPath(); c.arc(cx, cy + r, r * 0.02 + 2, 0, Math.PI * 2); c.fill();
    // dies
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
    for (const d of sim.dies) {
      const x = cx + d.x * k, y = cy + d.y * k, s = d.s * k;
      const gap = Math.min(1.2, s * 0.08);
      if (!d.whole) { c.strokeStyle = rgba(C.text, 0.12); c.lineWidth = 0.6; c.strokeRect(x + gap, y + gap, s - gap * 2, s - gap * 2); continue; }
      c.fillStyle = d.bad ? rgba(C.bad, Theme.dark ? 0.28 : 0.35) : acc;
      c.fillRect(x + gap, y + gap, s - gap * 2, s - gap * 2);
    }
    // defects
    c.fillStyle = Theme.dark ? "#ffffff" : "#15131c";
    const dotR = Math.max(1, r / 170);
    for (const [x, y] of sim.defects) { c.beginPath(); c.arc(cx + x * k, cy + y * k, dotR, 0, Math.PI * 2); c.fill(); }
    c.restore();
    c.strokeStyle = C.muted; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();

    // cost curve
    const R = L.chart;
    const pl = 48, pb = 30, pt = 30, pr = 8;
    const x0 = R.x + pl, x1 = R.x + R.w - pr, y0 = R.y + R.h - pb, y1 = R.y + pt;
    const AMIN = 20, AMAX = 858;
    const X = (a) => lerp(x0, x1, invLerp(Math.log(AMIN), Math.log(AMAX), Math.log(a)));
    const CMIN = 1, CMAX = 1e6;
    const Y = (v) => lerp(y0, y1, invLerp(Math.log10(CMIN), Math.log10(CMAX), Math.log10(clamp(v, CMIN, CMAX))));
    c.fillStyle = C.muted; c.font = `600 10px ${mono}`; c.textAlign = "left";
    c.fillText("COST PER WORKING CHIP", R.x, R.y + 12);
    c.font = `500 10px ${mono}`;
    for (const v of [1, 10, 100, 1000, 1e4, 1e5, 1e6]) {
      c.strokeStyle = C.line; c.beginPath(); c.moveTo(x0, Y(v)); c.lineTo(x1, Y(v)); c.stroke();
      c.fillStyle = C.faint; c.textAlign = "right"; c.fillText(v >= 1e6 ? "$1M" : v >= 1000 ? `$${v / 1000}k` : `$${v}`, x0 - 5, Y(v) + 3);
    }
    c.textAlign = "center";
    for (const a of [20, 50, 100, 200, 400, 858]) { c.fillStyle = C.faint; c.fillText(String(a), X(a), y0 + 14); }
    c.fillText("chip area, mm² (log)", (x0 + x1) / 2, y0 + 27);
    // no-defect line
    c.strokeStyle = rgba(C.text, 0.35); c.setLineDash([4, 4]); c.lineWidth = 1.2;
    c.beginPath();
    for (let i = 0; i <= 60; i++) { const a = AMIN * Math.pow(AMAX / AMIN, i / 60); const v = COST / Math.max(1e-9, grossModel(a)); i ? c.lineTo(X(a), Y(v)) : c.moveTo(X(a), Y(v)); }
    c.stroke(); c.setLineDash([]);
    // with defects
    c.strokeStyle = acc; c.lineWidth = 2.2;
    c.beginPath();
    for (let i = 0; i <= 80; i++) { const a = AMIN * Math.pow(AMAX / AMIN, i / 80); const v = costModel(a, D0); i ? c.lineTo(X(a), Y(v)) : c.moveTo(X(a), Y(v)); }
    c.stroke();
    c.fillStyle = C.faint; c.textAlign = "left";
    c.fillText("if no defects", X(300), Y(COST / grossModel(300)) + 16);
    // marker
    const mv = costModel(A, D0);
    c.fillStyle = C.text; c.beginPath(); c.arc(X(A), Y(mv), 5, 0, Math.PI * 2); c.fill();
    c.font = `700 11px ${mono}`;
    c.textAlign = X(A) > x1 - 70 ? "right" : "left";
    c.fillText(`~${fmtMoney(mv)}`, X(A) + (c.textAlign === "right" ? -9 : 9), Y(mv) - 7);
  }

  const slD = slider({
    label: "Defect rate", min: 0.02, max: 2, value: D0, log: true,
    round: (v) => roundSig(v, 2),
    fmt: (v) => `${fmtNum(v, 2)} per cm²`,
    ticks: [{ v: 0.02, label: "0.02" }, { v: 0.1, label: "mature" }, { v: 0.5, label: "new" }, { v: 2, label: "2" }],
    onInput: (v) => { D0 = v; update(); },
  });
  const slA = slider({
    label: "Chip area", min: 20, max: 858, value: A, log: true,
    round: (v) => (v >= 850 ? 858 : Math.round(v / (v < 100 ? 5 : 10)) * (v < 100 ? 5 : 10)),
    fmt: (v) => `${fmtInt(v)} mm²`,
    ticks: [{ v: 20, label: "20" }, { v: 100, label: "phone chip" }, { v: 814, label: "H100" }],
    onInput: (v) => { A = v; update(); },
  });
  const bNew = button("New wafer", () => { seed++; reroll(); update(); }, { icon: "dice", small: true });
  root.append(h("div", { class: "ctl-row" }, slD.el, slA.el, h("div", { class: "btn-row" }, bNew)));
  const roGross = readout("Whole chips");
  const roGood = readout("Working");
  const roYield = readout("Yield");
  const roCost = readout("Cost per working chip");
  root.append(h("div", { class: "readouts" }, roGross.el, roGood.el, roYield.el, roCost.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  function update() {
    sim = simulate();
    const y = sim.whole ? sim.good / sim.whole : 0;
    roGross.set(fmtInt(sim.whole), "", "per 300 mm wafer");
    roGood.set(fmtInt(sim.good), "", `${fmtInt(sim.defects.length)} defects landed`);
    roYield.set(Math.round(y * 100), "%", `model: ~${Math.round(yieldModel(A, D0) * 100)}%`);
    if (sim.good) { roCost.set(fmtMoney(COST / sim.good)); roCost.state("hi"); }
    else { roCost.set("no chips"); roCost.state("bad"); }
    const a2 = Math.min(858, A * 2);
    const ratio = costModel(a2, D0) / costModel(A, D0);
    status.innerHTML = a2 > A
      ? `At this defect rate, going from ${fmtInt(A)} to ${fmtInt(a2)} mm² multiplies the cost of each working chip by about <b>${fmtNum(ratio, 2)}×</b>, not 2×: fewer chips fit, and each is more likely to catch a defect.`
      : `This is the biggest chip one exposure can print (~858 mm²). Anything larger has to be built from several dies.`;
    draw();
  }
  Actions.wafer = (arg) => {
    if (arg === "double") {
      slD.set(0.1, false); D0 = 0.1;
      slA.set(400, true);
      setTimeout(() => slA.set(800, true), 1100);
    }
  };
  Theme.on(draw);
  update();
});
