/* =====================================================================
   Layer 3 · Silicon — inside an EUV scanner (animated diagram).
   Tin droplet → pre-pulse flattens it → main pulse makes a plasma that
   glows at 13.5 nm → collector and relay mirrors → reflective mask →
   projection mirrors → wafer. Mask and wafer sweep in sync, the mask 4×
   faster because the pattern is shrunk 4×.
   ===================================================================== */

defineMount("euv", (root) => {
  const VW = 760, VH = 270; // virtual drawing space, plus a left margin for the laser
  const narrow = (w) => w < 560;
  const OXfor = (w) => (narrow(w) ? 150 : 96);
  const CYCLE = 1.8; // seconds per droplet (slowed down ~90,000×)
  let t = 0, playing = true;
  const BEAM = [[262, 130], [322, 66], [420, 40], [500, 112], [420, 172], [560, 222]];
  const seg = []; let beamLen = 0;
  for (let i = 1; i < BEAM.length; i++) { const d = Math.hypot(BEAM[i][0] - BEAM[i - 1][0], BEAM[i][1] - BEAM[i - 1][1]); seg.push(d); beamLen += d; }
  const beamAt = (s) => { let d = s * beamLen; for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const f = d / seg[i]; return [lerp(BEAM[i][0], BEAM[i + 1][0], f), lerp(BEAM[i][1], BEAM[i + 1][1], f)]; } d -= seg[i]; } return BEAM[BEAM.length - 1]; };

  const stage = new Stage(root, {
    label: "Animated diagram of an EUV scanner: a laser turns tin droplets into a glowing plasma; mirrors carry the light to a patterned mask and then onto a wafer.",
    height: (w) => Math.max(150, Math.round((w * VH) / (VW + OXfor(w)))),
    draw: () => draw(),
  });
  function tick(dt) { if (playing && !reducedMotion()) t += dt; draw(); }

  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w) return;
    stage.clear();
    const small = narrow(stage.w), OX = OXfor(stage.w);
    const k = Math.min(stage.w / (VW + OX), stage.h / VH);
    c.save();
    c.translate((stage.w - (VW + OX) * k) / 2 + OX * k, (stage.h - VH * k) / 2);
    c.scale(k, k);
    const mono = Theme.mono;
    const ph = (t % CYCLE) / CYCLE; // 0..1 within one droplet cycle
    const struct = Theme.dark ? "#2c2937" : "#d7d5e0";
    // phones get shorter labels at a readable size
    const fs = small ? Math.min(24, 9.5 / k) : 11;
    const label = (long, short, x, y, al = "left") => { c.fillStyle = C.muted; c.font = `600 ${fs}px ${mono}`; c.textAlign = al; c.fillText(small ? short : long, x, y); };

    // vacuum vessel
    c.strokeStyle = C["line-2"]; c.lineWidth = 1.5; c.fillStyle = rgba(C.l9, 0.04);
    roundRect(c, 34, 44, 200, 176, 22); c.fill(); c.stroke();
    label("LIGHT SOURCE, IN VACUUM", "IN VACUUM", 134, small ? 246 : 238, "center");
    // droplet generator
    c.fillStyle = C.muted; c.fillRect(122, 48, 12, 14);
    label("TIN DROPLETS, ~50,000 A SECOND", "TIN DROPLETS", 128, 34, "center");

    // droplet: falls, gets flattened by the pre-pulse, then vaporized
    const fall = clamp(ph / 0.36, 0, 1);
    const flat = clamp((ph - 0.36) / 0.08, 0, 1);
    if (ph < 0.46) {
      const y = lerp(66, 130, easeInOut(fall));
      c.fillStyle = Theme.dark ? "#d8d6e2" : "#6f6a82";
      c.beginPath(); c.ellipse(128, y, 3.6 + flat * 5, 3.6 - flat * 2.4, 0, 0, Math.PI * 2); c.fill();
    }
    // laser: weak pre-pulse, then the main pulse
    const pre = ph > 0.34 && ph < 0.38, main = ph > 0.44 && ph < 0.5;
    c.strokeStyle = main ? C.l1 : pre ? rgba(C.l1, 0.55) : rgba(C.l1, 0.18);
    c.lineWidth = main ? 4 : pre ? 2 : 1.5;
    c.beginPath(); c.moveTo(-OX, 130); c.lineTo(124, 130); c.stroke();
    label("CO₂ LASER", "CO₂ LASER", 6 - OX, 118);
    if (pre) { label("PRE-PULSE", "PRE-PULSE", 6 - OX, 130 + fs * 1.6); label("FLATTENS DROPLET", "", 6 - OX, 130 + fs * 2.8); }
    if (main) { label("MAIN PULSE", "MAIN PULSE", 6 - OX, 130 + fs * 1.6); label("MAKES PLASMA", "", 6 - OX, 130 + fs * 2.8); }

    // plasma flash and the EUV light it gives off
    const glow = ph > 0.45 ? Math.max(0, 1 - (ph - 0.45) / 0.35) : 0;
    c.fillStyle = rgba(C.l9, 0.08 + 0.35 * glow);
    c.beginPath(); c.moveTo(74, 78); c.lineTo(74, 182); c.lineTo(262, 130); c.closePath(); c.fill();
    if (glow > 0) {
      const r = 8 + 14 * (1 - glow);
      const g = c.createRadialGradient(128, 130, 0, 128, 130, r * 2);
      g.addColorStop(0, rgba("#ffffff", glow)); g.addColorStop(0.35, rgba(C.l9, glow * 0.9)); g.addColorStop(1, rgba(C.l9, 0));
      c.fillStyle = g; c.beginPath(); c.arc(128, 130, r * 2, 0, Math.PI * 2); c.fill();
    }
    label("PLASMA GLOWS AT 13.5 nm", "PLASMA, 13.5 nm", 134, 186);
    // collector mirror
    c.strokeStyle = C.l6; c.lineWidth = 3;
    c.beginPath(); c.moveTo(76, 76); c.quadraticCurveTo(56, 100, 53, 123); c.moveTo(53, 137); c.quadraticCurveTo(56, 160, 76, 184); c.stroke();
    label("COLLECTOR MIRROR", "", 46, 210);

    // beam path through the relay mirrors, with a pulse travelling along it
    c.strokeStyle = rgba(C.l9, 0.22); c.lineWidth = 6; c.lineJoin = "round";
    c.beginPath(); BEAM.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    const travel = (ph - 0.46) / 0.42;
    if (travel > 0 && travel < 1.15) {
      for (let j = 0; j < 10; j++) {
        const s = travel - j * 0.018;
        if (s < 0 || s > 1) continue;
        const [x, y] = beamAt(s);
        c.fillStyle = rgba(C.l9, 1 - j / 10);
        c.beginPath(); c.arc(x, y, 4 - j * 0.25, 0, Math.PI * 2); c.fill();
      }
    }
    c.strokeStyle = C.l6; c.lineWidth = 3;
    for (const [a, b] of [[[309, 56], [336, 74]], [[492, 98], [509, 124]], [[407, 180], [432, 162]]]) { c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    label("MIRRORS", "MIRRORS", 318, 100); label("MIRRORS", "MIRRORS", 514, 108);

    // mask and wafer sweep in opposite directions; the mask moves 4× as far
    const sweep = Math.sin(t * 1.3);
    const mx = sweep * 24, wx = -sweep * 6;
    c.fillStyle = struct; c.strokeStyle = C.muted; c.lineWidth = 1;
    c.fillRect(378 + mx, 22, 84, 12); c.strokeRect(378.5 + mx, 22.5, 83, 11);
    c.fillStyle = C.text;
    for (let i = 0; i < 9; i++) c.fillRect(384 + mx + i * 8.6, 25, 4, 6);
    label("MASK (A MIRROR TOO), PATTERN 4× LARGER", "MASK, 4× LARGER", 472, 18);
    c.fillStyle = C["line-2"]; roundRect(c, 498 + wx, 238, 124, 10, 3); c.fill();
    c.fillStyle = struct; c.strokeStyle = C.muted;
    c.beginPath(); c.ellipse(560 + wx, 229, 54, 10, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = rgba(C.text, 0.35); c.lineWidth = 0.6;
    for (const dx of [-36, -18, 0, 18, 36]) { c.beginPath(); c.moveTo(560 + wx + dx, 221); c.lineTo(560 + wx + dx, 237); c.stroke(); }
    const hit = travel > 0.95 && travel < 1.4 ? 1 - Math.abs(travel - 1.1) / 0.3 : 0;
    if (hit > 0) { c.fillStyle = rgba(C.l9, clamp(hit, 0, 1)); c.beginPath(); c.ellipse(560, 226, 11, 3.5, 0, 0, Math.PI * 2); c.fill(); }
    label("WAFER", "WAFER", 624, 214);
    c.restore();
  }
  const bPlay = button("Pause", () => { playing = !playing; bPlay.setLabel(playing ? "Pause" : "Play", playing ? "pause" : "play"); Loop.wake(); }, { icon: "pause", small: true });
  root.append(h("div", { class: "btn-row", style: "margin-top:10px" }, bPlay, h("span", { class: "muted small" }, "Slowed down about 90,000 times. Real droplets are hit about 50,000 times a second.")));
  Theme.on(draw);
  Loop.add(stage.canvas, tick, () => playing);
});
