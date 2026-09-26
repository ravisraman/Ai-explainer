/* =====================================================================
   Layer 2 · Data centers — build-a-cluster sandbox.
   Each step: fixed compute, then a ring all-reduce whose speed is set by
   the rack with the fewest working uplinks (the straggler).
   ===================================================================== */

defineMount("cluster", (root) => {
  const TC = 1.0; // compute time per step (s)
  const GB = 0.82; // gradient size / per-link bandwidth (s)
  const ALPHA = 0.004; // per-hop latency (s)
  const MAX_R = 12, MIN_R = 2, MAX_S = 4, MIN_S = 1;
  const SW = "ABCD";

  let S, racks, sel = 0, hover = -1, focused = false;
  let phase = "compute", t = 0, playing = true, stallT = 0;
  const history = [];
  const rackNew = [];

  function reset() {
    S = 4;
    racks = Array.from({ length: 8 }, () => ({ links: [true, true, true, true] }));
    rackNew.length = 0;
    phase = "compute"; t = 0; history.length = 0;
  }
  reset();

  const nLinks = (r) => r.links.slice(0, S).filter(Boolean).length;
  function model() {
    const n = racks.length;
    const counts = racks.map(nLinks);
    const minL = Math.min(...counts), maxL = Math.max(...counts);
    const slow = minL < maxL ? counts.indexOf(minL) : -1;
    if (minL === 0) return { n, counts, stalled: true, slow, minL };
    const bwTerm = (l) => (2 * (n - 1) / n) * GB / l;
    const lat = 2 * (n - 1) * ALPHA;
    const ts = bwTerm(minL) + lat;
    const per = counts.map((l) => bwTerm(l) + lat);
    const step = TC + ts;
    const speed = (n * TC) / step; // relative to one rack computing alone
    const wired = TC + bwTerm(S) + lat;
    return { n, counts, ts, per, step, speed, slow, minL, eff: TC / step, slowdown: step / wired - 1 };
  }

  /* ---------- canvas ---------- */
  let G = {};
  const stage = new Stage(root, {
    label: "A cluster of racks connected to network switches. Each training step, racks compute, then exchange results over the links.",
    height: (w) => clamp(w * 0.62, 330, 440),
    onResize: layout,
    draw: () => draw(),
  });
  stage.canvas.tabIndex = 0;

  function layout(w, hh) {
    const chartH = 70;
    const netH = hh - chartH - 14;
    const n = racks.length;
    const pad = 12;
    const gap = w < 480 ? 5 : 10;
    const rw = Math.min(48, (w - pad * 2 - gap * (n - 1)) / n);
    const totalW = rw * n + gap * (n - 1);
    const rx0 = (w - totalW) / 2;
    const rackY = netH * 0.56, rackH = netH * 0.3;
    const swW = Math.min(120, (w - pad * 2 - 12 * (S - 1)) / S);
    const swTot = swW * S + 12 * (S - 1);
    const sx0 = (w - swTot) / 2;
    const swY = 22, swH = 24;
    const rackList = racks.map((_, i) => ({ x: rx0 + i * (rw + gap), y: rackY, w: rw, h: rackH }));
    const swList = Array.from({ length: S }, (_, s) => ({ x: sx0 + s * (swW + 12), y: swY, w: swW, h: swH }));
    const links = [];
    racks.forEach((r, i) => {
      for (let s = 0; s < S; s++) {
        const R = rackList[i], W = swList[s];
        links.push({
          r: i, s,
          x1: R.x + (R.w * (s + 1)) / (S + 1), y1: R.y,
          x2: W.x + (W.w * (i + 1)) / (n + 1), y2: W.y + W.h,
        });
      }
    });
    G = { w, hh, chartH, netH, rackList, swList, links };
    sel = clamp(sel, 0, links.length - 1);
  }
  const relayout = () => { if (stage.w) layout(stage.w, stage.h); };

  function segDist(px, py, L) {
    const dx = L.x2 - L.x1, dy = L.y2 - L.y1;
    const k = clamp(((px - L.x1) * dx + (py - L.y1) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(px - (L.x1 + k * dx), py - (L.y1 + k * dy));
  }
  function pick(p, e) {
    const tol = e && e.pointerType === "touch" ? 16 : 9;
    let best = -1, bd = tol;
    G.links.forEach((L, i) => {
      if (p.y < L.y2 - 4 || p.y > L.y1 + 4) return;
      const d = segDist(p.x, p.y, L);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function toggle(i) {
    const L = G.links[i];
    if (!L) return;
    racks[L.r].links[L.s] = !racks[L.r].links[L.s];
    update();
  }
  stage.pointer({
    down: (p, e) => { const i = pick(p, e); if (i >= 0) { sel = i; toggle(i); } },
    move: (p, e) => {
      const i = pick(p, e);
      if (i !== hover) { hover = i; draw(); }
      if (i >= 0 && e.pointerType !== "touch") {
        const L = G.links[i];
        const on = racks[L.r].links[L.s];
        stage.tip(`Rack ${L.r + 1} ↔ switch ${SW[L.s]}: ${on ? "tap to cut" : "tap to connect"}`, p.x, p.y);
        stage.canvas.style.cursor = "pointer";
      } else { stage.tip(null); stage.canvas.style.cursor = ""; }
    },
    leave: () => { hover = -1; stage.tip(null); draw(); },
  });
  stage.canvas.addEventListener("focus", () => { focused = true; draw(); });
  stage.canvas.addEventListener("blur", () => { focused = false; draw(); });
  stage.canvas.addEventListener("keydown", (e) => {
    const n = G.links.length;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { sel = (sel + 1) % n; e.preventDefault(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { sel = (sel - 1 + n) % n; e.preventDefault(); }
    else if (e.key === "Enter" || e.key === " ") { toggle(sel); e.preventDefault(); }
    else return;
    const L = G.links[sel];
    Announcer(`Rack ${L.r + 1} to switch ${SW[L.s]}: ${racks[L.r].links[L.s] ? "connected" : "cut"}`);
    draw();
  });

  function tick(dt) {
    const m = model();
    if (playing) {
      t += dt;
      if (phase === "compute" && t >= TC) { phase = "sync"; t = 0; }
      else if (phase === "sync") {
        if (m.stalled) {
          stallT += dt;
          if (stallT > 0.8) { history.push(0); stallT = 0; }
        } else if (t >= m.ts) {
          history.push(m.speed);
          phase = "compute"; t = 0;
        }
      }
      if (history.length > 40) history.splice(0, history.length - 40);
    }
    draw();
  }

  function draw() {
    const c = stage.ctx, C = Theme.c;
    if (!stage.w || !G.links) return;
    stage.clear();
    const m = model();
    const acc = C.l2, net = C.l6;
    const mono = Theme.mono;

    // links
    G.links.forEach((L, i) => {
      const on = racks[L.r].links[L.s];
      const isHover = i === hover, isSel = focused && i === sel;
      c.lineWidth = isHover || isSel ? 3 : 1.4;
      if (on) {
        c.setLineDash([]);
        const active = phase === "sync" && !m.stalled ? 0.55 : 0.28;
        c.strokeStyle = isHover || isSel ? C.text : rgba(net, active);
      } else {
        c.setLineDash([3, 4]);
        c.strokeStyle = isHover || isSel ? C.text : rgba(C.muted, 0.35);
      }
      c.beginPath(); c.moveTo(L.x1, L.y1); c.lineTo(L.x2, L.y2); c.stroke();
      if (!on) {
        const mx = lerp(L.x1, L.x2, 0.5), my = lerp(L.y1, L.y2, 0.5);
        c.setLineDash([]);
        c.strokeStyle = C.bad; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(mx - 3, my - 3); c.lineTo(mx + 3, my + 3); c.moveTo(mx + 3, my - 3); c.lineTo(mx - 3, my + 3); c.stroke();
      }
    });
    c.setLineDash([]);

    // packets during sync: each rack's packets move at its own link speed
    if (phase === "sync") {
      G.links.forEach((L) => {
        if (!racks[L.r].links[L.s]) return;
        const per = m.stalled ? Infinity : m.per[L.r];
        const done = t >= per;
        if (done) return;
        const speed = m.counts[L.r] / S;
        for (let k = 0; k < 2; k++) {
          const f = ((t * 1.6 * speed + k * 0.5) % 1);
          const up = (k % 2) === 0;
          const ff = up ? f : 1 - f;
          c.fillStyle = net;
          c.beginPath(); c.arc(lerp(L.x1, L.x2, ff), lerp(L.y1, L.y2, ff), 2.4, 0, Math.PI * 2); c.fill();
        }
      });
    }

    // switches
    c.font = `600 10px ${mono}`;
    c.textAlign = "center";
    G.swList.forEach((W, s) => {
      c.fillStyle = C.raised; c.strokeStyle = C.muted; c.lineWidth = 1.2;
      roundRect(c, W.x, W.y, W.w, W.h, 5); c.fill(); c.stroke();
      c.fillStyle = C.text;
      c.fillText(W.w > 70 ? `SWITCH ${SW[s]}` : SW[s], W.x + W.w / 2, W.y + W.h / 2 + 3.5);
    });
    c.fillStyle = C.muted; c.textAlign = "left";
    c.fillText("NETWORK SWITCHES", G.swList[0].x, 12);

    // racks
    G.rackList.forEach((R, i) => {
      const isSlow = i === m.slow;
      const cnt = m.counts[i];
      let prog, col, state;
      if (phase === "compute") { prog = t / TC; col = acc; state = "compute"; }
      else if (m.stalled) { prog = cnt === 0 ? 0 : 1; col = cnt === 0 ? C.bad : C.faint; state = cnt === 0 ? "cut off" : "waiting"; }
      else {
        const per = m.per[i];
        prog = clamp(t / per, 0, 1);
        col = prog >= 1 ? C.faint : net;
        state = prog >= 1 ? "waiting" : "syncing";
      }
      c.fillStyle = C.sunk;
      c.strokeStyle = isSlow ? C.bad : C.muted;
      c.lineWidth = isSlow ? 2.2 : 1.2;
      roundRect(c, R.x, R.y, R.w, R.h, 4); c.fill(); c.stroke();
      // GPUs
      const cols = 2, rows = 4;
      const gw = (R.w - 10) / cols, gh = (R.h - 12) / rows;
      for (let k = 0; k < cols * rows; k++) {
        const gx = R.x + 5 + (k % cols) * gw, gy = R.y + 6 + Math.floor(k / cols) * gh;
        const busy = phase === "compute";
        c.fillStyle = busy ? acc : state === "waiting" ? rgba(C.text, 0.12) : rgba(net, 0.35);
        if (busy) { c.shadowColor = acc; c.shadowBlur = 6; }
        roundRect(c, gx + 1.5, gy + 1.5, gw - 3, gh - 3, 2); c.fill();
        c.shadowBlur = 0;
      }
      // progress bar
      const by = R.y + R.h + 7;
      c.fillStyle = rgba(C.text, 0.1); roundRect(c, R.x, by, R.w, 5, 2.5); c.fill();
      c.fillStyle = col; roundRect(c, R.x, by, Math.max(2, R.w * prog), 5, 2.5); c.fill();
      // labels
      c.textAlign = "center"; c.font = `600 ${R.w < 30 ? 9 : 10}px ${mono}`;
      c.fillStyle = isSlow ? C.bad : C.muted;
      c.fillText(String(i + 1), R.x + R.w / 2, by + 18);
      c.fillStyle = cnt < S ? (cnt === 0 ? C.bad : C.warn) : C.faint;
      c.fillText(`${cnt}/${S}`, R.x + R.w / 2, by + 30);
    });
    c.textAlign = "left"; c.fillStyle = C.muted; c.font = `600 10px ${mono}`;
    const lab = phase === "compute" ? "COMPUTING" : m.stalled ? "STUCK: A RACK IS CUT OFF" : "SYNCING RESULTS";
    c.fillText(`RACKS · ${lab}`, G.rackList[0].x, G.rackList[0].y - 8);

    // throughput strip chart
    const cy = G.netH + 14, ch = G.chartH - 18, cx = 12, cw = G.w - 24;
    c.fillStyle = C.sunk; roundRect(c, cx, cy, cw, ch + 14, 6); c.fill();
    c.fillStyle = C.muted; c.font = `600 10px ${mono}`; c.textAlign = "left";
    c.fillText("TRAINING SPEED, EACH STEP", cx + 8, cy + 13);
    const maxV = MAX_R;
    const bx = cx + 8, bw = cw - 16, bh = ch - 10, by0 = cy + 16 + bh;
    const N = 40, barW = bw / N;
    // ideal line for current rack count
    const idealY = by0 - (racks.length / maxV) * bh;
    c.strokeStyle = rgba(C.text, 0.25); c.setLineDash([2, 3]); c.lineWidth = 1;
    c.beginPath(); c.moveTo(bx, idealY); c.lineTo(bx + bw, idealY); c.stroke(); c.setLineDash([]);
    c.textAlign = "right"; c.fillStyle = C.faint;
    c.fillText(`IDEAL ${racks.length}×`, bx + bw, idealY - 3);
    history.forEach((v, i) => {
      const x = bx + (N - history.length + i) * barW;
      const hgt = (v / maxV) * bh;
      c.fillStyle = v === 0 ? C.bad : i === history.length - 1 ? acc : rgba(acc, 0.55);
      c.fillRect(x + 1, by0 - Math.max(1, hgt), barW - 2, Math.max(1, hgt));
    });
  }

  /* ---------- controls ---------- */
  const stRacks = stepper({
    label: "Racks", value: racks.length, min: MIN_R, max: MAX_R,
    onChange: (v, d) => {
      if (d > 0) { const r = { links: [false, false, false, false] }; r.links[0] = true; racks.push(r); }
      else racks.pop();
      update();
    },
  });
  const stSw = stepper({
    label: "Switches", value: S, min: MIN_S, max: MAX_S,
    onChange: (v, d) => {
      if (d > 0) { racks.forEach((r) => (r.links[S] = true)); S++; }
      else { S--; racks.forEach((r) => (r.links[S] = false)); }
      update();
    },
  });
  const bWire = button("Wire everything", () => { racks.forEach((r) => { for (let s = 0; s < S; s++) r.links[s] = true; }); update(); }, { small: true });
  const bPlay = button("Pause", () => { playing = !playing; bPlay.setLabel(playing ? "Pause" : "Play", playing ? "pause" : "play"); Loop.wake(); }, { icon: "pause", small: true });
  const bReset = button("Reset", () => { reset(); update(); }, { icon: "reset", small: true });
  root.append(h("div", { class: "ctl-row" }, stRacks.el, stSw.el, h("div", { class: "btn-row" }, bWire, bPlay, bReset)));

  const roStep = readout("Step time");
  const roSpeed = readout("Speed vs one rack");
  const roEff = readout("Scaling efficiency");
  const roWeak = readout("Weakest rack");
  root.append(h("div", { class: "readouts" }, roStep.el, roSpeed.el, roEff.el, roWeak.el));
  const status = h("p", { class: "status", "aria-live": "polite" });
  root.append(status);

  function update() {
    relayout();
    const m = model();
    stRacks.set(racks.length);
    stSw.set(S);
    if (m.stalled) {
      roStep.set("∞", " s"); roStep.state("bad");
      roSpeed.set("0", "×"); roSpeed.state("bad");
      roEff.set("0", "%"); roEff.state("bad");
      roWeak.set(`Rack ${m.slow + 1}`, "", "cut off"); roWeak.state("bad");
      status.innerHTML = `<b class="bad">Rack ${m.slow + 1} has no links.</b> The other racks can't finish swapping results, so the whole job is stuck. Tap one of its dashed lines to connect it, or remove it.`;
    } else {
      roStep.set(fmtNum(m.step, 3), " s"); roStep.state(m.slow >= 0 ? "bad" : null);
      roSpeed.set(fmtNum(m.speed, 2), "×"); roSpeed.state("hi");
      roEff.set(Math.round(m.eff * 100), "%"); roEff.state(null);
      roWeak.set(`${m.minL}/${S}`, " links"); roWeak.state(m.minL < S ? "bad" : null);
      if (m.slow >= 0) {
        const missing = m.counts.reduce((a, k) => a + (S - k), 0);
        const naive = (missing / (racks.length * S)) * 100;
        let extra = "";
        if (racks.length > MIN_R) {
          const saved = racks.splice(m.slow, 1)[0];
          const without = model();
          racks.splice(m.slow, 0, saved);
          if (!without.stalled && without.speed > m.speed) extra = ` Removing rack ${m.slow + 1} entirely would make the cluster <b>faster</b> (${fmtNum(without.speed, 2)}× instead of ${fmtNum(m.speed, 2)}×).`;
        }
        status.innerHTML = `<b>Rack ${m.slow + 1} is the straggler.</b> With ${m.minL} of ${S} links, its share of each sync takes ${fmtNum(S / m.minL, 2)}× longer, and all ${racks.length} racks wait for it. Training is <b class="bad">${Math.round(m.slowdown * 100)}% slower</b> than fully wired, though only ${fmtNum(naive, 2)}% of the links are missing.${extra}`;
      } else if (m.minL < S) {
        status.innerHTML = `<b>Every rack is missing links,</b> so every sync is ${fmtNum(S / m.minL, 2)}× slower. Training is <b class="bad">${Math.round(m.slowdown * 100)}% slower</b> than fully wired.`;
      } else {
        status.innerHTML = `<b>All ${racks.length} racks fully wired.</b> Each step is ${fmtNum(TC, 2)} s of computing, then ${fmtNum(m.ts, 2)} s swapping results. Tap a link to cut it, or add a rack.`;
      }
    }
    Loop.wake();
  }

  Actions.cluster = (arg) => {
    if (arg === "cut") {
      reset();
      racks[2].links[0] = false;
      playing = true; bPlay.setLabel("Pause", "pause");
      update();
    }
  };
  Theme.on(draw);
  Loop.add(stage.canvas, tick, () => true);
  update();
});
