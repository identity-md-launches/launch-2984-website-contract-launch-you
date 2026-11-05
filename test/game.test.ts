import test from "node:test";
import assert from "node:assert/strict";
import {
  MATCH_LENGTH,
  WARMUP,
  pipPick,
  randomAt,
  resolveRound,
  restoreMatch,
  streak,
  total,
  type Choice,
  type Match,
} from "../src/game.ts";
import {
  parseCore,
  nextRound,
  makeLocalPick,
  resolveLocalPick,
  type LocalPick,
} from "../src/live.ts";
import { DEPLOYMENT } from "../src/deployment.ts";

function coreFixture() {
  const c = DEPLOYMENT.contracts.SqueekCore;
  return {
    schemaVersion: 1,
    status: "available",
    installationId: "test-installation",
    chain: { chainId: "11155111", safeThroughBlock: "12000000" },
    identities: {
      core: String(c.address),
      proxyImplementation: c.implementation,
      proxyAdmin: c.proxyAdmin,
    },
    implementation: {
      codeVersion: "3",
      runtimeHash: c.implementationRuntimeHash,
      storageLayoutDigest: c.storageLayoutDigest,
    },
    configuration: {
      streamId: DEPLOYMENT.coreConfiguration.streamId,
      genesisTimestamp: String(DEPLOYMENT.coreConfiguration.genesisTimestamp),
      roundDuration: "600",
      maxWorkPerRound: "10000",
    },
    core: { settledThroughRound: "5", paused: false },
    events: [] as unknown[],
  };
}
function settlements(active: string, work: string, from = "5", through = "6") {
  return {
    schemaVersion: 3,
    status: "available",
    installationId: "test-installation",
    chain: {
      chainId: "11155111",
      deploymentBlock: String(DEPLOYMENT.deploymentBlock),
    },
    recentSettlements: [
      {
        previousSettledThroughRound: from,
        settledThroughRound: through,
        activeRoundCount: active,
        workAdded: work,
        confirmationStatus: "safe",
        ethereumBlockNumber: "12000000",
      },
    ],
  };
}

test("Pip uses only the visible last three outcomes", () => {
  assert.equal(pipPick(["rest", "run", "run"]), "run");
  assert.equal(pipPick(["run", "rest", "rest"]), "rest");
  assert.equal(pipPick(["run", "run", "run", "rest", "rest"]), "rest");
  assert.equal(pipPick(WARMUP), "run");
});

test("simulation is reproducible, bounded and not constant across seeds", () => {
  const values = new Set<number>();
  for (let seed = 0; seed < 1000; seed++) {
    const x = randomAt(seed, 0);
    assert.ok(x >= 0 && x < 1);
    assert.equal(x, randomAt(seed, 0));
    values.add(x);
  }
  assert.equal(values.size, 1000);
  assert.notEqual(randomAt(5, 0), randomAt(5, 1));
});

test("correct streak increases score by 25 up to 200, misses reset", () => {
  let m: Match = { seed: 7, results: [] };
  for (let i = 0; i < MATCH_LENGTH; i++) {
    const preview = resolveRound(m, "run");
    m = resolveRound(m, preview.results.at(-1)!.outcome);
    assert.equal(m.results.at(-1)!.points, Math.min(200, 100 + i * 25));
  }
  assert.equal(total(m.results), 750);
  assert.equal(streak(m.results), 5);
  assert.equal(resolveRound(m, "rest"), m);
  let miss: Match = { seed: 8, results: [] };
  const first = resolveRound(miss, "run").results[0].outcome;
  miss = resolveRound(miss, first === "run" ? "rest" : "run");
  assert.equal(streak(miss.results), 0);
  assert.equal(total(miss.results), 0);
  const second = resolveRound(miss, "run").results[1].outcome;
  miss = resolveRound(miss, second);
  assert.equal(miss.results[1].points, 100);
});

test("1000 seeded matches preserve scoring invariants and saved replay", () => {
  for (let seed = 0; seed < 1000; seed++) {
    const picks: Choice[] = ["run", "rest", "run", "rest", "run"];
    const m = restoreMatch(seed, picks);
    assert.equal(m.results.length, 5);
    assert.ok(total(m.results) >= 0 && total(m.results) <= 750);
    assert.ok(total(m.results, true) >= 0 && total(m.results, true) <= 750);
    for (const r of m.results) {
      assert.equal(r.points > 0, r.pick === r.outcome);
      assert.equal(r.pipPoints > 0, r.pip === r.outcome);
      assert.ok(r.points <= 200);
    }
    assert.deepEqual(restoreMatch(seed, picks), m);
    assert.deepEqual(picks, ["run", "rest", "run", "rest", "run"]);
  }
});

test("corrupted or overlong saves cannot create an impossible game", () => {
  for (const seed of [NaN, -1, 0x100000000, 1.5])
    assert.throws(() => restoreMatch(seed, []));
  assert.throws(() => restoreMatch(5, ["bad"]));
  assert.throws(() => restoreMatch(5, Array(6).fill("run")));
  assert.equal(restoreMatch(0, []).results.length, 0);
});

test("live parser rejects unavailable, new schema and deployment mismatches", () => {
  assert.equal(parseCore(coreFixture()).frontier, 5n);
  assert.throws(
    () => parseCore({ ...coreFixture(), status: "unavailable" }),
    /not made/,
  );
  assert.throws(
    () => parseCore({ ...coreFixture(), schemaVersion: 2 }),
    /not supported/,
  );
  const wrong = coreFixture();
  wrong.identities.core = "0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4";
  assert.throws(() => parseCore(wrong), /differ/);
  const malformed = coreFixture();
  malformed.core.settledThroughRound = "5.4";
  assert.throws(() => parseCore(malformed), /invalid/);
});

test("future round math and prediction cutoff agree at exact boundaries", () => {
  const s = parseCore(coreFixture()),
    g = Number(s.genesis) * 1000;
  assert.deepEqual(nextRound(s, g - 1), { round: 1n, startsAt: g });
  assert.deepEqual(nextRound(s, g + 600_000), {
    round: 3n,
    startsAt: g + 1_200_000,
  });
  const target = nextRound(s, g + 2_700_000);
  assert.equal(target.round, 6n);
  const pick = makeLocalPick(s, "rest", target, g + 2_700_000);
  assert.equal(pick.round, "6");
  assert.throws(
    () => makeLocalPick(s, "rest", target, target.startsAt),
    /closed/,
  );
  assert.throws(
    () => makeLocalPick({ ...s, paused: true }, "rest", target, g + 2_700_000),
    /closed/,
  );
});

test("only certified outcomes settle; unknown never becomes zero", () => {
  const x = coreFixture();
  x.core.settledThroughRound = "6";
  const s = parseCore(x);
  const p: LocalPick = {
    round: "6",
    pick: "rest",
    startsAt: 0,
    madeAt: -1,
    core: s.core,
    stream: s.stream,
    outcome: null,
  };
  assert.equal(
    resolveLocalPick(p, { ...s, frontier: 5n }, settlements("0", "0")).outcome,
    null,
  );
  assert.equal(
    resolveLocalPick(p, s, { ...settlements("0", "0"), recentSettlements: [] })
      .outcome,
    null,
  );
  assert.equal(resolveLocalPick(p, s, settlements("0", "0")).outcome, "rest");
  assert.equal(resolveLocalPick(p, s, settlements("1", "10")).outcome, "run");
  assert.equal(
    resolveLocalPick(p, s, settlements("1", "10", "4", "6")).outcome,
    null,
  );
  assert.equal(
    resolveLocalPick(p, { ...s, core: "different" }, settlements("0", "0"))
      .outcome,
    null,
  );
  assert.equal(
    resolveLocalPick(p, s, { ...settlements("0", "0"), schemaVersion: 100 })
      .outcome,
    null,
  );
});

test("an exact safe active event resolves a mixed multi-round settlement", () => {
  const x = coreFixture();
  x.core.settledThroughRound = "6";
  x.events = [
    {
      eventName: "RoundRecorded",
      contractAddress: x.identities.core,
      blockNumber: "12000000",
      arguments: [
        { name: "roundId", value: "6" },
        { name: "work", value: "12" },
      ],
    },
  ];
  const s = parseCore(x),
    p: LocalPick = {
      round: "6",
      pick: "run",
      startsAt: 0,
      madeAt: -1,
      core: s.core,
      stream: s.stream,
      outcome: null,
    };
  assert.equal(
    resolveLocalPick(p, s, settlements("1", "12", "4", "6")).outcome,
    "run",
  );
  x.events = [
    {
      eventName: "RoundRecorded",
      contractAddress: x.identities.core,
      blockNumber: "12000001",
      arguments: [
        { name: "roundId", value: "6" },
        { name: "work", value: "12" },
      ],
    },
  ];
  assert.equal(
    resolveLocalPick(p, parseCore(x), settlements("1", "12", "4", "6")).outcome,
    null,
  );
});


test("mixed-batch omissions resolve Rest only with all unique active rounds", () => {
  const x = coreFixture();
  x.core.settledThroughRound = "186";
  const event = (round: string, work = "6", blockNumber = "12000000") => ({
    eventName: "RoundRecorded", contractAddress: x.identities.core, blockNumber,
    arguments: [{ name: "roundId", value: round }, { name: "work", value: work }],
  });
  x.events = [event("186")];
  const s = parseCore(x);
  const pick: LocalPick = { round: "180", pick: "rest", startsAt: 0, madeAt: -1,
    core: s.core, stream: s.stream, outcome: null };
  assert.equal(resolveLocalPick(pick, s, settlements("1", "6", "170", "186")).outcome, "rest");
  assert.equal(resolveLocalPick({ ...pick, pick: "run" }, s, settlements("1", "6", "170", "186")).outcome, "rest");
  const incomplete = settlements("2", "12", "170", "186");
  assert.equal(resolveLocalPick(pick, s, incomplete).outcome, null);
  x.events = [event("186"), event("186"), event("169"), event("187"), event("181", "0")];
  assert.equal(resolveLocalPick(pick, parseCore(x), incomplete).outcome, null);
  x.events = [event("186"), event("181", "6", "12000001")];
  assert.equal(resolveLocalPick(pick, parseCore(x), incomplete).outcome, null);
  x.events = [event("186"), event("181")];
  assert.equal(resolveLocalPick(pick, parseCore(x), incomplete).outcome, "rest");
  assert.equal(resolveLocalPick({ ...pick, round: "181" }, parseCore(x), incomplete).outcome, "run");
  assert.equal(resolveLocalPick(pick, s, settlements("0", "6", "170", "186")).outcome, null);
  assert.equal(resolveLocalPick(pick, s, { ...settlements("1", "6", "170", "186"), installationId: "other" }).outcome, null);
});


test("game handoff never guesses a contract or accepts the wrong chain", async () => {
  const { parseGameHandoff, parseRound } = await import("../src/handoff.ts");
  assert.equal(parseGameHandoff({ status: "awaiting-deployment" }), null);
  assert.throws(() => parseGameHandoff({}), /Sepolia/);
  assert.throws(() => parseGameHandoff({ network: { chainId: 1 }, contracts: {} }), /Sepolia/);
  assert.throws(() => parseGameHandoff({ network: { chainId: 11155111 }, contracts: {} }), /address/);
  assert.throws(() => parseGameHandoff({ network: { chainId: 11155111 }, contracts: { WheelhouseRounds: { address: "0x0000000000000000000000000000000000000000" } } }), /address/);
  const address = DEPLOYMENT.contracts.SqueekCore.address; // Address parsing only; not a game deployment.
  assert.equal(parseGameHandoff({ network: { chainId: 11155111 }, contracts: { WheelhouseRounds: { address } } })?.address.toLowerCase(), address.toLowerCase());
  for (const invalid of ["", "0", "-1", "1.2", "1e2", " 1", "01", "18446744073709551616"]) assert.equal(parseRound(invalid), null);
  assert.equal(parseRound("18446744073709551615"), 18446744073709551615n);
});
