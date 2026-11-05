import { restoreMatch, type Match, type SavedMatch } from "./game.ts";
export const STORAGE_KEY = "wheelhouse:v1";
export interface Stored {
  match: Match | null;
  history: SavedMatch[];
  sound: boolean;
  available: boolean;
}
export function loadStored(): Stored {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!data || data.version !== 1)
      return { match: null, history: [], sound: false, available: true };
    let match: Match | null = null;
    try {
      match = restoreMatch(data.seed, data.picks);
    } catch {
      /* discard only the damaged match */
    }
    const history = (Array.isArray(data.history) ? data.history : [])
      .slice(-20)
      .filter((item: SavedMatch) => {
        try {
          return (
            item.picks.length === 5 &&
            !!restoreMatch(item.seed, item.picks) &&
            typeof item.finishedAt === "string" &&
            Number.isFinite(Date.parse(item.finishedAt))
          );
        } catch {
          return false;
        }
      });
    return { match, history, sound: data.sound === true, available: true };
  } catch {
    return { match: null, history: [], sound: false, available: false };
  }
}
export function saveStored(
  match: Match,
  history: SavedMatch[],
  sound: boolean,
): boolean {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        seed: match.seed,
        picks: match.results.map((r) => r.pick),
        history: history.slice(-20),
        sound,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
export function downloadFile(name: string, body: string, type: string): void {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadScorecard(match: Match): void {
  const score = match.results.reduce((s, r) => s + r.points, 0);
  const pip = match.results.reduce((s, r) => s + r.pipPoints, 0);
  const dots = match.results
    .map(
      (r, i) =>
        `<circle cx="${90 + i * 74}" cy="385" r="23" fill="${r.pick === r.outcome ? "#dce9bb" : "#e9dce6"}"/><text x="${90 + i * 74}" y="393" text-anchor="middle" font-size="22" fill="#292e28">${r.pick === r.outcome ? "✓" : "×"}</text>`,
    )
    .join("");
  downloadFile(
    "wheelhouse-scorecard.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" rx="28" fill="#f6f4ed"/><circle cx="710" cy="80" r="120" fill="#e7edc9"/><g font-family="Arial, sans-serif" fill="#292e28"><text x="65" y="80" font-size="30" font-weight="700">wheelhouse</text><text x="65" y="150" font-size="22">Five rounds. One little hamster.</text><text x="65" y="245" font-size="54" font-weight="700">You ${score} : ${pip} Pip</text><text x="65" y="307" font-size="28">${score > pip ? "You beat Pip!" : score === pip ? "An even match." : "The rematch is yours."}</text>${dots}<text x="65" y="465" font-size="18">Practice match · simulated rounds · local points only</text></g></svg>`,
    "image/svg+xml",
  );
}
