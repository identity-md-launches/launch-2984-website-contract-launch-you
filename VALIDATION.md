# Wheelhouse revision validation

Local worker observations on 2026-11-05. These checks do not independently certify behavior or a public deployment.

## Revision scope

Preserved the accepted practice game, original artwork, scoring, storage/replay, contract implementation, ABI and deployment pin. Addressed all twelve reported findings. Added the missing Live-to-contract integration and its explicit undeployed state; no owner/address/token/manifest was invented. `.imd-responses.json` answers each finding with its original ID.

## Acceptance coverage

| Requirement | Result |
| --- | --- |
| Usable website and primary interactions | Full five-round practice game, saved/exported history, pause/resume/reveal, downloads and live browser picks pass. Wallet/RPC fixtures exercise Predict, Settle and scores |
| Source, lockfile and static export | Vite base `./`; complete local assets in `dist/`; both browser suites serve `/preview/`; no local resource failures |
| Build/typecheck/interaction validation | Production build and explicit typecheck pass; 11 Node tests and 31 browser checks pass |
| First screen at 390 | Practice product, simulation disclosure, warm-up clues, choices and Lock action fit at 390×844. Live shows Connect, disabled onchain actions and deployment explanation before the illustration |
| Metadata | Existing title, favicon, description, og:title and local PNG share image retained; probe passes |
| Six-domain design review | Applied pinned Better Interface to changed surfaces; coverage and limits below. All 16 pinned taste checks pass |
| Design and installation docs | `DESIGN.md` updated from final source; README documents install, preview, rebuild, wallet use, handoff and actual limitations |
| Real deployment | After review, by the network. No handoff supplied: shipped runtime record explicitly says awaiting deployment; transaction controls remain disabled |

## Reproductions, corrections and rechecks

| Finding / source | Reproduction | Correction and evidence |
| --- | --- | --- |
| Contract orphaned: `src/components/OnchainGame.tsx:49`, `src/wallet.ts` | Accepted frontend had no wallet/client/contract call; Live saved only editable local picks | Imported exported ABI; runtime handoff address; EIP-6963/mobile/Coinbase connections; simulated Predict/Settle and RPC score reads. Explicit disabled undeployed state. Fixture verifies destinations, arguments, pending/rejected/confirmed states and score refresh |
| Misleading feed state: `src/components/LiveGame.tsx:117`, `src/live.ts:90` | Browser error displayed three green dots and closed explanation. Public API still reports a different core | App dots deleted; one snapshot-dependent dot remains; plain pause heading/message; details open on error. Identity-error fixture verifies these states; pin unchanged |
| Mixed-batch Rest: `src/live.ts:266` | Exact reported batch (170,186], active=1, work=6, event round 186 left pick 180 pending | Unique positive-work events covering the certified active count prove omitted rounds Rest. Unit tests retain pending for incomplete, duplicated, unsafe or out-of-span evidence |
| Practice instructions under Live: `src/App.tsx:612` | Browser found `.how-strip` while Live selected | Strip is practice-only; regression checks zero strips in Live |
| Match rule and hero: `src/App.tsx:223`, `src/App.tsx:464` | Source confirmed five rounds/point winner/draws and unexplained Pip | Truthful points rule and requested Squeekchain/Pip sentence. First-screen screenshot and six-width checks pass |
| Seeded history: `src/App.tsx:51`, `src/App.tsx:327`, `src/App.tsx:550` | Every replay begins from the same WARMUP | Warm-up/match labels and trail accessibility text corrected; WARMUP and `src/game.ts` unchanged |
| Redundant Play nav: `src/App.tsx` navigation | Handler could be a no-op and did not change modes | Button/current styles removed; browser asserts absent |
| Hidden reveal and focus: `src/App.tsx:114`, `src/App.tsx:241` | Keyboard Lock left BODY focused; entering Live then returning showed one result had advanced | Focus Pause on reveal; pause before changing mode. Regression returns to Resume reveal with zero results, then explicitly resumes |
| Weak selected state: `src/styles.css:462` | Mobile hides radio indicator, leaving thin border/tint | Two-pixel ink selection perimeter via inset shadow; selected state and keyboard focus screenshots inspected |
| Filler: `src/App.tsx:635` and stage/finished panels | Three reported lines duplicated or added no information | Removed lines; retained footer, useful scorecard download and left-aligned bottom link. Full match/download and screenshots rechecked |

Additional corrections found during validation: removing the last desktop caption exposed an older `:last-child` mobile rule that hid the clue strip; removed that obsolete rule and visually confirmed clues. Axe found a nested complementary landmark in Live; replaced the supporting aside wrapper with a plain layout div. Contract writes also disable during failed/refetching handoffs and missing/unconfigured/mismatched core checks, preventing stale cached configuration from enabling a write.

## Better Interface coverage

| Domain | Checked | Limits |
| --- | --- | --- |
| Accessibility | Native labeled radios and round input, uint64 error text, keyboard Lock→Pause, mode pause, dialog Tab/Escape/focus return, named Connect rows, polite statuses; axe clean on practice ready/finished/rules and undeployed/connected Live | No screen-reader session or complete WCAG conformance claim |
| Layout | Screenshots and overflow at 320/390/768/820/1080/1440 for practice; 320/390/1440 for Live error; wallet bottom sheet and connected 390 screenshot inspected; primary action measured within first phone screen | Native zoom, RTL and localization expansion unperformed |
| Writing | Squeekchain and Pip identified, points rule accurate, warm-up labeled, practice-only instructions, no misleading green dots on errors, local/onchain scores distinguished, gas and deployment status explicit | No localization review |
| Typography | Existing six-token scale, two local families, three weights retained; probe reports five sizes per entry width; addresses and hashes wrap without clipping | No physical OS rendering comparison |
| Colors | Existing palette retained; stronger selected perimeter; pinned contrast check passes, changed Live states pass axe | No new manual ratio claim; forced-colors and dark-mode review unperformed (no dark theme supplied) |
| UI | Loading/undeployed/wrong-chain/rejected/pending/confirmed/failed-read states; account Disconnect; missing bytecode/core guards; no fake scores; practice motion pauses off-screen and respects reduced motion | Wallet apps, passkey creation and public signatures not exercised; no 10%-speed Animations-panel session |

One visual idea remains: the illustrated hamster wheel on warm paper, with orange actions and Run/Rest categories. No redesign or extra font system was added.

## Actual commands and results

| Check | Result |
| --- | --- |
| `npm run build` | Exit 0; TypeScript and Vite export successful |
| `npm run typecheck` | Exit 0 |
| `npm test` | 11 passed, 0 failed; includes scoring/replay invariants, timing/identity guards, mixed settlements and handoff/round validation |
| `node --experimental-strip-types scripts/validate-ui.mjs` with supplied Playwright/Chromium variables | Exit 0; 17 checks pass: full match, responsive layout, keyboard/modal behavior, storage, downloads, local-live fixtures, errors and static resources |
| `node --experimental-strip-types scripts/validate-onchain.mjs` with the same variables | Exit 0; 14 checks pass: focus, mode pause, undeployed/error layout, phone links, EIP-6963, rejection retry, add/switch chain, transaction encoding/receipts, score reads, uint64 bounds, core/handoff guards and Disconnect |
| Pinned `taste.mjs --out test/scratch/taste` | Exit 0; 16/16: render, layout, targets, contrast, casing, tracking, eyebrows, type sizes/faces, glyphs, slogans, repetition, copy budget, chrome, motion and share |
| Axe | Zero violations in selected WCAG/best-practice tags on practice ready/finished/rules, Live identity error and connected fixture |
| `forge build --offline && forge test --offline && forge fmt --check` | Exit 0; 3 Solidity files compiled, 18 tests passed, including 256 runs for each fuzz property. Contract files are unchanged |
| `slither . --exclude-informational --exclude-optimization --exclude-low` | Not run successfully: command unavailable (`slither: command not found`). Previous-round analysis is not claimed as rerun |
| `npm audit --omit=dev --json` | Zero production dependency vulnerabilities reported during revision |
| `python3 scripts/check-delivery.py` | Required outputs, relative assets, ABI JSON, source/export budgets and 8 MiB total checked; checker accounts for removed old hashed bundles before worker staging |
| `git check-ignore -v dist/index.html` | No output; export remains eligible for the worker's commit |

Pinned probe reports 30 prose words on the first 390 screen (bar 60), 45 at 1440 (bar 90), two families and weights 400/600/700. All nine entry controls meet the 24px-or-spacing rule; seven compact secondary controls remain below the optional 44px comfort size.

Disposable evidence is under `test/scratch/ui/`, `test/scratch/onchain/` and `test/scratch/taste/`. Inspected practice phone/desktop, Live undeployed/error/connected and phone wallet screenshots. These are removed before delivery; the reusable validation scripts remain. Public API results and all wallet/RPC fixtures are clearly separated: no production fallback data was added.

## Live and deployment limitations

A command-line GET to `https://api.squeekchain.com/v1/core` still returned core `0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4`, installation `sepolia-core-sepolia-20261103`, frontier 186. That differs from the unchanged published pin. The actual browser instead reached its recoverable network-error state. Identity mismatches, available feed/predictions and settlements were exercised using explicit fixtures. No real live outcome or public-chain transaction is claimed.

The runtime handoff contains no deployed game address. The network must deploy the accepted contract, supply its actual handoff, and the owner must configure a reviewed core. New predictions require the existing API identity guard to pass. Settlement still uses the game contract's own certification checks when the API is unavailable. The frontend uses the Sepolia definition bundled with viem and the local exported game ABI; it never adopts the API-reported replacement identity.

Browser validation used Chromium; WebKit, physical wallets/mobile app launches, passkeys, screen readers, native zoom, physical audio and manual forced-colors checks remain unperformed. No hosting or wallet transaction was requested/performed. The final static export is below 1 MiB and the eligible source/export bundle is below 2 MiB, within the 8 MiB assignment ceiling and documented path budgets.
