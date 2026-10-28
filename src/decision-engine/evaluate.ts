/**
 * Deterministic pathway evaluation.
 *
 * evaluate() is a pure function: the same pathway, answers and patient group always
 * give the same result. It re-walks the pathway from the first step on every call, so
 * editing an earlier answer automatically recalculates everything after it, and answers
 * that are no longer on the route are reported as `cleared`.
 *
 * It never chooses a branch by default. Missing answers, "unknown" answers without an
 * explicit branch, missing thresholds and steps not defined for the selected patient
 * group all STOP the walk with an explanation.
 */
import type { Condition, Id, Pathway, PathwayEdge, PathwayNode, QuestionNode } from '../content/types.ts';
import { answerValues } from './graph.ts';

export type Answer = { kind: 'value'; value: string } | { kind: 'number'; value: number } | { kind: 'unknown' };
export type Answers = Readonly<Record<Id, Answer>>;

export type EvaluationState = 'awaiting-input' | 'missing' | 'conflict' | 'terminal' | 'error';

export interface TrailStep {
  node: PathwayNode;
  /** Branch taken out of this step (absent for the current/last step). */
  via?: PathwayEdge;
}

export interface Evaluation {
  state: EvaluationState;
  trail: TrailStep[];
  /** The step the user is on (last trail step), or null if the pathway could not start. */
  current: PathwayNode | null;
  /** Plain-English explanation for missing / conflict / error states. */
  reason?: string;
  /** Branches that matched at once (conflict state). */
  conflicting?: PathwayEdge[];
  /** Answers given that are not on the current route (stale; the caller should discard them). */
  cleared: Id[];
}

type Truth = true | false | 'indeterminate';

/** Check an answer is a possible answer to the question. */
export function isValidAnswer(q: QuestionNode, a: Answer): boolean {
  if (a.kind === 'unknown') return q.input.allowUnknown;
  if (q.input.kind === 'number') return a.kind === 'number' && Number.isFinite(a.value);
  return a.kind === 'value' && (answerValues(q) ?? []).includes(a.value);
}

function evalCondition(c: Condition, answers: Answers): { truth: Truth; why?: string } {
  if ('all' in c) {
    const parts = c.all.map((x) => evalCondition(x, answers));
    if (parts.some((p) => p.truth === false)) return { truth: false };
    const ind = parts.find((p) => p.truth === 'indeterminate');
    return ind ? ind : { truth: true };
  }
  if ('any' in c) {
    const parts = c.any.map((x) => evalCondition(x, answers));
    if (parts.some((p) => p.truth === true)) return { truth: true };
    const ind = parts.find((p) => p.truth === 'indeterminate');
    return ind ? ind : { truth: false };
  }
  if ('not' in c) {
    const inner = evalCondition(c.not, answers);
    return inner.truth === 'indeterminate' ? inner : { truth: !inner.truth };
  }
  if ('unknown' in c) {
    const a = answers[c.unknown];
    if (!a) return { truth: 'indeterminate', why: `The answer to an earlier question ("${c.unknown}") is missing.` };
    return { truth: a.kind === 'unknown' };
  }
  const a = answers[c.answer];
  if (!a) return { truth: 'indeterminate', why: `The answer to an earlier question ("${c.answer}") is missing.` };
  if (a.kind === 'unknown') return { truth: false };
  if ('eq' in c) return { truth: a.kind === 'value' && a.value === c.eq };
  if ('in' in c) return { truth: a.kind === 'value' && c.in.includes(a.value) };
  // number comparison
  if (c.value === null)
    return { truth: 'indeterminate', why: 'The threshold for this decision has not been entered from the source.' };
  if (a.kind !== 'number') return { truth: false };
  switch (c.compare) {
    case 'gt':
      return { truth: a.value > c.value };
    case 'gte':
      return { truth: a.value >= c.value };
    case 'lt':
      return { truth: a.value < c.value };
    case 'lte':
      return { truth: a.value <= c.value };
  }
}

/**
 * @param population selected patient group, or null if none selected
 * @param allPopulations every defined patient group; when none is selected, a step that is
 *   not for all groups stops the walk until a group is chosen.
 */
export function evaluate(
  pathway: Pathway,
  answers: Answers,
  population: string | null,
  allPopulations: readonly string[] = [],
): Evaluation {
  const nodes = new Map(pathway.nodes.map((n) => [n.id, n]));
  const trail: TrailStep[] = [];
  const visited = new Set<Id>();
  const finish = (state: EvaluationState, extra: Partial<Evaluation> = {}): Evaluation => {
    const onRoute = new Set(trail.map((t) => t.node.id));
    return {
      state,
      trail,
      current: trail.length ? trail[trail.length - 1]!.node : null,
      cleared: Object.keys(answers).filter((id) => !onRoute.has(id)),
      ...extra,
    };
  };

  let id: Id | undefined = pathway.entryNode;
  while (id !== undefined) {
    const node = nodes.get(id);
    if (!node) return finish('error', { reason: `Step "${id}" does not exist.` });
    if (visited.has(id)) return finish('error', { reason: 'The pathway loops back on itself.' });
    visited.add(id);
    trail.push({ node });

    if (population !== null && !node.populations.includes(population)) {
      return finish('missing', {
        reason: 'The source does not define this step for the selected patient group. Use the manual and consult.',
      });
    }
    if (population === null && !allPopulations.every((p) => node.populations.includes(p))) {
      return finish('missing', {
        reason: 'This step is specific to a patient group. Select Adult or Child above to continue.',
      });
    }
    if (node.type === 'terminal') return finish('terminal');

    const outs = pathway.edges.filter((e) => e.from === id && e.kind === 'normal');
    if (node.type !== 'question') {
      if (outs.length !== 1) return finish('error', { reason: 'This step does not have exactly one next step.' });
      trail[trail.length - 1]!.via = outs[0];
      id = outs[0]!.to;
      continue;
    }

    const answer = answers[node.id];
    if (!answer || !isValidAnswer(node, answer)) return finish('awaiting-input');

    const results = outs.map((e) => ({ edge: e, ...evalCondition(e.condition!, answers) }));
    const matched = results.filter((r) => r.truth === true);
    const unsure = results.filter((r) => r.truth === 'indeterminate');
    if (matched.length > 1) {
      return finish('conflict', {
        reason: 'More than one branch in the source matches these answers. Use the manual and consult.',
        conflicting: matched.map((m) => m.edge),
      });
    }
    if (unsure.length > 0) {
      return finish('missing', { reason: unsure[0]!.why ?? 'Information needed for this decision is missing.' });
    }
    if (matched.length === 0) {
      return finish('missing', {
        reason:
          answer.kind === 'unknown'
            ? 'The source does not define what to do when this is unknown. Use the manual and consult.'
            : 'The source does not define a next step for this answer. Use the manual and consult.',
      });
    }
    trail[trail.length - 1]!.via = matched[0]!.edge;
    id = matched[0]!.edge.to;
  }
  return finish('error', { reason: 'The pathway ended without an end step.' });
}

/** Answers with stale entries removed. */
export function pruneAnswers(answers: Answers, evaluation: Evaluation): Record<Id, Answer> {
  const out: Record<Id, Answer> = { ...answers };
  for (const id of evaluation.cleared) delete out[id];
  return out;
}

/**
 * Start a reassessment along a "reassess" branch: answers from the branch target onwards
 * (on the current route) are removed so those questions are asked again.
 * Returns the remaining answers and the answers that were set aside (for history display).
 */
export function reassess(
  pathway: Pathway,
  answers: Answers,
  evaluation: Evaluation,
  edgeId: Id,
): { answers: Record<Id, Answer>; previous: Record<Id, Answer> } | null {
  const edge = pathway.edges.find((e) => e.id === edgeId && e.kind === 'reassess');
  if (!edge) return null;
  const ids = evaluation.trail.map((t) => t.node.id);
  const from = ids.indexOf(edge.from);
  const to = ids.indexOf(edge.to);
  if (from === -1 || to === -1 || to > from) return null;
  const reset = new Set(ids.slice(to));
  const kept: Record<Id, Answer> = {};
  const previous: Record<Id, Answer> = {};
  for (const [k, v] of Object.entries(answers)) (reset.has(k) ? previous : kept)[k] = v;
  return { answers: kept, previous };
}

export function describeAnswer(node: PathwayNode, a: Answer): string {
  if (a.kind === 'unknown') return 'Unknown / not assessed';
  if (a.kind === 'number')
    return `${a.value}${node.type === 'question' && node.input.unit ? ` ${node.input.unit}` : ''}`;
  if (node.type === 'question' && node.input.kind === 'choice')
    return node.input.options?.find((o) => o.value === a.value)?.label ?? a.value;
  return a.value === 'yes' ? 'Yes' : a.value === 'no' ? 'No' : a.value;
}
