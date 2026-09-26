/* =====================================================================
   Navigation: the persistent stack diagram (desktop rail), the phone
   elevator bar and sheet, scroll tracking, and the theme toggle.
   ===================================================================== */

const LAYERS = [
  { n: 1, id: "energy", name: "Energy", tag: "Power and cooling" },
  { n: 2, id: "datacenters", name: "Data centers", tag: "Racks and networks" },
  { n: 3, id: "silicon", name: "Silicon", tag: "Making chips" },
  { n: 4, id: "chips", name: "Chips", tag: "GPUs and memory" },
  { n: 5, id: "software", name: "Systems software", tag: "Kernels and parallelism" },
  { n: 6, id: "data", name: "Data", tag: "Text and tokens" },
  { n: 7, id: "model", name: "The model", tag: "Neurons and attention" },
  { n: 8, id: "training", name: "Training", tag: "Learning from mistakes" },
  { n: 9, id: "inference", name: "Inference", tag: "One token at a time" },
  { n: 10, id: "apps", name: "Applications", tag: "Chat, tools, agents" },
];

/* Every scroll stop in page order. */
const STOPS = [
  { id: "top", kind: "start", name: "Start", color: 1 },
  ...LAYERS.slice(0, 4).map((l) => ({ ...l, kind: "layer", color: l.n })),
  { id: "zoom", kind: "marker", name: "Zoom out", tag: "Transistor to campus", color: 4 },
  ...LAYERS.slice(4).map((l) => ({ ...l, kind: "layer", color: l.n })),
  { id: "journey", kind: "marker", name: "Follow one prompt", tag: "All ten layers", color: 10 },
  { id: "limits", kind: "end", name: "Open questions", tag: "Limits", color: 9 },
];

function stopLabel(s) {
  if (s.kind === "layer") return { kicker: `Layer ${s.n}`, name: s.name };
  if (s.kind === "marker") return { kicker: s.id === "zoom" ? "Interlude" : "Finale", name: s.name };
  if (s.kind === "end") return { kicker: "End", name: s.name };
  return { kicker: "The AI Stack", name: "Start at the bottom" };
}

function buildStackList(listEl, onPick) {
  const items = [];
  const add = (s) => {
    const a = h("a", {
      class: "slab" + (s.kind === "marker" ? " marker" : ""),
      href: "#" + s.id,
      style: `--sc: var(--l${s.color})`,
      "data-stop": s.id,
      title: s.tag ? `${s.name}: ${s.tag}` : s.name,
    },
      h("span", { class: "slab-n" }, s.kind === "layer" ? String(s.n) : ""),
      h("span", { class: "slab-bar", "aria-hidden": "true" }),
      h("span", { class: "slab-name" }, s.name));
    if (onPick) a.addEventListener("click", () => onPick(s));
    items.push(a);
    listEl.append(h("li", null, a));
  };
  STOPS.filter((s) => s.kind !== "start" && s.kind !== "end").forEach((s) => {
    add(s);
    if (s.id === "zoom") {
      listEl.append(h("li", { class: "rail-divider", "aria-hidden": "true" }, h("span", null, "Software ↑  Hardware ↓")));
    }
  });
  return items;
}

function initNav() {
  const root = document.documentElement;
  const railItems = buildStackList($("#railStack"));
  const sheet = $("#sheet");
  let lastFocus = null;
  const closeSheet = () => {
    sheet.hidden = true;
    if (lastFocus) lastFocus.focus();
  };
  const sheetItems = buildStackList($("#sheetStack"), () => closeSheet());
  const sections = STOPS.map((s) => document.getElementById(s.id));

  let cur = -1;
  const setCurrent = (i) => {
    if (i === cur) return;
    cur = i;
    const s = STOPS[i];
    for (const list of [railItems, sheetItems]) {
      for (const a of list) {
        const idx = STOPS.findIndex((x) => x.id === a.dataset.stop);
        a.classList.toggle("is-current", idx === i);
        a.classList.toggle("is-past", idx < i);
        if (idx === i) a.setAttribute("aria-current", "location");
        else a.removeAttribute("aria-current");
      }
    }
    const lab = stopLabel(s);
    $(".elev-kicker").textContent = lab.kicker;
    $(".elev-name").textContent = lab.name;
    $("#elevDown").disabled = i <= 0;
    $("#elevUp").disabled = i >= STOPS.length - 1;
    root.style.setProperty("--cur", Theme.c["l" + s.color] || "#ff6b4a");
  };
  Theme.on(() => { const i = cur; cur = -1; setCurrent(Math.max(0, i)); });

  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.innerHeight * 0.42;
    let i = 0;
    sections.forEach((sec, k) => { if (sec && sec.getBoundingClientRect().top <= y) i = k; });
    setCurrent(i);
  };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener("resize", update);
  update();

  const go = (i) => {
    const target = sections[clamp(i, 0, sections.length - 1)];
    if (target) target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  };
  $("#elevUp").addEventListener("click", () => go(cur + 1));
  $("#elevDown").addEventListener("click", () => go(cur - 1));
  $("#elevCur").addEventListener("click", () => {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    const current = sheet.querySelector(".is-current") || sheet.querySelector(".slab");
    if (current) current.focus();
  });
  $("#sheetClose").addEventListener("click", closeSheet);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });

  /* Theme toggle: flips to the opposite of whatever is showing now. */
  const syncThemeButtons = () => {
    for (const b of $$("[data-theme-toggle]")) {
      b.setAttribute("aria-label", Theme.dark ? "Switch to light theme" : "Switch to dark theme");
      b.title = Theme.dark ? "Light theme" : "Dark theme";
    }
  };
  for (const b of $$("[data-theme-toggle]")) {
    b.addEventListener("click", () => {
      root.setAttribute("data-theme", Theme.dark ? "light" : "dark");
      requestAnimationFrame(() => { Theme.changed(); syncThemeButtons(); });
    });
  }
  Theme.on(syncThemeButtons);
  syncThemeButtons();
}
