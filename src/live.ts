import { DEPLOYMENT } from "./deployment.ts";
import { isChoice, type Choice } from "./game.ts";
const API = "https://api.squeekchain.com/v1";
export const LIVE_KEY = "wheelhouse:live:v1";
export interface LocalPick {
  round: string;
  pick: Choice;
  startsAt: number;
  madeAt: number;
  core: string;
  stream: string;
  outcome: Choice | null;
}
interface CoreEvent {
  eventName: string;
  arguments: { name: string; value: string }[];
}
export interface LiveSnapshot {
  frontier: bigint;
  genesis: bigint;
  duration: bigint;
  safeBlock: bigint;
  paused: boolean;
  core: string;
  stream: string;
  installationId: string;
  events: CoreEvent[];
}
export class LiveError extends Error {
  kind: "network" | "identity" | "unavailable" | "schema";
  constructor(
    message: string,
    kind: "network" | "identity" | "unavailable" | "schema" = "network",
  ) {
    super(message);
    this.kind = kind;
  }
}
const object = (x: unknown): Record<string, unknown> => {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new LiveError(
      "The live feed returned an unsupported response. Try again later.",
      "schema",
    );
  return x as Record<string, unknown>;
};
const decimal = (x: unknown): bigint => {
  if (typeof x !== "string" || !/^(0|[1-9]\d*)$/.test(x) || x.length > 78)
    throw new LiveError(
      "The live feed returned an invalid round or block value.",
      "schema",
    );
  return BigInt(x);
};
const same = (a: unknown, b: string) =>
  typeof a === "string" && a.toLowerCase() === b.toLowerCase();
export function parseCore(input: unknown): LiveSnapshot {
  const x = object(input);
  if (x.schemaVersion !== 1)
    throw new LiveError(
      "This live feed version is not supported yet.",
      "schema",
    );
  if (x.status !== "available")
    throw new LiveError(
      "Squeekchain has not made this round available yet. Try again later.",
      "unavailable",
    );
  const chain = object(x.chain),
    identities = object(x.identities),
    config = object(x.configuration),
    state = object(x.core),
    implementation = object(x.implementation);
  const expected = DEPLOYMENT.contracts.SqueekCore;
  if (
    decimal(chain.chainId) !== BigInt(DEPLOYMENT.chainId) ||
    !same(identities.core, expected.address) ||
    !same(identities.proxyImplementation, expected.implementation) ||
    !same(identities.proxyAdmin, expected.proxyAdmin) ||
    !same(implementation.runtimeHash, expected.implementationRuntimeHash) ||
    !same(implementation.storageLayoutDigest, expected.storageLayoutDigest) ||
    decimal(implementation.codeVersion) !== 3n ||
    !same(config.streamId, DEPLOYMENT.coreConfiguration.streamId) ||
    decimal(config.genesisTimestamp) !==
      BigInt(DEPLOYMENT.coreConfiguration.genesisTimestamp) ||
    decimal(config.roundDuration) !== 600n ||
    decimal(config.maxWorkPerRound) !== 10000n
  ) {
    throw new LiveError(
      "The live feed and published deployment record differ. Predictions are paused until they agree.",
      "identity",
    );
  }
  if (typeof x.installationId !== "string" || !x.installationId)
    throw new LiveError(
      "The feed does not identify its installation.",
      "schema",
    );
  const safeBlock = decimal(chain.safeThroughBlock);
  if (
    safeBlock < BigInt(DEPLOYMENT.deploymentBlock) ||
    typeof state.paused !== "boolean"
  )
    throw new LiveError(
      "The feed has not reached a safe block yet.",
      "unavailable",
    );
  const events: CoreEvent[] = [];
  if (Array.isArray(x.events))
    for (const raw of x.events) {
      const e = object(raw);
      if (
        e.eventName === "RoundRecorded" &&
        same(e.contractAddress, expected.address) &&
        decimal(e.blockNumber) <= safeBlock &&
        Array.isArray(e.arguments)
      ) {
        const args = e.arguments.map((a) => object(a));
        if (
          args.every(
            (a) => typeof a.name === "string" && typeof a.value === "string",
          )
        )
          events.push({
            eventName: "RoundRecorded",
            arguments: args as unknown as CoreEvent["arguments"],
          });
      }
    }
  return {
    frontier: decimal(state.settledThroughRound),
    genesis: decimal(config.genesisTimestamp),
    duration: decimal(config.roundDuration),
    paused: state.paused,
    safeBlock,
    core: expected.address.toLowerCase(),
    stream: config.streamId as string,
    installationId: x.installationId,
    events,
  };
}
async function getJson(path: string, signal: AbortSignal): Promise<unknown> {
  let r: Response;
  try {
    r = await fetch(`${API}/${path}`, {
      signal,
      credentials: "omit",
      cache: "no-store",
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new LiveError(
      "The live feed could not be reached. Check your connection and try again.",
    );
  }
  if (r.status === 429)
    throw new LiveError(
      "The live feed is busy. Wait a moment, then check again.",
    );
  if (!r.ok)
    throw new LiveError(
      "The live feed could not be reached. Check your connection and try again.",
    );
  return r.json();
}
export async function fetchSnapshot(
  signal: AbortSignal,
): Promise<LiveSnapshot> {
  return parseCore(await getJson("core", signal));
}
export function nextRound(
  snapshot: LiveSnapshot,
  nowMs = Date.now(),
): { round: bigint; startsAt: number } {
  const now = BigInt(Math.floor(nowMs / 1000));
  const current =
    now < snapshot.genesis
      ? 0n
      : (now - snapshot.genesis) / snapshot.duration + 1n;
  const round = current + 1n;
  return {
    round,
    startsAt:
      Number(snapshot.genesis + (round - 1n) * snapshot.duration) * 1000,
  };
}
export function makeLocalPick(
  snapshot: LiveSnapshot,
  choice: Choice,
  target: { round: bigint; startsAt: number },
  nowMs = Date.now(),
): LocalPick {
  if (
    snapshot.paused ||
    !isChoice(choice) ||
    nowMs >= target.startsAt ||
    target.round <= snapshot.frontier ||
    target.round !== nextRound(snapshot, nowMs).round
  )
    throw new Error(
      "That prediction window has closed. Refresh for the next round.",
    );
  return {
    round: target.round.toString(),
    pick: choice,
    startsAt: target.startsAt,
    madeAt: nowMs,
    core: snapshot.core,
    stream: snapshot.stream,
    outcome: null,
  };
}
// Absence from an event page is never evidence for Rest. Only an exact active
// event or an explicitly certified all-zero / all-active batch resolves a pick.
export function resolveLocalPick(
  pick: LocalPick,
  snapshot: LiveSnapshot,
  settlements: unknown,
): LocalPick {
  const target = BigInt(pick.round);
  if (
    pick.core !== snapshot.core ||
    pick.stream !== snapshot.stream ||
    target > snapshot.frontier ||
    pick.outcome
  )
    return pick;
  for (const e of snapshot.events) {
    const args = Object.fromEntries(e.arguments.map((a) => [a.name, a.value]));
    if (decimal(args.roundId) === target && decimal(args.work) > 0n)
      return { ...pick, outcome: "run" };
  }
  const x = object(settlements);
  if (
    x.schemaVersion !== 3 ||
    x.status !== "available" ||
    x.installationId !== snapshot.installationId
  )
    return pick;
  const chain = object(x.chain);
  if (
    decimal(chain.chainId) !== BigInt(DEPLOYMENT.chainId) ||
    decimal(chain.deploymentBlock) !== BigInt(DEPLOYMENT.deploymentBlock) ||
    !Array.isArray(x.recentSettlements)
  )
    return pick;
  for (const raw of x.recentSettlements) {
    const s = object(raw);
    const from = decimal(s.previousSettledThroughRound),
      through = decimal(s.settledThroughRound),
      active = decimal(s.activeRoundCount);
    if (
      s.confirmationStatus !== "safe" ||
      decimal(s.ethereumBlockNumber) > snapshot.safeBlock ||
      target <= from ||
      target > through ||
      through > snapshot.frontier ||
      through <= from ||
      active > through - from
    )
      continue;
    if (active === 0n && decimal(s.workAdded) === 0n)
      return { ...pick, outcome: "rest" };
    if (active === through - from && decimal(s.workAdded) > 0n)
      return { ...pick, outcome: "run" };
  }
  return pick;
}
export async function settleLocalPicks(
  picks: LocalPick[],
  snapshot: LiveSnapshot,
  signal: AbortSignal,
): Promise<LocalPick[]> {
  const pending = picks.some(
    (p) =>
      p.outcome === null &&
      BigInt(p.round) <= snapshot.frontier &&
      p.core === snapshot.core &&
      p.stream === snapshot.stream,
  );
  if (!pending) return picks;
  const settlements = await getJson("settlements?range=30d", signal);
  return picks.map((p) => resolveLocalPick(p, snapshot, settlements));
}
export function loadLivePicks(): LocalPick[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LIVE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value
      .slice(-100)
      .filter(
        (p): p is LocalPick =>
          p &&
          typeof p === "object" &&
          typeof p.round === "string" &&
          /^[1-9]\d{0,19}$/.test(p.round) &&
          isChoice(p.pick) &&
          (p.outcome === null || isChoice(p.outcome)) &&
          typeof p.startsAt === "number" &&
          Number.isFinite(p.startsAt) &&
          typeof p.madeAt === "number" &&
          p.madeAt < p.startsAt &&
          /^0x[\da-f]{40}$/i.test(p.core) &&
          /^0x[\da-f]{64}$/i.test(p.stream),
      );
  } catch {
    return [];
  }
}
