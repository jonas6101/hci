# Arbor — high-fidelity prototype

Arbor is a browser extension concept for LLM chats. It does two things:

1. **Awareness: who is doing the thinking?** Every prompt is labelled as *your thinking* ●, *thinking together* ◑ or *delegated to AI* ○. Before you delegate, Arbor can offer a gentle speed bump: add your own take first.
2. **Organisation: a knowledge tree, zoomable to a forest.** Each concept you touch becomes a leaf on the conversation's tree. Filled leaves are ideas you reasoned through yourself; hollow leaves are still the AI's. Zoom out to see all your conversations as a forest, grouped into groves and connected by roots (shared concepts).

The prototype simulates the extension on top of a generic chat app inside a mock browser window. The assistant's answers are scripted ("Wizard of Oz"), so the prototype runs offline and behaves the same way for every test participant.

## Design styles

Arbor comes in several design styles that share one core: the conversation, the classifier and the scripted assistant live in one store (`src/lib/`, `src/data/`), and each style is its own UI under `src/designs/`. Switch with `?design=ascii|classic`, in settings, or by typing `/design classic`. The conversation carries over, so you can compare styles side by side in a user test.

| Style | What it is |
|---|---|
| **ascii** (default) | Everything on one character grid, in one monospace voice. Minimal chrome, keyboard first, and a set of interaction concepts built for the medium (see below). |
| **classic** | The first iteration: a mock browser with a chat app and the Arbor side panel, an SVG tree with hover tooltips, and the zoomable SVG forest. It has the newer additions too: the squirrel, which you can hover and poke for tips like in the ASCII style. |

To add a style, create `src/designs/<name>/App.tsx` (default export, reads `useStore()`), add it to `DESIGNS` in `src/App.tsx` and to the `Design` type in `src/lib/types.ts`. Prefix its CSS classes so styles never collide.

### Interaction concepts in the ASCII style

Press `?` in the app for the same list, each with a *try it* button that sets up the demo.

| # | Concept | Principle | What happens |
|---|---|---|---|
| 01 | **Thought linter** | Explainable feedforward | While you type, the words that make a prompt delegating get a wavy underline (dashed: together, solid: yours, so shape carries the meaning as well as colour), and the reason sits right below, like a spellchecker or compiler diagnostic. |
| 02 | **Modeline** | Ambient awareness, calm technology | Like vim's `-- INSERT --`, the status bar always says who is thinking right now and lists the keys that work in this moment. Even the caret takes the mode's colour. |
| 03 | **Predict → reveal** | Desirable difficulty, generation effect | With nudges on *active*, a delegated answer arrives veiled (`░░░`): its shape is visible, its words are not. Type a hunch and reveal it, and a decode sweep uncovers the answer with the words you already had highlighted; the prompt becomes *thinking together*. Or just press ↵. It is never blocked. |
| 04 | **Two views, one tree** | Multiple views, object constancy | `t` switches between the growing plant and a `tree`-command outline. Every leaf keeps its identity and glides to its new place. |
| 05 | **Forgetting scrubber** | Feedforward of consequences | Drag time forward (`[` `]`): letters drop out of labels and forgotten leaves fall to the ground. What you delegated falls first. An illustrative Ebbinghaus-style model (`src/lib/retention.ts`), labelled as such. |
| 06 | **Semantic zoom** | Overview first, zoom & filter, details on demand | Pinch out or press `f`: the camera pulls back from your tree to the forest, where every chat is a crown of glyphs. Hover a tree and labelled roots run to chats that share a concept; zoom in for the full tree and a "revisit, most faded first" list. |
| 07 | **Drawn links** | Brushing & linking | Hover a message and a line is drawn in box characters to the leaves it grew; hover a leaf and the line finds its message, pointing up or down if it is scrolled away. |
| 08 | **Relabel in place** | User control, error recovery | Click the glyph next to a message: the evidence is underlined in your own words, with the confidence, and you can relabel it. The tree regrows. |
| 09 | **Command line** | Flexibility & efficiency, recognition over recall | `/` lists every command with what it does (`/quiz`, `/hint`, `/forest`, `/time 1w`, `/why`, `/nudge`, `/design`, …). `tab` cycles demo prompts. |
| 10 | **Squirrel** | Ambient presence, non-judgmental tone, details on demand | A squirrel in characters holds an acorn in the glyph language, lifts it when an answer is veiled and hops when you think for yourself. On its own it moves only when something changes. Hover it and it notices you once (ear twitch, blink, a ripple down the tail); poke it and it tosses its acorn and cycles through tips, each with an action: the leaf that is least yours (*quiz me*), what would fade (*skip ahead*), the forest. Poke it too often and it gets dizzy. |

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

## Demo script, ASCII style (≈ 3 minutes)

1. **Intro**: one screen explains the glyphs. `?` opens the concept list at any time.
2. **Lint**: press `tab` for *"Write me a summary of backpropagation…"*. The words *write* and *summary* get a wavy underline with the reasons below, the modeline says `○ DELEGATING`, and the squirrel holds a hollow acorn.
3. **Predict → reveal**: press ↵. The answer arrives veiled and the squirrel lifts its acorn. Type a hunch (*"it goes backwards with the chain rule"*) and press ↵: the answer decodes, the words you had light up, and the *Backpropagation* leaf grows half-filled.
4. **Retrieve**: `/quiz loss` (or press `q` on a leaf), then answer in your own words. The leaf fills.
5. **Relabel**: click any glyph next to *you*. See the underlined evidence and relabel it.
6. **Brush**: hover a message, and a line is drawn to its leaves. Hover a leaf, and the line runs back.
7. **Time**: press `]` a few times. Delegated leaves fade, then fall; your own stay.
8. **Zoom out**: pinch out on the tree or press `f`. Hover *linear regression*: a root labelled *gradient descent* runs to this chat. Click to zoom in, `esc` to step back out.
9. **Compare**: `/design classic` shows the same conversation in the classic style.

## Demo script, classic style (≈ 3 minutes)

1. **Intro**: the 3-step onboarding explains the glyphs (replay it any time with ⓘ in the panel).
2. **Read the panel**: the *Who's thinking* bar, the trail (one glyph per prompt), the squirrel and the tree, which already has four concepts. The squirrel holds an acorn in the glyph language (filled / half / hollow) and says what the last prompt meant.
3. **Delegate**: click the demo chip *"Write me a summary of backpropagation…"*. The composer lens turns violet and the squirrel's acorn turns hollow. Press ↵: the nudge appears and the squirrel lifts the acorn. Choose **Add my take**, type a guess, and send. The squirrel hops, the reply reacts to your guess and then gives the summary, and a *Backpropagation* leaf appears.
4. **Retrieve**: send *"Quiz me on the loss function"*, then answer in your own words. The leaf fills in completely.
5. **Correct Arbor**: click any label under a message to see *why* it was classified that way, and relabel it. The tree updates.
6. **Brushing & linking**: hover a leaf to light its path down to the roots, read its card and highlight its message, or click it to jump there.
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
| `?mascot=0` / `?mascot=1` | hide / show the squirrel (e.g. to test whether it changes behaviour) |
| `?design=ascii\|classic` | design style (the choice is remembered) |
| `?layout=outline` | ASCII style: start with the outline view of the tree |

Example baseline vs. treatment: `/?intro=0&arbor=off` and `/?intro=0&nudge=active`. In the ASCII style, `nudge=gentle` gives the linter only and `nudge=active` adds predict → reveal.

## Where to change things

| What | File |
|---|---|
| Scripted answers, concepts, demo prompts, seed conversation | `src/data/scenario.ts` |
| Past conversations (the rest of the forest), groves, sidebar | `src/data/forest.ts` |
| Classification rules ("who's thinking"), their explanations and the words they point at | `src/lib/classify.ts` |
| Assistant behaviour (hint / quiz / feedback / full answer) | `src/lib/engine.ts` |
| Forgetting model (fading, fallen leaves) | `src/lib/retention.ts` |
| ASCII tree: layout (tree and outline), then drawing and motion | `src/lib/asciiTree.ts`, `src/shared/AsciiTreeView.tsx`, `src/shared/ascii-tree.css` |
| ASCII style: colours, type, dark mode | tokens at the top of `src/designs/ascii/ascii.css` |
| ASCII style: the interaction concepts and their *try it* actions | `src/designs/ascii/Concepts.tsx` |
| ASCII style: slash commands | `useCommands()` in `src/designs/ascii/Composer.tsx` |
| ASCII style: squirrel drawing and what it says | `src/designs/ascii/Squirrel.tsx`, `Companion` in `src/designs/ascii/Pane.tsx` |
| Classic style: colours, typography, dark mode | tokens at the top of `src/designs/classic/styles.css` |
| Classic style: squirrel | `src/designs/classic/components/Squirrel.tsx`, `Mascot` in `.../Panel.tsx` |
| Tree and forest geometry (classic) | `src/lib/layout.ts` |

To make it live, replace `respond()` in `engine.ts` and `classify()` in `classify.ts` with LLM calls that return the same shapes. The UI does not need to change.

## Design rationale (HCI principles)

| Principle | How Arbor applies it |
|---|---|
| **Visibility of system status** (Nielsen #1) | Live lens in the composer while typing, balance bar, trail, streaming replies, leaves sprouting as topics come up. The squirrel mirrors the lens live, even in the periphery |
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
| **Brushing & linking** | Hovering a message highlights its leaves (their path lights up to the roots), and hovering a leaf highlights its message |
| **Non-paternalistic tone** | Delegation is never blocked or judged ("Totally fine — just good to know"). The goal is awareness, not restriction. When you delegate, the squirrel just holds a hollow acorn and never looks sad |
| **Ambient awareness** (calm technology) | The squirrel sits in the periphery and its acorn changes with who is thinking, so you notice the shift without reading anything. It is drawn in the tree's neutral bark colours and only the acorn (the ●◑○ glyph) is coloured, so it adds no new visual language. It moves only when something changes, never on a loop, and it can be hidden in settings |
| **Accessibility** | Meaning is encoded in shape (filled/half/hollow) as well as colour. WCAG-AA text contrast. Keyboard-reachable trees and controls. `prefers-reduced-motion` respected (the squirrel keeps its poses but doesn't hop, and everything it says is real text). Light & dark themes |

Learning-science background for the interventions: the *generation effect* (a first guess helps the answer stick) and *retrieval practice* (quizzes fill leaves in).

## Project structure

```
src/
  App.tsx                 one store, then the chosen design (lazy-loaded, so only its CSS is on the page)
  lib/                    shared by every design
    store.tsx             state (reducer + context), send/stream flow, veil/reveal, derived live tree
    classify.ts           rule-based "who's thinking" classifier with explanations and evidence spans
    engine.ts             scripted assistant
    retention.ts          illustrative forgetting model
    asciiTree.ts          the tree on a character grid: botanical layout and outline
    layout.ts, camera.ts  SVG tree + forest layout and camera (classic)
  data/
    scenario.ts           live conversation script
    forest.ts             past trees
  shared/
    AsciiTreeView.tsx     the animated ASCII tree (ASCII style; kept here so other styles can reuse it)
  designs/
    ascii/
      App.tsx             layout, global keys, browser line, toast
      Transcript.tsx      the log: evidence, why + relabel, predict → reveal, make it yours
      Composer.tsx        thought linter, slash commands, demo prompts
      Pane.tsx            balance, trail, squirrel, tree, forgetting scrubber, settings
      Forest.tsx          semantic zoom: forest of glyph crowns, roots, tree detail
      Links.tsx           drawn links between messages and leaves
      Modeline.tsx        status bar: mode + the keys that work now
      Concepts.tsx        interaction concepts sheet and intro
      Squirrel.tsx, Md.tsx, ui.tsx, ascii.css
    classic/
      App.tsx, styles.css
      components/         Host, Chat, Panel, Forest, TreeSvg, Glyph, Overlays, Squirrel
```
