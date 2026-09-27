/* =====================================================================
   Hero: an isometric stack of the ten layers. Particles start at the
   bottom as electricity, climb through every layer (taking each layer's
   color) and leave the top as letters. Labels are real links.
   ===================================================================== */

defineMount("hero", (root) => {
  const WORDS = ["answers", "code", "poems", "plans", "summaries", "ideas", "translations"];
  const list = h("ol", { class: "hero-labels" });
  const links = LAYERS.slice().reverse().map((l) => {
    const a = h("a", { href: "#" + l.id, style: `--c: var(--l${l.n})`, "data-n": l.n }, h("span", { class: "hl-n" }, String(l.n)), h("span", { class: "hl-name" }, l.name));
    a.addEventListener("mouseenter", () => { hover = l.n; });
    a.addEventListener("mouseleave", () => { hover = 0; });
    a.addEventListener("focus", () => { hover = l.n; });
    a.addEventListener("blur", () => { hover = 0; });
    list.append(h("li", null, a));
    return a;
  });
  let hover = 0, t0 = performance.now(), geo = null;
  const stage = new Stage(root, {
    cls: "hero-stage",
    label: "",
    height: (w) => clamp(w * 1.05, 330, 520),
    onResize: (w, hh) => {
      const labelW = w < 420 ? 156 : 170;
      const sw = Math.min((w - labelW - 16) / 2, 150);
      const cx = 12 + sw + 6;
      const d = sw * 0.5; // isometric depth
      const th = Math.max(9, hh * 0.028); // slab thickness
      const gap = (hh - 90 - d * 2) / 10;
      geo = { w, hh, sw, cx, d, th, gap, top: 70 + d, labelX: cx + sw + (w < 420 ? 10 : 22) };
      // position label links beside each slab
      links.forEach((a) => {
        const n = +a.dataset.n;
        const y = slabY(n);
        a.parentElement.style.top = `${y - 4}px`;
        a.parentElement.style.left = `${geo.labelX}px`;
      });
    },
    draw: () => draw(0),
  });
  stage.canvas.setAttribute("aria-hidden", "true");
  root.append(list);
  const slabY = (n) => geo.top + (10 - n) * geo.gap; // y of the slab's top-face center

  const parts = [];
  const R = rng(3);
  const letters = [];
  let wordIdx = 0, letterTimer = 0;

  function spawn() {
    parts.push({ x: (R() - 0.5) * 0.9, z: (R() - 0.5) * 0.9, y: 0, v: 0.08 + R() * 0.06, ph: R() * 6.28 });
  }
  function tick(dt) {
    const reduced = reducedMotion();
    if (!reduced) {
      if (parts.length < 46 && R() < 0.35) spawn();
      for (const p of parts) { p.y += p.v * dt; p.ph += dt * 2; }
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].y > 1) {
          const p = parts.splice(i, 1)[0];
          letterTimer -= 1;
          if (letterTimer <= 0) {
            const w = WORDS[wordIdx++ % WORDS.length];
            letters.push({ text: w, x: p.x, life: 0 });
            letterTimer = 14;
          }
        }
      }
      for (const L of letters) L.life += dt;
      while (letters.length && letters[0].life > 3.2) letters.shift();
    }
    draw(dt);
  }
  function iso(x, z, y) {
    // x, z in [-1, 1] across the slab; y = height fraction 0 (bottom) .. 1 (top)
    const g = geo;
    const baseY = g.top + 9 * g.gap + g.gap * 0.0;
    const sy = lerp(baseY + g.gap * 0.6, g.top - g.d - 20, y);
    return [g.cx + (x - z) * g.sw * 0.5, sy + (x + z) * g.d * 0.5];
  }
  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w || !geo) return;
    stage.clear();
    const g = geo;
    const since = (performance.now() - t0) / 1000;
    // slabs from bottom (1) to top (10)
    for (let n = 1; n <= 10; n++) {
      const appear = reducedMotion() ? 1 : clamp((since - (n - 1) * 0.07) / 0.45, 0, 1);
      if (appear <= 0) continue;
      const lift = (1 - easeOut(appear)) * 30 + (hover === n ? 6 : 0);
      const y = slabY(n) - lift;
      const col = C["l" + n];
      const on = hover === n;
      c.globalAlpha = appear * (hover && !on ? 0.55 : 1);
      // faces
      const L = [g.cx - g.sw, y], T = [g.cx, y - g.d], Rr = [g.cx + g.sw, y], B = [g.cx, y + g.d];
      const th = g.th;
      c.fillStyle = mix(col, "#000000", 0.45);
      poly(c, [L, B, [B[0], B[1] + th], [L[0], L[1] + th]]);
      c.fillStyle = mix(col, "#000000", 0.25);
      poly(c, [B, Rr, [Rr[0], Rr[1] + th], [B[0], B[1] + th]]);
      c.fillStyle = on ? mix(col, "#ffffff", 0.18) : col;
      poly(c, [L, T, Rr, B]);
      // etched grid on the top face for texture
      c.strokeStyle = rgba("#000000", 0.12); c.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        const f = k / 4;
        c.beginPath(); c.moveTo(lerp(L[0], T[0], f), lerp(L[1], T[1], f)); c.lineTo(lerp(B[0], Rr[0], f), lerp(B[1], Rr[1], f)); c.stroke();
      }
      c.globalAlpha = 1;
    }
    // particles (drawn over the slabs, climbing through)
    for (const p of parts) {
      const [px, py] = iso(p.x + Math.sin(p.ph) * 0.04, p.z, p.y);
      const layer = clamp(Math.floor(p.y * 10) + 1, 1, 10);
      c.fillStyle = C["l" + layer];
      c.shadowColor = C["l" + layer]; c.shadowBlur = 6;
      c.beginPath(); c.arc(px, py, 2.2, 0, Math.PI * 2); c.fill();
    }
    c.shadowBlur = 0;
    // words leaving the top
    c.font = `600 13px ${Theme.mono}`; c.textAlign = "center";
    for (const L of letters) {
      const [px, py] = iso(L.x, 0, 1);
      const a = clamp(1 - L.life / 3.2, 0, 1);
      c.fillStyle = rgba(C.l10, a);
      c.fillText(L.text, px, py - L.life * 16);
    }
    // bottom label
    c.fillStyle = rgba(C.l1, 0.9); c.font = `600 10px ${Theme.mono}`;
    const [bx, by] = iso(0, 0, 0);
    c.fillText("ELECTRONS IN", bx, Math.min(g.hh - 6, by + g.d + 26));
  }
  function poly(c, pts) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); }
  Theme.on(() => draw(0));
  Loop.add(root, tick);
});
