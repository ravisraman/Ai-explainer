/* =====================================================================
   Core kit: DOM helpers, theme colors, animation loop, canvas stage,
   controls (slider, segmented, button, readout), predict cards,
   number formatting and the mount registry.
   ===================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function h(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "text") n.textContent = v;
      else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : String(kid));
  }
  return n;
}

const SVGNS = "http://www.w3.org/2000/svg";
function sv(tag, attrs, ...kids) {
  const n = document.createElementNS(SVGNS, tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "text") n.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid);
  return n;
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
/* Frame-rate independent exponential approach toward a target. */
const approach = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);
let _uid = 0;
const uid = (p = "u") => `${p}${++_uid}`;

/* Small seeded PRNG so toy simulations are repeatable. */
function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* Poisson sample (Knuth for small means, normal approximation for large). */
function poisson(mean, rand = Math.random) {
  if (mean > 60) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gauss(rand)));
  const L = Math.exp(-mean);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}
function gauss(rand = Math.random) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const RM = window.matchMedia("(prefers-reduced-motion: reduce)");
const reducedMotion = () => RM.matches;

/* ---------- theme colors (read from CSS custom properties) ---------- */
const Theme = {
  c: {},
  dark: true,
  fns: new Set(),
  read() {
    const cs = getComputedStyle(document.documentElement);
    const keys = ["bg", "bg-2", "panel", "raised", "sunk", "line", "line-2", "text", "muted", "faint", "on-accent", "good", "bad", "warn"];
    for (const k of keys) this.c[k] = cs.getPropertyValue("--" + k).trim();
    for (let i = 1; i <= 10; i++) this.c["l" + i] = cs.getPropertyValue("--l" + i).trim();
    this.dark = cs.getPropertyValue("--is-dark").trim() !== "0";
    this.mono = cs.getPropertyValue("--font-mono").trim();
    this.body = cs.getPropertyValue("--font-body").trim();
    this.display = cs.getPropertyValue("--font-display").trim();
  },
  on(fn) { this.fns.add(fn); },
  changed() {
    this.read();
    for (const fn of this.fns) {
      try { fn(); } catch (err) { console.error(err); }
    }
  },
};
/* "#rrggbb" + alpha -> "rgba(...)" */
function rgba(hex, a) {
  if (!hex || hex[0] !== "#") return hex;
  let s = hex.slice(1);
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const n = parseInt(s, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
/* Mix two "#rrggbb" colors. */
function mix(h1, h2, t) {
  const p = (x) => { const n = parseInt(x.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const a = p(h1), b = p(h2);
  const c = a.map((v, i) => Math.round(lerp(v, b[i], t)));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/* ---------- animation loop: ticks only visible, active figures ---------- */
const Loop = {
  items: [],
  running: false,
  last: 0,
  add(el, tick, active) {
    const it = { el, tick, visible: false, active: active || (() => true) };
    this.items.push(it);
    this.io.observe(el);
    return it;
  },
  wake() {
    if (Loop.running) return;
    Loop.running = true;
    Loop.last = performance.now();
    requestAnimationFrame(Loop.frame);
  },
  frame(t) {
    const dt = Math.min(0.05, Math.max(0, (t - Loop.last) / 1000));
    Loop.last = t;
    let any = false;
    if (!document.hidden) {
      for (const it of Loop.items) {
        if (!it.visible || !it.active()) continue;
        any = true;
        try { it.tick(dt, t / 1000); } catch (err) { console.error(err); it.active = () => false; }
      }
    }
    if (any) requestAnimationFrame(Loop.frame);
    else Loop.running = false;
  },
};
Loop.io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) for (const it of Loop.items) if (it.el === e.target) it.visible = e.isIntersecting;
    Loop.wake();
  },
  { rootMargin: "80px 0px" }
);
document.addEventListener("visibilitychange", () => { if (!document.hidden) Loop.wake(); });

/* ---------- canvas stage with DPR + resize handling ---------- */
class Stage {
  constructor(parent, opts = {}) {
    this.opts = opts;
    this.wrap = h("div", { class: "stage" + (opts.drag ? " drag" : "") + (opts.cls ? " " + opts.cls : "") });
    this.canvas = h("canvas", { role: "img", "aria-label": opts.label || "" });
    this.wrap.append(this.canvas);
    parent.append(this.wrap);
    this.ctx = this.canvas.getContext("2d");
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    /* The observer's first callback does the initial sizing, after the
       figure's own setup code has finished running. */
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.wrap);
  }
  resize() {
    const w = Math.round(this.wrap.clientWidth);
    if (!w) return;
    const o = this.opts;
    const hh = Math.round(typeof o.height === "function" ? o.height(w) : o.height || w * 0.56);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && hh === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = hh;
    this.dpr = dpr;
    this.canvas.style.height = hh + "px";
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(hh * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (o.onResize) o.onResize(w, hh);
    if (o.draw) o.draw();
  }
  clear() { this.ctx.clearRect(0, 0, this.w, this.h); }
  /* Unified pointer handling in CSS pixels. */
  pointer(hd) {
    const c = this.canvas;
    let down = false;
    const pos = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    c.addEventListener("pointerdown", (e) => {
      down = true;
      if (hd.capture) { try { c.setPointerCapture(e.pointerId); } catch (_) {} }
      if (hd.down) hd.down(pos(e), e);
    });
    c.addEventListener("pointermove", (e) => { if (hd.move) hd.move(pos(e), e, down); });
    const end = (e) => { if (!down) return; down = false; if (hd.up) hd.up(pos(e), e); };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("pointerleave", (e) => { if (hd.leave) hd.leave(pos(e), e); });
  }
  tip(text, x, y) {
    if (!this.tipEl) { this.tipEl = h("div", { class: "stage-tip", "aria-hidden": "true" }); this.wrap.append(this.tipEl); }
    const t = this.tipEl;
    if (!text) { t.classList.remove("on"); return; }
    t.textContent = text;
    t.classList.add("on");
    const tw = t.offsetWidth, th = t.offsetHeight;
    let left = x + 12, top = y - th - 10;
    if (left + tw > this.w) left = x - tw - 12;
    if (top < 0) top = y + 14;
    t.style.left = clamp(left, 0, Math.max(0, this.w - tw)) + "px";
    t.style.top = top + "px";
  }
}

/* ---------- number formatting ---------- */
function roundSig(x, sig = 3) {
  if (x === 0 || !isFinite(x)) return x;
  const p = Math.pow(10, Math.floor(Math.log10(Math.abs(x))) - sig + 1);
  return Math.round(x / p) * p;
}
function fmtNum(x, sig = 3) {
  if (!isFinite(x)) return "∞";
  if (x === 0) return "0";
  const r = roundSig(x, sig);
  const dec = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(r))));
  return r.toLocaleString("en-US", { maximumFractionDigits: Math.min(dec, 6), minimumFractionDigits: 0 });
}
const fmtInt = (x) => Math.round(x).toLocaleString("en-US");
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n) => String(n).split("").map((c) => (c === "-" ? "⁻" : SUP[+c])).join("");
function fmtSci(x, sig = 2) {
  if (!isFinite(x)) return "∞";
  let e = Math.floor(Math.log10(x));
  let m = roundSig(x / Math.pow(10, e), sig);
  if (m >= 10) { m /= 10; e += 1; }
  return `${fmtNum(m, sig)} × 10${sup(e)}`;
}
const SI = [[1e15, "P"], [1e12, "T"], [1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""]];
/* 1500, "W" -> ["1.5", "kW"] */
function siParts(x, unit, sig = 3) {
  if (!isFinite(x)) return ["∞", unit];
  for (const [m, p] of SI) if (Math.abs(x) >= m * 0.9995) return [fmtNum(x / m, sig), p + unit];
  if (Math.abs(x) >= 1e-3 && Math.abs(x) < 1) return [fmtNum(x * 1e3, sig), "m" + unit];
  return [fmtNum(x, sig), unit];
}
const fmtSI = (x, unit, sig = 3) => siParts(x, unit, sig).join(" ");
const WORDS = [[1e18, "quintillion"], [1e15, "quadrillion"], [1e12, "trillion"], [1e9, "billion"], [1e6, "million"]];
function fmtWords(x, sig = 2) {
  for (const [m, w] of WORDS) if (x >= m * 0.9995) return `${fmtNum(x / m, sig)} ${w}`;
  return fmtInt(roundSig(x, Math.max(sig, 2)));
}
function fmtMoney(x) {
  if (!isFinite(x)) return "∞";
  if (x < 0.01) return "$" + fmtNum(x, 2);
  if (x < 1000) return "$" + fmtNum(x, 3);
  if (x < 1e6) return "$" + fmtInt(roundSig(x, 3));
  return "$" + fmtWords(x, 2);
}
function fmtDur(sec) {
  if (!isFinite(sec)) return "∞";
  if (sec < 1e-3) return fmtNum(sec * 1e6, 2) + " µs";
  if (sec < 1) return fmtNum(sec * 1e3, 2) + " ms";
  if (sec < 120) return fmtNum(sec, 2) + " s";
  if (sec < 7200) return fmtNum(sec / 60, 2) + " min";
  if (sec < 86400 * 3) return fmtNum(sec / 3600, 2) + " hours";
  if (sec < 86400 * 365 * 2) return fmtNum(sec / 86400, 2) + " days";
  return fmtWords(sec / (86400 * 365.25), 2) + " years";
}
const fmtPct = (x, d = 0) => (x * 100).toFixed(d) + "%";

/* Animate a number; tweens in log space for values that span decades. */
function tween(from, to, dur, fn, log) {
  if (reducedMotion() || !isFinite(from) || !isFinite(to) || from === to) { fn(to); return () => {}; }
  let id = 0;
  const t0 = performance.now();
  const useLog = log && from > 0 && to > 0;
  const a = useLog ? Math.log(from) : from, b = useLog ? Math.log(to) : to;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const v = lerp(a, b, easeOut(k));
    fn(k >= 1 ? to : useLog ? Math.exp(v) : v);
    if (k < 1) id = requestAnimationFrame(step);
  };
  id = requestAnimationFrame(step);
  return () => cancelAnimationFrame(id);
}

/* ---------- controls ---------- */
/*
  slider({ label, min, max, value, log, step, values, fmt, ticks, onInput })
  - log: logarithmic mapping over [min, max]
  - values: discrete list; the slider picks an index
  - ticks: [{ v, label }]
*/
function slider(o) {
  const id = o.id || uid("sl");
  const discrete = Array.isArray(o.values);
  const RES = 1000;
  const input = h("input", { type: "range", class: "range", id });
  if (discrete) { input.min = 0; input.max = o.values.length - 1; input.step = 1; }
  else if (o.log) { input.min = 0; input.max = RES; input.step = 1; }
  else { input.min = o.min; input.max = o.max; input.step = o.step || "any"; }

  const toPos = (v) => {
    if (discrete) { let best = 0; o.values.forEach((x, i) => { if (Math.abs(x - v) < Math.abs(o.values[best] - v)) best = i; }); return best; }
    if (o.log) return (Math.log(v / o.min) / Math.log(o.max / o.min)) * RES;
    return v;
  };
  const fromPos = (p) => {
    if (discrete) return o.values[Math.round(p)];
    let v = o.log ? o.min * Math.pow(o.max / o.min, p / RES) : p;
    if (o.round) v = o.round(v);
    return clamp(v, o.min, o.max);
  };
  const frac = (v) => {
    if (discrete) return toPos(v) / Math.max(1, o.values.length - 1);
    if (o.log) return toPos(v) / RES;
    return invLerp(o.min, o.max, v);
  };

  const out = h("output", { class: "ctl-val", for: id });
  const ticksEl = o.ticks ? h("div", { class: "ticks", "aria-hidden": "true" }) : null;
  if (ticksEl) {
    o.ticks.forEach((t, i) => {
      const f = frac(t.v);
      const span = h("span", { style: { left: `calc(11px + (100% - 22px) * ${f})` } }, t.label);
      if (f < 0.04 || i === 0) span.classList.add("first");
      if (f > 0.96 || i === o.ticks.length - 1) { span.classList.remove("first"); span.classList.add("last"); }
      if (f < 0.04) span.style.left = "0";
      if (f > 0.96) span.style.left = "100%";
      ticksEl.append(span);
    });
  }
  const labelEl = h("label", { class: "ctl-label", for: id }, o.label);
  const el = h("div", { class: "ctl" + (o.cls ? " " + o.cls : "") },
    h("div", { class: "ctl-top" }, labelEl, out),
    h("div", { class: "range-wrap" }, input, ticksEl));

  let value = o.value;
  const paint = () => {
    input.style.setProperty("--fill", (frac(value) * 100).toFixed(2) + "%");
    const txt = o.fmt ? o.fmt(value) : String(value);
    out.textContent = txt;
    input.setAttribute("aria-valuetext", txt);
  };
  input.addEventListener("input", () => {
    value = fromPos(+input.value);
    paint();
    if (o.onInput) o.onInput(value);
  });
  input.value = toPos(value);
  paint();
  return {
    el, input,
    get value() { return value; },
    set(v, fire) {
      value = discrete ? v : clamp(v, o.min, o.max);
      input.value = toPos(value);
      paint();
      if (fire && o.onInput) o.onInput(value);
    },
    refresh: paint,
  };
}

/* segmented({ label, options:[{value,label}], value, onChange }) */
function segmented(o) {
  const group = h("div", { class: "seg", role: "group", "aria-label": o.label || "" });
  let value = o.value;
  const btns = o.options.map((opt) =>
    h("button", {
      type: "button",
      "aria-pressed": String(opt.value === value),
      title: opt.title || null,
      onclick: () => api.set(opt.value, true),
    }, opt.label)
  );
  group.append(...btns);
  const el = o.label
    ? h("div", { class: "ctl ctl-seg" }, h("span", { class: "ctl-label" }, o.label), group)
    : group;
  const api = {
    el, group,
    get value() { return value; },
    set(v, fire) {
      value = v;
      o.options.forEach((opt, i) => btns[i].setAttribute("aria-pressed", String(opt.value === v)));
      if (fire && o.onChange) o.onChange(v);
    },
    buttons: btns,
  };
  return api;
}

const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  step: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v14l10-7zM16 5h3v14h-3z"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5v14L9 12zM5 5h3v14H5z"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.3 4H3l3.5-4.5L10 9H7.9A5 5 0 1 0 12 7z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14v2H5z"/></svg>',
  dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
};
/* button(label, onClick, { kind: "primary"|"", icon, small, title }) */
function button(label, onClick, opts = {}) {
  const b = h("button", {
    type: "button",
    class: "btn" + (opts.kind ? " " + opts.kind : "") + (opts.small ? " small" : ""),
    title: opts.title || null,
    "aria-label": opts.aria || null,
    onclick: onClick,
  });
  const setLabel = (text, icon) => {
    b.innerHTML = (icon ? ICONS[icon] : "") + (text ? `<span>${text}</span>` : "");
  };
  setLabel(label, opts.icon);
  b.setLabel = setLabel;
  return b;
}

/* stepper({ label, value, min, max, fmt, onChange }) -> compact − value + control */
function stepper(o) {
  let value = o.value;
  const val = h("output", { class: "stp-val" });
  const minus = h("button", { type: "button", class: "stp-btn", "aria-label": `Fewer ${o.label.toLowerCase()}`, html: ICONS.minus });
  const plus = h("button", { type: "button", class: "stp-btn", "aria-label": `More ${o.label.toLowerCase()}`, html: ICONS.plus });
  const el = h("div", { class: "ctl ctl-stp" }, h("span", { class: "ctl-label" }, o.label), h("div", { class: "stp" }, minus, val, plus));
  const paint = () => {
    val.textContent = o.fmt ? o.fmt(value) : String(value);
    minus.disabled = value <= o.min;
    plus.disabled = value >= o.max;
  };
  const change = (d) => {
    const v = clamp(value + d, o.min, o.max);
    if (v === value) return;
    value = v;
    paint();
    if (o.onChange) o.onChange(v, d);
  };
  minus.addEventListener("click", () => change(-1));
  plus.addEventListener("click", () => change(1));
  paint();
  return { el, get value() { return value; }, set(v) { value = v; paint(); } };
}

/* readout(label, { unit, sub, cls }) -> { el, set(text, unit?, sub?) } */
function readout(label, opts = {}) {
  const val = h("span", { class: "ro-num" }, "–");
  const unit = h("span", { class: "ro-unit" }, opts.unit || "");
  const sub = h("div", { class: "ro-sub" }, opts.sub || "");
  const el = h("div", { class: "ro" + (opts.cls ? " " + opts.cls : "") },
    h("div", { class: "ro-label" }, label),
    h("div", { class: "ro-val" }, val, unit),
    opts.sub !== undefined ? sub : null);
  return {
    el,
    set(text, u, s) {
      val.textContent = text;
      if (u !== undefined) unit.textContent = u;
      if (s !== undefined) sub.textContent = s;
    },
    state(cls) {
      el.classList.remove("hi", "bad", "good");
      if (cls) el.classList.add(cls);
    },
  };
}

/* Throttled polite announcements for screen readers. */
const Announcer = (() => {
  let el = null, timer = 0;
  return (msg) => {
    if (!el) { el = h("div", { class: "sr-only", "aria-live": "polite" }); document.body.append(el); }
    clearTimeout(timer);
    timer = setTimeout(() => { el.textContent = msg; }, 400);
  };
})();

/* ---------- mounts and actions ---------- */
const Mounts = {};
const Actions = {};
const defineMount = (name, fn) => { Mounts[name] = fn; };

function runAction(spec, originEl) {
  const i = spec.indexOf(":");
  const name = i < 0 ? spec : spec.slice(0, i);
  const arg = i < 0 ? "" : spec.slice(i + 1);
  const fn = Actions[name];
  if (!fn) return;
  fn(arg);
  const target = $(`[data-mount="${name}"]`);
  if (target) {
    const r = target.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      target.closest(".fig").scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
    }
  }
}

function initPredict() {
  for (const card of $$(".predict")) {
    const ans = +card.dataset.answer;
    const opts = $$(".predict-opts button", card);
    const a = $(".predict-a", card);
    const verdict = h("span", { class: "verdict" });
    const firstP = a.querySelector("p");
    if (firstP) firstP.prepend(verdict);
    let showBtn = null;
    opts.forEach((b, i) =>
      b.addEventListener("click", () => {
        card.classList.add("answered");
        opts.forEach((x, j) => {
          x.classList.toggle("right", j === ans);
          x.classList.toggle("picked", j === i);
          x.setAttribute("aria-pressed", String(j === i));
        });
        verdict.textContent = i === ans ? "Right. " : "Not quite. ";
        a.hidden = false;
        if (card.dataset.show && !showBtn) {
          showBtn = button("Show me", () => runAction(card.dataset.show, card), { small: true, kind: "primary" });
          a.append(h("div", { class: "btn-row" }, showBtn));
        }
      })
    );
  }
}

function boot() {
  Theme.read();
  for (const el of $$("[data-mount]")) {
    const fn = Mounts[el.dataset.mount];
    if (!fn) continue;
    try { fn(el); }
    catch (err) {
      console.error("Figure failed:", el.dataset.mount, err);
      el.replaceChildren(h("p", { class: "mount-error" }, "This figure failed to load."));
    }
  }
  initPredict();
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", () => requestAnimationFrame(() => Theme.changed()));
  new MutationObserver(() => requestAnimationFrame(() => Theme.changed()))
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => Theme.changed());
}
