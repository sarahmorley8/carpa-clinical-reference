/**
 * Builds ISBAR text ONLY from what the user explicitly ticked or answered in this session.
 * It never infers diagnoses, observations or treatments, and never adds identifying details.
 */
import type { ContentStore } from '../content/validate.ts';
import { isPlaceholder } from '../content/placeholders.ts';
import { describeAnswer, evaluate } from '../decision-engine/evaluate.ts';
import type { IsbarDraft, IsbarSection, SessionState } from '../state/session.tsx';

export const ISBAR_LABELS: Record<IsbarSection, { letter: string; title: string; hint: string }> = {
  identify: {
    letter: 'I',
    title: 'Identify',
    hint: 'Yourself, your role and location. Add patient identifiers only if your procedure requires it.',
  },
  situation: { letter: 'S', title: 'Situation', hint: 'Why you are calling.' },
  background: { letter: 'B', title: 'Background', hint: 'Relevant history.' },
  assessment: { letter: 'A', title: 'Assessment', hint: 'Observations, examination and test results.' },
  recommendation: { letter: 'R', title: 'Recommendation', hint: 'What you are asking for.' },
};

const OUTCOME_TEXT: Record<string, string> = {
  'continue-per-source': 'continue as per source',
  consult: 'consult',
  evacuate: 'evacuate',
  'go-to-presentation': 'go to another presentation',
};

export function buildIsbarLines(state: SessionState, store: ContentStore): Record<IsbarSection, string[]> {
  const out: Record<IsbarSection, string[]> = {
    identify: [],
    situation: [],
    background: [],
    assessment: [],
    recommendation: [],
  };
  const population = state.population ? store.refs.populations.get(state.population)?.label : null;
  if (population) out.situation.push(`Patient group: ${population}`);
  const allPopulations = [...store.refs.populations.keys()];

  const ids = new Set([...Object.keys(state.checks), ...Object.keys(state.answers)]);
  for (const id of ids) {
    const unit = store.presentations.get(id);
    if (!unit) continue;
    const p = unit.data;
    const ticked = new Set(state.checks[id] ?? []);
    const answers = state.answers[id] ?? {};
    if (ticked.size === 0 && Object.keys(answers).length === 0) continue;
    out.situation.push(`Reference pathway used: ${p.meta.title}`);
    const text = (items: { id: string; text: string }[]) =>
      items.filter((i) => ticked.has(i.id) && !isPlaceholder(i.text)).map((i) => i.text);
    out.background.push(...text(p.assessment.history));
    out.assessment.push(...text(p.assessment.observations), ...text(p.assessment.examination));
    out.assessment.push(...text(p.investigations).map((t) => `Done: ${t}`));

    const ev = evaluate(p.pathway, answers, state.population, allPopulations);
    for (const step of ev.trail) {
      const a = answers[step.node.id];
      if (a && !isPlaceholder(step.node.text))
        out.assessment.push(`${step.node.text}: ${describeAnswer(step.node, a)}`);
      if (step.node.type === 'escalation' && !isPlaceholder(step.node.text))
        out.recommendation.push(`Pathway step reached: ${step.node.text}`);
    }
    if (ev.state === 'terminal' && ev.current?.type === 'terminal')
      out.recommendation.push(`Pathway end reached (${p.meta.title}): ${OUTCOME_TEXT[ev.current.outcome]}`);
  }
  return out;
}

/** Add generated lines to the draft without overwriting or duplicating what is there. */
export function mergeIntoDraft(draft: IsbarDraft, lines: Record<IsbarSection, string[]>): IsbarDraft {
  const next = { ...draft };
  for (const key of Object.keys(lines) as IsbarSection[]) {
    const existing = new Set(draft[key].split('\n').map((l) => l.trim()));
    const add = lines[key].filter((l) => !existing.has(l.trim()));
    if (add.length) next[key] = [draft[key].trimEnd(), ...add].filter((l) => l !== '').join('\n');
  }
  return next;
}

export function isbarToText(draft: IsbarDraft): string {
  return (Object.keys(ISBAR_LABELS) as IsbarSection[])
    .map((k) => `${ISBAR_LABELS[k].letter} — ${ISBAR_LABELS[k].title}:\n${draft[k].trim() || '(none)'}`)
    .join('\n\n');
}
