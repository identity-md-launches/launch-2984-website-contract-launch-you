import { getAddress, isAddress, zeroAddress, type Address } from "viem";

export type GameHandoff = { chainId: 11155111; address: Address };

// This is the site's runtime handoff, not Squeekchain's upstream deployment pin.
// An absent launch address is an explicit unavailable state, never a stand-in.
export function parseGameHandoff(input: unknown): GameHandoff | null {
  if (!input || typeof input !== "object")
    throw new Error("The game deployment handoff is invalid.");
  const x = input as Record<string, unknown>;
  if (x.status === "awaiting-deployment") return null;
  const network = x.network as Record<string, unknown> | undefined;
  const contracts = x.contracts as Record<string, unknown> | undefined;
  const game = contracts?.WheelhouseRounds as
    | Record<string, unknown>
    | undefined;
  if (network?.chainId !== 11155111)
    throw new Error(
      "The game deployment handoff must name Sepolia (11155111).",
    );
  if (
    typeof game?.address !== "string" ||
    !isAddress(game.address) ||
    game.address.toLowerCase() === zeroAddress
  )
    throw new Error(
      "The deployment handoff does not supply a valid WheelhouseRounds address.",
    );
  return { chainId: 11155111, address: getAddress(game.address) };
}

export function parseRound(value: string): bigint | null {
  if (!/^[1-9]\d{0,19}$/.test(value)) return null;
  const round = BigInt(value);
  return round <= (1n << 64n) - 1n ? round : null;
}
