import { describe, expect, it } from 'vitest';
import { checkPathway, orderSteps } from '../../src/decision-engine/graph.ts';
import type { Pathway, PathwayEdge, PathwayNode } from '../../src/content/types.ts';

const cite = { sourceId: 's', section: 'x', page: '1' };
const both = ['adult', 'child'];
const q = (id: string, extra: Partial<PathwayNode> = {}): PathwayNode =>
  ({
    id,
    type: 'question',
    text: id,
    cite,
    populations: both,
    input: { kind: 'yes-no', required: true, allowUnknown: true },
    ...extra,
  }) as PathwayNode;
const info = (id: string, populations = both): PathwayNode => ({ id, type: 'info', text: id, cite, populations });
const end = (id: string): PathwayNode => ({
  id,
  type: 'terminal',
  outcome: 'consult',
  text: id,
  cite,
  populations: both,
});
const edge = (id: string, from: string, to: string, extra: Partial<PathwayEdge> = {}): PathwayEdge => ({
  id,
  from,
  to,
  kind: 'normal',
  cite,
  ...extra,
});
const yes = (answer: string) => ({ condition: { answer, eq: 'yes' }, label: 'yes' });
const no = (answer: string) => ({ condition: { answer, eq: 'no' }, label: 'no' });

const codes = (p: Pathway, severity: 'error' | 'warning' = 'error') =>
  checkPathway(p, both, 'f.json')
    .filter((i) => i.severity === severity)
    .map((i) => i.code);

const valid: Pathway = {
  entryNode: 'q1',
  nodes: [q('q1'), info('i1'), end('end-a'), end('end-b')],
  edges: [edge('e1', 'q1', 'i1', yes('q1')), edge('e2', 'q1', 'end-b', no('q1')), edge('e3', 'i1', 'end-a')],
};

describe('pathway graph checks', () => {
  it('accepts a valid pathway (unknown answer left uncovered is fine)', () => {
    expect(codes(valid)).toEqual([]);
    expect(codes(valid, 'warning')).toEqual([]);
  });

  it('detects a missing first step and broken branch targets', () => {
    expect(codes({ ...valid, entryNode: 'nope' })).toContain('graph-missing-entry');
    expect(codes({ ...valid, edges: [...valid.edges, edge('e9', 'i1', 'ghost')] })).toContain('graph-broken-edge');
  });

  it('detects cycles through normal branches', () => {
    const p: Pathway = {
      entryNode: 'a',
      nodes: [info('a'), info('b'), end('z')],
      edges: [edge('ab', 'a', 'b'), edge('ba', 'b', 'a')],
    };
    expect(codes(p)).toContain('graph-cycle');
  });

  it('detects unreachable steps and dead ends', () => {
    const p: Pathway = { entryNode: 'a', nodes: [info('a'), info('orphan'), end('z')], edges: [edge('az', 'a', 'z')] };
    expect(codes(p)).toEqual(expect.arrayContaining(['graph-unreachable', 'graph-dead-end']));
  });

  it('only question steps may branch, and their branches need conditions', () => {
    const p: Pathway = {
      entryNode: 'a',
      nodes: [info('a'), q('q1'), end('y'), end('z')],
      edges: [edge('a1', 'a', 'q1'), edge('a2', 'a', 'y'), edge('q-y', 'q1', 'y'), edge('q-z', 'q1', 'z', no('q1'))],
    };
    expect(codes(p)).toEqual(
      expect.arrayContaining(['graph-unconditional-branch', 'graph-question-edge-without-condition']),
    );
  });

  it('detects overlapping branches and warns about answers with no branch', () => {
    const overlap: Pathway = {
      ...valid,
      edges: [edge('e1', 'q1', 'i1', yes('q1')), edge('e2', 'q1', 'end-b', yes('q1')), edge('e3', 'i1', 'end-a')],
    };
    expect(codes(overlap)).toContain('graph-overlapping-branches');
    expect(codes(overlap, 'warning')).toContain('graph-uncovered-answer');
  });

  it('rejects conditions with impossible values or wrong question types', () => {
    const p: Pathway = {
      entryNode: 'q1',
      nodes: [
        q('q1'),
        q('n1', { input: { kind: 'number', unit: '/min', required: true, allowUnknown: false } } as never),
        end('z'),
        end('y'),
      ],
      edges: [
        edge('e1', 'q1', 'n1', { condition: { answer: 'q1', eq: 'maybe' }, label: 'x' }),
        edge('e2', 'q1', 'z', no('q1')),
        edge('e3', 'n1', 'z', { condition: { answer: 'n1', eq: 'yes' }, label: 'x' }),
        edge('e4', 'n1', 'y', { condition: { answer: 'n1', compare: 'gt', value: 5, unit: 'mmHg' }, label: 'x' }),
      ],
    };
    expect(codes(p)).toEqual(
      expect.arrayContaining([
        'graph-condition-bad-value',
        'graph-condition-kind-mismatch',
        'graph-condition-unit-mismatch',
      ]),
    );
  });

  it('a missing threshold is a warning (shown as MISSING), never a default', () => {
    const p: Pathway = {
      entryNode: 'n1',
      nodes: [
        q('n1', { input: { kind: 'number', unit: '/min', required: true, allowUnknown: false } } as never),
        end('z'),
      ],
      edges: [
        edge('e1', 'n1', 'z', { condition: { answer: 'n1', compare: 'gt', value: null, unit: '/min' }, label: 'x' }),
      ],
    };
    expect(codes(p)).toEqual([]);
    expect(codes(p, 'warning')).toContain('graph-threshold-missing');
  });

  it('conditions may only refer to answers asked earlier', () => {
    const p: Pathway = {
      entryNode: 'q1',
      nodes: [q('q1'), q('q2'), end('z'), end('y')],
      edges: [
        edge('e1', 'q1', 'q2', { condition: { answer: 'q2', eq: 'yes' }, label: 'x' }),
        edge('e2', 'q1', 'z', no('q1')),
        edge('e3', 'q2', 'y', yes('q2')),
      ],
    };
    expect(codes(p)).toContain('graph-condition-not-earlier');
  });

  it('reassess branches must go backwards', () => {
    const forward = { ...valid, edges: [...valid.edges, edge('r', 'q1', 'i1', { kind: 'reassess' })] };
    expect(codes(forward)).toContain('graph-reassess-not-backwards');
    const back = { ...valid, edges: [...valid.edges, edge('r', 'i1', 'q1', { kind: 'reassess' })] };
    expect(codes(back)).toEqual([]);
  });

  it('end steps cannot continue; branches cannot join different populations', () => {
    const p: Pathway = {
      entryNode: 'a',
      nodes: [info('a', ['adult']), info('b', ['child']), end('z')],
      edges: [edge('ab', 'a', 'b'), edge('bz', 'b', 'z'), edge('zb', 'z', 'b', { kind: 'reassess' })],
    };
    expect(codes(p)).toEqual(expect.arrayContaining(['graph-population-mismatch', 'graph-terminal-has-exit']));
  });

  it('orders steps breadth-first from the first step', () => {
    expect(orderSteps(valid).map((s) => `${s.number}:${s.node.id}`)).toEqual(['1:q1', '2:i1', '3:end-b', '4:end-a']);
  });
});
