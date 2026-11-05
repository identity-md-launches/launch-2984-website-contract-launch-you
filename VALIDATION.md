# Wheelhouse validation

Worker observations on 2026-11-05. These are local checks, not independent certification by the contributor network.

## Scope and choices

Delivered a Vite/React/TypeScript static prediction game and a deployable, unconfigured Solidity points companion. Practice is explicitly simulated, complete and usable without a wallet or network. Live mode is a browser-local prediction flow over certified Squeekchain rounds; it does not sign transactions. No new token, guessed game address, hosting or public deployment is claimed.

The app defaults to practice because the real API's current deployment differs from the published deployment record and had no settled work at the time of the command-line read. That is not a reason to invent real rounds. The reader pins the published identity, rejects mismatches and preserves unknown outcomes. Original game logic and SVG artwork make this a playable product rather than an API dashboard or landing page.

## Acceptance coverage

| Requirement | Result and evidence |
| --- | --- |
| Usable product and primary interactions | Passed a full five-round match, score/streak/progress updates, pause/reveal, next round, restart, history, deletion confirmation and downloads |
| Responsive layout | Rendered at 320, 390, 768, 820, 1080 and 1440; no horizontal document overflow in the automated checks |
| Product/main action on first 390 screen | Screenshot inspected; at 390×844 the game, simulation label, six clues, Pip's pick, both predictions and lock action fit on the first screen |
| Static export plus source/lockfile | `dist/index.html` and all local assets exist; Vite base `./`; subpath `/preview/` run reports no missing local files. `dist/` is eligible for the worker's commit and not ignored |
| Build and typecheck | `npm run build` and `npm run typecheck` exited 0 after the final source change |
| Useful validation | Nine Node tests, 17 browser checks and 18 Solidity tests, including two fuzz properties; results below |
| Six-domain review | All six domains checked for delivered states; explicit unperformed subchecks below |
| Metadata | Title, description, favicon, og:title and 1200×630 PNG og:image; local share image rendered from authored SVG and visually inspected |
| Documentation | Root `DESIGN.md`, `README.md`, `REVIEW.md`; implemented tokens, typography, components, states and build/preview commands documented |

## Better Interface six-domain review

| Domain | Status | Evidence / limits |
| --- | --- | --- |
| Accessibility | Checked | Native labeled radios, fieldset/legend, landmarks, skip link, named icon controls, polite result region and semantic history table; keyboard arrows/Enter/Tab/Escape, visible radio focus, native modal with explicit Tab wrap and focus return; axe scans on ready/finished/rules. No screen-reader session or complete WCAG conformance claim |
| Layout | Checked | Actual screenshots and overflow measurements at six widths; primary action measured inside 390×844; mobile clues beside controls; empty/history/dialog/live/error states exercised. Native 200% zoom, RTL and localization expansion not performed |
| Writing | Checked | Product/action named directly; simulation/local/onchain distinctions; consistent Run/Rest/round vocabulary; recoverable network/unavailable/rate-limit messages; short slogan stack removed. No localization review |
| Typography | Checked | Two local font families; 400/600/700 weights; five sizes per entry viewport within six tokens; hierarchy, wrapping and tabular scores inspected. No physical OS/font-rendering comparison |
| Colors | Checked | Taste measured solid text/background pairs and passed; source-token pair computations below; stronger control boundary added; selected state includes dark border/native checked state. No dark theme; forced colors implemented but not manually inspected |
| UI details | Checked | Ready/revealing/paused/result/finished, selected/hover/focus, history empty/populated/clear confirmation and live loading/errors checked; no nested panel cards or border-plus-shadow surfaces; short opt-in motion, pause/skip and reduced-motion test. Physical audio and Animations-panel 10% replay not manually checked |

Wallet connector checks are not applicable because this export signs nothing. The contract is a separately supplied after-launch integration, not a fake wallet connection.

## Findings fixed and rechecked

| Severity / domain | Final source location | Observed problem | Change and recheck |
| --- | --- | --- | --- |
| Medium / writing | `src/App.tsx:227`, `src/App.tsx:622` | First production taste run reported six short two-beat lines | Removed extra hero note and replaced repeated slogans with direct instructions; final slogans check passes |
| High / layout | `src/styles.css:1701` | New mobile clues exposed a desktop caption through a more-specific selector, making the 320px page 367px wide | Corrected direct class selector and compacted clue cells at 360px, retaining labels; six-width checks and final taste layout pass |
| High / accessibility | `src/components/Dialog.tsx:37` | Keyboard traversal could leave the intended dialog focus loop | Added first/last Tab wrapping to native showModal; retained Escape, inert background and focus return; twelve consecutive Tabs and Escape pass |
| Medium / writing | `src/live.ts:142` | Failed browser fetch exposed “Failed to fetch” without useful recovery | Mapped to a connection/retry instruction, retained abort/timeouts; actual browser failure and fixture recovery rechecked |
| Medium / accessibility | `src/styles.css:453`, `src/styles.css:549` | Unselected input/secondary-action edges had insufficient boundary contrast | Added `--control-border: #858d76`; measured 3.43:1 against the surface; final rendering, axe and taste rechecked |

No applicable unresolved High or Medium source finding remains from these checks. Provider/deployment availability and after-launch work remain explicit limitations.

## Actual commands and results

| Command / check | Result |
| --- | --- |
| `npm run build` | Exit 0; TypeScript and Vite production export succeeded |
| `npm run typecheck` | Exit 0 |
| `npm test` | 9 passed, 0 failed; includes 1000 seeded match invariants/replay, score cap, malformed saves, live identity/schema errors, exact time boundaries and certified vs unknown work |
| `node --experimental-strip-types scripts/validate-ui.mjs` with supplied Playwright/Chromium | Exit 0; **17 checks passed**; manages its own bounded foreground subpath preview and closes browser/server |
| Axe ready game | 38 rules passed, 0 violations in selected WCAG/best-practice tags |
| Axe finished game | 35 rules passed, 0 violations; focus moves to Play again |
| Axe rules dialog | 20 rules passed, 0 violations |
| Pinned `taste.mjs --out test/scratch/taste` with supplied Playwright/Chromium | Exit 0; **16/16 checks passed**: render, layout, targets, contrast, casing, tracking, eyebrows, type sizes, type faces, glyphs, slogans, repetition, copy budget, chrome, motion, share |
| `forge build --offline`, `forge test --offline`, `forge fmt --check` | Passed; 18 real tests in final root tree; clean source-only export compiled 3 Solidity files and passed 18 tests offline |
| Second fuzz seed / 1024 runs | All 18 tests passed; 1024 runs for each of two fuzz tests |
| Slither 0.11.6 High / High+Medium | 0 results in both filtered runs |
| `forge build --sizes` | Main runtime 5116 bytes, initcode 5287; within limits |
| Offline deploy script, Sepolia/test fixture owner | Succeeded without RPC or broadcast; tests also verify wrong-chain rejection and supplied owner |
| ABI export | `forge inspect WheelhouseRounds abi --json`; parsed 30-entry JSON ABI |
| `git check-ignore -v dist/index.html` | Printed nothing; export not ignored |
| `python3 scripts/check-delivery.py` | Required paths, relative assets, JSON ABI and byte budget checked |

The 17 browser checks cover ready/finished/rules accessibility; six-width reflow/first-screen action; keyboard input; pause; full match; SVG scorecard; roundbook/JSON export/dialog restoration; reload/deletion; restart confirmation; focus containment; actual public-feed error state; local live pick/zero-work settlement under a matching fixture; unavailable/rate-limit fixtures; blocked storage/reduced motion; subpath resources/console.

The browser MCP transport was unavailable. Rendered checks instead used the provided Playwright and Chromium in a bounded foreground script. Screenshots were generated and inspected; passing axe is not a screen-reader session or full accessibility certification.

## Measurements and evidence

- At 390px: 22 words of first-screen prose, below the 60-word bar. At 1440px: 37, below 90. Five sizes per width, two families and three weights.
- Nine entry controls satisfy the 24px-or-spacing target rule. Seven are below the optional 44px comfort size; compact secondary/mode controls retain separation. Main actions are at least 48px high.
- Solid token ratios: ink/paper 11.95:1; muted/paper 4.99:1; muted/surface 5.44:1; muted/stage 4.72:1; surface/accent 5.08:1; run ink/background 6.38:1; rest ink/background 5.79:1. Control boundary/surface: 3.43:1.
- Generated and viewed ready mobile/desktop, keyboard focus, finished-match and share-card images. Final entry views were additionally captured by the pinned probe.
- Disposable evidence: `test/scratch/ui/` contains `ready-390.png`, `ready-1440.png`, `finished-390.png`, `keyboard-radio.png`, `rules-390.png`, `live-actual-390.png`, `results.json`; `test/scratch/taste/` contains `taste.json`, `shots/390.png`, `shots/1440.png`. Scratch evidence is not submitted; the static product and repeatable validation scripts are.
- Byte budget: final delivery is below 1 MiB, against the 8 MiB limit; the full static export is 446104 bytes. The read-only delivery checker measures the final eligible file set and rejects missing/ignored outputs or excess bytes.

## Limitations and completion

Command-line HTTP reached the real API and observed a different core identity than the pinned published deployment. The current deployment had zero settled work; its status feed said settlement was disabled. The actual browser request failed to reach the provider and showed a friendly retry state. Valid live pick/settlement paths were exercised with explicit fixtures. No real live result, historical replay, deployed game contract, wallet transaction, financial reward, public leaderboard or independently verified oracle answer is claimed.

Native devices/zoom, screen readers, RTL/localization expansion, physical audio, manual forced-colors and public-chain transactions remain unperformed. The companion contract awaits the real launch owner and reviewed core configuration through the network's after-review deployment process. Upgrade/governance and local-score trust limits are in `REVIEW.md`.

**Complete for the delivered website and contract-source scope.** Source, lockfile, static runtime assets and documentation are present. Provider-dependent live end-to-end settlement and actual deployment remain unclaimed.
