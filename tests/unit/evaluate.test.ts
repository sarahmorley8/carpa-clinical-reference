import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Pathway, PathwayEdge, PathwayNode, Presentation } from '../../src/content/types.ts';
import { evaluate, pruneAnswers, reassess, type Answer, type Answers } from '../../src/decision-engine/evaluate.ts';
import { readContent } from '../helpers.ts';

const cite = { sourceId: 's', section: 'x', page: '1' };
const both = ['adult', 'child'];
const yn = (id: string, allowUnknown = true, populations = both): PathwayNode => ({
  id,
  type: 'question',
  text: id,
  cite,
  populations,
  input: { kind: 'yes-no', required: true, allowUnknown },
});
const num = (id: string): PathwayNode => ({
  id,
  type: 'question',
  text: id,
  cite,
  populations: both,
  input: { kind: 'number', unit: '/min', required: true, allowUnknown: true },
});
const act = (id: string, populations = both): PathwayNode => ({ id, type: 'action', text: id, cite, populations });
const end = (id: string): PathwayNode => ({
  id,
  type: 'terminal',
  outcome: 'consult',
  text: id,
  cite,
  populations: both,
});
const e = (id: string, from: string, to: string, extra: Partial<PathwayEdge> = {}): PathwayEdge => ({
  id,
  from,
  to,
  kind: 'normal',
  cite,
  ...extra,
});
const eq = (answer: string, value: string) => ({ condition: { answer, eq: value }, label: `${answer}=${value}` });
const yes: Answer = { kind: 'value', value: 'yes' };
const no: Answer = { kind: 'value', value: 'no' };
const unknown: Answer = { kind: 'unknown' };

// q1 yes -> a1 -> end-a ; q1 no -> q2 ; q2 yes -> end-b ; q2 no -> end-c ; reassess end... from q2 back to q1
const p: Pathway = {
  entryNode: 'q1',
  nodes: [yn('q1'), act('a1'), yn('q2', false), end('end-a'), end('end-b'), end('end-c')],
  edges: [
    e('q1-yes', 'q1', 'a1', eq('q1', 'yes')),
    e('q1-no', 'q1', 'q2', eq('q1', 'no')),
    e('a1-next', 'a1', 'end-a'),
    e('q2-yes', 'q2', 'end-b', eq('q2', 'yes')),
    e('q2-no', 'q2', 'end-c', eq('q2', 'no')),
    e('again', 'q2', 'q1', { kind: 'reassess', label: 'Reassess' }),
  ],
};
const ids = (ev: ReturnType<typeof evaluate>) => ev.trail.map((t) => t.node.id);

describe('evaluate()', () => {
  it('waits for the first answer', () => {
    const ev = evaluate(p, {}, null);
    expect(ev.state).toBe('awaiting-input');
    expect(ids(ev)).toEqual(['q1']);
  });

  it('follows defined branches through to an end step', () => {
    const ev = evaluate(p, { q1: yes }, null);
    expect(ev.state).toBe('terminal');
    expect(ids(ev)).toEqual(['q1', 'a1', 'end-a']);
    expect(ev.trail[0]!.via!.id).toBe('q1-yes');
  });

  it('changing an earlier answer recalculates and reports stale answers', () => {
    const first = evaluate(p, { q1: no, q2: yes }, null);
    expect(ids(first)).toEqual(['q1', 'q2', 'end-b']);
    const changed: Answers = { q1: yes, q2: yes };
    const ev = evaluate(p, changed, null);
    expect(ids(ev)).toEqual(['q1', 'a1', 'end-a']);
    expect(ev.cleared).toEqual(['q2']);
    expect(pruneAnswers(changed, ev)).toEqual({ q1: yes });
  });

  it('"unknown" never follows a branch unless one is defined', () => {
    const ev = evaluate(p, { q1: unknown }, null);
    expect(ev.state).toBe('missing');
    expect(ev.reason).toMatch(/does not define what to do when this is unknown/);
    const withUnknown: Pathway = {
      ...p,
      edges: [...p.edges, e('q1-unk', 'q1', 'end-c', { condition: { unknown: 'q1' }, label: 'u' })],
    };
    expect(ids(evaluate(withUnknown, { q1: unknown }, null))).toEqual(['q1', 'end-c']);
  });

  it('invalid answers are treated as not answered', () => {
    expect(evaluate(p, { q2: unknown, q1: no }, null).state).toBe('awaiting-input'); // q2 does not allow unknown
    expect(evaluate(p, { q1: { kind: 'value', value: 'maybe' } }, null).state).toBe('awaiting-input');
  });

  it('a missing threshold stops instead of choosing', () => {
    const t: Pathway = {
      entryNode: 'n',
      nodes: [num('n'), end('hi'), end('lo')],
      edges: [
        e('hi', 'n', 'hi', { condition: { answer: 'n', compare: 'gte', value: null, unit: '/min' }, label: 'hi' }),
        e('lo', 'n', 'lo', { condition: { answer: 'n', compare: 'lt', value: null, unit: '/min' }, label: 'lo' }),
      ],
    };
    const ev = evaluate(t, { n: { kind: 'number', value: 120 } }, null);
    expect(ev.state).toBe('missing');
    expect(ev.reason).toMatch(/threshold/);
  });

  it('number thresholds compare correctly at the boundary', () => {
    const t: Pathway = {
      entryNode: 'n',
      nodes: [num('n'), end('hi'), end('lo')],
      edges: [
        e('hi', 'n', 'hi', { condition: { answer: 'n', compare: 'gte', value: 100, unit: '/min' }, label: 'hi' }),
        e('lo', 'n', 'lo', { condition: { answer: 'n', compare: 'lt', value: 100, unit: '/min' }, label: 'lo' }),
      ],
    };
    expect(ids(evaluate(t, { n: { kind: 'number', value: 100 } }, null))).toEqual(['n', 'hi']);
    expect(ids(evaluate(t, { n: { kind: 'number', value: 99.9 } }, null))).toEqual(['n', 'lo']);
  });

  it('two matching branches stop with CONFLICT', () => {
    const c: Pathway = {
      entryNode: 'n',
      nodes: [num('n'), end('a'), end('b')],
      edges: [
        e('a', 'n', 'a', { condition: { answer: 'n', compare: 'gte', value: 10, unit: '/min' }, label: 'a' }),
        e('b', 'n', 'b', { condition: { answer: 'n', compare: 'gte', value: 5, unit: '/min' }, label: 'b' }),
      ],
    };
    const ev = evaluate(c, { n: { kind: 'number', value: 12 } }, null);
    expect(ev.state).toBe('conflict');
    expect(ev.conflicting!.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('an answer with no matching branch stops with MISSING', () => {
    const partial: Pathway = { ...p, edges: p.edges.filter((x) => x.id !== 'q1-no') };
    const ev = evaluate(partial, { q1: no }, null);
    expect(ev.state).toBe('missing');
    expect(ev.reason).toMatch(/does not define a next step/);
  });

  it('steps not for the selected group stop; group-specific steps need a group', () => {
    const g: Pathway = {
      entryNode: 'q1',
      nodes: [yn('q1'), act('child-step', ['child']), end('z')],
      edges: [
        e('y', 'q1', 'child-step', eq('q1', 'yes')),
        e('n', 'q1', 'z', eq('q1', 'no')),
        e('c', 'child-step', 'z'),
      ],
    };
    expect(evaluate(g, { q1: yes }, 'adult').state).toBe('missing');
    expect(evaluate(g, { q1: yes }, null, both).reason).toMatch(/Select Adult or Child/);
    expect(evaluate(g, { q1: yes }, 'child', both).state).toBe('terminal');
  });

  it('reassess sets aside answers from the loop target onwards', () => {
    const answers: Answers = { q1: no, q2: yes };
    const ev = evaluate(p, answers, null);
    const r = reassess(p, answers, ev, 'again')!;
    expect(r.answers).toEqual({});
    expect(r.previous).toEqual(answers);
    expect(reassess(p, answers, ev, 'q1-yes')).toBeNull(); // not a reassess branch
  });

  it('is deterministic and never crashes for any combination of answers (property test)', () => {
    const answerArb = fc.oneof(
      fc.constant(yes),
      fc.constant(no),
      fc.constant(unknown),
      fc.record({ kind: fc.constant('value' as const), value: fc.string() }),
      fc.record({ kind: fc.constant('number' as const), value: fc.double() }),
    );
    fc.assert(
      fc.property(
        fc.dictionary(fc.constantFrom('q1', 'q2', 'a1', 'zz'), answerArb),
        fc.constantFrom(null, 'adult', 'child'),
        (answers, pop) => {
          const a = evaluate(p, answers, pop, both);
          const b = evaluate(p, answers, pop, both);
          expect(a).toEqual(b);
          expect(['awaiting-input', 'missing', 'conflict', 'terminal']).toContain(a.state);
          // every answer is either on the route or reported as cleared
          const onRoute = new Set(a.trail.map((t) => t.node.id));
          for (const k of Object.keys(answers)) expect(onRoute.has(k) || a.cleared.includes(k)).toBe(true);
          // terminal only when the last step is an end step
          if (a.state === 'terminal') expect(a.current!.type).toBe('terminal');
        },
      ),
    );
  });
});

describe('demonstration pathway end to end (engine only)', () => {
  const demo = readContent('examples/presentations/demo-fictional-fever.json') as Presentation;
  it('not sparkling, glow 3, settled → continue', () => {
    const ev = evaluate(
      demo.pathway,
      { 'q-sparkling': no, 'q-glow-level': { kind: 'number', value: 3 }, 'q-settled': yes },
      'child',
      both,
    );
    expect(ids(ev)).toEqual(['q-sparkling', 'q-glow-level', 'a-give-demonstrol', 'q-settled', 'end-continue']);
  });
  it('sparkling → consult', () => {
    expect(ids(evaluate(demo.pathway, { 'q-sparkling': yes }, 'adult', both))).toEqual([
      'q-sparkling',
      'e-call',
      'end-consult',
    ]);
  });
  it('unknown sparkling → MISSING (deliberately undefined in the demo)', () => {
    expect(evaluate(demo.pathway, { 'q-sparkling': unknown }, 'adult', both).state).toBe('missing');
  });
});
