/* =====================================================================
   Layer 1 · Energy — power a cluster.
   One continuous scene: six kinds of power plant feed a transmission
   line into a data center; electricity pulses flow in, heat flows out.
   The reader sets the cluster size, the cooling and the power source.
   ===================================================================== */

defineMount("power", (root) => {
  const PER_GPU = 1800; // W per GPU, all-in (Blackwell-class): its share of CPUs, memory, network, fans
  const HOME = 1200; // W, average US household draw over a year
  const CAR_T = 4.6; // t CO2 per typical passenger car per year (US EPA)
  const MODES = {
    air: { pue: 1.5, cool: 0.4, other: 0.1, perRack: 16, dT: 12, name: "Air" },
    liquid: { pue: 1.15, cool: 0.1, other: 0.05, perRack: 72, dT: 10, name: "Liquid" },
  };
  const NAMED = [
    { v: 1, name: "one GPU" },
    { v: 8, name: "one server" },
    { v: 72, name: "one liquid-cooled rack" },
    { v: 1000, name: "a row of racks" },
    { v: 10000, name: "a data hall" },
    { v: 100000, name: "a 2024-scale frontier cluster" },
  ];
  // lifecycle emissions, g CO2 per kWh (IPCC AR5 medians)
  const PLANTS = [
    { k: "coal", name: "Coal", g: 820 },
    { k: "gas", name: "Gas", g: 490 },
    { k: "nuclear", name: "Nuclear", g: 12 },
    { k: "hydro", name: "Hydro", g: 24 },
    { k: "wind", name: "Wind", g: 11 },
    { k: "solar", name: "Solar", g: 48 },
  ];
  const SOURCES = {
    grid: { label: "US grid mix", mix: { gas: 0.43, coal: 0.16, nuclear: 0.18, hydro: 0.06, wind: 0.1, solar: 0.07 } },
    gas: { label: "Gas", mix: { gas: 1 } },
    nuclear: { label: "Nuclear", mix: { nuclear: 1 } },
    renew: { label: "Solar + wind", mix: { solar: 0.5, wind: 0.5 } },
  };
  let n = 8, mode = "liquid", source = "grid";
  let dispHomes = 1, time = 0;
  const R = rng(7);

  const itW = () => n * PER_GPU;
  const facW = () => itW() * MODES[mode].pue;
  const load = () => clamp(Math.log10(itW() / 1000 + 1) / Math.log10(180001), 0, 1);
  const racks = () => Math.max(1, Math.ceil(n / MODES[mode].perRack));
  const mixOf = () => SOURCES[source].mix;
  const gPerKWh = () => PLANTS.reduce((a, p) => a + (mixOf()[p.k] || 0) * p.g, 0);
  const homesTarget = () => facW() / HOME;

  /* particle pools (declared before the stage so layout can reset them) */
  const pulses = [], heat = [], puffs = [], cool = [];

  /* ---------- scene geometry ---------- */
  let G = null;
  const stage = new Stage(root, {
    cls: "power-stage",
    label: "Power plants feed a transmission line into a data center; electricity flows in and heat flows out.",
    height: (w) => (w >= 560 ? clamp(w * 0.52, 320, 420) : clamp(w * 1.2, 400, 480)),
    onResize: layout,
    draw: () => draw(),
  });

  function layout(w, hh) {
    const wide = w >= 560;
    const g = { w, hh, wide };
    // two rows of plants (back row smaller, for depth), a switchyard, two pylons, the data center
    const pz = wide ? { x0: 6, x1: w * 0.55, back: hh * 0.5, front: hh * 0.86 } : { x0: 4, x1: w - 4, back: hh * 0.22, front: hh * 0.46 };
    const slotW = (pz.x1 - pz.x0) / 3;
    g.u = Math.min(slotW * (wide ? 0.78 : 0.68), wide ? 96 : 66);
    const order = [["coal", "gas", "nuclear"], ["hydro", "wind", "solar"]];
    g.plants = [];
    order.forEach((row, ri) => row.forEach((k, ci) => {
      const P = PLANTS.find((p) => p.k === k);
      const back = ri === 0;
      g.plants.push({ ...P, cx: pz.x0 + slotW * (ci + 0.5) + (back ? slotW * 0.18 : -slotW * 0.06), base: back ? pz.back : pz.front, sc: back ? 0.84 : 1 });
    }));
    g.ground = pz.front;
    g.backGround = pz.back;
    if (wide) {
      g.yard = { x: w * 0.585, y: hh * 0.66 };
      g.pylons = [w * 0.625, w * 0.69];
      g.wireY = hh * 0.36;
      g.pylonBase = g.ground;
      g.bld = { x: w * 0.725, y: hh * 0.3, w: w * 0.275 - 6, h: g.ground - hh * 0.3 };
      g.sub = { x: g.pylons[1] + 6, y: g.ground - 22, w: 0, h: 22 };
    } else {
      g.yard = { x: w * 0.9, y: hh * 0.54 };
      g.pylons = [w * 0.9, w * 0.9];
      g.wireY = hh * 0.52;
      g.pylonBase = hh * 0.6;
      g.bld = { x: 8, y: hh * 0.62, w: w - 16, h: hh * 0.33 };
      g.sub = { x: w * 0.9, y: hh * 0.62, w: 0, h: 0 };
    }
    // one path per plant: plant → curved feeder → switchyard → line over the pylons → building
    const entry = wide ? [g.bld.x + 4, g.bld.y + g.bld.h * 0.62] : [w * 0.9, g.bld.y + 10];
    g.paths = g.plants.map((p) => {
      const sx = p.cx + g.u * p.sc * 0.4, sy = p.base - g.u * p.sc * 0.1;
      const pts = [];
      const c1 = [lerp(sx, g.yard.x, 0.6), sy], c2 = [g.yard.x - 30, g.yard.y];
      for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push(bez([sx, sy], c1, c2, [g.yard.x, g.yard.y], t)); }
      if (wide) {
        const a = [g.yard.x, g.yard.y], p1 = [g.pylons[0], g.wireY], p2 = [g.pylons[1], g.wireY];
        for (let k = 1; k <= 8; k++) pts.push(sagged(a, p1, k / 8));
        for (let k = 1; k <= 8; k++) pts.push(sagged(p1, p2, k / 8));
        for (let k = 1; k <= 10; k++) pts.push(sagged(p2, entry, k / 10));
      } else {
        pts.push([g.yard.x, g.yard.y]);
        for (let k = 1; k <= 10; k++) pts.push(sagged([g.yard.x, g.yard.y], entry, k / 10));
      }
      return pathInfo(pts);
    });
    G = g;
    pulses.length = 0; heat.length = 0; puffs.length = 0; cool.length = 0;
  }
  function bez(a, b, c, d, t) {
    const u = 1 - t;
    return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
  }
  /* point on a sagging cable between a and b */
  function sagged(a, b, t) {
    const sag = Math.min(14, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.08);
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t) + sag * (1 - (2 * t - 1) ** 2)];
  }
  function pathInfo(pts) {
    const seg = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
    return { pts, seg, total };
  }
  function at(p, s) {
    let d = s * p.total;
    for (let i = 0; i < p.seg.length; i++) {
      if (d <= p.seg[i] || i === p.seg.length - 1) { const t = p.seg[i] ? clamp(d / p.seg[i], 0, 1) : 0; return [lerp(p.pts[i][0], p.pts[i + 1][0], t), lerp(p.pts[i][1], p.pts[i + 1][1], t)]; }
      d -= p.seg[i];
    }
    return p.pts[p.pts.length - 1];
  }

  /* ---------- simulation step ---------- */
  function tick(dt) {
    time += dt;
    const g = G;
    if (!g) return;
    const L = load(), mix = mixOf();
    if (!reducedMotion()) {
      // electricity pulses, shared out by each plant's share of the mix
      const want = Math.round(6 + 34 * L);
      if (pulses.length < want && R() < 0.6) {
        const act = g.plants.filter((p) => mix[p.k]);
        let u = R(), pick = act[act.length - 1];
        for (const p of act) { u -= mix[p.k]; if (u <= 0) { pick = p; break; } }
        pulses.push({ i: g.plants.indexOf(pick), s: 0, v: 0.18 + R() * 0.06 });
      }
      for (const q of pulses) q.s += q.v * dt * (0.8 + L);
      for (let k = pulses.length - 1; k >= 0; k--) if (pulses[k].s >= 1) pulses.splice(k, 1);
      // plumes from active thermal plants
      for (const p of g.plants) {
        if (!mix[p.k]) continue;
        const src = plumeSource(p);
        if (src && R() < dt * src.rate) puffs.push({ x: src.x + (R() - 0.5) * 3, y: src.y, r: src.r, vx: 4 + R() * 6, vy: -(10 + R() * 8), life: 0, max: src.life, col: src.col, a: src.a });
      }
      for (const f of puffs) { f.life += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.r += dt * f.r * 0.55; }
      for (let k = puffs.length - 1; k >= 0; k--) if (puffs[k].life > puffs[k].max) puffs.splice(k, 1);
      // heat leaving the data center roof
      const hw = Math.round(3 + 12 * L);
      if (heat.length < hw && R() < 0.5) { const b = g.bld; heat.push({ x: b.x + b.w * (0.12 + R() * 0.76), y: b.y - 14, life: 0, max: (g.wide ? 1.6 : 0.9) + R() * (g.wide ? 1 : 0.4), ph: R() * 6.28 }); }
      for (const q of heat) { q.life += dt; q.y -= dt * (16 + 18 * L); }
      for (let k = heat.length - 1; k >= 0; k--) if (heat[k].life > heat[k].max) heat.splice(k, 1);
      // coolant or air moving through the racks
      const cw = Math.round(8 + 20 * L);
      if (cool.length < cw && R() < 0.5) cool.push({ s: 0, lane: R(), v: 0.25 + R() * 0.1 });
      for (const q of cool) q.s += q.v * dt;
      for (let k = cool.length - 1; k >= 0; k--) if (cool[k].s >= 1) cool.splice(k, 1);
    }
    dispHomes = Math.exp(approach(Math.log(dispHomes), Math.log(homesTarget()), 9, dt));
    draw();
    drawHomes();
  }
  function plumeSource(p) {
    const u = G.u * p.sc, x = p.cx, b = p.base;
    if (p.k === "coal") return { x: x + u * 0.28, y: b - u * 0.92, r: u * 0.06, rate: 7, life: 2.6, col: Theme.dark ? "#77707f" : "#8d8795", a: 0.55 };
    if (p.k === "gas") return { x: x + u * 0.16, y: b - u * 0.68, r: u * 0.04, rate: 5, life: 1.6, col: Theme.dark ? "#cfcbe0" : "#a9a5b8", a: 0.22 };
    if (p.k === "nuclear") return { x: x - u * 0.12, y: b - u * 0.86, r: u * 0.1, rate: 6, life: 2.8, col: Theme.dark ? "#e9e7f2" : "#c9c6d6", a: 0.5 };
    return null;
  }

  /* ---------- drawing ---------- */
  const structFill = () => (Theme.dark ? "#2c2937" : "#cfccda");
  const structLine = () => (Theme.dark ? "#4a4658" : "#6f6a82");

  function draw() {
    const c = stage.ctx, C = Theme.c, g = G;
    if (!stage.w || !g) return;
    stage.clear();
    const mix = mixOf(), mono = Theme.mono;
    // warm haze over the generation side, and the ground
    const sky = c.createLinearGradient(0, 0, 0, g.ground);
    sky.addColorStop(0, rgba(C.l3, 0));
    sky.addColorStop(1, rgba(C.l3, Theme.dark ? 0.08 : 0.09));
    c.fillStyle = sky; c.fillRect(0, 0, g.wide ? g.plantX1 + 10 : g.w, g.ground);
    c.strokeStyle = C["line-2"]; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, g.ground + 0.5); c.lineTo(g.w, g.ground + 0.5); c.stroke();
    if (!g.wide) { c.beginPath(); c.moveTo(0, g.bld.y + g.bld.h + 0.5); c.lineTo(g.w, g.bld.y + g.bld.h + 0.5); c.stroke(); }
    // sun, when solar is in the mix
    if (mix.solar) {
      const sx = g.wide ? g.w * 0.5 : g.w - 20, sy = g.wide ? 34 : 18, sr = g.wide ? 12 : 8;
      const glow = c.createRadialGradient(sx, sy, 2, sx, sy, sr * 3.2);
      glow.addColorStop(0, rgba(C.l4, 0.45)); glow.addColorStop(1, rgba(C.l4, 0));
      c.fillStyle = glow; c.beginPath(); c.arc(sx, sy, sr * 3.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = C.l4; c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill();
    }
    // plumes sit behind the structures
    for (const f of puffs) {
      const a = f.a * (1 - f.life / f.max);
      const gr = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      gr.addColorStop(0, rgba(f.col, a)); gr.addColorStop(1, rgba(f.col, 0));
      c.fillStyle = gr; c.beginPath(); c.arc(f.x, f.y, f.r, 0, Math.PI * 2); c.fill();
    }
    // back-row ground line
    c.strokeStyle = rgba(C["line-2"], 0.6); c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, g.backGround + 0.5); c.lineTo(g.wide ? g.w * 0.56 : g.w, g.backGround + 0.5); c.stroke();
    // feeders: width shows each plant's share of the supply
    for (let i = 0; i < g.plants.length; i++) {
      const p = g.plants[i], share = mix[p.k] || 0, pts = g.paths[i].pts;
      c.strokeStyle = share ? rgba(C.l4, 0.28 + 0.4 * share) : rgba(C.muted, 0.14);
      c.lineWidth = share ? 1.2 + 6 * share : 1;
      c.beginPath(); for (let k = 0; k <= 24; k++) (k ? c.lineTo(pts[k][0], pts[k][1]) : c.moveTo(pts[k][0], pts[k][1])); c.stroke();
    }
    // plants (back row first) and labels
    for (const p of g.plants) {
      const on = !!mix[p.k];
      c.save(); c.globalAlpha = on ? 1 : Theme.dark ? 0.3 : 0.42; drawPlant(c, C, p, g.u * p.sc, on); c.restore();
      c.fillStyle = on ? C.text : C.faint; c.font = `600 ${g.wide ? 10 : 9}px ${mono}`; c.textAlign = "center";
      const lab = p.name.toUpperCase() + (on && source === "grid" ? ` ${Math.round(mix[p.k] * 100)}%` : "");
      c.fillText(lab, p.cx, p.base + 13);
    }
    // switchyard, pylons and line to the data center
    const Y = g.yard;
    c.fillStyle = structFill(); c.strokeStyle = structLine(); c.lineWidth = 1;
    c.fillRect(Y.x - 7, Y.y - 7, 14, 14); c.strokeRect(Y.x - 6.5, Y.y - 6.5, 13, 13);
    if (g.wide) for (const x of g.pylons) drawPylon(c, x, g.wireY, g.pylonBase);
    const tail = g.paths[0].pts.slice(25);
    c.strokeStyle = rgba(C.l4, 0.6); c.lineWidth = 1.6;
    for (const off of g.wide ? [0, 4] : [0]) {
      c.beginPath(); c.moveTo(Y.x, Y.y + off); tail.forEach(([x, y]) => c.lineTo(x, y + off)); c.stroke();
    }
    c.fillStyle = C.faint; c.font = `600 8px ${mono}`; c.textAlign = "center";
    c.fillText("SWITCHYARD", Y.x, Y.y + 18);
    drawBuilding(c, C, mono);
    // electricity pulses with a short trail
    for (const q of pulses) {
      const path = g.paths[q.i];
      for (let k = 3; k >= 0; k--) {
        const s = q.s - k * 0.012;
        if (s < 0) continue;
        const [x, y] = at(path, s);
        c.fillStyle = rgba(C.l4, k ? 0.18 * (4 - k) : 1);
        c.beginPath(); c.arc(x, y, k ? 2.2 : 2.8, 0, Math.PI * 2); c.fill();
      }
    }
    // heat rising from the roof: soft warm blobs that wobble and fade
    for (const q of heat) {
      const a = Math.sin(Math.PI * (q.life / q.max)) * 0.35;
      const x = q.x + Math.sin(q.ph + time * 3) * 3, r = 6 + q.life * 6;
      const gr = c.createRadialGradient(x, q.y, 0, x, q.y, r);
      gr.addColorStop(0, rgba(C.l1, a)); gr.addColorStop(1, rgba(C.l1, 0));
      c.fillStyle = gr; c.beginPath(); c.arc(x, q.y, r, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = C.muted; c.font = `600 10px ${mono}`; c.textAlign = "left";
    c.fillText("POWER PLANTS", 6, 12);
    const dw = c.measureText("DATA CENTER").width;
    c.fillStyle = rgba(C.panel, 0.9); c.fillRect(g.bld.x + 4, g.bld.y + 3, dw + 8, 14);
    c.fillStyle = C.muted; c.fillText("DATA CENTER", g.bld.x + 8, g.bld.y + 13);
  }

  function drawPlant(c, C, p, u, on) {
    const x = p.cx, b = p.base, F = structFill(), S = structLine();
    c.lineWidth = 1; c.strokeStyle = S;
    const box = (x0, y0, w, hh) => { c.fillStyle = F; c.fillRect(x0, y0, w, hh); c.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, hh - 1); };
    if (p.k === "coal") {
      c.fillStyle = Theme.dark ? "#1a181f" : "#5c5864";
      c.beginPath(); c.moveTo(x - u * 0.48, b); c.quadraticCurveTo(x - u * 0.36, b - u * 0.2, x - u * 0.22, b); c.fill();
      box(x - u * 0.2, b - u * 0.36, u * 0.42, u * 0.36);
      box(x + u * 0.24, b - u * 0.92, u * 0.08, u * 0.92);
      c.fillStyle = on ? rgba(C.l1, 0.8) : S; c.fillRect(x + u * 0.24, b - u * 0.84, u * 0.08, u * 0.05);
      for (let k = 0; k < 3; k++) { c.fillStyle = on ? rgba(C.l3, 0.7) : S; c.fillRect(x - u * 0.14 + k * u * 0.12, b - u * 0.26, u * 0.06, u * 0.08); }
    } else if (p.k === "gas") {
      box(x - u * 0.4, b - u * 0.3, u * 0.52, u * 0.3);
      c.fillStyle = F; c.beginPath(); c.ellipse(x - u * 0.14, b - u * 0.3, u * 0.26, u * 0.08, 0, Math.PI, 0); c.fill(); c.stroke();
      box(x + u * 0.12, b - u * 0.68, u * 0.07, u * 0.68);
      box(x + u * 0.24, b - u * 0.56, u * 0.07, u * 0.56);
      c.fillStyle = on ? C.l6 : S;
      c.beginPath(); c.moveTo(x - u * 0.14, b - u * 0.07); c.quadraticCurveTo(x - u * 0.22, b - u * 0.16, x - u * 0.14, b - u * 0.24); c.quadraticCurveTo(x - u * 0.06, b - u * 0.16, x - u * 0.14, b - u * 0.07); c.fill();
    } else if (p.k === "nuclear") {
      const tx = x - u * 0.12, top = b - u * 0.86;
      c.fillStyle = F;
      c.beginPath();
      c.moveTo(tx - u * 0.3, b);
      c.quadraticCurveTo(tx - u * 0.12, b - u * 0.5, tx - u * 0.2, top);
      c.lineTo(tx + u * 0.2, top);
      c.quadraticCurveTo(tx + u * 0.12, b - u * 0.5, tx + u * 0.3, b);
      c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(tx, top, u * 0.2, u * 0.035, 0, 0, Math.PI * 2); c.fillStyle = Theme.dark ? "#1b1924" : "#bdbacb"; c.fill(); c.stroke();
      box(x + u * 0.2, b - u * 0.2, u * 0.26, u * 0.2);
      c.fillStyle = F; c.beginPath(); c.arc(x + u * 0.33, b - u * 0.2, u * 0.13, Math.PI, 0); c.fill(); c.stroke();
    } else if (p.k === "hydro") {
      c.fillStyle = rgba(C.l6, on ? 0.45 : 0.2); c.fillRect(x - u * 0.5, b - u * 0.5, u * 0.36, u * 0.5);
      c.fillStyle = F;
      c.beginPath(); c.moveTo(x - u * 0.16, b - u * 0.56); c.lineTo(x - u * 0.02, b - u * 0.56); c.lineTo(x + u * 0.1, b); c.lineTo(x - u * 0.2, b); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = rgba(C.l6, on ? 0.35 : 0.15); c.fillRect(x + u * 0.1, b - u * 0.05, u * 0.4, u * 0.05);
      if (on) {
        c.strokeStyle = rgba(C.l6, 0.9); c.lineWidth = 1.4;
        for (let k = 0; k < 4; k++) {
          const ph = (time * 1.6 + k * 0.25) % 1, x0 = x + u * 0.06 + k * u * 0.025;
          c.beginPath(); c.moveTo(x0, b - u * 0.5 + ph * u * 0.42); c.lineTo(x0 + u * 0.02, b - u * 0.5 + ph * u * 0.42 + u * 0.08); c.stroke();
        }
      }
    } else if (p.k === "wind") {
      const turbine = (tx, hgt, r, phase) => {
        c.strokeStyle = S; c.lineWidth = Math.max(1.5, u * 0.035);
        c.beginPath(); c.moveTo(tx, b); c.lineTo(tx, b - hgt); c.stroke();
        const hy = b - hgt, ang = (on ? time * 2.2 : 0) + phase;
        c.fillStyle = Theme.dark ? "#dcd9e8" : "#8f8ba0";
        for (let k = 0; k < 3; k++) {
          const a = ang + (k * Math.PI * 2) / 3, pa = a + Math.PI / 2;
          c.beginPath();
          c.moveTo(tx + Math.cos(pa) * u * 0.02, hy + Math.sin(pa) * u * 0.02);
          c.lineTo(tx + Math.cos(a) * r, hy + Math.sin(a) * r);
          c.lineTo(tx - Math.cos(pa) * u * 0.02, hy - Math.sin(pa) * u * 0.02);
          c.closePath(); c.fill();
        }
        c.fillStyle = S; c.beginPath(); c.arc(tx, hy, Math.max(2, u * 0.035), 0, Math.PI * 2); c.fill();
      };
      turbine(x - u * 0.18, u * 0.78, u * 0.3, 0.3);
      turbine(x + u * 0.24, u * 0.58, u * 0.22, 1.4);
    } else if (p.k === "solar") {
      for (let row = 0; row < 3; row++) {
        const y0 = b - u * 0.06 - row * u * 0.13, x0 = x - u * 0.42 + row * u * 0.05;
        const pw = u * 0.82, ph = u * 0.1;
        const panel = () => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + pw, y0); c.lineTo(x0 + pw + u * 0.05, y0 - ph); c.lineTo(x0 + u * 0.05, y0 - ph); c.closePath(); };
        c.fillStyle = Theme.dark ? "#223a66" : "#3f5bb0"; panel(); c.fill();
        c.strokeStyle = rgba("#ffffff", 0.18); c.lineWidth = 0.6;
        for (let k = 1; k < 6; k++) { const xx = x0 + (pw * k) / 6; c.beginPath(); c.moveTo(xx, y0); c.lineTo(xx + u * 0.05, y0 - ph); c.stroke(); }
        if (on) {
          const gx = x0 + (((time * 0.35 + row * 0.3) % 1.4) - 0.2) * pw;
          const gr = c.createLinearGradient(gx - u * 0.12, 0, gx + u * 0.12, 0);
          gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
          c.save(); panel(); c.clip(); c.fillStyle = gr; c.fillRect(gx - u * 0.12, y0 - ph, u * 0.24, ph); c.restore();
        }
      }
    }
  }
  function drawPylon(c, x, top, base) {
    const hw = Math.max(5, (base - top) * 0.12);
    c.strokeStyle = structLine(); c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x - hw, base); c.lineTo(x - 1.5, top); c.lineTo(x + 1.5, top); c.lineTo(x + hw, base);
    const rungs = Math.max(2, Math.floor((base - top) / 14));
    for (let k = 1; k < rungs; k++) { const t = k / rungs, y = lerp(top, base, t), w = lerp(1.5, hw, t); c.moveTo(x - w, y); c.lineTo(x + w, y); }
    c.moveTo(x - 9, top + 2); c.lineTo(x + 9, top + 2);
    c.stroke();
  }
  function drawSubstation(c, C, s) {
    c.strokeStyle = structLine(); c.lineWidth = 1;
    c.setLineDash([2, 2]); c.strokeRect(s.x + 0.5, s.y + 0.5, s.w, s.h); c.setLineDash([]);
    c.fillStyle = structFill();
    for (let k = 0; k < 2; k++) { c.fillRect(s.x + 5 + k * 14, s.y + 9, 10, s.h - 12); c.strokeRect(s.x + 5.5 + k * 14, s.y + 9.5, 9, s.h - 13); }
    c.fillStyle = C.faint; c.font = `600 8px ${Theme.mono}`; c.textAlign = "center";
    c.fillText("SUBSTATION", s.x + s.w / 2, s.y - 4);
  }
  function drawBuilding(c, C, mono) {
    const b = G.bld, m = MODES[mode];
    c.fillStyle = Theme.dark ? "#16141d" : "#f0eff5";
    c.strokeStyle = structLine(); c.lineWidth = 1.5;
    roundRect(c, b.x, b.y, b.w, b.h, 4); c.fill(); c.stroke();
    // rooftop coolers with spinning fans
    const uw = Math.min(34, b.w / 5);
    for (let k = 0; k < 3; k++) {
      const ux = b.x + b.w * (0.2 + k * 0.3) - uw / 2, uy = b.y - 12;
      c.fillStyle = structFill(); c.fillRect(ux, uy, uw, 12); c.strokeStyle = structLine(); c.strokeRect(ux + 0.5, uy + 0.5, uw - 1, 11);
      const fx = ux + uw / 2, fy = uy + 6, r = 4.5;
      c.strokeStyle = C.muted; c.lineWidth = 1;
      c.beginPath(); c.arc(fx, fy, r, 0, Math.PI * 2); c.stroke();
      const a0 = time * (4 + 14 * load());
      for (let j = 0; j < 3; j++) { const a = a0 + (j * Math.PI * 2) / 3; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + Math.cos(a) * r, fy + Math.sin(a) * r); c.stroke(); }
    }
    // racks inside
    const rk = racks(), show = Math.min(rk, 3);
    const rw = Math.min(42, (b.w - 30) / 3.6), rh = b.h - 34;
    const totalW = show * rw + (show - 1) * 10;
    const x0 = b.x + (b.w - totalW) / 2, y0 = b.y + 16;
    const lit = Math.min(n, m.perRack);
    const trays = mode === "liquid" ? 9 : 2, cols = 4, perTray = 8;
    const th = mode === "liquid" ? (rh - 8) / 9 : (rh - 8) / 3.2;
    for (let r = 0; r < show; r++) {
      const rx = x0 + r * (rw + 10);
      c.fillStyle = C.sunk; c.strokeStyle = C.muted; c.lineWidth = 1;
      roundRect(c, rx, y0, rw, rh, 3); c.fill(); c.stroke();
      for (let t = 0; t < trays; t++) {
        const ty = y0 + rh - 4 - (t + 1) * th - (mode === "air" ? t * th * 0.5 : 0);
        for (let k = 0; k < perTray; k++) {
          const on = r > 0 || t * perTray + k < lit;
          const cx = rx + 3 + (k % cols) * ((rw - 6) / cols), cy = ty + Math.floor(k / cols) * (th / 2);
          c.fillStyle = on ? C.l1 : rgba(C.text, 0.1);
          c.fillRect(cx + 0.5, cy + 0.5, (rw - 6) / cols - 1.5, th / 2 - 1.5);
        }
      }
    }
    // coolant loop (liquid) or air stream (air) through the racks
    for (const q of cool) {
      const t = q.s;
      if (mode === "liquid") {
        const lx = x0 - 7, rx2 = x0 + totalW + 7, top = y0 - 5, bot = y0 + rh;
        const per = (bot - top) * 2 + (rx2 - lx);
        const d = t * per;
        let x, y, hot;
        if (d < bot - top) { x = rx2; y = bot - d; hot = true; }
        else if (d < bot - top + (rx2 - lx)) { x = rx2 - (d - (bot - top)); y = top; hot = x > (lx + rx2) / 2; }
        else { x = lx; y = top + (d - (bot - top) - (rx2 - lx)); hot = false; }
        c.fillStyle = hot ? C.l1 : C.l6;
        c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill();
      } else {
        const y = y0 + 6 + q.lane * (rh - 12), x = lerp(b.x + 4, b.x + b.w - 4, t);
        c.fillStyle = x > x0 + totalW / 2 ? rgba(C.l1, 0.8) : rgba(C.l6, 0.8);
        c.beginPath(); c.arc(x, y, 1.8, 0, Math.PI * 2); c.fill();
      }
    }
    c.fillStyle = C.text; c.font = `600 10px ${mono}`; c.textAlign = "center";
    const label = rk > 1 ? `${fmtInt(rk)} RACKS${rk > 3 ? " (3 SHOWN)" : ""}` : n < m.perRack ? `${n} OF ${m.perRack} SLOTS` : "1 RACK";
    c.fillText(label, b.x + b.w / 2, b.y + b.h - 6);
  }

  /* ---------- homes strip ---------- */
  const homesWrap = h("div", { class: "homes" });
  root.append(homesWrap);
  const homesStage = new Stage(homesWrap, { label: "Houses showing how many homes use the same power.", height: (w) => (w >= 560 ? 92 : 104), draw: () => drawHomes() });
  function drawHomes() {
    const c = homesStage.ctx, C = Theme.c;
    if (!homesStage.w) return;
    homesStage.clear();
    const w = homesStage.w, hh = homesStage.h, wide = w >= 560;
    const unit = Math.pow(10, Math.max(0, Math.ceil(Math.log10(homesTarget() / 100))));
    const icons = dispHomes / unit;
    const cols = 25, rows = 4;
    const gx0 = wide ? 194 : 0, gy0 = wide ? 8 : 38;
    const cell = Math.min((w - gx0 - 4) / cols, (hh - gy0 - 4) / rows);
    c.textAlign = "left"; c.fillStyle = C.muted; c.font = `600 10px ${Theme.mono}`;
    c.fillText("SAME POWER AS", 2, 13);
    c.fillStyle = C.text; c.font = `700 16px ${Theme.mono}`;
    c.fillText(`≈ ${fmtHomes(dispHomes)} US homes`, 2, wide ? 36 : 31);
    c.fillStyle = C.muted; c.font = `600 ${wide ? 10 : 9}px ${Theme.mono}`;
    if (wide) c.fillText(`EACH ICON = ${fmtInt(unit)} HOME${unit > 1 ? "S" : ""}`, 2, 56);
    else { c.textAlign = "right"; c.fillText(`ICON = ${fmtInt(unit)} HOME${unit > 1 ? "S" : ""}`, w - 2, 31); c.textAlign = "left"; }
    for (let i = 0; i < cols * rows; i++) {
      const cx = gx0 + (i % cols) * cell + cell / 2, cy = gy0 + Math.floor(i / cols) * cell + cell / 2;
      const f = clamp(icons - i, 0, 1);
      house(c, cx, cy, cell * 0.36, rgba(C.text, 0.08));
      if (f > 0) { c.save(); c.beginPath(); c.rect(cx - cell / 2, cy - cell / 2, cell * f, cell); c.clip(); house(c, cx, cy, cell * 0.36, C.l3); c.restore(); }
    }
  }
  function house(c, x, y, r, col) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x, y - r); c.lineTo(x + r, y - r * 0.1); c.lineTo(x + r * 0.75, y - r * 0.1); c.lineTo(x + r * 0.75, y + r);
    c.lineTo(x - r * 0.75, y + r); c.lineTo(x - r * 0.75, y - r * 0.1); c.lineTo(x - r, y - r * 0.1); c.closePath(); c.fill();
  }
  const fmtHomes = (x) => (x < 10 ? fmtNum(x, 2) : fmtInt(roundSig(x, 2)));

  /* ---------- controls ---------- */
  const gpuSlider = slider({
    label: "GPUs",
    min: 1, max: 100000, value: n, log: true,
    round: (v) => { for (const s of NAMED) if (Math.abs(Math.log10(v / s.v)) < 0.06) return s.v; return v < 20 ? Math.round(v) : roundSig(v, 2); },
    fmt: (v) => fmtInt(v),
    ticks: [{ v: 1, label: "1" }, { v: 8, label: "8" }, { v: 72, label: "72" }, { v: 1000, label: "1k" }, { v: 10000, label: "10k" }, { v: 100000, label: "100k" }],
    onInput: (v) => { n = v; update(); },
  });
  const coolSeg = segmented({ label: "Cooling", options: [{ value: "air", label: "Air" }, { value: "liquid", label: "Liquid" }], value: mode, onChange: (v) => { mode = v; cool.length = 0; update(); } });
  const srcSeg = segmented({
    label: "Power source", scroll: true,
    options: Object.entries(SOURCES).map(([k, s]) => ({ value: k, label: s.label })),
    value: source, onChange: (v) => { source = v; pulses.length = 0; puffs.length = 0; update(); },
  });
  root.append(h("div", { class: "ctl-row" }, gpuSlider.el, coolSeg.el), h("div", { class: "ctl-row" }, srcSeg.el));
  const roIT = readout("Chips & servers"), roFac = readout("Whole building"), roYear = readout("Energy per year"), roCO2 = readout("CO₂ per year");
  const roHeat = readout("Coolant flow"), roRack = readout("Racks needed");
  root.append(h("div", { class: "readouts" }, roIT.el, roFac.el, roYear.el, roCO2.el, roHeat.el, roRack.el));
  const segIT = h("div", { class: "pb-seg pb-it" }), segCool = h("div", { class: "pb-seg pb-cool" }), segOther = h("div", { class: "pb-seg pb-other" });
  const barLegend = h("div", { class: "pb-legend" });
  root.append(h("div", { class: "powerbar" }, h("div", { class: "pb-title" }, "Where each watt goes"), h("div", { class: "pb-track" }, segIT, segCool, segOther), barLegend));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  let prevIT = itW(), prevFac = facW(), cancels = [];
  function update() {
    const m = MODES[mode];
    const it = itW(), fac = facW();
    cancels.forEach((f) => f());
    cancels = [
      tween(prevIT, it, 450, (v) => { const [a, u] = siParts(v, "W"); roIT.set(a, u); }, true),
      tween(prevFac, fac, 450, (v) => { const [a, u] = siParts(v, "W"); roFac.set(a, u); }, true),
    ];
    prevIT = it; prevFac = fac;
    roIT.set(...siParts(it, "W"), `${fmtInt(n)} × ~${fmtNum(PER_GPU / 1000, 2)} kW`);
    roFac.set(...siParts(fac, "W"), `+${Math.round((m.pue - 1) * 100)}% for cooling and power conversion`);
    const kwhYear = (fac * 8760) / 1000;
    roYear.set(...siParts(kwhYear * 1000, "Wh", 2), "running all year");
    const tCO2 = (kwhYear * gPerKWh()) / 1e6;
    roCO2.set(tCO2 >= 1 ? fmtInt(roundSig(tCO2, 2)) : fmtNum(tCO2 * 1000, 2), tCO2 >= 1 ? " t" : " kg", tCO2 / CAR_T >= 1 ? `≈ ${fmtInt(roundSig(tCO2 / CAR_T, 2))} cars' yearly emissions` : "less than one car's yearly emissions");
    roCO2.state(gPerKWh() > 200 ? "bad" : "good");
    if (mode === "liquid") roHeat.set(fmtNum((it / (4186 * m.dT)) * 60, 2), "L/min", `water warming by ${m.dT} °C, circulating`);
    else roHeat.set(fmtNum(it / (1.2 * 1005 * m.dT), 2), "m³/s", `of air warming by ${m.dT} °C`);
    const rk = racks();
    roRack.set(fmtInt(rk), rk === 1 ? "rack" : "racks", `${m.perRack} GPUs per ${mode}-cooled rack`);
    const tot = 1 + m.cool + m.other;
    segIT.style.width = (100 / tot).toFixed(1) + "%";
    segCool.style.width = ((100 * m.cool) / tot).toFixed(1) + "%";
    segOther.style.width = ((100 * m.other) / tot).toFixed(1) + "%";
    barLegend.innerHTML =
      `<span><i class="pb-it"></i>Computing ${Math.round(100 / tot)}%</span>` +
      `<span><i class="pb-cool"></i>Cooling ${Math.round((100 * m.cool) / tot)}%</span>` +
      `<span><i class="pb-other"></i>Power conversion, lights ${Math.round((100 * m.other) / tot)}%</span>`;
    status.innerHTML = describe() + " " + sourceNote();
    Loop.wake();
  }
  function sourceNote() {
    const g = Math.round(gPerKWh());
    if (source === "grid") return `On the average US grid mix (~${g} g CO₂ per kWh, counting each plant's whole life), most emissions come from the coal and gas plants.`;
    if (source === "gas") return `Gas plants can be built quickly and run around the clock, at ~${g} g CO₂ per kWh.`;
    if (source === "nuclear") return `Nuclear runs around the clock at ~${g} g CO₂ per kWh, but new plants take many years to build.`;
    return `Solar and wind emit ~${g} g CO₂ per kWh, but they rise and fall with the sun and the weather. A data center runs 24/7, so it also needs storage or backup, which this toy leaves out.`;
  }
  function describe() {
    const named = NAMED.find((s) => s.v === n);
    const homes = homesTarget(), facTxt = fmtSI(facW(), "W", 2);
    if (n === 1) return `<b>One GPU with its share of the server: about a space heater.</b>`;
    if (n === 8) return `<b>One server of eight GPUs: ~${fmtSI(8 * PER_GPU, "W", 2)},</b> about what ${fmtInt(Math.round(homes))} homes draw on average.`;
    if (n === 72 && mode === "liquid") return `<b>One rack: ~${fmtSI(72 * PER_GPU, "W", 2)} in less than a square meter of floor.</b> Switch to air cooling to see how many racks the same GPUs need.`;
    if (n === 72 && mode === "air") return `<b>Air can't carry ~${fmtSI(72 * PER_GPU, "W", 2)} out of one rack,</b> so the same 72 GPUs are spread over ${racks()} racks.`;
    if (n === 100000) return `<b>A 2024-scale frontier cluster: ${facTxt} for the whole site,</b> as much as ~${fmtInt(roundSig(homes, 2))} homes.`;
    if (named) return `<b>${named.name[0].toUpperCase() + named.name.slice(1)}: ${facTxt}</b>, as much as ~${fmtInt(roundSig(homes, 2))} homes.`;
    return `<b>${fmtInt(n)} GPUs: ${facTxt}</b> for the whole building, as much as ~${fmtHomes(roundSig(homes, 2))} homes.`;
  }

  Actions.power = (arg) => { if (arg === "100k") gpuSlider.set(100000, true); };
  Theme.on(() => { draw(); drawHomes(); });
  Loop.add(stage.canvas, tick);
  update();
});
