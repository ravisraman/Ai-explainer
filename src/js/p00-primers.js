/* =====================================================================
   "Build it up, step by step" figures for the software layers (5–10).
   Small, mostly static-until-touched pieces that lead into the main
   figures of each layer.
   ===================================================================== */

function primerPause(root) {
  const b = button("Pause motion", () => {
    const p = root.classList.toggle("paused");
    b.setLabel(p ? "Play motion" : "Pause motion");
  }, { small: true });
  return b;
}

/* ---- L5: one line of code, followed down ---- */
defineMount("codedown", (root) => {
  const LV = [
    ["Your code (Python)", "One line asks for a matrix multiplication. Python itself is far too slow to do the arithmetic; it just hands the request to the framework."],
    ["Framework (PyTorch)", "PyTorch knows x and W are tensors (grids of numbers) already sitting in GPU memory. It checks their shapes and number format, records the operation so it can compute gradients later, and picks a routine to run."],
    ["Library or compiler", "A tuned library (such as NVIDIA's cuBLAS) or a compiler (torch.compile, Triton) supplies the kernel: a GPU program that cuts the matrices into tiles small enough to fit in fast on-chip memory. It may fuse this step with the next one to save trips to memory."],
    ["Runtime and driver (CUDA)", "The CUDA runtime queues the kernel on the GPU: run this program on a grid of many thousands of threads, reading from these memory addresses. Python doesn't wait; it moves straight on to queue the next operation."],
    ["The GPU", "The GPU spreads blocks of threads across its 100-plus streaming multiprocessors. Each block loads a tile of x and a tile of W from high-bandwidth memory, and its tensor cores multiply and add them in bulk: billions of transistors switching (Layers 3 and 4)."],
    ["The result", "Finished tiles are written back to memory as y, ready for the next kernel. For a big matrix the whole trip takes microseconds to milliseconds, and one training step runs thousands of kernels like it."],
  ];
  let i = 0;
  const list = h("ol", { class: "cd-levels" });
  const detail = h("div", { class: "cd-detail", "aria-live": "polite" });
  const back = button("← Up", () => { i = Math.max(0, i - 1); paint(); });
  const next = button("Down →", () => { i = Math.min(LV.length - 1, i + 1); paint(); }, { kind: "primary" });
  function paint() {
    list.replaceChildren(...LV.map(([t], j) => h("li", {}, h("button", {
      type: "button", class: (j === i ? "on " : "") + (j <= i ? "seen" : ""), "aria-current": j === i ? "step" : "false",
      onclick: () => { i = j; paint(); },
    }, h("span", {}, String(j + 1)), t))));
    detail.replaceChildren(h("h4", {}, `${i + 1}. ${LV[i][0]}`), h("p", {}, LV[i][1]));
    back.disabled = i === 0; next.disabled = i === LV.length - 1;
  }
  root.append(h("div", { class: "cd-code" }, "y = x ", h("b", {}, "@"), " W", h("span", { class: "muted" }, "    # multiply inputs by weights")),
    h("div", { class: "cd-grid" }, list, h("div", {}, detail, h("div", { class: "btn-row" }, back, next))));
  paint();
});

/* ---- L7: a model is a function with knobs (fit a line) ---- */
defineMount("fitline", (root) => {
  const X = [420, 500, 560, 640, 700, 780, 850, 920, 1000, 1080, 1150, 1250, 1400];
  const NZ = [180, -120, 90, -220, 135, -60, 195, -165, 60, -90, 225, -135, 30];
  const Y = X.map((x, i) => 1.5 * x + 400 + NZ[i]);
  const n = X.length, mx = X.reduce((a, b) => a + b) / n, my = Y.reduce((a, b) => a + b) / n;
  const sx = Math.sqrt(X.reduce((a, x) => a + (x - mx) ** 2, 0) / n), sy = Math.sqrt(Y.reduce((a, y) => a + (y - my) ** 2, 0) / n);
  let w = 0.5, b = 900, anim = 0;
  const W = 560, H = 290, m = { l: 58, r: 14, t: 12, b: 40 };
  const px = (x) => m.l + (x - 300) / 1200 * (W - m.l - m.r), py = (y) => m.t + (1 - y / 3000) * (H - m.t - m.b);
  const clipId = uid("clip");
  const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "fit-svg", role: "img", "aria-label": "Scatter plot of apartment size against rent, with an adjustable line" });
  svg.append(sv("defs", {}, sv("clipPath", { id: clipId }, sv("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b }))));
  [0, 1000, 2000, 3000].forEach((v) => svg.append(sv("line", { class: "gridl", x1: m.l, x2: W - m.r, y1: py(v), y2: py(v) }), sv("text", { class: "axis-t", x: m.l - 6, y: py(v) + 4, "text-anchor": "end", text: "$" + v.toLocaleString("en-US") })));
  [400, 800, 1200].forEach((v) => svg.append(sv("text", { class: "axis-t", x: px(v), y: H - m.b + 16, "text-anchor": "middle", text: v + " sq ft" })));
  svg.append(sv("text", { class: "axis-t", x: (m.l + W - m.r) / 2, y: H - 4, "text-anchor": "middle", text: "apartment size → monthly rent" }));
  const resid = sv("g", { "clip-path": `url(#${clipId})` }), line = sv("line", { class: "fitline", "clip-path": `url(#${clipId})` });
  svg.append(resid, line, ...X.map((x, i) => sv("circle", { class: "pt", cx: px(x), cy: py(Y[i]), r: 4.5 })));
  const rmse = () => Math.sqrt(X.reduce((a, x, i) => a + (w * x + b - Y[i]) ** 2, 0) / n);
  const read = h("div", { class: "fig-read" }), msg = h("p", { class: "fig-msg", "aria-live": "polite" });
  const stop = () => { cancelAnimationFrame(anim); anim = 0; };
  const sw = slider({ label: "w · dollars per sq ft", min: 0, max: 4, step: 0.05, value: w, fmt: (v) => "$" + v.toFixed(2), onInput: (v) => { stop(); w = v; draw(); } });
  const sb = slider({ label: "b · base amount", min: -500, max: 1500, step: 10, value: b, fmt: (v) => "$" + Math.round(v), onInput: (v) => { stop(); b = v; draw(); } });
  function draw(sync) {
    line.setAttribute("x1", px(300)); line.setAttribute("y1", py(w * 300 + b)); line.setAttribute("x2", px(1500)); line.setAttribute("y2", py(w * 1500 + b));
    resid.replaceChildren(...X.map((x, i) => sv("line", { class: "resid", x1: px(x), x2: px(x), y1: py(Y[i]), y2: py(w * x + b) })));
    read.innerHTML = `<span>rent = <b>${w.toFixed(2)}</b> × size + <b>${Math.round(b)}</b></span><span>typical error (the loss): <b>$${fmtInt(rmse())}</b></span>`;
    if (sync) { sw.set(clamp(w, 0, 4)); sb.set(clamp(b, -500, 1500)); }
  }
  function gd(steps) {
    let a = w * sx / sy, c = (w * mx + b - my) / sy;
    const xs = X.map((x) => (x - mx) / sx), ys = Y.map((y) => (y - my) / sy);
    for (let k = 0; k < steps; k++) {
      let ga = 0, gc = 0;
      xs.forEach((x, i) => { const e = a * x + c - ys[i]; ga += 2 * e * x / n; gc += 2 * e / n; });
      a -= 0.06 * ga; c -= 0.06 * gc;
    }
    w = a * sy / sx; b = c * sy + my - w * mx;
  }
  const auto = button("Auto-fit (gradient descent)", () => {
    stop();
    if (reducedMotion()) { gd(400); draw(true); msg.textContent = "Fitted by gradient descent."; return; }
    let k = 0;
    const tick = () => {
      gd(2); k += 2; draw(true);
      msg.textContent = `Step ${k}: each knob moved a little downhill.`;
      if (k < 120) anim = requestAnimationFrame(tick);
      else { anim = 0; msg.textContent = `Done after ${k} small steps. The leftover error is noise that no straight line can explain.`; }
    };
    anim = requestAnimationFrame(tick);
  }, { kind: "primary" });
  const reset = button("Reset", () => { stop(); w = 0.5; b = 900; msg.textContent = ""; draw(true); });
  root.append(svg, read, h("div", { class: "ctl-row" }, sw.el, sb.el), h("div", { class: "btn-row" }, auto, reset), msg,
    h("p", { class: "note-s" }, "Made-up example data. Real rents depend on much more than size, which is why the next steps add more inputs and bends."));
  draw();
});

/* ---- L7: one neuron ---- */
defineMount("neuron", (root) => {
  const x = [2, 1, 3], w = [0.5, -0.3, 0.4]; let bias = 0;
  const ys = [35, 95, 155], SX = 250, SY = 95;
  const sig = (z) => 1 / (1 + Math.exp(-z));
  const svg = sv("svg", { viewBox: "0 0 470 195", class: "np-svg", role: "img" });
  const edges = ys.map((y) => sv("path", { class: "edge", d: `M60 ${y} L${SX - 30} ${SY}` }));
  const wls = ys.map((y) => sv("text", { class: "wl", x: 138, y: (y + SY) / 2 - 6 }));
  const sumT = sv("text", { class: "small", x: SX, y: SY + 50 });
  const outT = sv("text", { class: "outv", x: 404, y: SY + 8 });
  let curve = "";
  for (let i = 0; i <= 24; i++) { const z = -6 + i / 2; curve += (i ? "L" : "M") + (316 + i * 2).toFixed(1) + " " + (SY + 18 - sig(z) * 36).toFixed(1); }
  const dot = sv("circle", { r: 3.5, fill: "var(--c)" });
  svg.append(...edges, ...wls,
    ...ys.map((y, i) => sv("g", {}, sv("circle", { class: "node", cx: 40, cy: y, r: 19 }), sv("text", { x: 40, y: y + 5, text: String(x[i]) }))),
    sv("text", { class: "small", x: 40, y: 190, text: "inputs" }),
    sv("circle", { class: "node", cx: SX, cy: SY, r: 28 }), sv("text", { x: SX, y: SY + 6, style: "font-size:20px", text: "Σ" }), sumT,
    sv("path", { d: `M${SX + 28} ${SY} L310 ${SY}`, stroke: "var(--line-2)", "stroke-width": 2 }),
    sv("rect", { x: 310, y: SY - 26, width: 60, height: 52, rx: 8, fill: "var(--raised)", stroke: "var(--line-2)" }),
    sv("path", { d: curve, fill: "none", stroke: "var(--c)", "stroke-width": 2.2 }), dot,
    sv("text", { class: "small", x: 340, y: SY + 44, text: "S-curve" }),
    sv("path", { d: `M370 ${SY} L398 ${SY}`, stroke: "var(--line-2)", "stroke-width": 2 }), outT,
    sv("text", { class: "small", x: 404, y: SY + 28, "text-anchor": "start", text: "output" }));
  const read = h("div", { class: "fig-read", "aria-live": "polite" });
  const f1 = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  function draw() {
    const sum = x.reduce((a, xi, i) => a + xi * w[i], 0) + bias, out = sig(sum);
    edges.forEach((e, i) => {
      e.setAttribute("class", "edge " + (w[i] < 0 ? "neg" : "pos"));
      e.setAttribute("stroke-width", (1 + Math.abs(w[i]) * 5).toFixed(1));
      e.setAttribute("stroke-dasharray", w[i] < 0 ? "6 4" : "none");
      e.setAttribute("opacity", w[i] === 0 ? 0.25 : 1);
    });
    wls.forEach((t, i) => { t.textContent = "× " + f1(w[i]); t.setAttribute("fill", w[i] < 0 ? "var(--bad)" : "var(--c)"); });
    sumT.textContent = `sum ${f1(sum)}`;
    outT.textContent = out.toFixed(2);
    const zc = clamp(sum, -6, 6);
    dot.setAttribute("cx", (316 + (zc + 6) * 4).toFixed(1)); dot.setAttribute("cy", (SY + 18 - sig(zc) * 36).toFixed(1));
    svg.setAttribute("aria-label", `One neuron: inputs 2, 1 and 3; sum ${f1(sum)}; output ${out.toFixed(2)}`);
    const terms = x.map((xi, i) => `${xi}×${w[i] < 0 ? "(" + f1(w[i]) + ")" : f1(w[i])}`).join(" + ");
    read.innerHTML = `<span>${terms} ${bias < 0 ? "−" : "+"} ${Math.abs(bias).toFixed(1)} = <b>${f1(sum)}</b></span><span>after the S-curve: <b>${out.toFixed(2)}</b>${sum < -2 ? " (nearly off)" : sum > 2 ? " (nearly fully on)" : ""}</span>`;
  }
  const sls = w.map((v, i) => slider({ label: `weight ${i + 1}`, min: -1, max: 1, step: 0.1, value: v, fmt: f1, onInput: (nv) => { w[i] = nv; draw(); } }));
  const sb = slider({ label: "bias", min: -4, max: 4, step: 0.1, value: 0, fmt: f1, onInput: (nv) => { bias = nv; draw(); } });
  root.append(svg, read, h("div", { class: "ctl-row" }, ...sls.map((s) => s.el), sb.el),
    h("p", { class: "note-s" }, "The S-curve squashes any sum into the range 0 to 1: big negative sums give nearly 0 (the neuron is quiet), big positive sums nearly 1. Large language models use smooth ramp-shaped bends instead, but the role is the same."));
  draw();
});

/* ---- L7: attention, with the arithmetic ---- */
defineMount("attnmath", (root) => {
  const q = [1, 2];
  const R = [["The", [0.1, 0.2], [0, 0]], ["cat", [1.2, 1.4], [0.9, 0.1]], ["sat", [0.8, -0.6], [0.1, 0.9]], ["because", [-0.3, 0.3], [0, 0.2]], ["it (itself)", [0.5, 0.5], [0.3, 0.1]]];
  const sc = R.map((r) => (q[0] * r[1][0] + q[1] * r[1][1]) / Math.SQRT2);
  const ex = sc.map(Math.exp), tot = ex.reduce((a, b) => a + b), wt = ex.map((e) => e / tot);
  const out = [0, 1].map((d) => R.reduce((a, r, i) => a + wt[i] * r[2][d], 0));
  const f = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(2), f1 = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  const fv = (v) => `(${f(v[0])}, ${f(v[1])})`, fv1 = (v) => `(${f1(v[0])}, ${f1(v[1])})`;
  let step = 1;
  const EXPL = {
    1: "Score: multiply the query and each key number by number, add, then divide by √2 (the square root of the vector length, a standard step that keeps scores in a sensible range). “cat” scores highest because its key points the same way as the query.",
    2: "Weigh: a softmax turns scores into weights that add up to 100%. It raises e to the power of each score and divides by the total, so bigger scores get disproportionately more. “cat” now gets most of the attention.",
    3: `Mix: multiply each value by its weight and add them up. The result, ${fv(out)}, is mostly “cat”: “it” has pulled in information about the cat. This blend is added to the running notes for “it”.`,
  };
  const table = h("table", { class: "am-table" });
  const expl = h("p", { class: "fig-msg", "aria-live": "polite" });
  const outBox = h("p", { class: "am-out" });
  const seg = segmented({ label: "Step", options: [{ value: 1, label: "1 · Score" }, { value: 2, label: "2 · Weigh" }, { value: 3, label: "3 · Mix" }], value: step, onChange: (v) => { step = v; draw(); } });
  function draw() {
    const H = (lvl, v) => h("td", { class: step >= lvl ? (step === lvl ? "hot" : "") : "hide" }, v);
    table.replaceChildren(
      h("thead", {}, h("tr", {}, ["earlier token", "key", "score", "weight", "value", "weight × value"].map((t) => h("th", {}, t)))),
      h("tbody", {},
        h("tr", { class: "q" }, h("td", {}, "query of “it”"), h("td", {}, fv1(q)), h("td"), h("td"), h("td"), h("td")),
        ...R.map((r, i) => h("tr", {}, h("td", {}, r[0]), h("td", {}, fv1(r[1])), H(1, f(sc[i])),
          H(2, h("span", {}, h("span", { class: "am-bar", style: `width:${Math.round(wt[i] * 60)}px` }), Math.round(wt[i] * 100) + "%")),
          H(3, fv1(r[2])), H(3, fv([wt[i] * r[2][0], wt[i] * r[2][1]]))))));
    expl.textContent = EXPL[step];
    outBox.innerHTML = step === 3 ? `New information for “it” = sum of the last column = <b>${fv(out)}</b>` : "Step through to see the result.";
  }
  root.append(seg.el, h("div", { class: "am-wrap", style: "margin-top:12px" }, table), expl, outBox,
    h("p", { class: "note-s" }, "Made-up two-number vectors so the arithmetic fits on screen. Real models learn how to compute each token's query, key and value; nobody sets them by hand."));
  draw();
});

/* ---- L7: a transformer, animated ---- */
defineMount("xformer", (root) => {
  const T = ["The", "cat", "sat", "because", "it"], XS = [70, 165, 260, 355, 450];
  const blocks = [{ a: 300, m: 262, n: "Block 1" }, { a: 212, m: 174, n: "Block 2" }, { a: 104, m: 66, n: "Last block" }];
  const svg = sv("svg", { viewBox: "0 0 640 400", class: "xf-svg", role: "img", "aria-label": "Animated transformer: five token columns flow upward through repeated blocks of attention, which links columns, and feed-forward networks, which process each column separately, ending in next-token predictions" });
  const g = [];
  XS.forEach((x) => g.push(sv("line", { class: "col", x1: x, y1: 342, x2: x, y2: 48 }), sv("line", { class: "flowup", x1: x, y1: 342, x2: x, y2: 48 })));
  blocks.forEach((b) => {
    g.push(sv("rect", { class: "band", x: 36, y: b.a - 14, width: 452, height: 26, rx: 6 }), sv("text", { class: "band-l", x: 500, y: b.a + 4, text: "attention" }));
    for (let j = 1; j < XS.length; j++) for (let i = 0; i < j; i++) if (j === XS.length - 1 || j - i === 1) g.push(sv("path", { class: "arc", d: `M${XS[i]} ${b.a + 4} Q${(XS[i] + XS[j]) / 2} ${b.a - 22 - (j - i) * 4} ${XS[j]} ${b.a + 4}` }));
    XS.forEach((x) => g.push(sv("rect", { class: "mlpbox", x: x - 20, y: b.m - 9, width: 40, height: 18, rx: 4 })));
    g.push(sv("text", { class: "band-l", x: 500, y: b.m + 4, text: "feed-forward" }), sv("text", { class: "band-l", x: 500, y: b.a - 20, style: "fill:var(--muted)", text: b.n }));
  });
  g.push(sv("rect", { x: 70, y: 134, width: 380, height: 20, rx: 10, fill: "var(--panel)", stroke: "var(--line)" }),
    sv("text", { class: "band-l", x: 260, y: 148, "text-anchor": "middle", style: "fill:var(--muted)", text: "⋮  the same block repeats, dozens to 100+ times  ⋮" }));
  XS.forEach((x, i) => g.push(sv("rect", { class: "emb", x: x - 34, y: 344, width: 68, height: 20, rx: 4 }), sv("text", { class: "tok", x, y: 358, text: T[i] }), sv("text", { class: "band-l", x, y: 384, "text-anchor": "middle", style: "fill:var(--muted)", text: "embedding" })));
  g.push(sv("rect", { class: "pulse", x: 30, y: 340, width: 462, height: 14, rx: 7 }));
  g.push(sv("path", { d: "M450 46 L450 30 L500 30", fill: "none", stroke: "var(--c)", "stroke-width": 1.6 }),
    sv("text", { class: "pred", x: 506, y: 26, text: "next token:" }),
    sv("text", { class: "pred", x: 506, y: 42 }, sv("tspan", { class: "predhi", text: "was" }), " 38% · had 11%"));
  svg.append(...g);
  root.append(h("div", { style: "overflow-x:auto" }, h("div", { style: "min-width:520px" }, svg)),
    h("div", { class: "scene-bar" }, h("span", { class: "scene-hint" }, "Swipe sideways on small screens."), primerPause(root)),
    h("p", { class: "note-s" }, "Pink arcs: attention moving information between tokens (only a few are drawn; each token can look at all earlier ones). Boxes: each token's own feed-forward network. Upward lines: the running notes. Prediction numbers are illustrative."));
});

/* ---- L8: one sentence, graded ---- */
defineMount("gradeone", (root) => {
  const W = ["The", "cat", "sat", "on", "the", "mat", "."];
  const TR = [0.02, 0.15, 0.55, 0.7, 0.25, 0.45];
  const UN = 1 / 128000;
  let mode = "un";
  const table = h("table", { class: "tt-table" });
  const foot = h("p", { class: "tt-foot", "aria-live": "polite" });
  const pct = (p) => (p >= 0.01 ? Math.round(p * 100) + "%" : (p * 100).toFixed(4) + "%");
  function draw() {
    const ps = mode === "un" ? TR.map(() => UN) : TR;
    const ls = ps.map((p) => -Math.log(p));
    table.replaceChildren(h("thead", {}, h("tr", {}, ["text so far", "next word", "probability", "loss"].map((t) => h("th", {}, t)))),
      h("tbody", {}, ...ps.map((p, i) => h("tr", {},
        h("td", { class: "tt-ctx" }, W.slice(0, i + 1).join(" ") + " …"),
        h("td", { class: "tgt" }, W[i + 1] === "." ? "“.”" : W[i + 1]),
        h("td", { class: "num" }, h("span", {}, pct(p)), h("span", { class: "tt-bar", style: `width:${Math.max(2, p * 100)}%` })),
        h("td", { class: "num" }, ls[i].toFixed(1))))));
    const avg = ls.reduce((a, b) => a + b) / ls.length;
    foot.innerHTML = mode === "un"
      ? `Average loss: <b>${avg.toFixed(1)}</b>. An untrained model spreads its bets roughly evenly over ~128,000 tokens, so every right answer gets about 0.0008%.`
      : `Average loss: <b>${avg.toFixed(2)}</b>. Much better, but not perfect: “mat” was only one of many reasonable endings, so some loss can never go away.`;
  }
  const seg = segmented({ label: "Model", options: [{ value: "un", label: "Untrained" }, { value: "tr", label: "Trained" }], value: mode, onChange: (v) => { mode = v; draw(); } });
  root.append(seg.el, h("div", { class: "tt-wrap", style: "margin-top:12px" }, table), foot,
    h("p", { class: "note-s" }, "Words shown as whole tokens for readability. Trained-model probabilities are illustrative."));
  draw();
});

/* ---- L8: backpropagation, animated ---- */
defineMount("backprop", (root) => {
  const L = [[60, [50, 110, 170]], [230, [35, 85, 135, 185]], [400, [80, 150]]];
  const svg = sv("svg", { viewBox: "0 0 560 225", class: "bp-svg", role: "img", "aria-label": "A small network: signals flow forward to make a guess, the guess is graded, blame flows backward, and the weights are updated" });
  const edges = [];
  for (let l = 0; l < 2; l++) for (const y1 of L[l][1]) for (const y2 of L[l + 1][1]) { const e = sv("line", { class: "edge", x1: L[l][0] + 14, y1, x2: L[l + 1][0] - 14, y2 }); edges.push(e); svg.append(e); }
  const r = rng(3);
  const widths = edges.map(() => 0.8 + r() * 2.6);
  L.forEach(([x, ys], l) => ys.forEach((y) => svg.append(sv("circle", { class: "n" + (l === 2 ? " o" : ""), cx: x, cy: y, r: 14 }))));
  svg.append(sv("text", { x: 60, y: 218, text: "inputs" }), sv("text", { x: 230, y: 218, text: "hidden neurons" }), sv("text", { x: 400, y: 218, text: "scores" }),
    sv("text", { x: 452, y: 84, "text-anchor": "start", style: "fill:var(--text)", text: "“rug” 60%" }), sv("text", { x: 452, y: 154, "text-anchor": "start", style: "fill:var(--text)", text: "“mat” 25%" }),
    sv("g", { class: "grade" }, sv("text", { x: 452, y: 102, "text-anchor": "start", style: "fill:var(--bad)", text: "↓ should be lower" }), sv("text", { x: 452, y: 172, "text-anchor": "start", style: "fill:var(--good)", text: "↑ right answer" })));
  const PH = [["1 · Forward", "Signals flow through the weights to make a guess.", "fwd"], ["2 · Grade", "Compare with the word that actually came next.", "grd"], ["3 · Backward", "Blame flows back along every connection.", "bwd"], ["4 · Update", "Every weight is nudged a little.", "upd"]];
  let ph = 0, timer = 0;
  const list = h("ol", { class: "bp-phases" });
  const play = button("Play", () => {
    if (timer) { stopP(); return; }
    play.setLabel("Pause", "pause");
    timer = setInterval(() => { ph = (ph + 1) % 4; draw(); }, 1900);
  }, { kind: "primary", icon: "play" });
  function stopP() { clearInterval(timer); timer = 0; play.setLabel("Play", "play"); }
  function draw() {
    svg.classList.remove("fwd", "grd", "bwd");
    if (PH[ph][2] !== "upd") svg.classList.add(PH[ph][2]);
    else widths.forEach((w, i) => { widths[i] = clamp(w + (r() - 0.5) * 1.2, 0.6, 4); });
    edges.forEach((e, i) => e.setAttribute("stroke-width", widths[i].toFixed(2)));
    list.replaceChildren(...PH.map(([t, d], j) => h("li", {}, h("button", {
      type: "button", class: j === ph ? "on" : "", "aria-current": j === ph ? "step" : "false",
      onclick: () => { stopP(); ph = j; draw(); },
    }, h("b", {}, t), d))));
  }
  root.append(svg, list, h("div", { class: "btn-row" }, play), h("p", { class: "note-s" }, "Line thickness shows weight size. In a real model this cycle runs once per training step, over billions of weights at once."));
  draw();
});

/* ---- L9: what you see vs what the model sees ---- */
defineMount("transcript", (root) => {
  root.innerHTML = `<div class="np-grid">
    <div><p class="mini-cap">What you see</p>
      <div class="chat"><div class="bubble me">Why is the sky blue?</div><div class="bubble ai">Sunlight scatters off air molecules, and blue light scatters the most…</div><div class="bubble me">So why are sunsets red?</div></div></div>
    <div><p class="mini-cap">What the model actually sees</p>
<pre class="transcript" style="white-space:pre-wrap"><span class="t-mark">&lt;|system|&gt;</span>You are a helpful assistant. Be accurate and concise.<span class="t-mark">&lt;|end|&gt;</span>
<span class="t-mark">&lt;|user|&gt;</span>Why is the sky blue?<span class="t-mark">&lt;|end|&gt;</span>
<span class="t-mark">&lt;|assistant|&gt;</span>Sunlight scatters off air molecules, and blue light scatters the most…<span class="t-mark">&lt;|end|&gt;</span>
<span class="t-mark">&lt;|user|&gt;</span>So why are sunsets red?<span class="t-mark">&lt;|end|&gt;</span>
<span class="t-mark">&lt;|assistant|&gt;</span><span class="t-cursor" aria-hidden="true"></span></pre></div></div>
  <p class="ts-note">Marker names differ between models; these are illustrative. The system prompt is written by the app's makers, and you normally don't see it. The model continues from the cursor.</p>`;
});

/* ---- L10: context-window budget ---- */
defineMount("ctxbudget", (root) => {
  const WIN = 128000;
  const PARTS = [["Instructions and tool descriptions", "var(--faint)"], ["Conversation so far", "var(--l7)"], ["Documents and tool results", "var(--l5)"], ["Room for the reply", "var(--warn)"]];
  const SC = { chat: [1500, 2500, 0, 800], docs: [1500, 600, 12000, 1000], agent: [12000, 4000, 70000, 2000] };
  const bar = h("div", { class: "ctx-bar", role: "img" });
  const segs = PARTS.map(([, c]) => h("span", { class: "ctx-seg", style: `background:${c}` }));
  const empty = h("span", { class: "ctx-seg" });
  bar.append(...segs, empty);
  const legend = h("ul", { class: "legend" });
  const total = h("p", { class: "ctx-total", "aria-live": "polite" });
  function draw(k) {
    const v = SC[k], used = v.reduce((a, b) => a + b);
    v.forEach((n, i) => { segs[i].style.flexGrow = n; segs[i].hidden = n === 0; });
    empty.style.flexGrow = WIN - used;
    bar.setAttribute("aria-label", PARTS.map(([t], i) => `${t}: ${fmtInt(v[i])} tokens`).join("; "));
    legend.replaceChildren(...PARTS.map(([t, c], i) => h("li", {}, h("i", { style: `background:${c}` }), h("span", {}, t), h("b", { class: "lg-val" }, fmtInt(v[i])))));
    total.innerHTML = `Using <b>${fmtInt(used)}</b> of a ${fmtInt(WIN)}-token window (${Math.round(used / WIN * 100)}%). Every token the model writes looks back over all of it.`;
  }
  const OPTS = [["Simple chat", "chat"], ["Questions about your documents", "docs"], ["Coding agent, mid-task", "agent"]];
  const chips = h("div", { class: "chips", role: "group", "aria-label": "Scenario" }, OPTS.map(([t, k]) => h("button", { type: "button", class: "chip", "data-k": k, "aria-pressed": String(k === "chat") }, t)));
  chips.addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (!c) return; $$(".chip", chips).forEach((x) => x.setAttribute("aria-pressed", String(x === c))); draw(c.dataset.k); });
  root.append(chips, bar, legend, total, h("p", { class: "note-s" }, "Illustrative token counts. Context windows for leading models ranged from about 128,000 to over a million tokens as of 2026."));
  draw("chat");
});
