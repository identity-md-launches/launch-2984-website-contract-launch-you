export type Choice = "run" | "rest";
export const MATCH_LENGTH = 5;
export const WARMUP: Choice[] = ["run", "run", "rest", "rest", "run", "run"];
export interface RoundResult {
  round: number;
  pick: Choice;
  pip: Choice;
  outcome: Choice;
  points: number;
  pipPoints: number;
}
export interface Match {
  seed: number;
  results: RoundResult[];
}
export interface SavedMatch {
  seed: number;
  picks: Choice[];
  finishedAt: string;
}
export const isChoice = (x: unknown): x is Choice =>
  x === "run" || x === "rest";

// A repeatable local simulation, never represented as onchain or recorded hamster work.
export function randomAt(seed: number, position: number): number {
  let x = (seed ^ Math.imul(position + 1, 0x9e3779b9)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}
export function pipPick(history: Choice[]): Choice {
  const last = history.slice(-3);
  return last.filter((x) => x === "run").length >= 2 ? "run" : "rest";
}
export function streak(results: RoundResult[], rival = false): number {
  let count = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if ((rival ? results[i].pip : results[i].pick) !== results[i].outcome)
      break;
    count++;
  }
  return count;
}
export const total = (results: RoundResult[], rival = false) =>
  results.reduce((sum, r) => sum + (rival ? r.pipPoints : r.points), 0);
export function resolveRound(match: Match, pick: Choice): Match {
  if (!isChoice(pick) || match.results.length >= MATCH_LENGTH) return match;
  const history = [...WARMUP, ...match.results.map((r) => r.outcome)];
  const pip = pipPick(history);
  // A mild tendency to continue the previous behavior; both players see the same clues.
  const runningProbability = history.at(-1) === "run" ? 0.62 : 0.38;
  const outcome: Choice =
    randomAt(match.seed, match.results.length) < runningProbability
      ? "run"
      : "rest";
  const points = (right: boolean, previous: number) =>
    right ? Math.min(200, 100 + previous * 25) : 0;
  return {
    ...match,
    results: [
      ...match.results,
      {
        round: match.results.length + 1,
        pick,
        pip,
        outcome,
        points: points(pick === outcome, streak(match.results)),
        pipPoints: points(pip === outcome, streak(match.results, true)),
      },
    ],
  };
}
export function restoreMatch(seed: number, picks: unknown[]): Match {
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    picks.length > MATCH_LENGTH ||
    !picks.every(isChoice)
  )
    throw new Error("Invalid saved match");
  return picks.reduce<Match>((m, p) => resolveRound(m, p as Choice), {
    seed,
    results: [],
  });
}
export function freshSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
export const matchVerdict = (m: Match) =>
  total(m.results) > total(m.results, true)
    ? "You beat Pip!"
    : total(m.results) === total(m.results, true)
      ? "An even match."
      : "Pip takes this one.";
