# The AI Stack: From Electrons to Answers — build plan (v2, explorable edition)

An explorable explanation of modern AI, from the power plant to the chatbot reply, for a curious
non-specialist who learns by tinkering. Every layer is built around something to manipulate; the text is
short and sits beside the visual.

This plan replaces the v1 plan (a text-first field guide with nine figures). Facts that v1 already
checked (IEA figures, Llama 3 numbers, KV-cache arithmetic and so on) carry over; the page is rebuilt
around ~25 live interactives.

---

## 1. Deliverable and architecture

- **Output:** `index.html`, one self-contained file with inline CSS and JS. No libraries: every chart,
  simulation and 3-D view is hand-written canvas/SVG, which keeps the page small, offline-capable
  (fonts aside) and free of version drift.
- **Only network request:** Google Fonts, with full system fallback stacks.
- **No browser storage.**
- **Source layout** (for maintainability; `index.html` is generated, never hand-edited):
  ```
  src/head.html       <title>, meta, font links
  src/styles.css      tokens, layout, control language, per-figure styles
  src/body.html       all markup and text
  src/js/*.js         core kit, navigation, one file per layer + cross-cutting pieces
  src/data/*.txt      generated data (BPE merge table)
  tools/build.py      inlines everything into index.html (and an artifact variant)
  tools/train_bpe.py  trains the tokenizer's merge table from English word frequencies
  ```
- **Runtime kit** (`00-core.js`), shared by every interactive:
  - `Loop`: one `requestAnimationFrame` loop; each animated figure registers a `tick(dt)`.
    An `IntersectionObserver` marks figures visible; offscreen or hidden-tab figures are not ticked,
    and the loop stops completely when nothing visible is animating.
  - `Stage`: canvas wrapper with device-pixel-ratio handling, `ResizeObserver`, and pointer helpers
    (unified mouse/touch/pen via Pointer Events, with `touch-action` set so vertical scroll still works).
  - Controls: `slider()` (linear or log mapping, tick labels, live readout, keyboard via native range input),
    `segmented()` (radio group styled as pills), `button()`, `toggle()`, `readout()` (tweened numbers).
  - `predict()`: the "predict, then play" card. A question, 2–4 guesses to tap, then a reveal that can also
    drive the figure to the relevant state ("Show me").
  - `theme`: reads colors from CSS custom properties and notifies figures to redraw on theme change.
  - Formatting: SI units (W → kW → MW → GW), counts (1.2 million, 3.8 × 10²⁵), money, durations.
  - `prefers-reduced-motion`: particles and tweens drop to still frames; state changes stay instant.

---

## 2. Page structure

Reading order is top to bottom, but the reader is **climbing**: Layer 1 (Energy) is first on the page and
drawn at the *bottom* of the stack diagram. The stack diagram's marker rises as you scroll down.

1. **Hero** — title, one-line thesis, an animated 10-slab stack with particles rising through it
   (electrons in at the bottom, words out at the top). Each slab is clickable. Two buttons: *Start at the
   bottom* and *Follow one prompt*.
2. **How to read this page** — three short lines: everything is live; `~` = estimate, dates matter;
   toy models are labeled "Simplified".
3. **Layers 1–4 (hardware, warm colors)**
4. **Interlude: the scale zoom** — one continuous zoom from a transistor to a campus. Sits at the
   hardware/software boundary because it ties Layers 1–4 together.
5. **Layers 5–10 (software, cool colors)**
6. **Finale: Follow one prompt** — the whole stack, down and back up, with a running tally.
7. **Open questions and limits**
8. **Sources and notes**

### Persistent stack diagram
- **Desktop (≥ 1180 px):** fixed left rail. Ten slabs, Layer 1 at the bottom, drawn as a warm-to-cool
  gradient column. The current layer's slab expands with its name; hovering any slab shows its name and
  one-line summary; clicking scrolls there. Markers for the zoom interlude (between 4 and 5) and the
  finale (above 10). A thin "altitude" line fills as you climb.
- **Tablet and phone:** a bottom "elevator" bar: color chip, `Layer 3 · Silicon`, ▲/▼ buttons to move one
  floor, and a *Stack* button that opens a sheet showing the full stack for jumping.
- Keyboard: every slab is a link; the elevator buttons are real buttons.

### Anatomy of each layer section
1. Kicker `Layer N / 10` + name + **one-sentence plain-language summary**.
2. **Spec plate:** one or two striking numbers, rounded, estimates marked `~`/"est.", dated where needed.
3. **Bench(es):** the interactive centerpiece(s). Each bench is a figure (visual + controls + live readouts)
   with a narrow side column holding a *Predict* card and/or 1–2 short explanation blocks. Across the
   layer there are 2–3 explanation blocks in total. On phones the side column stacks under the figure.
4. **Analogy chip** with an explicit *Where it breaks* line.
5. **Go deeper:** `<details>` panels for detail, math and caveats.
6. Every figure ends with a **Simplified** line saying what the toy model leaves out.

---

## 3. Layers and interactives

Format: **Controls** → what the reader manipulates. **Updates** → what recomputes. **Insight** → what they
should walk away with. **Predict** → the question posed before playing (where it helps).
**Simplified** → the honesty label.

### Layer 1 · Energy — *Every answer starts as electricity, and almost all of it ends up as heat.*
Numbers: ~1.5% of world electricity went to data centers in 2024 (IEA), projected ~2× by 2030;
the largest AI campuses being built as of 2026 are ~1 GW, about one large nuclear reactor.

**1a. Cluster power meter**
- Controls: log slider 1 → 100,000 GPUs with named stops (1 GPU · 1 server = 8 · 1 rack = 72 · a hall
  ≈ 10,000 · frontier cluster = 100,000). Cooling toggle: Air | Liquid.
- Updates: IT power (W → kW → MW, tweened), facility power (IT × PUE), homes-equivalent (with a grid of
  house icons, each icon worth 1/10/100/1000 homes as the scale grows), heat to remove, coolant flow
  (water L/min or air m³/s), racks needed and floor area (air racks top out around 30–40 kW, liquid
  ~130 kW), stacked bar of where each watt goes (chips / cooling / other overhead).
- Visual: canvas cross-section of a rack. Electricity particles flow in; heat particles flow out. Air
  mode: fans, cool air in at the front, hot air rising out the back. Liquid mode: a cold-plate loop with
  blue → red coolant. Particle rate scales (logarithmically) with power.
- Insight: power grows linearly with chips, so a frontier cluster draws as much as a small city;
  nearly every watt becomes heat; liquid cooling is what makes 100+ kW racks possible.
- Predict: "One GPU (with its share of the server) draws about as much as a space heater. How many
  homes' worth of power does a 100,000-GPU cluster use?" 1,000 / 10,000 / 100,000+.
- Simplified: ~1.5 kW per GPU all-in; typical PUE 1.5 (air) vs 1.15 (liquid); US average home ≈ 1.2 kW.

### Layer 2 · Data centers — *A data center wires thousands of chips into one computer, and the network decides how fast they can work together.*
Numbers: 100,000+ GPUs in the largest clusters (2026); chips talk ~10–20× faster inside a rack than between racks.

**2a. Build-a-cluster sandbox**
- Controls: Add rack / Remove rack (2–12), Add / remove spine switch (1–4). Tap a solid link to cut it,
  tap a dashed link to connect it. New racks arrive with a single uplink, so the reader has to wire them
  up (and sees what happens if they don't). Auto-wire and Reset buttons.
- Updates: every training step animates (GPUs glow during compute, packets flow on links during the
  gradient sync). Per step: compute time + sync time. Sync time = ring all-reduce limited by the
  **slowest rack's** uplink bandwidth, plus a latency term that grows with rack count. Readouts: step
  time, training speed (relative tokens/s), speedup vs one rack and vs ideal, and a live strip chart of
  training speed so a cut link shows up as a visible drop. The straggler rack is outlined in red;
  a rack with zero links stalls the whole job.
- Insight: in synchronous training, the whole cluster moves at the pace of its slowest link.
- Predict: "Rack 3 loses one of its four uplinks. Does training slow by 1/48th (one link of 48) or by more?"
- Simplified: one leaf-spine network, ring all-reduce, no overlap of compute and communication.

### Layer 3 · Silicon — *Chips are printed onto ultra-pure silicon, tens of billions of switches at a time, and a single speck of dust can ruin one.*
Numbers: 208 billion transistors on NVIDIA's B200 (2024); one company (ASML) builds every EUV scanner, ~$200M+ each.

**3a. Shrinking transistors**
- Controls: slider across 11 landmark chips, 1971 → 2024 (Intel 4004, 386, Pentium, Pentium 4, Core 2,
  GTX 480, P100, V100, A100, H100, B200), with smooth interpolation between them.
- Updates: a "lens" that shows transistor-sized cells at true relative scale, with a scale bar and a
  reference object that fits the current scale (human hair → red blood cell → bacterium → virus);
  the chip's transistor count, die area, and average area per transistor; a log chart of transistor count
  vs year with the current chip highlighted; the node label next to the actual gate pitch.
- Insight: counts grew ~100-million-fold since 1971; each transistor (with its wiring) now occupies a
  square ~100 nm across, smaller than most viruses. "3 nm" is a marketing label.
- Simplified: area per transistor = die area ÷ transistor count (includes wiring and memory).

**3b. Wafer yield simulator**
- Controls: defect density (0.02 → 2 per cm², log), die size (50 → 858 mm², the reticle limit),
  *New wafer* (re-roll defects).
- Updates: a 300 mm wafer with gridded dies; random defects (Poisson) drawn as specks; good dies lit,
  hit dies dark. Readouts: dies per wafer, good dies, yield (sampled and the e^(−D·A) model), cost per good
  die at ~$20,000 per wafer. Small chart of cost per good die vs die size, current point marked.
- Insight: big chips cost disproportionately more (fewer per wafer *and* each more likely to be hit),
  which is why the biggest AI chips are two dies joined in one package.
- Predict: "Double the die area. Does the cost per good chip double?"
- Simplified: no defect clustering, no salvaging partly-bad dies ("binning"), no edge losses beyond whole dies.

### Layer 4 · Chips — *AI chips win by doing thousands of simple multiplications at once, and then spend much of their time waiting for data.*
Numbers: ~10¹⁵ 16-bit operations per second per H100-class chip; ~300 operations needed per byte fetched to keep it busy.

**4a. CPU vs GPU race**
- Controls: matrix size (8 → 64), Race button, Reset.
- Updates: two output grids fill in as cores compute cells. CPU: 16 fast cores. GPU: 1,024 slow cores
  plus a fixed launch overhead. Timers and a speedup readout.
- Insight: every output cell of a matrix multiply is independent, so thousands of simple cores win
  once the matrix is big enough; for tiny jobs the CPU wins.
- Predict: "For an 8×8 matrix, who wins?"
- Simplified: GPU core 4× slower than a CPU core; fixed launch overhead; no caches.

**4b. The memory wall**
- Controls: memory bandwidth (0.5 → 16 TB/s, log), workload preset (chat for one user · batch of 32 ·
  batch of 256 · training) or a free "operations per byte" slider.
- Updates: animated chip: HBM stacks feed a pipe (width ∝ bandwidth) into a grid of compute tiles; tiles
  light only when fed. Readouts: achieved TFLOPS = min(peak, bandwidth × intensity), utilization %,
  tokens/s for a 70B model. A roofline chart with the operating point.
- Insight: generating text for one user is memory-bound; faster math does nothing unless memory
  gets faster or work is batched.
- Predict: "Double the chip's math speed. How much faster does a one-user chat get?"

### Layer 5 · Systems software — *Software turns a few lines of Python into billions of scheduled operations, and splits one model across thousands of chips.*
Numbers: ~40% of peak actually used training Llama 3 405B; one unexpected interruption every ~3 hours on 16,000 GPUs.

**5a. Split the model**
- Controls: strategy (Data · Tensor · Pipeline), GPUs (2 · 4 · 8 · 16), model size (1B · 7B · 70B),
  link (fast in-rack · slow between racks), micro-batches (pipeline only).
- Updates: GPU boxes show what each holds (full copy / a slice of every layer / a few whole layers);
  memory bar per GPU against 80 GB (overflows turn red: "doesn't fit"); a per-GPU timeline (Gantt) for one
  step: compute, communication, idle bubble; readouts: step time, speedup, efficiency, communication share.
- Insight: every split trades memory, communication and idle time. Real runs combine all three:
  tensor inside a rack, pipeline across nearby racks, data across the rest.
- Simplified: proportioned-but-made-up constants; no overlap; no optimizer-state sharding.

### Layer 6 · Data — *Models learn from trillions of words, heavily filtered and then chopped into numbered pieces called tokens.*
Numbers: ~15 trillion tokens for Llama 3 (≈ 250,000 years of reading); ~¾ of an English word per token.

**6a. Tokenizer playground** — a *real* byte-pair-encoding tokenizer trained for this page.
- Controls: text box (presets: plain English, a rare word, "strawberry", numbers, code, emoji, Spanish,
  German, Hindi), a **vocabulary slider** (256 → full vocabulary) that replays BPE with fewer or more
  merges, toggles for IDs and visible spaces.
- Updates: colored token chips with IDs; counts of characters, words, tokens, tokens per word;
  step-through of merges for a clicked word.
- Insight: tokens are statistical chunks, not words; bigger vocabularies mean fewer tokens; rare words,
  numbers, and non-English text break into more pieces (and cost more).
- Simplified: vocabulary ~4k tokens trained on English word frequencies; real vocabularies are 100k–250k.

**6b. Filter the web**
- Controls: toggles for each pipeline stage (language ID · dedupe · length/boilerplate rules · quality
  classifier with a threshold slider · safety filter · PII scrubbing).
- Updates: a field of ~400 document dots flows through the stages; rejected dots fall out, color-coded
  by reason; survivor counts and % per stage; a quality vs diversity meter; tap a dot to read its snippet.
- Insight: most of the raw web is discarded (often ~90%); every filter is a judgment call that trades
  quantity for quality and can carry bias (e.g., strict quality filters drop dialects and other languages).
- Simplified: synthetic documents with plausible proportions.

### Layer 7 · The model — *A model is a huge stack of simple arithmetic whose billions of numbers were learned, not written.*
Numbers: 405 billion parameters in Llama 3.1 405B (~810 GB at 16 bits); ~80% of them in feed-forward blocks.

**7a. Neural-network playground**
- Controls: dataset (two groups · XOR · circle), hidden neurons (1–6), drag any connection up/down to
  change its weight (or select it and use the slider), bias per neuron, *Learn* / *Step* / *Scramble*.
- Updates: output heatmap over the input plane with data points; each hidden neuron shows its own
  mini-map; edge color/thickness = weight; loss and accuracy.
- Insight: each weight is a knob; neurons draw straight lines, layers combine them into curves;
  learning is turning all the knobs automatically. XOR needs a hidden layer.

**7b. Embedding map**
- Controls: hover/tap a word for its nearest neighbors; build A − B + C (presets: king − man + woman,
  Paris − France + Japan, walked − walk + swim, puppy − dog + cat).
- Updates: arrows drawn on the 2-D map; nearest words to the result computed by cosine similarity in
  the full hand-built vector space, with scores.
- Insight: meaning becomes geometry; directions can encode relationships (only approximately).
- Simplified: 12-number vectors built by hand, projected to 2-D; input words excluded from results
  (as in the classic demo).

**7c. Attention visualizer**
- Controls: hover/tap/focus a word; head selector (4 heads: previous word · who is "it"? · verb → subject ·
  first-token "sink"); sentence toggle ("…too tired" / "…too wide"); arcs vs matrix view.
- Updates: arcs from the word to earlier words, thickness = weight; the full attention matrix with the
  selected row highlighted.
- Insight: each token pulls information from earlier tokens; different heads look for different
  things in parallel; "it" gets resolved by later words.
- Simplified: hand-set attention scores run through a real softmax; real heads are messier.

### Layer 8 · Training — *Training shows the model trillions of examples, measures how wrong each guess was, and nudges every number to be a little less wrong.*
Numbers: ~4 × 10²⁵ operations to train Llama 3.1 405B; ~31 million GPU-hours.

**8a. Loss landscape**
- Controls: learning rate (log, 0.003 → 3), optimizer (plain / momentum), Run · Step · Reset, click or tap
  the map to set a starting point; view: top-down map | 3-D (drag to rotate).
- Updates: optimizer path, current loss, step count, mini loss curve; divergence detected and shown.
- Insight: learning rate is a step size: too small crawls, too big zig-zags, past a threshold it explodes.
- Predict: "What happens if you double the learning rate from 0.4?"
- Simplified: two parameters instead of billions; the true loss surface shifts with every batch.

**8b. Watch a network learn** (draw a curve, a tiny network fits it live)
- Controls: draw a target curve with finger/mouse (or presets: wave, step, bump); neurons (1–24);
  learning rate; Train / Pause / Reset weights.
- Updates: the network's current fit over the curve, faint traces of each hidden neuron's contribution,
  a live loss curve (log scale), step counter.
- Insight: the network builds the curve out of simple bends; more neurons fit more detail; the loss
  falls fast then slowly.

**8c. Scaling-law explorer**
- Controls: parameters (10M → 10T, log), training tokens (1B → 100T, log), or lock compute and slide the
  size/data split.
- Updates: predicted loss (Chinchilla fit L = E + A/N^α + B/D^β), compute (6ND), GPU-hours, cost, energy;
  a heatmap of loss over (parameters, tokens) with iso-compute lines, the compute-optimal line (~20 tokens
  per parameter) and reference models (GPT-3, Chinchilla, Llama 3 8B/405B).
- Insight: loss falls predictably with scale, with diminishing returns; for a fixed budget there is a
  best model size.
- Simplified: a 2022 fit for one model family; cost assumes H100-class GPUs at 40% utilization and ~$2/hour.

### Layer 9 · Inference — *To answer, the model scores every possible next token, picks one, appends it, and repeats.*
Numbers: ~0.3 Wh per typical short query (2025 estimates); ~0.3 MB of KV cache per token for a 70B model.

**9a. Next-token generator**
- Controls: temperature (0 → 2), top-p (0.05 → 1), Sample, Greedy, tap any bar to choose that token
  yourself, Undo, Reset, prompt presets.
- Updates: bar chart of the top candidates with probabilities after temperature and top-p (excluded
  tokens greyed out, cutoff line), the growing text, a "surprise" readout for each chosen token.
- Model: a tiny trigram language model trained at load time on ~80 sentences written for this page,
  with interpolation (trigram + bigram + unigram), so every path has a long tail. Real computation.
- Insight: the model outputs odds, the sampler picks; low temperature is safe but repetitive, high
  temperature turns to word salad; top-p trims the tail.

**9b. Context window**
- Controls: window size (24 → 96 tokens), add a user message / a model reply / paste a document,
  then ask "What's my name?".
- Updates: token slots fill; once full, the oldest tokens slide out of view (the name falls out);
  the answer changes depending on whether "Ada" is still inside the window.
- Insight: the model sees only what fits in its window; there is no other memory.

**9c. KV cache**
- Controls: Generate one token, Auto, cache on/off, Reset.
- Updates: a token × layer grid. Without the cache every step recomputes every previous token's keys
  and values (the whole triangle lights up); with it, only the new row is computed and older rows are
  read. Counters: computations (quadratic vs linear), cache memory (grows per token).
- Insight: reuse turns quadratic work into linear work, paid for with memory.

### Layer 10 · Applications — *Apps wrap the model in instructions, tools and memory; an agent is the model running in a loop.*
Numbers: ~800 million weekly ChatGPT users (late 2025); 36% success on a 20-step task if each step is 95% reliable.

**10a. Agent loop simulator**
- Controls: task (weather in °F · a unit conversion with a document lookup), Step · Play · Reset,
  failure switches per tool (works · times out · returns an error · returns wrong data · returns a hidden
  instruction), step budget.
- Updates: the loop diagram (Think → Call tool → Read result → Answer) with the active node lit; a
  transcript showing each message, including the literal tool-call JSON; counters for model calls,
  tokens used, and cost. Failures change the path: retry, fall back to another tool, sanity-check a
  suspicious result, ignore an injected instruction, or tell the user it could not finish.
- Insight: the model never touches the world; the app runs tools and pastes results back as text.
  Errors compound, so good agents check, retry and know when to stop.
- Side widget: reliability compounding (per-step success × number of steps).

### Interlude · Scale zoom
- Controls: one zoom slider (log, ~10 orders of magnitude), pinch/wheel on the canvas, level buttons.
- Levels (true relative sizes, plan view): transistor (~100 nm) → block of logic (~µm) → compute unit
  (~mm) → die (~28 mm) → GPU package with memory stacks → compute tray (4 GPUs) → rack (72 GPUs) →
  data hall → campus (100,000 GPUs).
- Updates: continuous zoom with each level drawn inside the next; scale bar; counts in view (transistors,
  GPUs, power, footprint).
- Insight: the same pattern repeats at every scale; the campus holds ~20 quadrillion transistors.

### Finale · Follow one prompt
- Controls: prompt preset (a quick question · an essay · a hard reasoning problem), Play/Pause,
  Previous/Next, step dots, speed.
- Updates: a glowing packet travels down the stack (app → tokens → scheduler → model → software →
  chips → transistors → network → power plant) and back up as streamed tokens, pausing at each layer
  with a short card; running tally of elapsed time, tokens, operations, energy (Wh), cost, and a
  plain comparison (seconds of a microwave, minutes of an LED bulb).
- Insight: one short answer touches every layer in a few seconds, for a fraction of a watt-hour;
  long reasoning multiplies it.

### Open questions and limits
Energy demand; supply-chain concentration; what models still get wrong; what we don't understand.

---

## 4. Visual identity

**Concept: an instrument panel for a machine the size of a city.** Dark instrument glass, readouts in
monospace, controls that feel like hardware, and a spectrum that runs warm (physical: power, heat,
silicon) to cool (abstract: software, models, language), with a visible break between Layer 4 and 5 where
hardware ends and software begins.

- **Neutrals (dark):** ground `#0d0c12`, panel `#15141c`, raised `#1d1b27`, line `#2d2a3a`,
  text `#ecebf2`, muted `#a4a0b4`, faint `#716c84`.
  **Light:** ground `#f6f6f9`, panel `#ffffff`, raised `#eeedf3`, line `#dcdae4`, text `#15131c`,
  muted `#5d5870`, faint `#8a8599`.
- **Layer hues** (dark / light, the light set darkened for ≥ 4.5:1 text contrast):
  1 Energy `#ff6b4a`/`#c2381f` · 2 Data centers `#ff8c3a`/`#b44f00` · 3 Silicon `#f0a52a`/`#9c5c00` ·
  4 Chips `#e2c044`/`#876c00` · 5 Software `#2fd0bd`/`#00796c` · 6 Data `#2cc4e6`/`#00758f` ·
  7 Model `#4fa9ff`/`#0063b8` · 8 Training `#7f93ff`/`#3f5bd0` · 9 Inference `#a987ff`/`#6b4cc9` ·
  10 Apps `#d77cf0`/`#9442a8`. Green is skipped on purpose: the gap marks the hardware/software line.
- Each section sets `--c` to its hue; headings, slider thumbs, active pills, chart marks and particles
  in that section use it.
- **Type:** *Archivo* at expanded width and heavy weight for display (layer names read like equipment
  nameplates) · *Instrument Sans* for body (a clean, slightly narrow grotesque that stays legible at small sizes) ·
  *Atkinson Hyperlegible Mono* for readouts, tick labels and spec plates.
- **Control language (learned once):** range sliders with a hue-filled track and a large ringed thumb,
  label left and live mono readout right; segmented pills for either/or choices; filled button = primary
  action (Run, Sample), outlined = secondary (Step, Reset); readouts = small uppercase label over a big
  mono number with its unit; *Predict* cards have a dashed border; *Simplified* lines start with a ◇ glyph.
- **Motion:** an ambient glow behind the page that shifts to the current layer's hue; the rail marker
  rising as you scroll; figures ease in with scroll-driven animation where supported (always visible at
  rest); tweened numbers on every change; particles only where they explain a flow (electricity, heat,
  data, gradients, tokens). `prefers-reduced-motion` stills them.
- **Layout:** 1180 px+: rail (210 px) + content (max 1080 px); each bench is a 2-column grid (figure
  ~64%, notes ~36%). Below 980 px notes stack under figures. Phone: 16 px gutters, controls wrap, canvases
  keep an aspect ratio with a minimum height, bottom elevator bar.

---

## 5. Accuracy rules
- Round numbers; `~` marks an approximation, "est." an outside estimate; date-sensitive figures say "as of".
- Every analogy carries a *Where it breaks* line.
- Every toy model says what it leaves out.
- No hype words; end with open questions and limits.

## 6. Passes
1. Plan (this document).
2. Skeleton: build tooling, structure, navigation, stack diagram, all text, placeholders.
3. Interactives, one layer at a time, each checked for extreme values, empty input, rapid clicks, touch.
4. Design and motion.
5. Accuracy review.
6. Play-test on a phone viewport; improve the five weakest pieces; fix bugs (console, overflow,
   contrast, performance).
