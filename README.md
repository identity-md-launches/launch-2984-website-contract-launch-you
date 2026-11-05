# Wheelhouse

A playable hamster prediction game for the Squeekchain economy. Predict **Run** or **Rest**, watch the wheel reveal the outcome, and outscore the rule-based opponent Pip across five rounds. The site includes original SVG hamster art, streak scoring, browser persistence, a roundbook, JSON exports and downloadable SVG scorecards.

**Practice works immediately and uses simulated rounds.** Live mode offers browser-local picks and wallet-connected onchain points. Predict, Settle and contract score reads are wired to `WheelhouseRounds` using its exported ABI. No deployment handoff was supplied, so onchain actions show **“Onchain play opens once the contract is deployed.”** Connect remains available; no game address is guessed.

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

Vite uses `base: './'`. Deliver **all of `dist/`**, including its local JS, CSS, WOFF2 fonts, favicon and PNG share image. Static hosting needs no backend, rewrite rules, private credentials or environment file. Practice makes no external requests. Live mode loads the deployment handoff and documented public API when selected; with a deployed game it also reads Sepolia through viem’s public chain definition. Wallet SDK services are used only when connecting that wallet. The export was exercised under `/preview/`, not only at an origin root.

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

Predictions close before the target round starts and are separate from practice. A browser-pick result requires the certified frontier and either an exact safe `RoundRecorded` event, an all-zero/all-active batch, or a mixed batch containing every unique positive-work round named by its certified active count. In that complete mixed batch, an omitted round is Rest. An incomplete event page is **never** evidence for Rest. The API only returns bounded recent history: old picks can remain pending if the available responses cannot prove their result. Browser-clock timestamps and editable local storage make this a casual game, not a secure prediction market. Twelve-confirmation API reads reduce short-reorg exposure; browser-local resolved picks are not a full reorg-aware indexer.

During this revision, a command-line request reached the public API, which still reported a different core deployment from the published record (installation `sepolia-core-sepolia-20261103`, settled frontier 186). The identity check intentionally rejects that mismatch. The browser validation environment could not fetch the public API; its recoverable network state was inspected. Successful live prediction/settlement flows were tested with explicit matching fixtures, **not** asserted as observed live settlements. Practice remains fully usable in both cases.

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

**After launch:** the owner calls `configureCore(address)` with the reviewed **Sepolia SqueekCore proxy** from Squeekchain's published deployment record. Obtain and independently verify the address, implementation/runtime identity, version 3, storage layout, stream and configuration using the official quickstart. The API mismatch observed in this task must be resolved before this action. The setter is one-time; it is not safe to guess. Until then, the contract stays unconfigured. Practice and browser picks remain separate from the contract score. Onchain prediction requires a fresh, matching feed and the correct wallet chain. Settlement can proceed from its round number even when the API is unavailable; the contract simulation checks certification.

Deployment is handled by the network deployer after review. `script/Deploy.s.sol` accepts the real launch owner as an explicit argument and enforces Sepolia chain ID 11155111. It reads no keys/environment and does not broadcast. Operator-only offline dry run (the operator supplies `OWNER_ADDRESS`, never a placeholder):

```sh
forge script script/Deploy.s.sol:Deploy --offline --chain-id 11155111 \
  --sig 'run(address)' "$OWNER_ADDRESS"
```

No manifest or broadcast is included.

### Website deployment handoff

The website reads **`./imd-deployment.json` at runtime**, relative to the static export. The shipped file explicitly says `{ "status": "awaiting-deployment" }`; it contains no contract address. A deployment handoff supplies `network.chainId` as the number `11155111` and `contracts.WheelhouseRounds.address` as the actual deployed address. Other handoff metadata is retained. The build copies `.imd/reads/deployment.json` unchanged into `dist/imd-deployment.json` when that input exists. Retain the real handoff at `public/imd-deployment.json` for later rebuilds after task inputs have been removed. No source address edit is needed.

`src/handoff.ts` validates the handoff and rejects missing/zero/invalid addresses and other chains. `src/components/OnchainGame.tsx` checks deployed bytecode and the configured core against the existing Squeekchain pin. An unconfigured/mismatched core or a failed handoff refresh blocks writes. `docs/abi/WheelhouseRounds.json` is the imported ABI, not a duplicated handwritten signature list.

Live has one Connect control: named EIP-6963 browser wallets, MetaMask/Coinbase/Rabby/Phantom app links on phones without a provider, and Coinbase Wallet/Smart Wallet. Connected, it shows a shortened checksummed address and opens a full-address/Disconnect dialog. Wrong-chain state switches/adds Sepolia using wagmi’s known-chain parameters. No relay, project ID or private key is needed. Wallet code loads only when entering Live.

Predict calls `predict(round, willRun)` and Settle calls `settle(connectedPlayer, round)`, both after simulation and explicit wallet confirmation. Transactions require **Sepolia testnet gas**, despite having no wager or valuable reward. Pending/rejected/failed/confirmed states and an explorer receipt link are displayed. Scores are read with `scores(player)` and refreshed after confirmation; browser scores never supply them. Enter an earlier predicted round number to settle it after a reload. A successful wallet/RPC fixture is not a public-chain transaction.

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

The same variables run `node --experimental-strip-types scripts/validate-onchain.mjs`. Its 14 checks cover the undeployed state, focus/reveal regressions, mobile links, EIP-6963 connection, rejection/retry, Sepolia add/switch, simulated calldata, pending/confirmed transactions, contract-score refresh, invalid round input, missing bytecode, unconfigured/mismatched core, invalid refreshed handoff and disconnect. Wallets and chain responses in those checks are explicit test fixtures.

The module can instead be an independently supplied compatible Playwright installation. The script uses `axe-core` from the declared dev dependencies. To regenerate the social PNG from `design/share.svg`, use the same Playwright variables with `node scripts/render-share.mjs`, then rebuild.

The task's pinned taste probe was also run before the final build. Its input script is task-supplied and is not part of the delivered product:

```sh
IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs \
PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright \
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

Revision results: production build and typecheck passed; **11 unit tests, 31 browser checks (17 existing + 14 revision/wallet), 18 unchanged-contract tests and all 16 taste checks passed**. Axe reported zero violations in ready, finished, rules, Live-error and connected-Live scans. The full static export is **937,708 bytes**; the delivery checker enforces the 8 MiB bundle limit and the explicit path budgets. Slither could not be rerun: its command was unavailable in this revision runtime. No Solidity implementation changed.

Actual results, fixes, six-domain review coverage and remaining limitations are recorded in `VALIDATION.md`; contract findings and trust assumptions are in `REVIEW.md`. These are worker-side observations, not independent certification. Physical wallet apps/passkeys, WebKit, screen-reader sessions, native browser zoom and public onchain transactions were not tested. Real live prediction still requires Squeekchain’s API and published deployment identity to agree.

## Source and licenses

React + TypeScript + Vite; local Fontsource DM Sans and Bricolage Grotesque WOFF2 fonts. Original interface/game/art sources are MIT; font OFL texts and the pinned design-reference licenses/notices are in `docs/`. Site fonts/art and wallet marks are bundled locally; optional wallet SDKs contact their vendor services only for wallet operations. Wallet mark attribution is in `docs/WALLET-MARKS.md`.
