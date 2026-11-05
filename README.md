# Wheelhouse

A playable hamster prediction game for the Squeekchain economy. Predict **Run** or **Rest**, watch the wheel reveal the outcome, and outscore the rule-based opponent Pip across five rounds. The site includes original SVG hamster art, streak scoring, browser persistence, a roundbook, JSON exports and downloadable SVG scorecards.

**Practice works immediately and uses simulated rounds.** Live mode supports free browser-local predictions on future Squeekchain rounds, with explicit availability and identity checks. The companion Solidity points contract is included for the network's later deployment. This export does not sign transactions or claim a deployed game address.

## Install, preview and rebuild

Use Node 22.13+ (or a newer compatible Node 22 release) and npm:

```sh
npm ci
npm run dev
```

Build and preview the production export:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Vite uses `base: './'`. Deliver **all of `dist/`**, including its local JS, CSS, WOFF2 fonts, favicon and PNG share image. Static hosting needs no backend, rewrite rules, private credentials or environment file. Practice makes no external requests. Live mode contacts the documented public API only when selected/refreshed. The export was exercised under `/preview/`, not only at an origin root.

The worker commits the delivered files; this task does not modify Git metadata. `.gitignore` deliberately includes `dist/` and excludes dependencies and caches at every nesting level. The explicit path budget is in that file. Run `python3 scripts/check-delivery.py` to verify eligible outputs, relative assets and the 8 MiB ceiling.

## Rules

- Run means positive work; Rest means zero work in a certified round.
- Practice has five rounds. A correct prediction gives 100 points, plus 25 for each preceding consecutive correct prediction, capped at 200 per correct round. A miss resets the streak. A perfect match scores 750.
- Pip picks the majority of the last three displayed outcomes. Pip uses the same scoring rule and cannot see the future. It is a statistical baseline, not a hosted AI model.
- The simulation repeats the last behavior with probability 0.62. Its seed is generated locally with Web Crypto, and saved matches replay from their seed and picks. There is no stake, transferable token, financial prize or public leaderboard.
- Browser storage retains the current match and the last 20 completed matches. Clearing history requires confirmation. If storage is blocked, the game still works for the visit. Local scores are editable and are not attestations.
- Sound is off initially. Reveal motion can be paused or skipped and respects reduced motion.

## Live rounds and honest limitations

Integration references:

- [Full Squeekchain documentation](https://docs.squeekchain.com/llms-full.txt)
- [HTTP API and response definitions](https://docs.squeekchain.com/developers/api/)
- [Published Sepolia deployment record](https://docs.squeekchain.com/assets/deployments/sepolia.json)
- [SqueekCore and roundPage semantics](https://docs.squeekchain.com/developers/core/)

`src/deployment.ts` is the published deployment record retrieved on 2026-11-05. `src/live.ts` accepts core schema 1 and settlement schema 3, uses `bigint` for round/block/work values, checks the chain and pinned core identities/configuration, and checks that settlement and core responses identify the same installation. Unknown schemas, unavailable HTTP-200 responses, timeouts, rate limits and mismatches produce recovery messages. A snapshot older than one minute must be refreshed before a new prediction.

Predictions close before the target round starts and are separate from practice. A result requires the certified frontier and either an exact safe `RoundRecorded` event, a certified all-zero batch, or an all-active batch. A missing event is **never** evidence for Rest. The API only returns bounded recent history: an old or mixed-batch prediction can remain pending if the available responses cannot prove its individual result. Browser-clock timestamps and editable local storage make this a casual game, not a secure prediction market. Twelve-confirmation API reads reduce short-reorg exposure; browser-local resolved picks are not a full reorg-aware indexer.

During implementation, command-line requests reached the public API, which reported a different core deployment from the published record and no settled work on that current deployment. The identity check intentionally rejects that mismatch. The browser validation environment could not fetch the public API; its recoverable network state was inspected. Successful live prediction/settlement flows were tested with explicit matching fixtures, **not** asserted as observed live settlements. Practice remains fully usable in both cases.

To update the pin later, review a newly published deployment record and protocol ABI first, update `src/deployment.ts`, then rerun parser tests and browser validation. Never silently follow an API-reported replacement address.

## Contract interface and after launch

`src/WheelhouseRounds.sol` implements **free onchain points** for future rounds. Its scoring is deliberately simpler than practice: 100 for a correct certified prediction, zero otherwise; settlement order cannot affect a streak. It holds no funds or tokens and has no mint, transfer, fee, withdrawal, proxy, pause or upgrade capability. No additional launch token was requested or created.

| Interface | Behavior |
| --- | --- |
| `constructor(address initialOwner)` | Takes the requester/launch owner, validates nonzero and calls no external contract |
| `configureCore(address)` | Owner-only, emits `CoreConfigured`, sets the reviewed SqueekCore once; cannot be changed |
| `predict(uint64 round, bool willRun)` | One fixed choice per address for exactly the next not-yet-started round |
| `settle(address player, uint64 round)` | Permissionless; reads one certified `roundPage(round-1, round, 1)` and credits that player exactly once |
| `predictions`, `scores`, `settledPicks` | Public records; there are no rewards of monetary value |

The ABI is `docs/abi/WheelhouseRounds.json`. Before configuration, prediction calls revert `CoreNotConfigured`. Paused SqueekCore blocks new predictions while allowing already-certified history to settle. A changed core implementation, layout or stream/configuration stops reads; there is no owner override or migration. Governance/Reporter trust in Squeekchain remains. A malicious source can misreport itself, so configuration requires review rather than relying on identity getters alone.

**After launch:** the owner calls `configureCore(address)` with the reviewed **Sepolia SqueekCore proxy** from Squeekchain's published deployment record. Obtain and independently verify the address, implementation/runtime identity, version 3, storage layout, stream and configuration using the official quickstart. The API mismatch observed in this task must be resolved before this action. The setter is one-time; it is not safe to guess. Until then, the contract stays unconfigured. The website's local gameplay does not depend on deployment and does not submit calls to this contract.

Deployment is handled by the network deployer after review. `script/Deploy.s.sol` accepts the real launch owner as an explicit argument and enforces Sepolia chain ID 11155111. It reads no keys/environment and does not broadcast. Operator-only offline dry run (the operator supplies `OWNER_ADDRESS`, never a placeholder):

```sh
forge script script/Deploy.s.sol:Deploy --offline --chain-id 11155111 \
  --sig 'run(address)' "$OWNER_ADDRESS"
```

No manifest or broadcast is included. Any future wallet-enabled transaction UI must use the network wallet connector policy and a real deployment handoff.

## Contract build and checks

Solc 0.8.26 must already be available for an offline build. No vendored libraries, remote imports, FFI, filesystem permissions, environment-dependent tests or forked RPC are needed.

```sh
forge build --offline
forge test --offline
forge fmt --check
forge build --sizes
forge test --offline --fuzz-seed 0x576865656c686f757365 --fuzz-runs 1024
slither . --exclude-informational --exclude-optimization --exclude-low --exclude-medium
slither . --exclude-informational --exclude-optimization --exclude-low
forge inspect WheelhouseRounds abi --json > docs/abi/WheelhouseRounds.json
```

## Browser checks

Use the provided Playwright/Chromium installation. `scripts/validate-ui.mjs` manages a foreground subpath preview, browser and cleanup in one command; it writes disposable evidence only to `test/scratch/ui/`:

```sh
IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright \
node --experimental-strip-types scripts/validate-ui.mjs
```

The module can instead be an independently supplied compatible Playwright installation. The script uses `axe-core` from the declared dev dependencies. To regenerate the social PNG from `design/share.svg`, use the same Playwright variables with `node scripts/render-share.mjs`, then rebuild.

The task's pinned taste probe was also run before the final build. Its input script is task-supplied and is not part of the delivered product:

```sh
IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright \
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

Final local results: production build and typecheck passed; **9 unit tests, 17 browser checks, 18 contract tests and all 16 taste checks passed**. Axe reported zero violations in the ready, finished and rules-dialog scans. Slither reported zero High/Medium findings. The complete static export is **446,104 bytes** and the eligible delivery is below 1 MiB.

Actual results, fixes, six-domain review coverage and remaining limitations are recorded in `VALIDATION.md`; contract findings and trust assumptions are in `REVIEW.md`. These are worker-side observations, not independent certification. Physical devices, screen-reader sessions, native browser zoom and public onchain transactions were not tested.

## Source and licenses

React + TypeScript + Vite; local Fontsource DM Sans and Bricolage Grotesque WOFF2 fonts. Original interface/game/art sources are MIT; font OFL texts and the pinned design-reference licenses/notices are in `docs/`. No runtime asset is loaded from a third-party CDN.
