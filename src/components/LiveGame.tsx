import { useEffect, useRef, useState } from "react";
import {
  fetchSnapshot,
  nextRound,
  makeLocalPick,
  settleLocalPicks,
  loadLivePicks,
  LIVE_KEY,
  type LiveSnapshot,
  type LocalPick,
} from "../live";
import { ChoiceControls } from "./ChoiceControls";
import { Hamster } from "./Hamster";
import { Icon } from "./Icon";
export function LiveGame() {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [choice, setChoice] = useState<"run" | "rest">("run");
  const [picks, setPicks] = useState(loadLivePicks);
  const [now, setNow] = useState(Date.now());
  const [checkedAt, setCheckedAt] = useState(0);
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const picksRef = useRef(picks);
  picksRef.current = picks;
  async function refresh() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), 12000);
    setLoading(true);
    setError("");
    try {
      const fresh = await fetchSnapshot(controller.signal);
      const resolved = await settleLocalPicks(
        picksRef.current,
        fresh,
        controller.signal,
      );
      setSnapshot(fresh);
      setPicks(resolved);
      setNow(Date.now());
      setCheckedAt(Date.now());
      try {
        localStorage.setItem(LIVE_KEY, JSON.stringify(resolved));
      } catch {
        setNotice(
          "Browser storage is unavailable. Keep this page open to keep your predictions.",
        );
      }
    } catch (e) {
      if (request.current === controller) {
        setSnapshot(null);
        setError(
          e instanceof Error && e.name !== "AbortError"
            ? e.message
            : "The live feed timed out. Try checking again.",
        );
      }
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = snapshot ? nextRound(snapshot, now) : null;
  const stale = now - checkedAt > 60_000;
  const picked =
    target && snapshot
      ? picks.find(
          (p) =>
            p.round === target.round.toString() &&
            p.core === snapshot.core &&
            p.stream === snapshot.stream,
        )
      : undefined;
  function lock() {
    if (!snapshot || !target || picked) return;
    if (Date.now() - checkedAt > 60_000) {
      setNotice("Refresh the feed before making a prediction.");
      return;
    }
    try {
      const pick = makeLocalPick(snapshot, choice, target);
      const updated = [...picks, pick].slice(-100);
      setPicks(updated);
      try {
        localStorage.setItem(LIVE_KEY, JSON.stringify(updated));
        setNotice(
          `Prediction saved: ${choice === "run" ? "Run" : "Rest"} for round ${pick.round}.`,
        );
      } catch {
        setNotice(
          "Prediction saved for this visit. Browser storage is unavailable.",
        );
      }
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Refresh the round and try again.",
      );
    }
  }
  return (
    <section className="live-layout" aria-label="Live round predictions">
      <div className="game-surface">
        <div className="surface-heading">
          <span className="mode-label">
            <span className="status-dot" />
            Sepolia rounds
          </span>
          <span className="muted">Local predictions</span>
        </div>
        <div className="live-art">
          <Hamster mood="rest" />
        </div>
        {loading && !snapshot ? (
          <div className="live-message" role="status">
            <h2>Checking the wheel…</h2>
            <p>Looking for a matching, settled Squeekchain feed.</p>
          </div>
        ) : error ? (
          <div className="live-message">
            <h2>The wheel can wait.</h2>
            <p role="status">{error}</p>
            <button
              className="primary-button"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <Icon name="refresh" />
              Check again
            </button>
          </div>
        ) : snapshot && target ? (
          <div className="live-message">
            <span className="round-label">Round {target.round.toString()}</span>
            <h2>
              {snapshot.paused
                ? "Settlement is paused."
                : picked
                  ? "You’re in for the next round."
                  : "Will the next round run?"}
            </h2>
            <p>
              {snapshot.paused
                ? "Predictions will reopen when Squeekchain resumes."
                : `Starts ${new Date(target.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Predictions close before the round starts.`}
            </p>
            {!snapshot.paused && !picked && (
              <>
                <ChoiceControls
                  choice={choice}
                  setChoice={setChoice}
                  group="live-prediction"
                />
                <button
                  className="primary-button full"
                  onClick={stale ? () => void refresh() : lock}
                  disabled={loading}
                >
                  {stale
                    ? "Refresh to predict"
                    : `Lock ${choice === "run" ? "Run" : "Rest"} locally`}
                  <Icon name="arrow" />
                </button>
              </>
            )}
            {picked && (
              <p className="notice">
                <Icon name="check" />
                Locked: {picked.pick === "run" ? "Run" : "Rest"}. Waiting for a
                certified result.
              </p>
            )}
            <button
              className="text-button"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <Icon name="refresh" />
              {loading ? "Checking…" : "Refresh results"}
            </button>
          </div>
        ) : null}
        <p className="surface-footnote">
          Free points only. Predictions stay in this browser.
          {checkedAt > 0 && snapshot && (
            <span className="checked-time">
              Last checked{" "}
              {new Date(checkedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </span>
          )}
        </p>
        <p className="sr-only" role="status">
          {notice}
        </p>
      </div>
      <aside className="live-aside">
        <h2>A real hamster, real rounds.</h2>
        <p>
          Squeekchain certifies work in ten-minute rounds. Predict before a
          round begins, then return after it settles.
        </p>
        <dl className="definitions">
          <div>
            <dt>
              <Icon name="run" />
              Run
            </dt>
            <dd>Any positive settled wheel work.</dd>
          </div>
          <div>
            <dt>
              <Icon name="rest" />
              Rest
            </dt>
            <dd>Zero work in a certified round.</dd>
          </div>
        </dl>
        <p className="small muted">
          An unsettled round stays unknown. Live picks are editable local
          records, carry no monetary value and are separate from practice
          scores.
        </p>
        <details>
          <summary>Why might live play pause?</summary>
          <p className="small">
            The feed must match Squeekchain’s published deployment identity. If
            it changes, live play stops instead of trusting a different
            contract.
          </p>
          <p className="small">
            Results also wait when the available history cannot prove an
            individual round. Refreshing never treats missing data as Rest.
          </p>
          <a
            className="inline-link"
            href="https://docs.squeekchain.com/developers/api/"
            target="_blank"
            rel="noreferrer"
          >
            Squeekchain API documentation
            <Icon name="external" size={16} />
          </a>
        </details>
        {notice && <p className="notice">{notice}</p>}
        <div className="prediction-list">
          <h3>Live roundbook</h3>
          {picks.length ? (
            [...picks]
              .reverse()
              .slice(0, 12)
              .map((p: LocalPick) => (
                <div className="prediction-row" key={`${p.stream}:${p.round}`}>
                  <span>
                    Round {p.round}
                    <small>{p.pick === "run" ? "Run" : "Rest"}</small>
                  </span>
                  <span>
                    {p.outcome === null
                      ? "Pending"
                      : p.outcome === p.pick
                        ? "+100 pts"
                        : "0 pts"}
                  </span>
                </div>
              ))
          ) : (
            <p className="small muted">
              Your first live prediction will appear here.
            </p>
          )}
        </div>
      </aside>
    </section>
  );
}
