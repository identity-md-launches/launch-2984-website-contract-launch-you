import { useEffect, useRef, useState } from "react";
import {
  freshSeed,
  matchVerdict,
  MATCH_LENGTH,
  pipPick,
  resolveRound,
  restoreMatch,
  streak,
  total,
  WARMUP,
  type Choice,
  type Match,
  type SavedMatch,
} from "./game";
import {
  downloadFile,
  downloadScorecard,
  loadStored,
  saveStored,
} from "./storage";
import { ChoiceControls } from "./components/ChoiceControls";
import { Dialog } from "./components/Dialog";
import { Hamster } from "./components/Hamster";
import { Icon } from "./components/Icon";
import { LiveGame } from "./components/LiveGame";

type Panel = "rules" | "roundbook" | "reset" | null;
type Phase = "choose" | "revealing" | "result" | "finished";
function playNote(won: boolean) {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.value = 0.035;
    [0, 0.1].forEach((delay, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = won ? [520, 780][i] : [330, 260][i];
      o.connect(gain);
      o.start(ctx.currentTime + delay);
      o.stop(ctx.currentTime + delay + 0.13);
    });
    setTimeout(() => void ctx.close(), 450);
  } catch {
    /* sound is optional; the result is always visible */
  }
}
function Trail({
  outcomes,
  label = "Warm-up laps, then this match",
}: {
  outcomes: Choice[];
  label?: string;
}) {
  return (
    <div className="trail" aria-label={label}>
      {outcomes.slice(-6).map((outcome, i) => (
        <span
          className={`trail-item ${outcome}`}
          key={i}
          title={outcome === "run" ? "Run" : "Rest"}
        >
          <Icon name={outcome} size={17} />
          <span className="sr-only">
            {outcome === "run" ? "Run" : "Rest"}
            {i < outcomes.slice(-6).length - 1 ? ", " : ""}
          </span>
        </span>
      ))}
    </div>
  );
}
export default function App() {
  const [initial] = useState(loadStored);
  const [match, setMatch] = useState<Match>(
    () => initial.match ?? { seed: freshSeed(), results: [] },
  );
  const [phase, setPhase] = useState<Phase>(() =>
    initial.match?.results.length === MATCH_LENGTH ? "finished" : "choose",
  );
  const [choice, setChoice] = useState<Choice>("run");
  const [mode, setMode] = useState<"practice" | "live">("practice");
  const [panel, setPanel] = useState<Panel>(null);
  const [sound, setSound] = useState(initial.sound);
  const [history, setHistory] = useState<SavedMatch[]>(initial.history);
  const [storageOk, setStorageOk] = useState(initial.available);
  const [announcement, setAnnouncement] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const primaryButton = useRef<HTMLButtonElement>(null);
  const pauseButton = useRef<HTMLButtonElement>(null);
  const radioRef = useRef<HTMLDivElement>(null);
  const currentResult = match.results.at(-1);
  const outcomes = [...WARMUP, ...match.results.map((r) => r.outcome)];
  const pip = pipPick(outcomes);
  const round = Math.min(MATCH_LENGTH, match.results.length + 1);
  const complete = phase === "finished";
  const answered = phase === "result" || phase === "finished";
  const yourScore = total(match.results),
    pipScore = total(match.results, true);
  useEffect(() => {
    setStorageOk(saveStored(match, history, sound));
  }, [match, history, sound]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (phase === "revealing") pauseButton.current?.focus({ preventScroll: true });
    if (phase === "result") nextButton.current?.focus({ preventScroll: true });
    if ((phase === "choose" && match.results.length) || phase === "finished")
      primaryButton.current?.focus({ preventScroll: true });
  }, [phase, match.results.length]);
  function reveal() {
    if (timer.current) clearTimeout(timer.current);
    const resolved = resolveRound(match, choice);
    const result = resolved.results.at(-1)!;
    setMatch(resolved);
    setPaused(false);
    const finished = resolved.results.length === MATCH_LENGTH;
    setPhase(finished ? "finished" : "result");
    if (finished)
      setHistory((items) =>
        [
          ...items,
          {
            seed: resolved.seed,
            picks: resolved.results.map((r) => r.pick),
            finishedAt: new Date().toISOString(),
          },
        ].slice(-20),
      );
    setAnnouncement(
      `Round ${result.round}: ${result.outcome === "run" ? "Run" : "Rest"}. ${result.points ? `Correct! Plus ${result.points} points.` : "No points this round."}${finished ? ` ${matchVerdict(resolved)} Your final score is ${total(resolved.results)}.` : ""}`,
    );
    if (sound) playNote(result.points > 0);
  }
  function lock() {
    if (phase !== "choose") return;
    setPhase("revealing");
    setAnnouncement(
      `Prediction locked: ${choice === "run" ? "Run" : "Rest"}. Revealing round ${round}.`,
    );
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    timer.current = setTimeout(reveal, reduced ? 150 : 2200);
  }
  function togglePause() {
    if (paused) {
      setPaused(false);
      timer.current = setTimeout(reveal, 1000);
    } else {
      if (timer.current) clearTimeout(timer.current);
      setPaused(true);
    }
  }
  function newMatch() {
    if (timer.current) clearTimeout(timer.current);
    setMatch({ seed: freshSeed(), results: [] });
    setChoice("run");
    setPhase("choose");
    setPaused(false);
    setPanel(null);
    setAnnouncement("A new five-round practice match is ready.");
  }
  function next() {
    setPhase("choose");
    setAnnouncement(`Round ${round}. Choose Run or Rest.`);
  }
  const best = history.reduce(
    (best, h) => Math.max(best, total(restoreMatch(h.seed, h.picks).results)),
    0,
  );
  const wins = history.filter((h) => {
    const m = restoreMatch(h.seed, h.picks);
    return total(m.results) > total(m.results, true);
  }).length;
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to game
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="./" aria-label="Wheelhouse home">
            <span className="brand-mark">
              <Icon name="wheel" size={27} />
            </span>
            <span>
              wheelhouse<span className="brand-period">.</span>
            </span>
          </a>
          <nav aria-label="Main navigation">
            <button
              className="nav-item rules-nav"
              onClick={() => setPanel("rules")}
            >
              How to play
            </button>
            <button className="nav-item" onClick={() => setPanel("roundbook")}>
              <Icon name="book" size={18} />
              <span>Roundbook</span>
            </button>
          </nav>
          <span className="header-note">
            Made for Squeekchain
          </span>
        </div>
      </header>
      <main id="main" className="page-shell">
        <div className="intro">
          <div>
            <h1>
              Outguess the <span>little legs.</span>
            </h1>
            <p>
              A Squeekchain prediction game: call Run or Rest and outscore a bot
              named Pip over five rounds.
            </p>
          </div>
        </div>
        <div className="game-toolbar" id="game">
          <div className="mode-switch" role="group" aria-label="Game mode">
            <button
              aria-pressed={mode === "practice"}
              className={mode === "practice" ? "active" : ""}
              onClick={() => setMode("practice")}
            >
              Practice match
            </button>
            <button
              aria-pressed={mode === "live"}
              className={mode === "live" ? "active" : ""}
              onClick={() => {
                if (phase === "revealing" && !paused) togglePause();
                setMode("live");
              }}
            >
              Live rounds
            </button>
          </div>
          <div className="toolbar-end">
            <span className="free-note">Free to play. Just for points.</span>
            <button
              className="icon-button"
              aria-label={sound ? "Mute game sounds" : "Enable game sounds"}
              aria-pressed={sound}
              onClick={() => {
                setSound(!sound);
                if (!sound) playNote(true);
              }}
            >
              <Icon name={sound ? "volume" : "muted"} size={19} />
            </button>
            <button
              className="icon-button mobile-help"
              aria-label="How to play"
              onClick={() => setPanel("rules")}
            >
              <Icon name="help" />
            </button>
          </div>
        </div>
        {mode === "live" ? (
          <LiveGame />
        ) : (
          <div className="game-layout">
            <section
              className="game-surface"
              aria-label="Practice prediction game"
            >
              <div
                className={`game-stage ${phase === "revealing" && !paused ? "is-revealing" : ""} ${paused ? "is-paused" : ""}`}
              >
                <div className="stage-top">
                  <span className="mode-label">
                    <span className="practice-dot" />
                    Simulated practice
                  </span>
                  <span className="round-label">
                    Round{" "}
                    {phase === "result" || complete
                      ? match.results.length
                      : round}{" "}
                    <span className="muted">/ {MATCH_LENGTH}</span>
                  </span>
                </div>
                <div className="stage-art">
                  <span className="stage-note">
                    {complete
                      ? "Small legs, good game."
                      : answered
                        ? currentResult?.outcome === "run"
                          ? "Had a little zoom."
                          : "Snack break. Naturally."
                        : phase === "revealing"
                          ? paused
                            ? "Taking a breather."
                            : "The little legs decide…"
                          : "What’s the next move?"}
                  </span>
                  <Hamster
                    mood={
                      complete
                        ? "win"
                        : answered && currentResult?.outcome === "rest"
                          ? "rest"
                          : phase === "revealing"
                            ? "run"
                            : "ready"
                    }
                  />
                  <div className="stage-ground" />
                </div>
                <div className="stage-caption">
                  <span className="desktop-caption">
                    <Icon name="wheel" size={16} />
                    The practice wheel
                  </span>
                  <span className="mobile-intel">
                    <span>Warm-up</span>
                    <Trail outcomes={outcomes} />
                    <span className="mobile-pip">
                      Pip: {pip === "run" ? "Run" : "Rest"}
                    </span>
                  </span>
                </div>
              </div>
              <div className="game-controls">
                {phase === "choose" ? (
                  <>
                    <div className="question-row">
                      <div>
                        <h2>Will the wheel turn?</h2>
                        <p>Pick the next outcome before the reveal.</p>
                      </div>
                      <span className="points-hint">
                        +100<span>for a correct pick</span>
                      </span>
                    </div>
                    <div ref={radioRef}>
                      <ChoiceControls choice={choice} setChoice={setChoice} />
                    </div>
                    <button
                      ref={primaryButton}
                      className="primary-button full"
                      onClick={lock}
                    >
                      Lock {choice === "run" ? "Run" : "Rest"}
                      <Icon name="arrow" />
                    </button>
                    <p className="control-hint">
                      Five simulated rounds, played for points.
                    </p>
                  </>
                ) : phase === "revealing" ? (
                  <div className="reveal-panel">
                    <h2>{paused ? "Reveal paused." : "Prediction locked."}</h2>
                    <p>
                      You picked {choice === "run" ? "Run" : "Rest"}. Pip picked{" "}
                      {pip === "run" ? "Run" : "Rest"}.
                    </p>
                    <div
                      className={`reveal-progress ${paused ? "paused" : ""}`}
                      aria-hidden="true"
                    >
                      <span />
                    </div>
                    <div className="reveal-actions">
                      <button
                        className="secondary-button"
                        ref={pauseButton}
                        onClick={togglePause}
                      >
                        {paused ? "Resume reveal" : "Pause reveal"}
                      </button>
                      <button className="primary-button" onClick={reveal}>
                        Reveal now
                        <Icon name="arrow" />
                      </button>
                    </div>
                  </div>
                ) : complete ? (
                  <div className="match-finished">
                    <div className="finish-label">
                      <Icon name="trophy" />
                      Match complete
                    </div>
                    <h2>{matchVerdict(match)}</h2>
                    <p>
                      You {yourScore} <span aria-hidden="true">:</span>
                      <span className="sr-only">points to</span> {pipScore} Pip
                    </p>
                    <div className="finish-actions">
                      <button
                        ref={primaryButton}
                        className="primary-button"
                        onClick={newMatch}
                      >
                        Play again
                        <Icon name="refresh" />
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => {
                          downloadScorecard(match);
                          setAnnouncement("Scorecard download started.");
                        }}
                      >
                        <Icon name="download" />
                        Save scorecard
                      </button>
                    </div>
                  </div>
                ) : (
                  currentResult && (
                    <div className="round-result">
                      <span
                        className={`result-status ${currentResult.points ? "correct" : "miss"}`}
                      >
                        <Icon name={currentResult.points ? "check" : "close"} />
                        {currentResult.points
                          ? "Good instinct!"
                          : "Not this time."}
                      </span>
                      <h2>
                        {currentResult.outcome === "run"
                          ? "The hamster ran."
                          : "The hamster rested."}
                      </h2>
                      <p>
                        You picked{" "}
                        {currentResult.pick === "run" ? "Run" : "Rest"}.{" "}
                        {currentResult.points
                          ? `+${currentResult.points} points${streak(match.results) > 1 ? " with your streak bonus" : ""}.`
                          : "Next round is a fresh chance."}
                      </p>
                      <button
                        ref={nextButton}
                        className="primary-button full"
                        onClick={next}
                      >
                        Play round {round}
                        <Icon name="arrow" />
                      </button>
                    </div>
                  )
                )}
              </div>
            </section>
            <aside
              className="match-aside"
              aria-label="Match score and prediction clues"
            >
              <section className="match-score">
                <div className="aside-heading">
                  <h2>The matchup</h2>
                  <span>Five rounds, most points wins</span>
                </div>
                <div className="scoreboard">
                  <div>
                    <span className="player-avatar you">
                      <Icon name="spark" size={23} />
                    </span>
                    <span className="player-name">You</span>
                    <strong>{yourScore}</strong>
                    <span className="score-unit">points</span>
                  </div>
                  <span className="versus">vs</span>
                  <div>
                    <span className="player-avatar pip">
                      <svg
                        viewBox="0 0 32 32"
                        width="27"
                        height="27"
                        aria-hidden="true"
                      >
                        <rect
                          x="5"
                          y="9"
                          width="22"
                          height="18"
                          rx="7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                        <path
                          d="M16 9V5m-3 0h6M11 21h10"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                        <circle cx="11.5" cy="16" r="2" fill="currentColor" />
                        <circle cx="21" cy="16" r="2" fill="currentColor" />
                      </svg>
                    </span>
                    <span className="player-name">Pip</span>
                    <strong>{pipScore}</strong>
                    <span className="score-unit">points</span>
                  </div>
                </div>
                <div
                  className="round-progress"
                  aria-label={`${match.results.length} of 5 rounds complete`}
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={
                        match.results[i]
                          ? match.results[i].points
                            ? "won"
                            : "lost"
                          : i === match.results.length
                            ? "current"
                            : ""
                      }
                    >
                      {match.results[i] ? (
                        <Icon
                          name={match.results[i].points ? "check" : "close"}
                          size={17}
                        />
                      ) : (
                        i + 1
                      )}
                      <span className="sr-only">
                        {match.results[i]
                          ? match.results[i].points
                            ? "Correct"
                            : "Incorrect"
                          : ""}
                      </span>
                    </span>
                  ))}
                </div>
              </section>
              <section className="clues-section">
                <div className="aside-heading">
                  <h2>A little intel</h2>
                  <Icon name="spark" size={18} />
                </div>
                <p className="small muted">Warm-up laps, then this match</p>
                <Trail outcomes={outcomes} />
                <div className="trail-key">
                  <span>
                    <Icon name="run" size={15} />
                    Run
                  </span>
                  <span>
                    <Icon name="rest" size={15} />
                    Rest
                  </span>
                  <span>
                    Oldest to newest
                    <Icon name="arrow" size={15} />
                  </span>
                </div>
                <div className="pip-tip">
                  <div>
                    <span className="pip-tip-dot" />
                    Pip’s next pick
                    <strong>
                      <Icon name={pip} size={16} />
                      {pip === "run" ? "Run" : "Rest"}
                    </strong>
                  </div>
                  <p>
                    Pip follows the majority of the last three outcomes. Can you
                    read the wheel better?
                  </p>
                </div>
              </section>
              <section className="match-meta">
                <div>
                  <span>Current streak</span>
                  <strong>
                    {streak(match.results)}{" "}
                    {streak(match.results) === 1 ? "round" : "rounds"}
                  </strong>
                </div>
                <div>
                  <span>Personal best</span>
                  <strong>{best ? `${best} pts` : "Set your first"}</strong>
                </div>
              </section>
              {match.results.length > 0 && !complete && (
                <button
                  className="text-button new-match"
                  onClick={() => setPanel("reset")}
                >
                  <Icon name="refresh" size={16} />
                  Start a new match
                </button>
              )}
              <p className="local-note">
                <Icon name="book" size={17} />
                {storageOk
                  ? "Progress saved in this browser."
                  : "Storage unavailable. Progress lasts for this visit."}
              </p>
            </aside>
          </div>
        )}
        {mode === "practice" && <section className="how-strip" aria-label="Game at a glance">
          <div>
            <span className="step-number">01</span>
            <div>
              <h3>Read the wheel</h3>
              <p>Use the last six outcomes as clues.</p>
            </div>
          </div>
          <div>
            <span className="step-number">02</span>
            <div>
              <h3>Make your call</h3>
              <p>Run or rest. A correct pick earns 100.</p>
            </div>
          </div>
          <div>
            <span className="step-number">03</span>
            <div>
              <h3>Outsmart Pip</h3>
              <p>Score more than Pip over five rounds.</p>
            </div>
          </div>
        </section>}
        <div className="bottom-note">
          <a
            href="https://docs.squeekchain.com/"
            target="_blank"
            rel="noreferrer"
          >
            Meet Squeekchain
            <Icon name="external" size={16} />
          </a>
        </div>
      </main>
      <footer className="site-footer">
        <div>
          <span className="footer-brand">
            <Icon name="wheel" size={18} />
            wheelhouse
          </span>
          <span>A small game for the hamster economy.</span>
        </div>
        <button className="text-button" onClick={() => setPanel("rules")}>
          Rules &amp; scoring
          <Icon name="chevron" size={15} />
        </button>
      </footer>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      {panel === "rules" && (
        <Dialog
          title="A little instinct goes far."
          close={() => setPanel(null)}
        >
          <p>
            Outscore Pip across five rounds by predicting whether the practice
            hamster will run or rest.
          </p>
          <ol className="rules-list">
            <li>
              <strong>Read the last six outcomes.</strong>
              <p>
                Pip follows the majority of the last three. Its next pick is
                shown before you choose.
              </p>
            </li>
            <li>
              <strong>Pick Run or Rest.</strong>
              <p>
                Lock your prediction, then reveal the outcome. Run means
                positive work; Rest means zero work.
              </p>
            </li>
            <li>
              <strong>Keep a good thing going.</strong>
              <p>
                A correct pick earns 100 points. Consecutive correct picks add
                25 per round, up to 200 per correct pick. A miss resets your
                streak.
              </p>
            </li>
          </ol>
          <div className="rules-note">
            <h3>Practice and live are separate.</h3>
            <p>
              Practice uses locally simulated outcomes with a slight tendency to
              repeat the previous outcome. Pip is a simple rule-based bot, not
              an AI model. Practice is for fun; there is no wager or reward
              token.
            </p>
            <p>
              Live mode offers browser picks and onchain points on Sepolia.
              Connect a wallet to predict the next round, then settle a certified
              round and read your contract score. Correct onchain picks earn 100
              points with no streak bonus; transactions cost testnet gas. Browser
              picks stay editable and separate. Onchain play opens once the
              contract is deployed. Unknown results stay pending.
            </p>
          </div>
          <button
            className="primary-button full"
            onClick={() => setPanel(null)}
          >
            Back to the wheel
            <Icon name="arrow" />
          </button>
        </Dialog>
      )}
      {panel === "reset" && (
        <Dialog title="Start a fresh match?" close={() => setPanel(null)}>
          <p>
            This ends the current practice match. Only completed matches appear
            in your roundbook.
          </p>
          <div className="dialog-actions">
            <button className="secondary-button" onClick={() => setPanel(null)}>
              Keep playing
            </button>
            <button className="primary-button" onClick={newMatch}>
              Start new match
              <Icon name="refresh" />
            </button>
          </div>
        </Dialog>
      )}
      {panel === "roundbook" && (
        <Dialog
          title="Your roundbook"
          wide
          close={() => {
            setPanel(null);
            setClearConfirm(false);
          }}
        >
          <p className="muted">
            The last 20 completed practice matches, saved in this browser.
          </p>
          <div className="book-stats">
            <div>
              <strong>{history.length}</strong>
              <span>matches</span>
            </div>
            <div>
              <strong>{wins}</strong>
              <span>wins over Pip</span>
            </div>
            <div>
              <strong>{best}</strong>
              <span>personal best</span>
            </div>
          </div>
          {history.length ? (
            <>
              <div className="history-table">
                <table>
                  <caption className="sr-only">
                    Completed practice matches, newest first
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Match</th>
                      <th scope="col">You</th>
                      <th scope="col">Pip</th>
                      <th scope="col">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map((h, i) => {
                      const m = restoreMatch(h.seed, h.picks),
                        yours = total(m.results),
                        theirs = total(m.results, true);
                      return (
                        <tr key={`${h.seed}:${h.finishedAt}`}>
                          <th scope="row">
                            {history.length - i}
                            <small>
                              {new Date(h.finishedAt).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" },
                              )}
                            </small>
                          </th>
                          <td>{yours}</td>
                          <td>{theirs}</td>
                          <td>
                            <span
                              className={`history-result ${yours > theirs ? "won" : ""}`}
                            >
                              {yours > theirs
                                ? "Won"
                                : yours === theirs
                                  ? "Drew"
                                  : "Lost"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="book-actions">
                <button
                  className="secondary-button"
                  onClick={() => {
                    downloadFile(
                      "wheelhouse-roundbook.json",
                      JSON.stringify(
                        {
                          version: 1,
                          mode: "simulated-practice",
                          matches: history,
                        },
                        null,
                        2,
                      ),
                      "application/json",
                    );
                    setAnnouncement("Roundbook download started.");
                  }}
                >
                  <Icon name="download" />
                  Export roundbook
                </button>
                <button
                  className="text-button"
                  onClick={() => setClearConfirm(true)}
                >
                  Clear history
                </button>
              </div>
              {clearConfirm && (
                <div className="clear-confirm">
                  <p>
                    Delete completed matches and your personal best from this
                    browser?
                  </p>
                  <div>
                    <button
                      className="secondary-button"
                      onClick={() => setClearConfirm(false)}
                    >
                      Keep history
                    </button>
                    <button
                      className="danger-button"
                      onClick={() => {
                        setHistory([]);
                        setClearConfirm(false);
                        setAnnouncement("Roundbook cleared.");
                      }}
                    >
                      Delete history
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="book-empty">
              <Icon name="book" size={36} />
              <h3>Your story starts on the wheel.</h3>
              <p>Finish a five-round match to save your first score.</p>
              <button className="primary-button" onClick={() => setPanel(null)}>
                Play a match
                <Icon name="arrow" />
              </button>
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
