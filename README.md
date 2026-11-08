# Arbor — high-fidelity prototype

Arbor is a browser extension concept for LLM chats. It does two things:

1. **Awareness: who is doing the thinking?** Every prompt is labelled as *your thinking* ●, *thinking together* ◑ or *delegated to AI* ○. Before you delegate, Arbor can offer a gentle speed bump: add your own take first.
2. **Organisation: a knowledge tree, zoomable to a forest.** Each concept you touch becomes a leaf on the conversation's tree. Filled leaves are ideas you reasoned through yourself; hollow leaves are still the AI's. Zoom out to see all your conversations as a forest, grouped into groves and connected by roots (shared concepts).

The prototype simulates the extension on top of a generic chat app inside a mock browser window. The assistant's answers are scripted ("Wizard of Oz"), so the prototype runs offline and behaves the same way for every test participant.

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173
npm run build      # static build in dist/ (deployable to GitHub Pages, Netlify, …)
```

Requires Node 20+.

## Deploy (GitHub Pages)

Every push to `main` builds the app and publishes it via `.github/workflows/deploy.yml`. The live prototype is at `https://<user>.github.io/<repo>/`; append the URL parameters below to set up test conditions.

One-time setup: in the GitHub repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.

## Demo script (≈ 3 minutes)

1. **Intro**: the 3-step onboarding explains the glyphs (replay it any time with ⓘ in the panel).
2. **Read the panel**: the *Who's thinking* bar, the trail (one glyph per prompt) and the tree, which already has four concepts.
3. **Delegate**: click the demo chip *"Write me a summary of backpropagation…"* and press ↵. The composer lens turns violet and the nudge appears. Choose **Add my take**, type a guess, and send. The reply reacts to your guess and then gives the summary, and a half-filled *Backpropagation* leaf appears.
4. **Retrieve**: send *"Quiz me on the loss function"*, then answer in your own words. The leaf fills in completely.
5. **Correct Arbor**: click any label under a message to see *why* it was classified that way, and relabel it. The tree updates.
6. **Brushing & linking**: hover a leaf to highlight its message, or click it to jump there.
7. **Zoom out**: click **Forest**, or pinch out on the tree. The camera starts on the current tree and pulls back to the whole forest. Hover a tree to highlight related trees. Click one to zoom in (labels appear, and a drawer lists concepts to revisit). Search for "gradient" to filter. Press `Esc` to step back out one level.

## URL parameters for user tests

| Parameter | Effect |
|---|---|
| `?intro=0` / `?intro=1` | skip / force the onboarding |
| `?empty=1` | start from an empty chat (the tree grows from a seed) |
| `?nudge=off\|gentle\|active` | nudge level |
| `?arbor=off` | extension paused (baseline condition for A/B tests) |
| `?view=forest&tree=sql` | open the forest, optionally focused on a tree |
| `?theme=light\|dark` | force a theme |
| `?panel=0` | start with the panel closed |

Example baseline vs. treatment: `/?intro=0&arbor=off` and `/?intro=0&nudge=active`.

## Where to change things

| What | File |
|---|---|
| Scripted answers, concepts, demo prompts, seed conversation | `src/data/scenario.ts` |
| Past conversations (the rest of the forest), groves, sidebar | `src/data/forest.ts` |
| Classification rules ("who's thinking") and their explanations | `src/lib/classify.ts` |
| Assistant behaviour (hint / quiz / feedback / full answer) | `src/lib/engine.ts` |
| Tree and forest geometry | `src/lib/layout.ts` |
| Colours, typography, dark mode | tokens at the top of `src/styles.css` |
| Product name ("Arbor") | `Glyph.tsx` (logo), `Panel.tsx`, `Overlays.tsx` |

To make it live, replace `respond()` in `engine.ts` and `classify()` in `classify.ts` with LLM calls that return the same shapes. The UI does not need to change.

## Design rationale (HCI principles)

| Principle | How Arbor applies it |
|---|---|
| **Visibility of system status** (Nielsen #1) | Live lens in the composer while typing, balance bar, trail, streaming replies, leaves sprouting as topics come up |
| **Match with the real world** (#2) | Tree → grove → forest metaphor. Your own thinking makes leaves "grow in", delegated knowledge stays hollow. Shared concepts are roots (the "wood wide web") |
| **User control & freedom** (#3) | Nudges are skippable (*Send anyway* ↵, *Don't interrupt me*). Three nudge levels. Arbor can be paused. Every label can be corrected |
| **Consistency & standards** (#4) | One glyph language (●◑○) and one vocabulary everywhere: tags, lens, tree, forest, sidebar, legend. Two meaning colours only |
| **Error prevention** (#5) | The nudge is *feedforward*: it appears before delegating, not after |
| **Recognition over recall** (#6) | The tree shows what you covered. The legend is always visible. Labels are readable at every zoom level (screen-space names) |
| **Flexibility & efficiency** (#7) | Keyboard: ↵ send, ↵ again = send anyway, `Esc` steps back a level, `+`/`−`/`0` zoom. Pinch to zoom out of the tree |
| **Aesthetic & minimalist design** (#8) | Neutral palette, green = you, violet = AI, thin lines, lots of whitespace. Details only on demand |
| **Recognize, diagnose, recover** (#9) | Every label explains *why* (rules + confidence) and can be relabelled. The tree recomputes from the correction |
| **Help & documentation** (#10) | 3-step onboarding, replayable. "Why this label?" popovers. Tooltips |
| **Shneiderman's mantra** | *Overview first* (forest) → *zoom & filter* (groves, search, "mostly you / mostly AI") → *details on demand* (hover cards, drawer, jump to message) |
| **Brushing & linking** | Hovering a message highlights its leaves, and hovering a leaf highlights its message |
| **Non-paternalistic tone** | Delegation is never blocked or judged ("Totally fine — just good to know"). The goal is awareness, not restriction |
| **Accessibility** | Meaning is encoded in shape (filled/half/hollow) as well as colour. WCAG-AA text contrast. Keyboard-reachable trees and controls. `prefers-reduced-motion` respected. Light & dark themes |

Learning-science background for the interventions: the *generation effect* (a first guess helps the answer stick) and *retrieval practice* (quizzes fill leaves in).

## Project structure

```
src/
  App.tsx                 shell: browser chrome, host app, Arbor panel, forest overlay
  components/
    Host.tsx              mock browser + host chat sidebar (Arbor adds a glyph per chat)
    Chat.tsx              messages, Arbor tags, "make it yours", composer, lens, nudge
    Panel.tsx             Arbor side panel: balance, trail, live tree, legend, settings
    Forest.tsx            zoomable forest canvas, search, filters, hover card, drawer
    TreeSvg.tsx           shared tree renderer (panel + forest)
    Glyph.tsx             ●◑○ ownership glyph + logo
    Overlays.tsx          onboarding + toast
  lib/
    store.tsx             state (reducer + context), send/stream flow, derived live tree
    classify.ts           rule-based "who's thinking" classifier with explanations
    engine.ts             scripted assistant
    layout.ts             tree + forest layout
    camera.ts             pan / zoom / fly-to
  data/
    scenario.ts           live conversation script
    forest.ts             past trees
```
