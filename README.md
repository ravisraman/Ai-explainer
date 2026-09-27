# The AI Stack: From Electrons to Answers

An interactive, single-page explainer of how modern AI works end to end, from the power plant to the chatbot reply, written for curious non-specialists.

**Live site:** https://ravisraman.github.io/Ai-explainer/

The page climbs ten layers (energy, data centers, silicon, chips, systems software, data, the model, training, inference, applications). Each layer has a one-sentence summary, a few rounded key numbers, and "go deeper" panels. Then it follows one prompt through the whole stack and closes with open questions and limits.

From Layer 5 up, each software layer has a "Build it up, step by step" section that starts from scratch: a model as a function with knobs, a single neuron, a small network trained live in the browser, embeddings, a word-counting language model, attention worked through with real arithmetic, the transformer block, how training grades and corrects a model, and what actually happens when you chat.

Other interactive figures include a tokenizer, an attention visualizer, a gradient-descent toy, a temperature sampler, a token-by-token decode animation, a transistor-to-campus scale explorer, and a cost-of-one-answer calculator.

## Running it

It's one self-contained file: open `index.html` in a browser. There's no build step and no dependencies; the only external request is Google Fonts, with system-font fallbacks.

## Notes

- Figures are rounded, many are estimates, and they're dated to 2026. Sources are listed at the bottom of the page.
- The tokenizer, attention weights and next-word probabilities are illustrative, not taken from a real model.
- `PLAN.md` holds the original build plan.
- Pushing to `main` deploys the site via `.github/workflows/pages.yml`.
