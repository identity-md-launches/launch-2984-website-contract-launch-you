import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { sepolia } from "viem/chains";
import type { Abi } from "viem";
import abi from "../docs/abi/WheelhouseRounds.json";

export const GAME_ABI = abi as Abi;
export const chain = sepolia;
export const walletConfig = createConfig({
  chains: [chain],
  multiInjectedProviderDiscovery: true,
  connectors: [injected(), coinbaseWallet({ appName: "Wheelhouse" })],
  transports: {
    [chain.id]: http(chain.rpcUrls.default.http[0], {
      timeout: 12_000,
      retryCount: 1,
    }),
  },
});

export const OPEN_IN = [
  {
    id: "metamask",
    name: "MetaMask",
    href: (url: string) =>
      `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, "")}`,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    href: (url: string) =>
      `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
  {
    id: "rabby",
    name: "Rabby",
    href: (url: string) =>
      `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${encodeURIComponent(url)}`,
  },
  {
    id: "phantom",
    name: "Phantom",
    href: (url: string) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
  },
] as const;

export function walletMessage(error: unknown): string {
  if (error instanceof Error && /reject|denied|4001/i.test(error.message))
    return "Request declined in your wallet. You can try again.";
  return "The wallet request could not finish. Check your wallet and connection, then try again.";
}
