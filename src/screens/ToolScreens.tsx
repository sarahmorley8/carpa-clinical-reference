import { useState } from 'react';
import { useRelease } from '../app/ContentContext.tsx';
import { calculateDose, calculatorAvailable } from '../calculations/dose.ts';
import { hrefFor } from '../navigation/router.ts';
import { EMPTY_ISBAR, useSession, type IsbarSection } from '../state/session.tsx';
import { newTimerId } from '../tools/ids.ts';
import { buildIsbarLines, isbarToText, ISBAR_LABELS, mergeIntoDraft } from '../tools/isbar.ts';
import { formatRemaining, isValidDuration, remainingMs } from '../tools/timers.ts';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { ContentText } from '../components/ContentText.tsx';
import { Icon } from '../components/Icon.tsx';
import { PopulationSwitch } from '../components/PopulationSwitch.tsx';
import { useNow } from '../components/SessionGuards.tsx';

// ---------------- Timers ----------------

const LABELS = ['Repeat observations', 'Reassessment', 'Repeat dose reminder', 'CPR cycle'];

export function TimersScreen() {
  const { state, dispatch } = useSession();
  const now = useNow(250);
  const [label, setLabel] = useState(LABELS[0]!);
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    const m = minutes.trim() === '' ? 0 : Number(minutes);
    const s = seconds.trim() === '' ? 0 : Number(seconds);
    if (!/^\d*$/.test(minutes.trim()) || !/^\d*$/.test(seconds.trim()) || s > 59) {
      setError('Enter whole minutes, and seconds from 0 to 59.');
      return;
    }
    const ms = (m * 60 + s) * 1000;
    if (!isValidDuration(ms)) {
      setError('Enter a duration between 1 second and 24 hours.');
      return;
    }
    setError(null);
    dispatch({
      type: 'timer',
      action: { type: 'add', id: newTimerId(), label, durationMs: ms, source: 'user', now: Date.now() },
    });
    setMinutes('');
    setSeconds('');
  };

  return (
    <div className="screen">
      <div className="callout callout--caution">
        <Icon name="caution" />
        <span>
          Alerts are only reliable while this app is open on screen. The screen is kept awake while a timer runs (where
          the phone allows). iPhones do not vibrate for web apps and may mute sound in silent mode.
        </span>
      </div>

      {state.timers.length === 0 && <p className="empty">No timers running.</p>}
      <ul className="timer-list">
        {state.timers.map((t) => {
          const left = remainingMs(t, now);
          return (
            <li key={t.id} className={`timer timer--${t.status}`}>
              <div className="timer__label">
                {t.label}
                <span className="timer__source">
                  {t.source === 'content' ? 'Duration from pathway' : 'Duration you entered'}
                </span>
              </div>
              <div className="timer__time" role="timer" aria-label={`${t.label}: ${formatRemaining(left)} remaining`}>
                {t.status === 'done' ? 'FINISHED' : formatRemaining(left)}
                {t.status === 'paused' && <span className="timer__paused"> PAUSED</span>}
              </div>
              <div className="timer__actions">
                {t.status === 'running' && (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => dispatch({ type: 'timer', action: { type: 'pause', id: t.id, now: Date.now() } })}
                  >
                    Pause
                  </button>
                )}
                {t.status === 'paused' && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => dispatch({ type: 'timer', action: { type: 'resume', id: t.id, now: Date.now() } })}
                  >
                    Resume
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => dispatch({ type: 'timer', action: { type: 'reset', id: t.id, now: Date.now() } })}
                >
                  Restart
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => dispatch({ type: 'timer', action: { type: 'cancel', id: t.id } })}
                >
                  Cancel
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="settings-group" aria-labelledby="new-timer">
        <h2 id="new-timer" className="list-heading">
          New timer
        </h2>
        <p className="note">
          Enter the duration yourself, from the source or your local procedure. There are no default times.
        </p>
        <div className="field">
          <label className="field__label" htmlFor="timer-label">
            Label
          </label>
          <select id="timer-label" className="select" value={label} onChange={(e) => setLabel(e.target.value)}>
            {LABELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="duration">
          <div className="field">
            <label className="field__label" htmlFor="timer-min">
              Minutes
            </label>
            <input
              id="timer-min"
              className="answer__input"
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="timer-sec">
              Seconds
            </label>
            <input
              id="timer-sec"
              className="answer__input"
              inputMode="numeric"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <p className="answer__error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn btn--primary btn--block" onClick={start}>
          Start timer
        </button>
      </section>
    </div>
  );
}

// ---------------- ISBAR ----------------

export function IsbarScreen() {
  const { release } = useRelease();
  const { state, dispatch } = useSession();
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const draft = state.isbar;
  const set = (k: IsbarSection, v: string) => dispatch({ type: 'set-isbar', isbar: { ...draft, [k]: v } });

  const copy = async () => {
    setConfirmCopy(false);
    try {
      await navigator.clipboard.writeText(isbarToText(draft));
      setMessage('Copied. Clipboard contents may stay on your phone until replaced.');
    } catch {
      setMessage('Copy failed on this device. Read the handover from the screen instead.');
    }
  };

  return (
    <div className="screen">
      <p className="note">
        Build a handover to read out when you call. Only what you ticked, answered or typed is included. Nothing is
        saved or sent; it is cleared when the session ends.
      </p>
      <button
        type="button"
        className="btn btn--secondary btn--block"
        onClick={() => {
          dispatch({ type: 'set-isbar', isbar: mergeIntoDraft(draft, buildIsbarLines(state, release.store)) });
          setMessage('Added ticked items and pathway answers. Review and edit before use.');
        }}
      >
        Fill from ticked items and answers
      </button>
      {(Object.keys(ISBAR_LABELS) as IsbarSection[]).map((k) => (
        <div key={k} className="field isbar-field">
          <label htmlFor={`isbar-${k}`} className="field__label">
            <span className="isbar-letter">{ISBAR_LABELS[k].letter}</span> {ISBAR_LABELS[k].title}
          </label>
          <p className="note" id={`isbar-${k}-hint`}>
            {ISBAR_LABELS[k].hint}
          </p>
          <textarea
            id={`isbar-${k}`}
            className="textarea"
            rows={k === 'assessment' ? 6 : 3}
            value={draft[k]}
            aria-describedby={`isbar-${k}-hint`}
            onChange={(e) => set(k, e.target.value)}
          />
        </div>
      ))}
      {message && (
        <p className="runner__notice" role="status">
          {message}
        </p>
      )}
      <div className="button-row">
        <button type="button" className="btn btn--primary" onClick={() => setConfirmCopy(true)}>
          Copy to clipboard
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => setConfirmClear(true)}>
          Clear ISBAR
        </button>
      </div>
      {confirmCopy && (
        <ConfirmDialog
          title="Copy to clipboard?"
          message="Your phone, keyboard apps or other apps may keep clipboard contents (including clipboard history or sync to other devices). Only copy if your local procedure allows it."
          confirmLabel="Copy"
          onConfirm={() => void copy()}
          onCancel={() => setConfirmCopy(false)}
        />
      )}
      {confirmClear && (
        <ConfirmDialog
          title="Clear the ISBAR draft?"
          message="Everything typed or filled in here will be removed."
          confirmLabel="Clear"
          onConfirm={() => {
            dispatch({ type: 'set-isbar', isbar: EMPTY_ISBAR });
            setConfirmClear(false);
            setMessage(null);
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}

// ---------------- Dose calculator (synthetic test harness) ----------------

export function CalculatorScreen() {
  const { release } = useRelease();
  const { state } = useSession();
  const profile = release.manifest.profile;
  const regimens = [...release.store.regimens.values()].filter(
    ({ medication, regimen }) => calculatorAvailable(medication, profile) && regimen.dosing.type === 'weight-based',
  );
  const [regimenId, setRegimenId] = useState(regimens[0]?.regimen.id ?? '');
  const [weight, setWeight] = useState('');
  const [formulationId, setFormulationId] = useState<string>('');
  const [given, setGiven] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const selected = release.store.regimens.get(regimenId);

  const result =
    submitted && selected
      ? calculateDose(selected.regimen, selected.medication.formulations, {
          weightKg: weight,
          population: state.population,
          formulationId: formulationId || null,
          alreadyGiven: given,
        })
      : null;
  const reset = () => setSubmitted(false);

  return (
    <div className="screen">
      <div className="callout callout--critical">
        <Icon name="alert" />
        <span>
          <strong>SYNTHETIC TEST HARNESS — NOT FOR PATIENT CARE.</strong> Works only with the fictional demonstration
          medicine. It is not enabled for real medicines until the calculator, content and intended use are
          independently validated and authorised.
        </span>
      </div>
      {regimens.length === 0 ? (
        <p className="empty">No demonstration regimens are available in this build.</p>
      ) : (
        <>
          <PopulationSwitch />
          <div className="field">
            <label className="field__label" htmlFor="calc-regimen">
              Regimen
            </label>
            <select
              id="calc-regimen"
              className="select"
              value={regimenId}
              onChange={(e) => {
                setRegimenId(e.target.value);
                setFormulationId('');
                reset();
              }}
            >
              {regimens.map(({ medication, regimen }) => (
                <option key={regimen.id} value={regimen.id}>
                  {medication.name} — {regimen.route} — {regimen.indication}
                </option>
              ))}
            </select>
          </div>
          {selected && (
            <p className="note">
              Source dose: <ContentText text={selected.regimen.doseText} />
            </p>
          )}
          <div className="field">
            <label className="field__label" htmlFor="calc-weight">
              Weight (kg) — measured
            </label>
            <input
              id="calc-weight"
              className="answer__input"
              inputMode="decimal"
              autoComplete="off"
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value);
                reset();
              }}
            />
          </div>
          {selected && selected.regimen.formulationIds.length > 0 && (
            <div className="field">
              <label className="field__label" htmlFor="calc-form">
                Formulation (for volume)
              </label>
              <select
                id="calc-form"
                className="select"
                value={formulationId}
                onChange={(e) => {
                  setFormulationId(e.target.value);
                  reset();
                }}
              >
                <option value="">Not selected — dose only</option>
                {selected.medication.formulations
                  .filter((f) => selected.regimen.formulationIds.includes(f.id))
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.description}
                    </option>
                  ))}
              </select>
            </div>
          )}
          {selected?.regimen.dosing.type === 'weight-based' && selected.regimen.dosing.maxCumulative && (
            <div className="field">
              <label className="field__label" htmlFor="calc-given">
                Already given in the last {selected.regimen.dosing.maxCumulative.periodHours ?? '?'} h (
                {selected.regimen.dosing.dosePerKg.unit}) — optional
              </label>
              <input
                id="calc-given"
                className="answer__input"
                inputMode="decimal"
                autoComplete="off"
                value={given}
                onChange={(e) => {
                  setGiven(e.target.value);
                  reset();
                }}
              />
            </div>
          )}
          <button type="button" className="btn btn--primary btn--block" onClick={() => setSubmitted(true)}>
            Calculate
          </button>

          {result && !result.ok && (
            <div className="callout callout--caution" role="alert">
              <Icon name="caution" />
              <div>
                <strong>Not calculated</strong>
                <ul>
                  {result.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {result && result.ok && (
            <div className="calc-result">
              {result.stop && (
                <div className="calc-stop" role="alert">
                  <Icon name="alert" size={32} />
                  <strong>{result.stop.message}</strong>
                </div>
              )}
              {!result.stop && (
                <div className="calc-dose" role="status">
                  <div className="calc-dose__label">Dose</div>
                  <div className="calc-dose__value">
                    {result.dose.amount} {result.dose.unit}
                  </div>
                  {result.volume && (
                    <>
                      <div className="calc-dose__label">Volume of selected formulation</div>
                      <div className="calc-dose__value calc-dose__value--volume">{result.volume.amount} mL</div>
                    </>
                  )}
                </div>
              )}
              <h3 className="subheading">Working</h3>
              <ol className="calc-working">
                {result.working.map((w) => (
                  <li key={w}>{w}</li>
                ))}
                {result.volume && <li>{result.volume.working}</li>}
              </ol>
              {result.volumeNote && <p className="note">{result.volumeNote}</p>}
              {result.notes.map((n) => (
                <p key={n} className="note">
                  {n}
                </p>
              ))}
            </div>
          )}
        </>
      )}
      <p className="note">
        <a href={hrefFor({ name: 'tools' })}>Back to tools</a>
      </p>
    </div>
  );
}
