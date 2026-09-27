# The AI Stack: From Electrons to Answers

An explorable explanation of how modern AI works end to end, from the power plant to the chatbot
reply. Ten layers (energy, data centers, silicon, chips, systems software, data, the model, training,
inference, applications), each built around interactives you can drag, toggle and break, plus a
scale zoom from a transistor to a campus and a "follow one prompt" journey through the whole stack.

**Live site:** https://ravisraman.github.io/Ai-explainer/

**Open `index.html` in a browser.** It is a single self-contained file (inline CSS and JS, no
libraries). The only network request is Google Fonts, with system-font fallbacks.

## Editing

`index.html` is generated. Edit the sources in `src/`, then rebuild:

```
python3 tools/build.py
```

| Path | What it holds |
|------|---------------|
| `src/head.html` | `<title>`, meta tags, font links |
| `src/styles.css` | Theme tokens (dark and light), layout, the shared control styles, per-figure styles |
| `src/body.html` | All page text and the mount points for each interactive (`data-mount="…"`) |
| `src/js/00-core.js` | Shared kit: animation loop that pauses offscreen figures, canvas stage, slider / segmented / stepper / button / readout controls, predict cards, number formatting |
| `src/js/01-nav.js` | The persistent stack diagram (desktop rail, phone elevator bar and sheet), scroll tracking, theme toggle |
| `src/js/02-hero.js` | Hero stack animation |
| `src/js/l01…l11-*.js` | One file per layer, plus the scale zoom (`l045`) and the journey (`l11`) |
| `src/data/bpe.txt` | The tokenizer's merge table, injected into the JS at build time |
| `tools/train_bpe.py` | Retrains that merge table from English word frequencies (`pip install wordfreq`) |
| `PLAN.md` | The design plan: every interactive's controls, updates and intended insight |

Files in `src/js` are concatenated in filename order; `zz-boot.js` runs last and mounts every figure.

## Deploying

Pushing to `main` deploys `index.html` to GitHub Pages via `.github/workflows/pages.yml`. Rebuild
before committing so the generated file matches `src/`.

## Accuracy

Numbers are rounded; `~` means approximate and "est." means an outside estimate.
For hardware, data-center, power and cost figures, SemiAnalysis is the preferred source, with
primary sources (vendor datasheets, IEA, company statements) or Epoch AI where it has no public figure.
Every interactive is a simplified model and says so in its "Simplified" line. Sources are listed at the
bottom of the page.
Figures are dated to 2026. The tokenizer and the next-word generator are real but tiny models trained
on small English samples; the attention weights are hand-set for illustration.
