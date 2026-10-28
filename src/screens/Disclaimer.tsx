import { DISCLAIMER_VERSION } from '../state/preferences.ts';
import { usePreferences } from '../state/PreferencesContext.tsx';

export function DisclaimerText() {
  return (
    <div className="disclaimer">
      <p>
        <strong>
          This is a clinical reference prototype. Always confirm guidance against the current approved CARPA manual and
          applicable local procedures. Follow required consultation and escalation processes.
        </strong>
      </p>
      <p>
        This preview contains no approved clinical content: only empty templates and clearly labelled demonstration
        examples. It does not diagnose, decide treatment, or contact anyone for you. It is not a source of authority to
        supply or administer medicines.
      </p>
    </div>
  );
}

export function DisclaimerGate() {
  const { acceptDisclaimer } = usePreferences();
  return (
    <div className="gate">
      <div className="gate__panel" role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <h1 id="gate-title" className="gate__title">
          Before you start
        </h1>
        <DisclaimerText />
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => acceptDisclaimer(DISCLAIMER_VERSION)}
        >
          I understand
        </button>
      </div>
    </div>
  );
}
