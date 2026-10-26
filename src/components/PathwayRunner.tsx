import { useState } from 'react';
import { useRelease } from '../app/ContentContext.tsx';
import type { Presentation, PathwayEdge, PathwayNode, QuestionNode } from '../content/types.ts';
import {
  describeAnswer,
  evaluate,
  pruneAnswers,
  reassess,
  type Answer,
  type Evaluation,
} from '../decision-engine/evaluate.ts';
import { hrefFor } from '../navigation/router.ts';
import { useSession } from '../state/session.tsx';
import { newTimerId } from '../tools/ids.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { CiteRef, ContentText, NumberValue } from './ContentText.tsx';
import { ContactCard } from './Escalation.tsx';
import { Icon } from './Icon.tsx';

const OUTCOME: Record<string, string> = {
  'continue-per-source': 'End of pathway: continue as described in the source',
  consult: 'End of pathway: consult',
  evacuate: 'End of pathway: evacuate',
  'go-to-presentation': 'End of pathway: go to another presentation',
};

function QuestionInput({ node, onAnswer }: { node: QuestionNode; onAnswer: (a: Answer) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const input = node.input;
  const unknownButton = input.allowUnknown && (
    <button type="button" className="btn btn--secondary answer-btn" onClick={() => onAnswer({ kind: 'unknown' })}>
      Unknown / not assessed
    </button>
  );
  if (input.kind === 'number') {
    const submit = () => {
      const trimmed = text.trim();
      if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
        setError('Enter a number using digits only, e.g. 92 or 37.5.');
        return;
      }
      setError(null);
      onAnswer({ kind: 'number', value: Number(trimmed) });
    };
    const inputId = `num-${node.id}`;
    return (
      <div className="answer">
        <label htmlFor={inputId} className="answer__label">
          Enter value ({input.unit})
        </label>
        <div className="answer__number">
          <input
            id={inputId}
            className="answer__input"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-err` : undefined}
          />
          <span className="answer__unit">{input.unit}</span>
          <button type="button" className="btn btn--primary" onClick={submit}>
            Confirm
          </button>
        </div>
        {error && (
          <p id={`${inputId}-err`} className="answer__error" role="alert">
            {error}
          </p>
        )}
        {unknownButton}
      </div>
    );
  }
  const options =
    input.kind === 'yes-no'
      ? [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ]
      : (input.options ?? []);
  return (
    <div className="answer">
      <div className="answer__choices">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="btn btn--primary answer-btn"
            onClick={() => onAnswer({ kind: 'value', value: o.value })}
          >
            <ContentText text={o.label} />
          </button>
        ))}
      </div>
      {unknownButton}
    </div>
  );
}

function StepCard({
  presentation,
  node,
  via,
  answer,
  isCurrent,
  evaluation,
  onAnswer,
  onReassess,
}: {
  presentation: Presentation;
  node: PathwayNode;
  via?: PathwayEdge;
  answer?: Answer;
  isCurrent: boolean;
  evaluation: Evaluation;
  onAnswer: (a: Answer) => void;
  onReassess: (edgeId: string) => void;
}) {
  const { release } = useRelease();
  const { state, dispatch } = useSession();
  const [editing, setEditing] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const reassessEdges = presentation.pathway.edges.filter((e) => e.from === node.id && e.kind === 'reassess');
  const showInput = node.type === 'question' && ((isCurrent && evaluation.state === 'awaiting-input') || editing);

  return (
    <li className={`run-step run-step--${node.type}${isCurrent ? ' run-step--current' : ''}`}>
      <div className="run-step__text">
        <ContentText text={node.text} />
      </div>

      {node.type === 'question' && answer && !editing && (
        <div className="run-step__answer">
          <span>
            Answer: <strong>{describeAnswer(node, answer)}</strong>
          </span>
          <button type="button" className="btn btn--secondary btn--small" onClick={() => setEditing(true)}>
            Change
          </button>
        </div>
      )}
      {showInput && (
        <QuestionInput
          node={node as QuestionNode}
          onAnswer={(a) => {
            setEditing(false);
            onAnswer(a);
          }}
        />
      )}

      {node.type === 'action' && (node.regimenRefs ?? []).length > 0 && (
        <div className="run-step__detail">
          Medication reference:{' '}
          {(node.regimenRefs ?? [])
            .filter((id) => {
              const r = release.store.regimens.get(id);
              return !r || state.population === null || r.regimen.populations.includes(state.population);
            })
            .map((id) => {
              const r = release.store.regimens.get(id);
              return (
                <span key={id} className="run-step__med">
                  {r ? `${r.medication.name} (${r.regimen.route})` : 'unavailable'}
                </span>
              );
            })}
          <div className="note">See the Medication reference section for doses as written in the source.</div>
        </div>
      )}
      {node.type === 'action' && node.timer && (
        <div className="run-step__detail">
          {node.timer.durationMinutes === null ? (
            <>
              Timer: <ContentText text={node.timer.label} /> — duration <NumberValue value={null} />
            </>
          ) : (
            <button
              type="button"
              className="btn btn--secondary"
              disabled={timerStarted}
              onClick={() => {
                dispatch({
                  type: 'timer',
                  action: {
                    type: 'add',
                    id: newTimerId(),
                    label: node.timer!.label,
                    durationMs: node.timer!.durationMinutes! * 60_000,
                    source: 'content',
                    now: Date.now(),
                  },
                });
                setTimerStarted(true);
              }}
            >
              {timerStarted
                ? 'Timer started — see Timers'
                : `Start timer: ${node.timer.label} (${node.timer.durationMinutes} min)`}
            </button>
          )}
        </div>
      )}
      {node.type === 'escalation' &&
        (node.contactRefs ?? []).map((id) => {
          const c = release.store.refs.contacts.get(id);
          return c ? <ContactCard key={id} contact={c} /> : null;
        })}
      {node.type === 'terminal' && (
        <div className={`run-step__outcome run-step__outcome--${node.outcome}`}>
          <Icon name={node.outcome === 'evacuate' || node.outcome === 'consult' ? 'phone' : 'check'} />
          {OUTCOME[node.outcome]}
          {node.targetPresentation && (
            <a className="inline-link" href={hrefFor({ name: 'presentation', id: node.targetPresentation })}>
              Open{' '}
              {release.store.presentations.get(node.targetPresentation)?.data.meta.title ?? node.targetPresentation}
            </a>
          )}
        </div>
      )}
      {via && (
        <div className="run-step__via">
          <Icon name="chevron" size={18} /> {via.label ? <ContentText text={via.label} /> : 'Next'}
        </div>
      )}
      {reassessEdges.length > 0 && (
        <div className="run-step__reassess">
          {reassessEdges.map((e) => (
            <button key={e.id} type="button" className="btn btn--secondary btn--small" onClick={() => onReassess(e.id)}>
              ↺ {e.label ? <ContentText text={e.label} /> : 'Reassess'}
            </button>
          ))}
        </div>
      )}
      <CiteRef cite={node.cite} />
    </li>
  );
}

export function PathwayRunner({ presentation }: { presentation: Presentation }) {
  const { release } = useRelease();
  const { state, dispatch } = useSession();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const id = presentation.meta.id;
  const answers = state.answers[id] ?? {};
  const allPopulations = [...release.store.refs.populations.keys()];
  const evaluation = evaluate(presentation.pathway, answers, state.population, allPopulations);
  const rounds = state.rounds[id] ?? [];
  const nodeById = new Map(presentation.pathway.nodes.map((n) => [n.id, n]));

  const answer = (nodeId: string, a: Answer) => {
    const next = { ...answers, [nodeId]: a };
    const ev = evaluate(presentation.pathway, next, state.population, allPopulations);
    const pruned = pruneAnswers(next, ev);
    const cleared = Object.keys(next).length - Object.keys(pruned).length;
    setNotice(cleared > 0 ? `${cleared} later answer(s) were cleared because an earlier answer changed.` : null);
    dispatch({ type: 'set-answers', presentationId: id, answers: pruned });
  };

  const doReassess = (edgeId: string) => {
    const result = reassess(presentation.pathway, answers, evaluation, edgeId);
    if (!result) return;
    setNotice('Reassessing: earlier answers from this point are kept below as an earlier round.');
    dispatch({ type: 'reassess', presentationId: id, answers: result.answers, previous: result.previous });
  };

  return (
    <div className="runner">
      <ol className="run-steps">
        {evaluation.trail.map((t, i) => (
          <StepCard
            key={t.node.id}
            presentation={presentation}
            node={t.node}
            via={t.via}
            answer={answers[t.node.id]}
            isCurrent={i === evaluation.trail.length - 1}
            evaluation={evaluation}
            onAnswer={(a) => answer(t.node.id, a)}
            onReassess={doReassess}
          />
        ))}
      </ol>

      {notice && (
        <p className="runner__notice" role="status">
          {notice}
        </p>
      )}

      {(evaluation.state === 'missing' || evaluation.state === 'error') && (
        <div className="callout callout--critical" role="alert">
          <Icon name="alert" />
          <div>
            <strong>STOPPED — {evaluation.state === 'missing' ? 'cannot continue' : 'pathway problem'}</strong>
            <p>{evaluation.reason}</p>
            <p>
              <a href={hrefFor({ name: 'escalation', id })}>Consultation and retrieval criteria</a>
            </p>
          </div>
        </div>
      )}
      {evaluation.state === 'conflict' && (
        <div className="callout callout--critical" role="alert">
          <Icon name="alert" />
          <div>
            <strong>STOPPED — conflicting branches</strong>
            <p>{evaluation.reason}</p>
            <ul>
              {(evaluation.conflicting ?? []).map((e) => (
                <li key={e.id}>{e.label ? <ContentText text={e.label} /> : e.id}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {rounds.length > 0 && (
        <details className="runner__rounds">
          <summary>Earlier rounds ({rounds.length})</summary>
          {rounds.map((r, i) => (
            <div key={i} className="runner__round">
              <strong>Round {i + 1}</strong>
              <ul>
                {Object.entries(r).map(([nodeId, a]) => {
                  const n = nodeById.get(nodeId);
                  return n ? (
                    <li key={nodeId}>
                      <ContentText text={n.text} />: {describeAnswer(n, a)}
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          ))}
        </details>
      )}

      {Object.keys(answers).length > 0 && (
        <button type="button" className="btn btn--secondary btn--block" onClick={() => setConfirmRestart(true)}>
          Restart this pathway
        </button>
      )}
      {confirmRestart && (
        <ConfirmDialog
          title="Restart this pathway?"
          message="All answers for this pathway will be cleared."
          confirmLabel="Restart"
          onConfirm={() => {
            dispatch({ type: 'restart-pathway', presentationId: id });
            setNotice(null);
            setConfirmRestart(false);
          }}
          onCancel={() => setConfirmRestart(false)}
        />
      )}
    </div>
  );
}
