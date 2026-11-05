# Wheelhouse design

Implemented source: `src/styles.css`, `src/App.tsx` and `src/components/`. This document describes the finished interface, not a proposed redesign.

## Product and visual idea

Wheelhouse is a casual prediction game for people watching the Squeekchain hamster economy. One hand-drawn SVG hamster wheel carries the visual identity. A warm paper background, dark ink, burnt orange action and muted green/lilac outcome categories make a small arcade without neon, gradients or dashboard chrome. The product and prediction control come before explanatory sections.

Desktop pairs the game surface with the score and clues. Mobile keeps the wheel, six recent clues, Pip's next pick and the main action together; the detailed matchup follows below.

## Colors

Canonical tokens are at the start of `src/styles.css`.

| Token | Implemented value | Role |
| --- | --- | --- |
| `--paper` | `#f6f4ed` | Page and header background |
| `--surface` | `#fffef9` | Game controls, dialogs and neutral buttons |
| `--ink` | `#2c322a` | Main text, selected mode, selected radio border |
| `--muted` | `#666b5c` | Supporting text and captions |
| `--line` | `#dcded0` | Noninteractive grouping dividers |
| `--control-border` | `#858d76` | Unselected choices and secondary button boundaries |
| `--stage` | `#edf0d8` | Wheel backdrop and neutral hover |
| `--accent` | `#c04425` | Primary action, brand mark and headline signature |
| `--accent-hover` | `#a8381e` | Primary button hover |
| `--accent-soft` | `#f7e5d8` | Player avatar background |
| `--run-bg` / `--run-ink` | `#e4ebce` / `#475732` | Run outcome icons and trail |
| `--rest-bg` / `--rest-ink` | `#eae3ef` / `#62506e` | Rest outcomes and Pip |
| `--success` | `#425b2e` | Correct outcome text |
| `--danger` | `#a33f31` | Confirmed history deletion |
| `--focus` | `#294f80` | Keyboard focus perimeter |

Selected choices use a dark border plus `inset 0 0 0 1px var(--ink)` for a two-pixel visible selection ring, checked native radio state and a tinted background. The inset shadow communicates selection, not elevation. Success and misses have icons and text; outcomes never depend on color alone. The game surface uses a separate subtle structural edge (`#d3d7c7`), not the stronger control boundary. Illustrative fur/wheel colors are local to `Hamster.tsx`, not interface status tokens.

Measured source-token pairs, whose solid backgrounds were also checked in the rendered export: ink/paper 11.95:1, muted/paper 4.99:1, muted/surface 5.44:1, muted/stage 4.72:1, surface/accent 5.08:1, run ink/background 6.38:1 and rest ink/background 5.79:1. Control boundary/surface contrast is 3.43:1. The focus ring has a 4px offset on buttons/links, so its adjacent background is the page/surface; the radio wrapper uses a 3px offset. See validation for measured review coverage and limitations.

## Typography

- Body and controls: `DM Sans Variable`, then `DM Sans`, then sans-serif.
- Headings, wordmark, prominent scores: `Bricolage Grotesque Variable`, then `Bricolage Grotesque`, then sans-serif.
- Fonts are bundled from the pinned Fontsource dependencies in `src/main.tsx`; all required WOFF2 assets ship in `dist/assets/`. Font OFL notices ship in `docs/`.
- Three used weights: 400 body, 600 controls/section headings, 700 hero/wordmark.
- Six token sizes: 14, 16, 20, 24, 32 and 48px (0.875, 1, 1.25, 1.5, 2 and 3rem at the 16px root). Five sizes are used on each tested entry viewport. There is no third font for numbers.
- Body line-height is 1.5, longer dialog copy 1.6; hero 1.08, section headings 1.2. Hero tracking is -0.045em, reduced to -0.04em on phones; section headings use -0.025em. Body spacing stays natural.
- Balanced headings and pretty-wrapped descriptions avoid awkward final lines. Scores, round numbers and history cells use tabular numbers. Important values wrap or remain available; none are ellipsized.

## Layout and spacing

The page shell is at most 1240px including 40px inline padding; the header is at most 1280px. The main desktop grid is a flexible game plus a 300px aside with a 32px gap. Controls share a 24px inset, 12px control gaps and a 48px minimum action height. Within-group gaps usually use 6/8/12px; section gaps use 20/24/28/32/40px. The system uses logical inline/block spacing except for physical SVG geometry and explicit transforms.

Implemented breakpoints:

| Width | Changes |
| --- | --- |
| Above 1080px | Full header, two-column game, 48px hero and scores |
| 1080px and below | Hide nonessential header note; aside becomes 270px; compact choices |
| 820px and below | Game becomes one column; hero 32px; aside temporarily uses a two-column grid; shell inset 24px |
| 640px and below | Wallet dialog becomes a bottom sheet with 8px inline clearance and safe-area bottom padding |
| 540px and below | Header 64px; shell inset 20px; stage art 172px; inline recent-outcome/Pip strip appears; choices remain paired; detailed aside becomes a vertical flow |
| 360px and below | Shell inset 16px; mode controls and clue cells compact; redundant choice icon is removed while label and native radio remain |

The first 390×844 practice screen contains the product, the simulation disclosure, six warm-up/match clues, both predictions and the lock action. The hero names Squeekchain and explains Pip as a bot. Live starts with onchain controls and Connect before the illustration; the undeployed state shows disabled actions and its deployment explanation on the first screen. Normal-flow controls avoid sticky overlap. English layouts were exercised at 320, 390, 768, 820, 1080 and 1440px; native zoom, RTL and localization expansion remain unperformed rather than inferred.

## Surfaces, shape and depth

The game has one 16px rounded structural border; its stage uses a matching 15px inner top radius. There are no nested panel cards or border-plus-shadow surfaces. Inputs have 9px radii, primary/secondary buttons 8px, mode group 10px/6px, outcome cells 6px and avatars 50%.

Dialogs are the only elevated surface: 18px radius, no border, `0 20px 80px #25291d30` shadow and `#23291e65` backdrop with 3px blur. The default dialog is at most 520px, roundbook 620px and wallet 420px; standard dialogs fit with 16px side clearance and an internal scroll area. The wallet variant uses a bottom sheet below 640px, with 8px clearance and 48px-minimum rows. The skip link is the only fixed control and is revealed by keyboard focus.

## Components and states

| Component/pattern | Source | Behavior |
| --- | --- | --- |
| Game state and score | `src/App.tsx`, `src/game.ts` | Choose → revealing → result → next round → finished; visible lock/result cues, streak and progress updates, explicit restart confirmation |
| Prediction choices | `src/components/ChoiceControls.tsx` | Native labeled radios in a fieldset; Run/Rest categories; checked border, hover and visible focus; arrow keys change selection |
| Hamster wheel | `src/components/Hamster.tsx` | Original decorative inline SVG; ready/run/rest/win mood; meaningful outcomes are also written as text |
| Primary/secondary actions | `src/styles.css` | One orange primary action; bordered neutral alternatives; hover, focus, active and disabled treatments; touch actions remain in normal flow |
| Match clues | `Trail` in `src/App.tsx` | Text alternatives for Run/Rest icons; six warm-up/match laps with oldest-to-newest key; warm-up explicitly labeled; compact mobile strip near controls |
| Dialog | `src/components/Dialog.tsx` | Native `showModal`, inert background, explicit Tab wrap, Escape/backdrop close and trigger-focus restoration; close button has a name |
| Roundbook | `src/App.tsx`, `src/storage.ts` | Empty, populated, exported and clear-confirmation states; semantic table, last 20 completed matches |
| Live game | `src/components/LiveGame.tsx`, `src/live.ts` | Loading, matched feed, locally locked prediction, pending/result, paused, stale, unavailable and error states; one-minute freshness guard. Green status dot exists only for a validated snapshot; errors expand the explanation. Practice instructions are absent in Live |
| Onchain points | `src/components/OnchainGame.tsx`, `src/handoff.ts`, `src/wallet.ts` | Live-only lazy module; reads handoff, checks code/core, reads wallet score, simulates Predict/Settle, waits for receipt, reports rejection/failure/confirmation. No address means disabled actions with an explicit deployment message. Round input validates uint64 bounds; addresses/hashes wrap fully |
| Wallet connection | `src/components/ConnectWallet.tsx` | One Connect control; named extension discovery, phone app links, Coinbase Wallet/Smart Wallet; per-row pending state, readable rejection, chain switch/add, checksummed account and Disconnect. Reuses Dialog focus trapping, Escape/backdrop close and focus return |
| Icons | `src/components/Icon.tsx` | One currentColor SVG set with 1.7px round strokes; decorative icons hidden from assistive technology |

## Motion and interaction

There is no page-load animation. Button transitions name only background, color and transform, take 120ms, and press at scale 0.96. Wheel/paw motion exists only during a short reveal. A visible pause and immediate-reveal control are available. Locking moves focus to Pause reveal; changing to Live pauses a running practice reveal until the player returns and resumes it. Under reduced motion, animations/transitions stop and results advance after 150ms instead of the normal 2.2-second reveal. Optional tones have corresponding visible result text and are off by default.

A stable polite live region announces important game results. Inline live failures retain a recovery action. Browser storage failures produce a visit-only notice while leaving play available. Custom focus is 3px solid with an offset; forced-colors rules retain system-visible selection/button edges.

## Reuse

Use the existing page shell and six-size scale for another view. Reuse the primary/secondary action classes and native controls. Keep Run/Rest categories consistent, keep data next to the choice it informs, and label simulated/local/onchain results accurately. Add modes through the existing mode group; do not insert a marketing hero above the game or introduce another primary accent. Use the existing ConnectWallet/OnchainGame integration for wallet actions, with the real runtime deployment handoff and imported ABI. Never substitute browser scores for contract reads or a made-up address for a pending deployment. Full contract addresses and transaction hashes wrap; the account control alone uses a short label with the full address available in its dialog.

Design guidance was adapted from [Jakub Krehel's Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface), MIT. Documentation guidance was adapted from [Paul Bakaus's Impeccable document guide](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md), Apache-2.0. Full pinned license texts/notices are preserved in `docs/BETTER-INTERFACE-LICENSE.txt`.
