import { useState } from "react";
import {
  useConnection,
  useConnect,
  useConnectors,
  useDisconnect,
  useSwitchChain,
  type Connector,
} from "wagmi";
import { getAddress } from "viem";
import { chain, OPEN_IN, walletMessage } from "../wallet";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

export function ConnectWallet() {
  const { address, isConnected, chainId } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const mobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !("ethereum" in window) &&
    !connectors.some((c) => c.type === "injected" && c.id !== "injected");
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const listed = [
    ...connectors.filter((c) => c.type === "injected"),
    ...connectors.filter((c) => c.type !== "injected"),
  ].filter(
    (c) =>
      !(c.id === "injected" && named) && !(mobile && c.type === "injected"),
  );
  async function choose(connector: Connector) {
    setMessage("");
    try {
      await connect.mutateAsync({ connector });
      setOpen(false);
    } catch (error) {
      setMessage(walletMessage(error));
    }
  }
  async function changeChain() {
    setMessage("");
    try {
      await switchChain.mutateAsync({ chainId: chain.id });
    } catch (error) {
      setMessage(walletMessage(error));
    }
  }
  const label = (c: Connector) =>
    c.id === "injected"
      ? "Browser wallet"
      : c.id === "coinbaseWalletSDK" && mobile
        ? "Coinbase Smart Wallet"
        : c.name;
  const fullAddress = address ? getAddress(address) : "";
  return (
    <div className="wallet-control">
      <button
        className="secondary-button"
        onClick={() => {
          if (isConnected && chainId !== chain.id) void changeChain();
          else {
            setMessage("");
            setOpen(true);
          }
        }}
        disabled={switchChain.isPending}
      >
        {switchChain.isPending
          ? "Switching…"
          : isConnected && chainId !== chain.id
            ? "Switch to Sepolia"
            : fullAddress
              ? `${fullAddress.slice(0, 6)}…${fullAddress.slice(-4)}`
              : "Connect"}
      </button>
      {message && !open && (
        <p className="small" role="status">
          {message}
        </p>
      )}
      {open && (
        <Dialog
          title={isConnected ? "Connected wallet" : "Connect a wallet"}
          close={() => setOpen(false)}
          className="wallet-dialog"
        >
          {isConnected ? (
            <>
              <p className="contract-address">{fullAddress}</p>
              <button
                className="secondary-button full"
                onClick={() => {
                  disconnect.mutate();
                  setOpen(false);
                }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <p className="small muted">
                Connect on Sepolia for onchain points. Your wallet confirms
                every transaction.
              </p>
              <div className="wallet-list">
                {mobile &&
                  OPEN_IN.map((w) => (
                    <a
                      key={w.id}
                      className="wallet-row"
                      href={w.href(location.href)}
                    >
                      <img
                        width="28"
                        height="28"
                        src={`./wallets/${w.id}.svg`}
                        alt=""
                      />
                      Open in {w.name}
                    </a>
                  ))}
                {listed.map((c) => (
                  <button
                    className="wallet-row"
                    key={c.uid}
                    onClick={() => void choose(c)}
                    disabled={connect.isPending}
                  >
                    {c.icon ? (
                      <img width="28" height="28" src={c.icon} alt="" />
                    ) : c.id === "coinbaseWalletSDK" ? (
                      <img
                        width="28"
                        height="28"
                        src="./wallets/coinbase.svg"
                        alt=""
                      />
                    ) : (
                      <Icon name="wheel" size={28} />
                    )}
                    <span>
                      {label(c)}
                      {connect.isPending && connect.variables?.connector === c
                        ? " · opening…"
                        : ""}
                    </span>
                  </button>
                ))}
              </div>
              {message && <p role="status">{message}</p>}
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}
