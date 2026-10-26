/**
 * Structural checks for a pathway graph, run before any content can be used.
 * These checks never add or repair branches: they only report problems.
 */
import type { Condition, Id, Pathway, PathwayEdge, PathwayNode, QuestionNode } from '../content/types.ts';
import { issue, type ContentIssue } from '../content/issues.ts';

const nodeLoc = (id: string) => `pathway → step "${id}"`;
const edgeLoc = (id: string) => `pathway → branch "${id}"`;

/** Answer values a question can produce (excluding "unknown"). Null for numeric questions. */
export function answerValues(q: QuestionNode): string[] | null {
  switch (q.input.kind) {
    case 'yes-no':
      return ['yes', 'no'];
    case 'choice':
      return (q.input.options ?? []).map((o) => o.value);
    case 'number':
      return null;
  }
}

/** Ids of answers referenced by a condition. */
export function conditionRefs(c: Condition): Id[] {
  if ('all' in c) return c.all.flatMap(conditionRefs);
  if ('any' in c) return c.any.flatMap(conditionRefs);
  if ('not' in c) return conditionRefs(c.not);
  if ('unknown' in c) return [c.unknown];
  return [c.answer];
}

/** For a simple equality condition on one answer, the values it matches; otherwise null. */
function simpleValues(c: Condition, answerId: Id): string[] | null {
  if ('answer' in c && c.answer === answerId) {
    if ('eq' in c) return [c.eq];
    if ('in' in c) return c.in;
  }
  return null;
}

export function checkPathway(pathway: Pathway, allowedPopulations: readonly Id[], file: string): ContentIssue[] {
  const out: ContentIssue[] = [];
  const err = (code: string, location: string, message: string) =>
    out.push(issue('error', code, file, location, message));
  const warn = (code: string, location: string, message: string) =>
    out.push(issue('warning', code, file, location, message));

  // ---- identity ----
  const nodes = new Map<Id, PathwayNode>();
  for (const n of pathway.nodes) {
    if (nodes.has(n.id)) err('graph-duplicate-node', nodeLoc(n.id), `Two steps share the id "${n.id}".`);
    else nodes.set(n.id, n);
  }
  const edgeIds = new Set<Id>();
  for (const e of pathway.edges) {
    if (edgeIds.has(e.id)) err('graph-duplicate-edge', edgeLoc(e.id), `Two branches share the id "${e.id}".`);
    edgeIds.add(e.id);
  }
  if (!nodes.has(pathway.entryNode)) {
    err('graph-missing-entry', 'pathway → entryNode', `The first step "${pathway.entryNode}" does not exist.`);
  }

  // ---- edges ----
  const validEdges: PathwayEdge[] = [];
  for (const e of pathway.edges) {
    let ok = true;
    for (const end of [e.from, e.to] as const) {
      if (!nodes.has(end)) {
        err('graph-broken-edge', edgeLoc(e.id), `Branch points to a step "${end}" that does not exist.`);
        ok = false;
      }
    }
    if (ok) validEdges.push(e);
  }
  const normalOut = new Map<Id, PathwayEdge[]>();
  const reassessOut = new Map<Id, PathwayEdge[]>();
  for (const id of nodes.keys()) {
    normalOut.set(id, []);
    reassessOut.set(id, []);
  }
  for (const e of validEdges) (e.kind === 'normal' ? normalOut : reassessOut).get(e.from)!.push(e);

  // ---- per-node rules ----
  for (const n of nodes.values()) {
    const outs = normalOut.get(n.id)!;
    const loops = reassessOut.get(n.id)!;
    for (const p of n.populations) {
      if (!allowedPopulations.includes(p)) {
        err(
          'graph-population-outside',
          nodeLoc(n.id),
          `Step applies to population "${p}", but the presentation only covers: ${allowedPopulations.join(', ')}.`,
        );
      }
    }
    if (n.type === 'terminal') {
      if (outs.length + loops.length > 0)
        err('graph-terminal-has-exit', nodeLoc(n.id), 'An end step must not have branches leaving it.');
      if (n.outcome === 'go-to-presentation' && !n.targetPresentation)
        err(
          'graph-terminal-target-missing',
          nodeLoc(n.id),
          'Outcome "go-to-presentation" needs a "targetPresentation".',
        );
      if (n.outcome !== 'go-to-presentation' && n.targetPresentation)
        err(
          'graph-terminal-target-unexpected',
          nodeLoc(n.id),
          '"targetPresentation" is only allowed when outcome is "go-to-presentation".',
        );
      continue;
    }
    if (outs.length === 0) {
      err(
        'graph-dead-end',
        nodeLoc(n.id),
        'Step has no next step. Every route must finish at an end step (type "terminal").',
      );
    }
    if (n.type !== 'question') {
      if (outs.length > 1)
        err(
          'graph-unconditional-branch',
          nodeLoc(n.id),
          'Only question steps can branch. This step has more than one next step.',
        );
      for (const e of outs) {
        if (e.condition)
          err(
            'graph-condition-on-non-question',
            edgeLoc(e.id),
            'Only branches leaving a question step may have a condition.',
          );
      }
    } else {
      for (const e of outs) {
        if (!e.condition)
          err(
            'graph-question-edge-without-condition',
            edgeLoc(e.id),
            'A branch leaving a question step must state its condition. Branches are never chosen by default.',
          );
      }
      const values = (n.input.options ?? []).map((o) => o.value);
      if (new Set(values).size !== values.length)
        err('graph-duplicate-option', nodeLoc(n.id), 'Two answer options share the same value.');
    }
    for (const e of loops) {
      if (e.condition)
        err(
          'graph-reassess-condition',
          edgeLoc(e.id),
          'Reassess branches are chosen by the user and must not have a condition.',
        );
    }
  }

  // ---- cycles (normal edges only) ----
  const colour = new Map<Id, 0 | 1 | 2>();
  let cycleAt: Id | null = null;
  const visit = (id: Id) => {
    colour.set(id, 1);
    for (const e of normalOut.get(id) ?? []) {
      const c = colour.get(e.to) ?? 0;
      if (c === 1 && cycleAt === null) cycleAt = e.to;
      else if (c === 0) visit(e.to);
    }
    colour.set(id, 2);
  };
  for (const id of nodes.keys()) if ((colour.get(id) ?? 0) === 0) visit(id);
  if (cycleAt !== null) {
    err(
      'graph-cycle',
      nodeLoc(cycleAt),
      'The pathway loops back on itself through normal branches. Loops are only allowed as "reassess" branches.',
    );
  }

  // ---- reachability ----
  const reachable = new Set<Id>();
  if (nodes.has(pathway.entryNode)) {
    const queue = [pathway.entryNode];
    while (queue.length) {
      const id = queue.shift()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const e of normalOut.get(id) ?? []) queue.push(e.to);
    }
  }
  for (const id of nodes.keys()) {
    if (!reachable.has(id)) err('graph-unreachable', nodeLoc(id), 'Step can never be reached from the first step.');
  }

  // ---- ancestors (who can reach each node through normal edges) ----
  const incoming = new Map<Id, Id[]>();
  for (const id of nodes.keys()) incoming.set(id, []);
  for (const e of validEdges) if (e.kind === 'normal') incoming.get(e.to)!.push(e.from);
  const ancestorsOf = (id: Id): Set<Id> => {
    const seen = new Set<Id>();
    const queue = [...incoming.get(id)!];
    while (queue.length) {
      const a = queue.shift()!;
      if (seen.has(a)) continue;
      seen.add(a);
      queue.push(...incoming.get(a)!);
    }
    return seen;
  };

  // ---- conditions ----
  for (const n of nodes.values()) {
    if (n.type !== 'question') continue;
    const outs = normalOut.get(n.id)!.filter((e) => e.condition);
    const earlier = ancestorsOf(n.id);
    for (const e of outs) checkCondition(e.condition!, e, n.id, earlier);

    // overlap and coverage (only decidable for simple conditions on this question's own answer)
    const simple = outs.map((e) => simpleValues(e.condition!, n.id));
    if (simple.some((v) => v === null)) {
      if (outs.length > 1)
        warn(
          'graph-overlap-unchecked',
          nodeLoc(n.id),
          'Some branch conditions are combined or refer to earlier answers, so overlaps cannot be checked before use. If more than one branch matches, the app will stop and show a CONFLICT.',
        );
    } else {
      const claimed = new Map<string, Id>();
      for (let i = 0; i < outs.length; i++) {
        for (const v of simple[i]!) {
          const prior = claimed.get(v);
          if (prior)
            err(
              'graph-overlapping-branches',
              nodeLoc(n.id),
              `Answer "${v}" matches both branch "${prior}" and branch "${outs[i]!.id}".`,
            );
          else claimed.set(v, outs[i]!.id);
        }
      }
      const possible = answerValues(n);
      for (const v of possible ?? []) {
        if (!claimed.has(v))
          warn(
            'graph-uncovered-answer',
            nodeLoc(n.id),
            `Answer "${v}" has no branch. If chosen, the app will stop and show that the source does not define a next step.`,
          );
      }
    }
  }

  function checkCondition(c: Condition, e: PathwayEdge, ownId: Id, earlier: Set<Id>) {
    if ('all' in c) return c.all.forEach((x) => checkCondition(x, e, ownId, earlier));
    if ('any' in c) return c.any.forEach((x) => checkCondition(x, e, ownId, earlier));
    if ('not' in c) return checkCondition(c.not, e, ownId, earlier);
    const ref = 'unknown' in c ? c.unknown : c.answer;
    const target = nodes.get(ref);
    if (!target || target.type !== 'question') {
      err('graph-condition-bad-ref', edgeLoc(e.id), `Condition refers to "${ref}", which is not a question step.`);
      return;
    }
    if (ref !== ownId && !earlier.has(ref)) {
      err(
        'graph-condition-not-earlier',
        edgeLoc(e.id),
        `Condition refers to the answer of "${ref}", which is not always asked before this point.`,
      );
    }
    if ('unknown' in c) {
      if (!target.input.allowUnknown)
        err(
          'graph-condition-unknown-not-allowed',
          edgeLoc(e.id),
          `Question "${ref}" does not offer an "Unknown" answer.`,
        );
      return;
    }
    const allowed = answerValues(target);
    if ('compare' in c) {
      if (target.input.kind !== 'number')
        err(
          'graph-condition-kind-mismatch',
          edgeLoc(e.id),
          `A number comparison needs a number question; "${ref}" is not one.`,
        );
      else if (c.unit !== target.input.unit)
        err(
          'graph-condition-unit-mismatch',
          edgeLoc(e.id),
          `Condition unit "${c.unit}" does not match the question unit "${target.input.unit ?? ''}".`,
        );
      if (c.value === null)
        warn(
          'graph-threshold-missing',
          edgeLoc(e.id),
          'Threshold value not entered yet. The app will show MISSING instead of choosing this branch.',
        );
      return;
    }
    if (allowed === null) {
      err(
        'graph-condition-kind-mismatch',
        edgeLoc(e.id),
        `Number question "${ref}" must be checked with a comparison, not a matching value.`,
      );
      return;
    }
    const values = 'eq' in c ? [c.eq] : c.in;
    for (const v of values) {
      if (!allowed.includes(v))
        err(
          'graph-condition-bad-value',
          edgeLoc(e.id),
          `"${v}" is not a possible answer to "${ref}" (allowed: ${allowed.join(', ')}).`,
        );
    }
  }

  // ---- reassess loops must go backwards ----
  for (const e of validEdges) {
    if (e.kind !== 'reassess') continue;
    if (e.to !== e.from && !ancestorsOf(e.from).has(e.to)) {
      err(
        'graph-reassess-not-backwards',
        edgeLoc(e.id),
        'A reassess branch must return to this step or an earlier one.',
      );
    }
  }

  // ---- population continuity ----
  for (const e of validEdges) {
    const a = nodes.get(e.from)!;
    const b = nodes.get(e.to)!;
    if (!a.populations.some((p) => b.populations.includes(p))) {
      err(
        'graph-population-mismatch',
        edgeLoc(e.id),
        `Branch joins steps for different populations (${a.populations.join(', ')} → ${b.populations.join(', ')}).`,
      );
    }
  }

  return out;
}

export interface OrderedStep {
  number: number;
  node: PathwayNode;
  next: PathwayEdge[];
  reassess: PathwayEdge[];
}

/** Steps in reading order (breadth-first from the first step), numbered from 1. */
export function orderSteps(pathway: Pathway): OrderedStep[] {
  const byId = new Map(pathway.nodes.map((n) => [n.id, n]));
  const order: Id[] = [];
  const seen = new Set<Id>();
  const queue = byId.has(pathway.entryNode) ? [pathway.entryNode] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    order.push(id);
    for (const e of pathway.edges) if (e.kind === 'normal' && e.from === id) queue.push(e.to);
  }
  for (const n of pathway.nodes) if (!seen.has(n.id)) order.push(n.id);
  return order.map((id, i) => ({
    number: i + 1,
    node: byId.get(id)!,
    next: pathway.edges.filter((e) => e.from === id && e.kind === 'normal'),
    reassess: pathway.edges.filter((e) => e.from === id && e.kind === 'reassess'),
  }));
}
