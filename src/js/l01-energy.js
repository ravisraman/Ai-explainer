/* =====================================================================
   Layer 1 · Energy — cluster power meter with air/liquid cooling.
   ===================================================================== */

defineMount("power", (root) => {
  const PER_GPU = 1800; // W per GPU, all-in (Blackwell-class): its share of CPUs, memory, network, fans
  const HOME = 1200; // W, average US household draw over a year
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
  let n = 8;
  let mode = "liquid";
  let dispHomes = 1;
  let dispRacks = 1;

  /* ---------- layout + drawing ---------- */
  let L = {};
  const stage = new Stage(root, {
    label: "A rack of GPUs with electricity flowing in and heat flowing out, next to a grid of houses using the same power.",
    height: (w) => (w >= 560 ? clamp(w * 0.46, 290, 380) : clamp(w * 1.08, 360, 470)),
    onResize: layout,
    draw: () => draw(0),
  });

  function layout(w, hh) {
    const wide = w >= 560;
    const scene = wide ? { x: 0, y: 0, w: w * 0.6, h: hh } : { x: 0, y: 0, w, h: hh * 0.6 };
    const homes = wide ? { x: w * 0.62, y: 0, w: w * 0.38, h: hh } : { x: 0, y: hh * 0.62, w, h: hh * 0.38 };
    const rackW = clamp(scene.w * 0.26, 70, 120);
    const rackH = scene.h * 0.78;
    const rackX = scene.x + scene.w * 0.36;
    const rackY = scene.y + scene.h * 0.14;
    const src = { x: scene.x + 22, y: rackY + 10 };
    const plant = { x: rackX + rackW + clamp(scene.w * 0.14, 34, 70), y: rackY + rackH * 0.3, w: clamp(scene.w * 0.15, 56, 72), h: rackH * 0.4 };
    L = { wide, scene, homes, rackX, rackY, rackW, rackH, src, plant };
    particles.length = 0;
  }

  /* particles travel along polylines */
  const particles = [];
  const R = rng(7);
  function trayYs() {
    const m = MODES[mode];
    const rows = mode === "liquid" ? 9 : 3;
    const ys = [];
    const pad = 10, inner = L.rackH - pad * 2;
    for (let i = 0; i < rows; i++) {
      if (mode === "liquid") ys.push(L.rackY + pad + inner * ((i + 0.5) / rows));
      else ys.push(L.rackY + pad + inner * ((i * 3 + 1.5) / 9));
    }
    void m;
    return ys;
  }
  function litTrays() {
    const perTray = 8;
    const cap = MODES[mode].perRack;
    return Math.max(1, Math.ceil(Math.min(n, cap) / perTray));
  }
  function makePath(kind) {
    const ys = trayYs();
    const k = Math.floor(R() * Math.min(litTrays(), ys.length));
    const ty = ys[ys.length - 1 - k] + (R() - 0.5) * 6;
    const { rackX: x, rackY: y, rackW: w, rackH: hh, src, plant } = L;
    if (kind === "power") {
      return [[src.x + 10, src.y], [x - 16, src.y], [x - 16, ty], [x + 8, ty]];
    }
    if (mode === "air") {
      const jx = R() * 26;
      return [[x - 70 - jx, ty], [x + w + 18, ty], [x + w + 34 + R() * 34, y - 6], [x + w + 40 + R() * 40, y - 40]];
    }
    const lx = x - 8, rx = x + w + 8;
    return [
      [plant.x, plant.y + plant.h - 6], [plant.x - 12, plant.y + plant.h - 6], [plant.x - 12, y + hh + 10],
      [lx, y + hh + 10], [lx, ty], [rx, ty], [rx, y - 10], [plant.x - 12, y - 10], [plant.x - 12, plant.y + 6], [plant.x, plant.y + 6],
    ];
  }
  function pathInfo(pts) {
    const seg = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(d);
      total += d;
    }
    return { pts, seg, total };
  }
  function at(p, s) {
    let d = s * p.total;
    for (let i = 0; i < p.seg.length; i++) {
      if (d <= p.seg[i] || i === p.seg.length - 1) {
        const t = p.seg[i] ? clamp(d / p.seg[i], 0, 1) : 0;
        return [lerp(p.pts[i][0], p.pts[i + 1][0], t), lerp(p.pts[i][1], p.pts[i + 1][1], t)];
      }
      d -= p.seg[i];
    }
    return p.pts[p.pts.length - 1];
  }
  /* distance fraction where the path crosses the rack (heat is picked up there) */
  function hotAt(p) {
    if (p.kind === "power") return 2;
    const midX = L.rackX + L.rackW / 2;
    let d = 0;
    for (let i = 1; i < p.pts.length; i++) {
      const a = p.pts[i - 1], b = p.pts[i];
      if ((a[0] - midX) * (b[0] - midX) <= 0 && Math.abs(a[1] - b[1]) < 1) {
        return (d + Math.abs(midX - a[0])) / p.total;
      }
      d += p.seg[i - 1];
    }
    return 0.5;
  }
  function spawn(kind, s0) {
    const p = pathInfo(makePath(kind));
    p.kind = kind;
    p.s = s0 == null ? 0 : s0;
    p.hot = hotAt(p);
    p.speed = (kind === "power" ? 0.55 : mode === "air" ? 0.32 : 0.16) * (0.8 + R() * 0.4);
    return p;
  }

  const itW = () => n * PER_GPU;
  const facW = () => itW() * MODES[mode].pue;
  const load = () => clamp(Math.log10(itW() / 1000 + 1) / Math.log10(150001), 0, 1);

  function tick(dt) {
    const want = Math.round(10 + 70 * load());
    const wantP = Math.round(5 + 18 * load());
    const coolant = particles.filter((p) => p.kind !== "power");
    const power = particles.filter((p) => p.kind === "power");
    if (!reducedMotion()) {
      if (coolant.length < want && R() < 0.5) particles.push(spawn("cool"));
      if (power.length < wantP && R() < 0.5) particles.push(spawn("power"));
      const speedUp = 0.8 + load() * 0.9;
      for (const p of particles) p.s += (p.speed * speedUp * dt * 120) / Math.max(120, p.total);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.s >= 1 || (p.kind !== "power" && coolant.length > want + 4 && R() < 0.02)) particles.splice(i, 1);
      }
    } else if (!particles.length) {
      for (let i = 0; i < want; i++) particles.push(spawn("cool", R()));
      for (let i = 0; i < wantP; i++) particles.push(spawn("power", R()));
    }
    dispHomes = Math.exp(approach(Math.log(dispHomes), Math.log(homesTarget()), 9, dt));
    dispRacks = approach(dispRacks, racks(), 9, dt);
    draw(dt);
  }

  let fanAngle = 0;
  function draw(dt) {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w || !L.scene) return;
    stage.clear();
    const hot = C.l1, cold = C.l6, elec = C.l4;
    const { rackX: x, rackY: y, rackW: w, rackH: hh, src, plant } = L;

    // grid source
    c.save();
    c.strokeStyle = C.faint; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(src.x, src.y + 26); c.lineTo(src.x + 8, src.y - 10); c.lineTo(src.x + 16, src.y + 26);
    c.moveTo(src.x + 2, src.y + 6); c.lineTo(src.x + 14, src.y + 6); c.moveTo(src.x + 4, src.y - 2); c.lineTo(src.x + 12, src.y - 2); c.stroke();
    c.fillStyle = C.muted; c.font = "600 10px " + Theme.mono;
    c.textAlign = "left"; c.fillText("GRID", src.x - 2, src.y + 40);
    // power bus
    c.strokeStyle = rgba(elec, 0.35); c.lineWidth = 2;
    c.beginPath(); c.moveTo(src.x + 16, src.y); c.lineTo(x - 16, src.y); c.lineTo(x - 16, y + hh - 8); c.stroke();
    c.restore();

    // air: aisle labels; liquid: plant + pipes
    const mono = Theme.mono;
    c.font = `600 10px ${mono}`;
    if (mode === "air") {
      c.fillStyle = rgba(cold, 0.9); c.textAlign = "center";
      c.fillText("COLD AISLE", x - 52, y + hh + 16);
      c.fillStyle = rgba(hot, 0.95);
      c.fillText("HOT AISLE", x + w + 40, y + hh + 16);
      // warm plume above rack
      const g = c.createRadialGradient(x + w + 30, y - 10, 4, x + w + 30, y - 10, 70 + 60 * load());
      g.addColorStop(0, rgba(hot, 0.18 + 0.25 * load())); g.addColorStop(1, rgba(hot, 0));
      c.fillStyle = g; c.beginPath(); c.arc(x + w + 30, y - 10, 70 + 60 * load(), 0, Math.PI * 2); c.fill();
    } else {
      c.fillStyle = C.sunk; c.strokeStyle = C["line-2"]; c.lineWidth = 1;
      roundRect(c, plant.x, plant.y, plant.w, plant.h, 6); c.fill(); c.stroke();
      c.fillStyle = C.muted; c.textAlign = "center"; c.font = `600 9px ${mono}`;
      const lines = ["TO", "COOLING", "TOWER"];
      lines.forEach((t, i) => c.fillText(t, plant.x + plant.w / 2, plant.y + plant.h / 2 - 10 + i * 12));
      c.lineWidth = 5; c.lineCap = "round"; c.lineJoin = "round";
      const lx = x - 8, rx = x + w + 8;
      c.strokeStyle = rgba(cold, 0.22);
      c.beginPath(); c.moveTo(plant.x, plant.y + plant.h - 6); c.lineTo(plant.x - 12, plant.y + plant.h - 6); c.lineTo(plant.x - 12, y + hh + 10); c.lineTo(lx, y + hh + 10); c.lineTo(lx, y + 8); c.stroke();
      c.strokeStyle = rgba(hot, 0.22);
      c.beginPath(); c.moveTo(rx, y + hh - 8); c.lineTo(rx, y - 10); c.lineTo(plant.x - 12, y - 10); c.lineTo(plant.x - 12, plant.y + 6); c.lineTo(plant.x, plant.y + 6); c.stroke();
    }

    // extra racks behind
    const rk = racks();
    const show = Math.min(rk - 1, 10);
    for (let i = show; i >= 1; i--) {
      const off = i * 7;
      c.fillStyle = rgba(C.text, 0.03 + 0.012 * (show - i));
      c.strokeStyle = rgba(C.text, 0.12);
      c.lineWidth = 1;
      roundRect(c, x + off, y - off * 0.6, w, hh, 5); c.fill(); c.stroke();
    }

    // rack
    c.fillStyle = C.sunk; c.strokeStyle = C.muted; c.lineWidth = 1.5;
    roundRect(c, x, y, w, hh, 5); c.fill(); c.stroke();
    const ys = trayYs();
    const cap = MODES[mode].perRack;
    const lit = Math.min(n, cap);
    const cellW = (w - 18) / 8;
    let idx = 0;
    for (let r = ys.length - 1; r >= 0; r--) {
      const ty = ys[r];
      const trayH = mode === "liquid" ? (hh - 20) / 9 - 4 : (hh - 20) / 9 * 2.2;
      c.fillStyle = rgba(C.text, 0.05);
      roundRect(c, x + 5, ty - trayH / 2, w - 10, trayH, 3); c.fill();
      for (let k = 0; k < 8; k++) {
        const on = idx < lit;
        const cx = x + 9 + k * cellW;
        const ch = Math.min(trayH - 4, mode === "liquid" ? trayH - 4 : cellW * 1.2);
        c.fillStyle = on ? hot : rgba(C.text, 0.1);
        if (on) { c.shadowColor = hot; c.shadowBlur = 8; }
        roundRect(c, cx + 1, ty - ch / 2, cellW - 2, ch, 2); c.fill();
        c.shadowBlur = 0;
        idx++;
      }
    }
    if (mode === "air") {
      // fans on the exhaust side
      fanAngle += dt * (4 + 18 * load());
      c.strokeStyle = C.muted; c.lineWidth = 1.2;
      for (const ty of ys) {
        const fx = x + w + 1, r0 = 7;
        c.beginPath(); c.arc(fx, ty, r0, 0, Math.PI * 2); c.stroke();
        for (let b = 0; b < 3; b++) {
          const a = fanAngle + (b * Math.PI * 2) / 3;
          c.beginPath(); c.moveTo(fx, ty); c.lineTo(fx + Math.cos(a) * r0, ty + Math.sin(a) * r0); c.stroke();
        }
      }
    }
    // rack label
    c.fillStyle = C.text; c.textAlign = "center"; c.font = `600 11px ${mono}`;
    const rkTxt = rk > 1 ? `× ${fmtInt(Math.round(dispRacks))} RACKS` : n < cap ? `${n} OF ${cap} SLOTS` : "1 RACK";
    c.fillText(rkTxt, x + w / 2, y - 10 - Math.min(show, 10) * 4);

    // particles
    for (const p of particles) {
      const [px, py] = at(p, p.s);
      let col;
      if (p.kind === "power") col = elec;
      else col = p.s < p.hot ? cold : hot;
      const a = p.s < 0.06 ? p.s / 0.06 : p.s > 0.9 ? (1 - p.s) / 0.1 : 1;
      c.fillStyle = rgba(col, 0.9 * a);
      c.beginPath(); c.arc(px, py, p.kind === "power" ? 2 : 2.4, 0, Math.PI * 2); c.fill();
    }

    drawHomes(c, C, mono);
  }

  function drawHomes(c, C, mono) {
    const H = L.homes;
    const homes = dispHomes;
    const unitExp = Math.max(0, Math.ceil(Math.log10(homesTarget() / 100)));
    const unit = Math.pow(10, unitExp);
    const icons = homes / unit;
    const flat = H.w / H.h > 1.6;
    const cols = flat ? 20 : 10, rows = flat ? 5 : 10;
    const pad = 14;
    const titleH = 44;
    const cell = Math.min((H.w - pad * 2) / cols, (H.h - titleH - pad - 22) / rows);
    const gx = H.x + (H.w - cell * cols) / 2;
    const gy = H.y + titleH;
    c.textAlign = "left";
    c.fillStyle = C.muted; c.font = `600 10px ${mono}`;
    c.fillText("SAME POWER AS", gx, H.y + 18);
    c.fillStyle = C.text; c.font = `700 17px ${mono}`;
    c.fillText(`≈ ${fmtHomes(homes)} US homes`, gx, H.y + 36);
    for (let i = 0; i < cols * rows; i++) {
      const cx = gx + (i % cols) * cell + cell / 2;
      const cy = gy + Math.floor(i / cols) * cell + cell / 2;
      const f = clamp(icons - i, 0, 1);
      house(c, cx, cy, cell * 0.36, rgba(C.text, 0.08));
      if (f > 0) {
        c.save();
        c.beginPath(); c.rect(cx - cell / 2, cy - cell / 2, cell * f, cell); c.clip();
        house(c, cx, cy, cell * 0.36, C.l3);
        c.restore();
      }
    }
    c.fillStyle = C.muted; c.font = `600 10px ${mono}`;
    c.fillText(`EACH ICON = ${fmtInt(unit)} HOME${unit > 1 ? "S" : ""}`, gx, gy + rows * cell + 14);
  }
  function house(c, x, y, r, col) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x, y - r); c.lineTo(x + r, y - r * 0.1); c.lineTo(x + r * 0.75, y - r * 0.1); c.lineTo(x + r * 0.75, y + r);
    c.lineTo(x - r * 0.75, y + r); c.lineTo(x - r * 0.75, y - r * 0.1); c.lineTo(x - r, y - r * 0.1); c.closePath(); c.fill();
  }
  const fmtHomes = (x) => (x < 10 ? fmtNum(x, 2) : fmtInt(roundSig(x, 2)));
  const homesTarget = () => facW() / HOME;
  const racks = () => Math.max(1, Math.ceil(n / MODES[mode].perRack));

  /* ---------- controls ---------- */
  const gpuSlider = slider({
    label: "GPUs",
    min: 1, max: 100000, value: n, log: true,
    round: (v) => {
      for (const s of NAMED) if (Math.abs(Math.log10(v / s.v)) < 0.06) return s.v;
      return v < 20 ? Math.round(v) : roundSig(v, 2);
    },
    fmt: (v) => fmtInt(v),
    ticks: [{ v: 1, label: "1" }, { v: 8, label: "8" }, { v: 72, label: "72" }, { v: 1000, label: "1k" }, { v: 10000, label: "10k" }, { v: 100000, label: "100k" }],
    onInput: (v) => { n = v; update(); },
  });
  const coolSeg = segmented({
    label: "Cooling",
    options: [{ value: "air", label: "Air" }, { value: "liquid", label: "Liquid" }],
    value: mode,
    onChange: (v) => { mode = v; particles.length = 0; update(); },
  });
  root.append(h("div", { class: "ctl-row" }, gpuSlider.el, coolSeg.el));

  const roIT = readout("Chips & servers", { sub: "" });
  const roFac = readout("Whole building", { sub: "" });
  const roHeat = readout("Coolant flow", { sub: "" });
  const roRack = readout("Racks needed", { sub: "" });
  root.append(h("div", { class: "readouts" }, roIT.el, roFac.el, roHeat.el, roRack.el));

  const segIT = h("div", { class: "pb-seg pb-it" });
  const segCool = h("div", { class: "pb-seg pb-cool" });
  const segOther = h("div", { class: "pb-seg pb-other" });
  const barLegend = h("div", { class: "pb-legend" });
  root.append(h("div", { class: "powerbar" },
    h("div", { class: "pb-title" }, "Where each watt goes"),
    h("div", { class: "pb-track" }, segIT, segCool, segOther), barLegend));
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
    const heatW = it; // essentially all IT power becomes heat
    if (mode === "liquid") {
      const lpm = (heatW / (4186 * m.dT)) * 60;
      roHeat.set(fmtNum(lpm, 2), "L/min", `water warming by ${m.dT} °C, circulating`);
    } else {
      const m3s = heatW / (1.2 * 1005 * m.dT);
      roHeat.set(fmtNum(m3s, 2), "m³/s", `of air warming by ${m.dT} °C`);
    }
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
    status.innerHTML = describe();
    Loop.wake();
  }
  function describe() {
    const named = NAMED.find((s) => s.v === n);
    const homes = homesTarget();
    const facTxt = fmtSI(facW(), "W", 2);
    if (n === 1) return `<b>One GPU with its share of the server: about a space heater.</b> Run it all year and it uses about as much electricity as ${fmtNum(homes, 2)} average US homes.`;
    if (n === 8) return `<b>One server of eight GPUs: ~${fmtSI(8 * PER_GPU, "W", 2)},</b> about what ${fmtInt(Math.round(homes))} homes draw on average.`;
    if (n === 72 && mode === "liquid") return `<b>One rack: ~${fmtSI(72 * PER_GPU, "W", 2)} packed into less than a square meter.</b> Switch to air cooling and see how many racks the same 72 GPUs need.`;
    if (n === 72 && mode === "air") return `<b>Air can't carry ~${fmtSI(72 * PER_GPU, "W", 2)} out of one rack.</b> The same 72 GPUs have to be spread over ${racks()} racks, with fans pushing ${fmtNum(itW() / (1.2 * 1005 * 12), 2)} m³ of air per second.`;
    if (n === 100000) return `<b>A 2024-scale frontier cluster: ${facTxt} for the whole site,</b> as much as ~${fmtInt(roundSig(homes, 2))} homes. Every one of those watts leaves as heat.`;
    if (named) return `<b>${named.name[0].toUpperCase() + named.name.slice(1)}: ${facTxt}</b>, as much as ~${fmtInt(roundSig(homes, 2))} homes.`;
    return `<b>${fmtInt(n)} GPUs: ${facTxt}</b> for the whole building, as much as ~${fmtHomes(roundSig(homes, 2))} homes.`;
  }

  Actions.power = (arg) => {
    if (arg === "100k") gpuSlider.set(100000, true);
  };
  Theme.on(() => draw(0));
  Loop.add(stage.canvas, tick);
  update();
});

/* shared canvas helper */
function roundRect(c, x, y, w, hh, r) {
  r = Math.min(r, w / 2, hh / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + hh, r);
  c.arcTo(x + w, y + hh, x, y + hh, r);
  c.arcTo(x, y + hh, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
