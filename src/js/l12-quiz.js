/* =====================================================================
   Test yourself — a short multiple-choice test over the whole stack.
   Intro card → one question at a time (answers can be changed until the
   end) → results: score, a per-layer strip, and an explanation of every
   miss with a link back to the layer that covers it. Nothing is stored.
   ===================================================================== */

const QUIZ = [
  { n: 1, q: "The densest AI racks are cooled with water piped to the chips instead of with air. Why?",
    opts: ["Water carries far more heat than air, which runs out around 30–40 kW per rack",
      "Liquid-cooled chips can safely run well above their rated clock speed, so training goes faster",
      "The number of fans air cooling needs would break noise-safety limits inside the hall",
      "The warm water is piped to turbines that turn the waste heat back into electricity"],
    why: "A rack of 72 GPUs draws ~130 kW or more, and every watt ends up as heat. Air can't carry that much out of one rack, so coolant flows through cold plates on the chips. It also cuts the building's cooling overhead from ~50% to ~15%." },
  { n: 2, q: "One rack loses one of its network links: 1 link out of 32 in the whole cluster. What happens to the training job?",
    opts: ["The whole job drops to that rack's pace: every step waits for the slowest rack",
      "It slows by about 3%, because the cluster lost 1/32 of its network capacity",
      "Nothing noticeable: traffic reroutes over the other links and the job keeps full speed",
      "The scheduler drops that rack until the link is repaired, so the job runs 1/8 slower"],
    why: "Training steps are synchronized: every GPU shares its results before anyone moves on. One slow rack sets the pace for all of them, so in the page's model one cut link costs ~8%, not 3%. That's why operators hunt down stragglers." },
  { n: 3, q: "What does the “3 nm” in a chip-making process name measure today?",
    opts: ["Nothing physical: it's a generation label (gates sit ~48 nm apart)",
      "The width of each transistor, which is why density doubles when the number halves",
      "The thinnest wire on the chip, measured after the final polishing step",
      "The wavelength of the light that prints the chip's finest layers"],
    why: "Process names stopped matching any physical feature years ago. The label keeps shrinking because density keeps improving. (The EUV light that prints the finest layers has a wavelength of 13.5 nm.)" },
  { n: 3, q: "Why do big chips cost disproportionately more to make than small ones?",
    opts: ["Fewer fit per wafer, and each is likelier to catch a random, fatal defect",
      "Big chips need purer, more expensive silicon so signals can cross the larger die",
      "Each one has to be printed in several exposures on a slower, specialized machine",
      "Big chips can't be tested automatically, so each one is checked by hand"],
    why: "Defects land at random. A big die takes more of the wafer and is more likely to catch a defect, so the share of good chips falls fast as area grows. That's one reason the newest AI chips join two dies instead of making one giant one." },
  { n: 4, q: "For a tiny job, like working through an 8 × 8 grid, a CPU can finish before a GPU. Why?",
    opts: ["GPU launch overhead: 64 cells can't keep thousands of cores busy",
      "GPU cores can only multiply, so every addition is sent back to the CPU",
      "A CPU's few cores add up to more total speed than a GPU's thousands",
      "The GPU has to fetch the grid over the data-center network before starting"],
    why: "A GPU wins by running thousands of simple cores at once. On a small job the launch overhead dominates and most cores sit idle; on a big grid the GPU pulls far ahead." },
  { n: 4, q: "When a chatbot writes its answer for one user, one token at a time, what mostly limits its speed?",
    opts: ["How fast the chip can read the model's weights from memory",
      "How fast the chip's math units can multiply the numbers together",
      "The speed of the connection between the data center and the user",
      "How fast the tokenizer can turn each token back into text"],
    why: "Every new token reads every weight from memory but does only about one operation per byte it reads, so the math units wait on data. That's the memory wall. Batching many users together shares each read, which is why it helps so much." },
  { n: 5, q: "Why not just give every GPU a full copy of a large model and train on all of them at once?",
    opts: ["Training state takes ~16 bytes per parameter, so big models overflow one GPU",
      "GPUs in the same cluster can't hold identical copies of the same data",
      "Each copy would drift and learn something different, so they couldn't be combined",
      "Sending that many copies across the network would use too much electricity"],
    why: "Plain data parallelism puts everything on every GPU, and even a 7-billion-parameter model overflows 80 GB. So the model itself is split: tensor parallelism slices every layer, pipeline parallelism gives each GPU a range of layers, and ZeRO/FSDP share out the optimizer state. The price is more communication." },
  { n: 6, q: "Why can counting the r's in “strawberry” be surprisingly hard for a language model?",
    opts: ["It sees the word as a few token pieces, not as individual letters",
      "The word is too rare to have appeared often enough in its training data",
      "Language models have no way to represent numbers, so they can't count",
      "It's trained to hide its working, so it answers with a quick guess"],
    why: "Before the model sees any text, a tokenizer splits it into common pieces and turns each into an ID number. The letters inside a piece aren't directly visible, so spelling and letter-counting tasks can trip it up." },
  { n: 7, q: "When a chat model reaches a word, which other words can attention let it draw on?",
    opts: ["Only the words before it, weighted by how relevant each one is",
      "Every word in the text, including the ones that come after it",
      "Only the one or two words right before it, like a trigram model",
      "Only the nouns and verbs, since they carry the sentence's meaning"],
    why: "These models read left to right, and each word can only look back. Each attention head scores every earlier word (query against key) and pulls in more from the better matches. In “The animal didn't cross the street because it was too tired,” it's “tired” looking back that settles what “it” means." },
  { n: 8, q: "What does training actually change?",
    opts: ["Billions of weights, each nudged to make its guesses a bit less wrong",
      "A long list of if-then rules that engineers write and then refine",
      "A database of stored answers that the model looks up when asked",
      "The tokenizer's vocabulary, adding one new word at a time"],
    why: "Training shows the model trillions of examples, measures how wrong each guess was, and uses backpropagation to nudge every weight downhill on that error. That's gradient descent, repeated for hundreds of thousands of steps." },
  { n: 8, q: "You have a fixed compute budget for training. What does the Chinchilla scaling fit say gives the lowest loss?",
    opts: ["A balance: roughly 20 training tokens per parameter",
      "The biggest model you can afford, even if it only sees a little data",
      "A small model trained on as much data as you can find",
      "Any split works equally well: loss depends only on total compute"],
    why: "Loss depends on both model size and data, so the best use of a fixed budget sits in between, near 20 tokens per parameter. Many labs now train smaller models on far more data anyway, because smaller models are cheaper to run for users." },
  { n: 9, q: "What happens when you set a model's temperature to 0?",
    opts: ["It always picks its most likely next token, so output is predictable",
      "It stops generating, because no next token scores high enough",
      "It picks every next word completely at random, ignoring the odds",
      "The chips run cooler and use less energy for each token"],
    why: "Temperature reshapes the odds of the next token. Below 1 it sharpens them toward the favorite, and at 0 the model is “greedy.” Above 1 it flattens them, so the output gets more varied and eventually incoherent." },
  { n: 9, q: "What does the KV cache do while a model writes an answer?",
    opts: ["It keeps earlier tokens' keys and values so they aren't recomputed each step",
      "It stores whole answers to common questions so they can be reused",
      "It keeps the model's weights on disk until each layer is needed",
      "It remembers your past conversations from one chat to the next"],
    why: "Without the cache, writing token n reprocesses all n tokens so far, so 100 tokens take ~5,050 token-passes instead of 100. The cache grows by ~0.3 MB per token for a 70B model, which limits how many users one GPU can serve." },
  { n: 10, q: "When a chatbot “checks the weather,” who actually runs the weather lookup?",
    opts: ["The app, after the model writes a structured request for it",
      "The model connects to a weather website by itself while it writes",
      "The model recalls recent weather reports from its training data",
      "Your own device, and the model never sees the result"],
    why: "The model only ever produces text. It's trained to emit a message like {\"tool\": \"weather\", \"city\": \"Paris\"}; the application runs it, appends the result to the conversation, and the model continues. That's also how hidden instructions in tool output can reach the model." },
  { n: 10, q: "An agent does a 20-step task, and each step goes right 95% of the time. Roughly how likely is the whole task to go right?",
    opts: ["About 36%", "About 95%", "About 75%", "About 5%"],
    why: "Errors compound: 0.95 multiplied by itself 20 times is about 0.36. That's why agents need checks, retries and a way to catch their own mistakes." },
  { n: 0, q: "While a model answers your prompt, what happens to its weights?",
    opts: ["Nothing: training fixed them, and answering only reads them",
      "They update slightly, so the model learns from every question",
      "They're adjusted to match your writing style as you chat",
      "They're copied to your device so the answer can stream"],
    why: "Inference only reads the weights. Anything a chatbot seems to remember about you is the app saving notes and pasting them into later prompts, inside the same context window." },
];

defineMount("quiz", (root) => {
  const where = (n) => (n ? LAYERS[n - 1] : { n: 0, id: "journey", name: "Follow one prompt" });
  const color = (n) => `var(--l${n || 10})`;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  let order = [], picks = [], idx = 0;
  const card = h("div", { class: "quiz-card" });
  root.append(card);

  const pips = (fill) => h("div", { class: "quiz-pips", "aria-hidden": "true" },
    ...QUIZ.map((q, i) => h("span", { class: "quiz-pip" + (fill ? fill(i) : ""), style: `--pc:${color(q.n)}` })));

  function focusHead() {
    const hd = card.querySelector("[data-focus]");
    if (hd) hd.focus({ preventScroll: true });
    const r = card.getBoundingClientRect();
    if (r.top < 60 || r.top > innerHeight * 0.6) card.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }

  function intro() {
    card.replaceChildren(
      h("p", { class: "quiz-eyebrow" }, `${QUIZ.length} questions · about 5 minutes · every layer`),
      h("h3", { class: "quiz-title", tabindex: "-1", "data-focus": "" }, "Can you climb the whole stack?"),
      h("p", { class: "quiz-lede" }, "One question at a time, from the power plant to the chatbot. You can go back and change answers until the end. Then you'll see your score, which layers held up, and why each missed answer is wrong."),
      pips(),
      h("div", { class: "btn-row", style: "margin-top:18px" }, button("Start the test", start, { kind: "primary" })));
  }

  function start() {
    order = QUIZ.map((q, i) => ({ i, opts: shuffle(q.opts.map((t, k) => ({ t, right: k === 0 }))) }));
    picks = new Array(QUIZ.length).fill(-1);
    idx = 0;
    question();
    focusHead();
  }

  function question() {
    const o = order[idx], q = QUIZ[o.i], w = where(q.n);
    const last = idx === QUIZ.length - 1;
    const next = button(last ? "See my results" : "Next", () => {
      if (last) { results(); focusHead(); } else { idx++; question(); focusHead(); }
    }, { kind: "primary" });
    next.disabled = picks[idx] < 0;
    const opts = o.opts.map((op, k) => {
      const b = h("button", { type: "button", class: "quiz-opt", "aria-pressed": String(picks[idx] === k) },
        h("span", { class: "quiz-key", "aria-hidden": "true" }, "ABCD"[k]), h("span", null, op.t));
      b.addEventListener("click", () => {
        picks[idx] = k;
        opts.forEach((x, j) => x.setAttribute("aria-pressed", String(j === k)));
        next.disabled = false;
      });
      return b;
    });
    const back = button("Back", () => { idx--; question(); focusHead(); }, { small: false });
    back.disabled = idx === 0;
    card.style.setProperty("--c", color(q.n));
    card.replaceChildren(
      h("div", { class: "quiz-progress" },
        h("span", null, `Question ${idx + 1} of ${QUIZ.length}`),
        h("span", { class: "quiz-layer" }, w.n ? `Layer ${w.n} · ${w.name}` : w.name)),
      pips((i) => (i < idx ? " done" : i === idx ? " now" : " todo")),
      h("h3", { class: "quiz-q", tabindex: "-1", "data-focus": "" }, q.q),
      h("div", { class: "quiz-opts", role: "group", "aria-label": "Answers" }, ...opts),
      h("div", { class: "btn-row quiz-nav" }, back, next));
  }

  function results() {
    const right = order.map((o, i) => picks[i] >= 0 && o.opts[picks[i]].right);
    const score = right.filter(Boolean).length, total = QUIZ.length;
    const verdict = score === total ? "A perfect climb. You could teach this page."
      : score >= total - 3 ? "Strong. Just a couple of layers to revisit."
      : score >= total / 2 ? "Solid footing. The misses below show where to look again."
      : "A good start. The review below walks through every miss.";
    // per-layer strip, bottom of the stack first
    const byLayer = [...LAYERS.map((l) => l.n), 0].map((n) => {
      const idxs = order.map((o, i) => (QUIZ[o.i].n === n ? i : -1)).filter((i) => i >= 0);
      const got = idxs.filter((i) => right[i]).length;
      const w = where(n);
      const state = got === idxs.length ? "all" : got === 0 ? "none" : "some";
      return h("a", { class: `quiz-tile ${state}`, href: "#" + w.id, style: `--pc:${color(n)}`, title: `${w.name}: ${got} of ${idxs.length}` },
        h("span", { class: "quiz-tile-n" }, n ? String(n) : "↺"),
        h("span", { class: "quiz-tile-name" }, n ? w.name : "One prompt"),
        h("span", { class: "quiz-tile-score" }, `${got}/${idxs.length}`));
    });
    const review = (i, open) => {
      const o = order[i], q = QUIZ[o.i], w = where(q.n), ok = right[i];
      const yours = o.opts[picks[i]], answer = o.opts.find((x) => x.right);
      return h("li", { class: "quiz-rev " + (ok ? "ok" : "miss"), style: `--c:${color(q.n)}` },
        h("p", { class: "quiz-rev-layer" }, h("span", { class: "quiz-mark", "aria-label": ok ? "Correct" : "Missed" }, ok ? "✓" : "✗"), " " + (w.n ? `Layer ${w.n} · ${w.name}` : w.name)),
        h("p", { class: "quiz-rev-q" }, q.q),
        ok ? null : h("p", { class: "quiz-rev-yours" }, h("b", null, "You said: "), yours.t),
        h("p", { class: "quiz-rev-answer" }, h("b", null, ok ? "Right: " : "Answer: "), answer.t),
        open ? h("p", { class: "quiz-rev-why" }, q.why) : null,
        open ? h("a", { class: "quiz-rev-link", href: "#" + w.id }, `Revisit ${w.n ? "Layer " + w.n + ": " : ""}${w.name} →`) : null);
    };
    const misses = order.map((_, i) => i).filter((i) => !right[i]);
    const hits = order.map((_, i) => i).filter((i) => right[i]);
    card.style.setProperty("--c", "var(--l7)");
    card.replaceChildren(
      h("p", { class: "quiz-eyebrow" }, "Your results"),
      h("h3", { class: "quiz-score", tabindex: "-1", "data-focus": "" },
        h("span", { class: "quiz-score-num" }, String(score)), h("span", { class: "quiz-score-of" }, ` / ${total}`)),
      h("p", { class: "quiz-lede" }, verdict),
      pips((i) => (right[i] ? " right" : " miss")),
      h("div", { class: "quiz-tiles" }, ...byLayer),
      misses.length ? h("h4", { class: "quiz-h4" }, misses.length === 1 ? "The one you missed" : `The ${misses.length} you missed`) : null,
      misses.length ? h("ol", { class: "quiz-review" }, ...misses.map((i) => review(i, true))) : null,
      hits.length ? h("details", { class: "quiz-more" },
        h("summary", null, `Show the ${hits.length} you got right`),
        h("ol", { class: "quiz-review" }, ...hits.map((i) => review(i, true)))) : null,
      h("div", { class: "btn-row", style: "margin-top:18px" },
        button("Take it again", start, { kind: "primary" }),
        h("a", { class: "btn", href: "#top" }, "Back to the top")));
  }

  // keyboard: A–D or 1–4 pick an answer while a question is showing
  card.addEventListener("keydown", (e) => {
    if (!card.querySelector(".quiz-opt") || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = "abcd".indexOf(e.key.toLowerCase()) >= 0 ? "abcd".indexOf(e.key.toLowerCase()) : "1234".indexOf(e.key);
    if (k >= 0) { const b = card.querySelectorAll(".quiz-opt")[k]; if (b) { b.click(); b.focus(); } }
  });

  intro();
  Actions.quiz = () => { start(); focusHead(); };
});
