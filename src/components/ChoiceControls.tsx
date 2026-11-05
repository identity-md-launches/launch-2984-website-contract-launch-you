import type { Choice } from "../game";
import { Icon } from "./Icon";
export function ChoiceControls({
  choice,
  setChoice,
  disabled = false,
  group = "prediction",
}: {
  choice: Choice;
  setChoice: (c: Choice) => void;
  disabled?: boolean;
  group?: string;
}) {
  return (
    <fieldset className="choice-fieldset" disabled={disabled}>
      <legend className="sr-only">Predict Run or Rest</legend>
      {(["run", "rest"] as const).map((c) => (
        <label
          key={c}
          className={`choice choice-${c} ${choice === c ? "selected" : ""}`}
        >
          <input
            type="radio"
            name={group}
            value={c}
            checked={choice === c}
            onChange={() => setChoice(c)}
          />
          <span className="choice-icon">
            <Icon name={c} size={25} />
          </span>
          <span className="choice-copy">
            <strong>{c === "run" ? "Run" : "Rest"}</strong>
            <small>{c === "run" ? "The wheel turns" : "A little break"}</small>
          </span>
          <span className="radio-mark" aria-hidden="true">
            {choice === c && <span />}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
