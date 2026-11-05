# Wheelhouse contract and integration review

The checks below are the accepted previous-round review record. This revision leaves the Solidity implementation and ABI unchanged; current reruns and the new website integration are recorded in `VALIDATION.md`.

This is a worker adversarial review, not an independent audit or a deployment approval. Scope: `src/WheelhouseRounds.sol`, `script/Deploy.s.sol`, the test suite, `src/live.ts` and their documented boundary with the local game. No funds were sent and no contract was deployed to a public chain.

## Findings and dispositions

| Area | Finding / risk | Disposition and evidence |
| --- | --- | --- |
| Configuration | An unspecified or rotating core could make outcomes refer to another stream | Owner must configure the real reviewed core once after launch; constructor makes no external calls. Unconfigured, unauthorized, EOA and duplicate-configuration paths are tested. Source: `src/WheelhouseRounds.sol:107` |
| Settlement | A round past the certified frontier must not be treated as zero | `settle` checks the frontier, then requires a complete one-round page and compares cumulative work. Certified zero, active work, wrong prediction and incomplete-page cases are tested. Source: `src/WheelhouseRounds.sol:148` |
| Replay and scoring | Repeated settlement or a third-party settler must not create extra/redirected points | Existence and settled flags guard each player/round. Points always accrue to the named player. Duplicate picks/settlements and permissionless settlement are tested. Each correct onchain pick gives exactly 100, independent of ordering |
| Timing | A player must not predict a round that has already started | Only the next not-yet-started round is accepted. Pre-genesis, exact start boundary, current/past/far-future rounds and bounded timing fuzz tests cover it. Foundry's timestamp lint warning is expected: ten-minute game windows intentionally use chain time; points have no monetary value |
| Upgrade/governance | SqueekCore is a governed proxy, not a trustless measurement source | The configured implementation address, version, layout and relevant stream configuration are checked on each use. Changes stop the game. No migration/override exists. Identity getters still require trust in the reviewed source and its governance; a malicious source can lie about itself |
| Live browser data | Current API deployment differs from the pinned published deployment | The reader rejects it. Schema, chain, identity/configuration and cross-endpoint installation checks are present. Local live records are not onchain receipts. No identity mismatch is bypassed |
| Bounded API history | Missing/mixed history may not prove an individual round | Results remain pending unless an exact active event or a fully classifiable certified batch proves them. This limitation is documented, rather than treating absence as Rest |
| Local practice | Scores can be edited/replayed by their owner | Explicitly disclosed. They confer no reward, authority or ranking and are separate from contract scores |

No unresolved source defect with a demonstrated High or Medium impact was found in this review. Operational limits above remain; the worker's conclusion is not independent certification.

## Re-run checks

- Offline root build and all **18 Foundry tests** passed; two tests fuzz certified work and prediction timing with 256 runs each under the default profile.
- A second seed `0x576865656c686f757365` with **1024 runs per fuzz test** passed all 18 tests.
- A clean source-only export, containing `foundry.toml`, the Solidity source, top-level test and deploy script, compiled **3 Solidity files** and passed the same 18 tests offline. Its formatting check and High-only Slither pass succeeded. This was a copied input tree; no Git staging/metadata was modified.
- `forge fmt --check` passed.
- Slither **0.11.6**, High-only: **0 results**; High+Medium: **0 results**. The analyzer excludes informational/optimization/Low findings for these runs. It was installed only in disposable scratch after the bare `slither` command was unavailable.
- `forge build --sizes`: `WheelhouseRounds` runtime **5,116 bytes**, initcode **5,287 bytes**. Both are below EIP-170/EIP-3860 limits. The dry-run helper's runtime/initcode were 5,581/5,609 bytes.
- `forge script script/Deploy.s.sol:Deploy --offline --sig 'run(address)' <test fixture owner> --chain-id 11155111` succeeded with no RPC or broadcast. Tests separately verify wrong-chain rejection and preservation of the supplied owner. The test fixture address is not a launch configuration.
- `docs/abi/WheelhouseRounds.json` was exported with `forge inspect WheelhouseRounds abi --json` and parsed as a JSON array with 30 entries.
- The browser/parser game checks are recorded separately in `VALIDATION.md`.

## After-launch requirements and remaining limits

The network deployer supplies the real requester-owned address; none is guessed in a manifest. After deployment, that owner obtains the current reviewed Sepolia SqueekCore proxy from the official deployment record and calls `configureCore`. The observed API/documentation mismatch must be resolved before configuration. No launch manifest is written in this implementation step.

Practice and browser picks are usable without deployment. The revised site includes the network wallet connector and simulated Predict/Settle transaction flow, gated by a real deployment handoff. Its shipped awaiting-deployment record leaves transactions disabled; no deployed address or public signature is claimed. The contract intentionally has no money/token/reward path. It does not prevent Sybil addresses, guarantee Reporter honesty, provide a reorg-proof public tournament, or recover after an incompatible upstream upgrade. No public-chain end-to-end transaction, independent audit, physical-device test or screen-reader session was performed.
