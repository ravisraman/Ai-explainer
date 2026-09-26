# The AI Stack: From Electrons to Answers — build plan

Single self-contained file: `index.html` (inline CSS + JS, SVG/canvas only, no storage, no external images).
Only external request: Google Fonts (with system fallbacks).

## Reading model

The page reads top-to-bottom, but the reader is *climbing* the stack: Layer 1 (Energy) comes first,
Layer 10 (Applications) last. A persistent stack diagram (left rail on desktop, bottom "elevator" bar
on phones) draws Layer 1 at the bottom and lights up the current layer as you scroll.

Every layer section has the same bones:

1. Kicker (`Layer N of 10`) + name + **one-sentence plain summary** (for skimmers)
2. **Spec plate**: 2 striking numbers, rounded, estimates labeled `~` / "est.", dated "as of 2026" where needed
3. Four questions: *What it is* · *Why it matters* · *How it connects* (below ↓ / above ↑) · the numbers (in the plate)
4. **Analogy** callout with an explicit "where it breaks" line
5. A figure or interactive
6. **Go deeper** `<details>` blocks for deep readers

## Layers — key idea and numbers

| # | Layer | Key idea | Numbers (approximate) |
|---|-------|----------|-----------------------|
| 1 | Energy | AI is electricity turned into computation and then into heat; power is now a bottleneck | Data centers ~1.5% of world electricity (2024, IEA), projected ~2× by 2030; AI rack ~120 kW vs ~10 kW for a classic rack; big campuses ~1 GW |
| 2 | Data centers | Buildings that turn power, cooling and network into one giant computer | Largest clusters 100k+ accelerators (2026); one NVL72 rack has ~5,000 copper cables (~2 miles) |
| 3 | Silicon | Sand → ultra-pure wafers → billions of transistors printed with extreme-UV light by one supplier's machines | EUV light 13.5 nm; scanner ~$200M; TSMC ~90% of leading-edge logic; ~60 big GPU dies per 300 mm wafer |
| 4 | Chips | GPUs/TPUs win because AI is mostly matrix multiplication, done in parallel; memory bandwidth is the limit | ~10^15 16-bit ops/s per chip (H100-class); ~300 ops needed per byte fetched to stay busy; compute ~3×/2 yr vs memory bandwidth ~1.6×/2 yr |
| 5 | Systems software | Drivers, CUDA, compilers and frameworks turn Python into kernels; distributed training splits a model over thousands of chips | 38–43% hardware utilization on Llama 3 405B; ~1 unexpected interruption every 3 hours on 16k GPUs |
| 6 | Data | Models learn from trillions of tokens of filtered text; tokenization turns text into integer IDs | ~15T tokens for Llama 3 (≈ 250,000 years of reading); 1 token ≈ ¾ English word |
| 7 | The model | Weighted sums, stacked; embeddings; transformer blocks with attention; parameters are learned numbers | 405B parameters ≈ 810 GB at 16-bit; ~⅔ of parameters in MLP blocks |
| 8 | Training | Predict the next token, measure the error, nudge every number downhill; then post-training shapes behavior | ~6 × params × tokens FLOPs (3.8×10^25 for Llama 3 405B); ~31M GPU-hours; frontier runs est. 10^26+ |
| 9 | Inference | Prompt → prefill → token-by-token decode with sampling; KV cache; bandwidth-bound | ~0.3 MB KV cache per token for a 70B model; ~0.3 Wh per typical short query (2025 estimates) |
| 10 | Applications | Chat, coding, agents (model + tools in a loop), retrieval | ~800M weekly ChatGPT users (late 2025); agent tasks can use 100k–millions of tokens |

Then: **Follow one prompt** (step-through: down 10→1 and back up, running time + energy tally),
**cost-of-one-answer calculator**, **Open questions and limits**, a short note on sources.

## Interactives

1. **Cooling toggle** (L1) — air vs liquid: stacked bar of where each 100 W goes (PUE ~1.5 vs ~1.15).
2. **Scale explorer** (L2) — slider over 8 levels: transistor → die → package → tray → rack → pod → building → campus.
   SVG drawing per level + counts (GPUs, transistors, power, size) + log-scale size ruler.
3. **Memory-wall chart** (L4) — static two-line log chart with hover readout.
4. **Tokenizer** (L6) — approximate BPE-like splitter: common-word lexicon, affix peeling, chunking; UTF-8 byte fallback
   for emoji; numbers in groups of ≤3 digits; illustrative IDs. Presets; empty-input and length-limit states.
5. **Attention visualizer** (L7) — two sentences ("…too tired" vs "…too wide"); hover/tap/focus a word to see
   hand-set, causal (look-back-only) weights as heat + bars. Shows "it" is ambiguous until "tired"/"wide".
6. **Gradient descent** (L8) — ball on a 1-D bumpy loss curve (local + global minimum); learning-rate slider
   (log scale), step/run/reset, click-to-place; oscillation and divergence handled explicitly.
7. **Temperature** (L9) — next-word distribution for "After a long day, I like to relax with a cup of…";
   T from 0 (greedy, special-cased) to 2; sample 8 words.
8. **Follow one prompt** — 12-step walkthrough with mini-stack, time/energy tally, prev/next/play, keyboard.
9. **Cost of one answer** — active params × tokens → FLOPs, accelerator-seconds, Wh; presets; prefill modeled
   as more efficient than decode; comparisons (microwave seconds, LED minutes, phone charge).

## Visual identity

- **Dark-first**, with a full light theme (system preference + a toggle).
- **Palette**: ink ground `#0d0c12` (violet-biased near-black), surface `#16141d`, line `#2b2735`,
  text `#ece8f3`, muted `#a39db2`. Ten layer hues rotate warm→cool *without passing through green*
  (amber → orange → vermilion → rose → magenta → orchid → violet → indigo → blue → cyan), computed in OKLCH
  at equal lightness so no layer shouts. Light theme uses the same hues at lower lightness.
- **Type**: Bricolage Grotesque (display, tight, variable width) · IBM Plex Sans (body) · IBM Plex Mono
  (numbers, labels, spec plates — the "datasheet" voice of the hardware world).
- **Motion**: one orchestrated idea — an ambient glow behind the page that shifts hue as you climb the stack,
  plus the rail's elevator marker. Hero: particles rising through the stack. Scroll-linked reveal only where
  supported (`animation-timeline: view()`), everything visible at rest; `prefers-reduced-motion` respected.
- **Layout**: fixed left rail ≥1000px; single 680px reading column with wider (≤940px) figure panels;
  phone: bottom elevator bar that opens the full stack as a sheet.
