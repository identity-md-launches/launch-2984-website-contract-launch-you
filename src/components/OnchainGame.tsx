import { useEffect, useRef, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  WagmiProvider,
  useConnection,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { zeroAddress, type Hex } from "viem";
import { DEPLOYMENT } from "../deployment";
import { parseGameHandoff, parseRound } from "../handoff";
import { walletConfig, chain, GAME_ABI, walletMessage } from "../wallet";
import { ConnectWallet } from "./ConnectWallet";
import { ChoiceControls } from "./ChoiceControls";
import type { Choice } from "../game";
import type { LiveSnapshot } from "../live";

const queries = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
interface Props {
  snapshot: LiveSnapshot | null;
  target: { round: bigint; startsAt: number } | null;
  fresh: boolean;
}

function ContractPlay({ snapshot, target, fresh }: Props) {
  const { address: player, chainId, isConnected } = useConnection();
  const publicClient = usePublicClient({ chainId: chain.id });
  const writer = useWriteContract();
  const cache = useQueryClient();
  const [choice, setChoice] = useState<Choice>("run");
  const [settleRound, setSettleRound] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [hash, setHash] = useState<Hex>();
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const handoff = useQuery({
    queryKey: ["game-handoff"],
    queryFn: async () => {
      const response = await fetch("./imd-deployment.json", {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 404) return null;
      if (!response.ok)
        throw new Error(
          "The game deployment handoff could not be loaded. Try again.",
        );
      return parseGameHandoff(await response.json());
    },
    staleTime: 60_000,
  });
  const game = handoff.data;
  const ready = useQuery({
    queryKey: ["game-core", game?.address],
    enabled: Boolean(game && publicClient),
    queryFn: async () => {
      if (!game || !publicClient)
        throw new Error("Deployment is not available.");
      const bytecode = await publicClient.getCode({ address: game.address });
      if (!bytecode || bytecode === "0x")
        throw new Error(
          "No game contract was found at the deployment address. Onchain play is paused.",
        );
      const core = (await publicClient.readContract({
        address: game.address,
        abi: GAME_ABI,
        functionName: "core",
      })) as string;
      if (core.toLowerCase() === zeroAddress)
        throw new Error(
          "The game owner still needs to configure Squeekchain. Onchain play is paused.",
        );
      if (
        core.toLowerCase() !==
        DEPLOYMENT.contracts.SqueekCore.address.toLowerCase()
      )
        throw new Error(
          "The game uses a different Squeekchain core from the published record. Onchain play is paused.",
        );
      return true;
    },
    refetchInterval: 30_000,
  });
  const score = useReadContract({
    chainId: chain.id,
    address: game?.address,
    abi: GAME_ABI,
    functionName: "scores",
    args: player ? [player] : undefined,
    query: {
      enabled: Boolean(game && player && ready.data),
      retry: false,
      refetchInterval: 30_000,
    },
  });
  const prediction = useReadContract({
    chainId: chain.id,
    address: game?.address,
    abi: GAME_ABI,
    functionName: "predictions",
    args: player && target ? [player, target.round] : undefined,
    query: {
      enabled: Boolean(game && player && target && ready.data),
      retry: false,
      refetchInterval: 15_000,
    },
  });
  const record = prediction.data as
    | readonly [boolean, boolean, boolean, boolean]
    | undefined;
  const round = parseRound(settleRound);
  const wrongChain = isConnected && chainId !== chain.id;
  const canWrite = Boolean(
    game &&
      !handoff.isError &&
      !handoff.isFetching &&
      ready.data &&
      !ready.isError &&
      !ready.isFetching &&
      player &&
      !wrongChain &&
      !pending,
  );
  const canPredict =
    canWrite &&
    snapshot &&
    target &&
    fresh &&
    !snapshot.paused &&
    target.round > snapshot.frontier &&
    Date.now() < target.startsAt &&
    record !== undefined &&
    !record[0] &&
    !prediction.isError;

  async function send(kind: "predict" | "settle") {
    if (!game || !player || !publicClient || !canWrite || submitting.current)
      return;
    const selected = kind === "predict" ? target?.round : round;
    if (!selected || (kind === "predict" && !canPredict)) return;
    submitting.current = true;
    setPending(true);
    setHash(undefined);
    setNotice("Checking the transaction…");
    try {
      const call = {
        address: game.address,
        abi: GAME_ABI,
        account: player,
        chain: chain,
        chainId: chain.id,
      };
      const { request } =
        kind === "predict"
          ? await publicClient.simulateContract({
              ...call,
              functionName: "predict",
              args: [selected, choice === "run"],
            })
          : await publicClient.simulateContract({
              ...call,
              functionName: "settle",
              args: [player, selected],
            });
      if (mounted.current)
        setNotice(
          "Confirm the transaction in your wallet. Sepolia testnet gas is required.",
        );
      const tx = await writer.mutateAsync(request);
      if (mounted.current) {
        setHash(tx);
        setNotice("Transaction submitted. Waiting for confirmation…");
      }
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
        timeout: 120_000,
      });
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      await cache.invalidateQueries();
      if (mounted.current) {
        if (kind === "predict") setSettleRound(selected.toString());
        setNotice(
          `${kind === "predict" ? "Prediction" : "Settlement"} for round ${selected} confirmed on Sepolia.`,
        );
      }
    } catch (error) {
      if (mounted.current) {
        const message = error instanceof Error ? error.message : "";
        setNotice(
          /reject|denied|4001/i.test(message)
            ? walletMessage(error)
            : "The transaction could not be confirmed. Check its status, refresh the contract, and try again. A round must be certified before settlement.",
        );
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  }

  let availability = "";
  if (handoff.isPending) availability = "Checking the game deployment…";
  else if (handoff.error)
    availability =
      handoff.error instanceof Error
        ? handoff.error.message
        : "The deployment handoff is unavailable. Try again.";
  else if (!game)
    availability = "Onchain play opens once the contract is deployed.";
  else if (ready.error)
    availability =
      ready.error instanceof Error
        ? ready.error.message
        : "The game contract could not be checked. Try again.";
  else if (ready.isPending) availability = "Checking the game contract…";
  else if (!isConnected)
    availability = "Connect a wallet to predict and read your onchain score.";
  else if (wrongChain) availability = "Switch your wallet to Sepolia to play.";
  else if (!snapshot || !fresh)
    availability =
      "Refresh a matching live feed to predict. Certified picks can still be settled.";
  else if (snapshot.paused)
    availability =
      "New predictions are paused by Squeekchain. Certified picks can still be settled.";
  else if (prediction.isError)
    availability =
      "Your current prediction could not be read. Refresh the contract before predicting.";
  else if (record?.[0])
    availability = `Round ${target?.round}: ${record[1] ? "Run" : "Rest"} already locked onchain.`;

  return (
    <section className="onchain-game" aria-label="Onchain points">
      <div className="onchain-heading">
        <h2>Onchain points</h2>
        <ConnectWallet />
      </div>
      <p className="small muted" role="status">
        {availability}
      </p>
      {game && (
        <a
          className="inline-link contract-address"
          href={`${chain.blockExplorers.default.url}/address/${game.address}`}
          target="_blank"
          rel="noreferrer"
        >
          Game contract: {game.address}
        </a>
      )}
      {player && game && (
        <p className="onchain-score" role="status">
          {score.isError
            ? "Your score could not be read. Refresh the contract to retry."
            : score.data !== undefined
              ? `Your onchain score: ${String(score.data)} points`
              : "Reading your onchain score…"}
        </p>
      )}
      {game && snapshot && target && !record?.[0] && (
        <>
          <p className="small">
            Predict round {target.round.toString()} before{" "}
            {new Date(target.startsAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
          <ChoiceControls
            choice={choice}
            setChoice={setChoice}
            group="onchain-prediction"
            disabled={pending}
          />
        </>
      )}
      <button
        className="primary-button full"
        disabled={!canPredict}
        onClick={() => void send("predict")}
      >
        {pending
          ? "Transaction in progress…"
          : record?.[0]
            ? "Prediction locked"
            : `Predict ${choice === "run" ? "Run" : "Rest"} onchain`}
      </button>
      <div className="settle-controls">
        <label htmlFor="settle-round">
          Round to settle
          <input
            id="settle-round"
            inputMode="numeric"
            type="text"
            autoComplete="off"
            value={settleRound}
            onChange={(e) => setSettleRound(e.target.value)}
            disabled={!game || pending}
            aria-describedby="settle-hint"
            aria-invalid={Boolean(settleRound && !round)}
          />
        </label>
        <button
          className="secondary-button"
          disabled={!canWrite || !round}
          onClick={() => void send("settle")}
        >
          Settle round
        </button>
      </div>
      <p id="settle-hint" className="small muted">
        {settleRound && !round
          ? "Enter a whole round number from 1 to 18446744073709551615."
          : "Settle a certified round you predicted. A correct pick earns 100 points."}
      </p>
      <p className="small muted">
        No wager or token reward. Transactions cost Sepolia testnet gas.
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {hash && (
        <a
          className="inline-link contract-address"
          href={`${chain.blockExplorers.default.url}/tx/${hash}`}
          target="_blank"
          rel="noreferrer"
        >
          View transaction: {hash}
        </a>
      )}
      {(game || handoff.error) && (
        <button
          className="text-button"
          disabled={pending || handoff.isFetching || ready.isFetching}
          onClick={() => {
            void handoff.refetch();
            void cache.invalidateQueries();
          }}
        >
          Refresh contract
        </button>
      )}
    </section>
  );
}

export default function OnchainGame(props: Props) {
  return (
    <WagmiProvider config={walletConfig}>
      <QueryClientProvider client={queries}>
        <ContractPlay {...props} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
