import { describe, expect, it } from 'vitest';
import * as standalone from 'virtual:carpa-validators';
import type { Medication, Presentation } from '../../src/content/types.ts';
import { clone, errorCodes, file, readContent, realFiles, validate, validators, withFiles } from '../helpers.ts';

const TEMPLATE = 'templates/presentations/asthma.json';
const DEMO = 'examples/presentations/demo-fictional-fever.json';
const DEMO_MED = 'examples/medications/demonstrol.json';
const asthma = () => clone(readContent(TEMPLATE)) as Presentation;
const demo = () => clone(readContent(DEMO)) as Presentation;

describe('real content', () => {
  it('all files pass every check', () => {
    const store = validate(realFiles());
    expect(store.rejected.map((r) => ({ file: r.file.path, errors: r.errors }))).toEqual([]);
  });

  it('loads the five templates, the demonstration pathway and supporting units', () => {
    const store = validate(realFiles());
    expect([...store.presentations.keys()].sort()).toEqual([
      'anaphylaxis',
      'asthma',
      'chest-pain',
      'demo-fictional-fever',
      'gastroenteritis-dehydration-child',
      'sepsis',
    ]);
    expect([...store.medications.keys()]).toEqual(['demonstrol']);
    expect([...store.observationSets.keys()].sort()).toEqual(['demo-observations', 'vital-signs']);
  });

  it('templates contain placeholders only (no clinical numbers)', () => {
    const store = validate(realFiles());
    for (const id of ['anaphylaxis', 'asthma', 'chest-pain', 'sepsis', 'gastroenteritis-dehydration-child']) {
      const unit = store.presentations.get(id)!;
      expect(unit.file.tier).toBe('template');
      expect(unit.completeness.placeholders).toBeGreaterThan(0);
      expect(unit.data.medications).toEqual([]);
    }
  });

  it('browser (standalone) validators agree with Node validators', () => {
    const map = {
      presentation: standalone.presentation,
      medication: standalone.medication,
      'observation-set': standalone.observationSet,
    } as const;
    const broken = asthma() as unknown as Record<string, unknown>;
    broken.extra = 1;
    const samples: [keyof typeof map | 'reference-list', unknown][] = [
      ...realFiles().map((f) => {
        const data = JSON.parse(f.text) as { kind: string };
        const kind = data.kind in map ? (data.kind as keyof typeof map) : 'reference-list';
        return [kind, data] as [keyof typeof map | 'reference-list', unknown];
      }),
      ['presentation', broken],
      ['medication', { kind: 'medication' }],
    ];
    for (const [kind, data] of samples) {
      const browserFn = kind === 'reference-list' ? standalone.referenceList : map[kind];
      expect(browserFn(data)).toBe(validators[kind](data));
    }
  });
});

describe('schema errors are reported in plain English', () => {
  it('malformed JSON gives line and column', () => {
    const store = validate(withFiles(file(TEMPLATE, '{\n  "kind": "presentation",\n  "meta": {,\n}', 'template')));
    const r = store.rejected.find((x) => x.file.path === TEMPLATE)!;
    expect(r.errors[0]!.code).toBe('json-syntax');
    expect(r.errors[0]!.location).toMatch(/line 3/);
    expect(store.presentations.has('asthma')).toBe(false);
    // The rest of the content keeps working.
    expect(store.presentations.has('sepsis')).toBe(true);
  });

  it('a number written with units is rejected with the value and expectation', () => {
    const med = clone(readContent(DEMO_MED)) as Record<string, unknown>;
    // @ts-expect-error deliberately wrong type
    (med as Medication).regimens[0].dosing.maxSingleDose = { amount: '60mg', unit: 'mg' };
    const store = validate(withFiles(file(DEMO_MED, med, 'example')));
    const issues = store.rejected.find((r) => r.file.path === DEMO_MED)!.errors;
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'schema-type',
      location: 'regimens → item 1 → dosing → maxSingleDose → amount',
      value: '"60mg"',
    });
    expect(issues[0]!.expected).toMatch(/a number/);
  });

  it('missing required field, unknown field, bad id and bad enum', () => {
    const p = asthma() as unknown as Record<string, unknown> & Presentation;
    delete (p as Partial<Presentation>).followUp;
    (p as unknown as Record<string, unknown>).folowUp = [];
    p.redFlags[0]!.id = 'Red Flag 1';
    (p.redFlags[0] as unknown as Record<string, unknown>).action = 'phone-a-friend';
    const store = validate(withFiles(file(TEMPLATE, p, 'template')));
    const codes = errorCodes(store, TEMPLATE);
    expect(codes).toEqual(
      expect.arrayContaining(['schema-required', 'schema-unknown-field', 'schema-pattern', 'schema-enum']),
    );
    const unknown = store.rejected[0]!.errors.find((e) => e.code === 'schema-unknown-field')!;
    expect(unknown.location).toBe('folowUp');
  });

  it('incompatible schema version and unknown kind', () => {
    const p = asthma() as unknown as Record<string, unknown>;
    p.schemaVersion = '2.0.0';
    const store = validate(withFiles(file(TEMPLATE, p, 'template'), file('presentations/x.json', { kind: 'recipe' })));
    expect(errorCodes(store, TEMPLATE)).toEqual(['schema-version-incompatible']);
    expect(errorCodes(store, 'presentations/x.json')).toEqual(['unknown-kind']);
  });
});

describe('lifecycle and build-tier rules', () => {
  it('demonstration content outside content/examples is rejected', () => {
    const store = validate(
      withFiles(file('presentations/demo.json', { ...demo(), meta: { ...demo().meta, id: 'demo-copy' } })),
    );
    expect(errorCodes(store, 'presentations/demo.json')).toContain('tier-demo-outside-examples');
  });

  it('non-demonstration content in content/examples is rejected', () => {
    const d = demo();
    d.meta.demonstration = false;
    expect(errorCodes(validate(withFiles(file(DEMO, d, 'example'))), DEMO)).toContain('tier-example-not-demo');
  });

  it('real content citing a demonstration source is rejected', () => {
    const p = asthma();
    p.redFlags[0]!.cite = { sourceId: 'demo-source', section: 'x', page: '1' };
    const store = validate(withFiles(file('presentations/asthma.json', p)));
    expect(errorCodes(store, 'presentations/asthma.json')).toContain('ref-demo-source');
  });

  it('real content using a demonstration medication is rejected', () => {
    const p = asthma();
    p.medications = ['demonstrol-demo-fever-adult-oral'];
    const store = validate(withFiles(file('presentations/asthma.json', p)));
    expect(errorCodes(store, 'presentations/asthma.json')).toContain('ref-demo-unit');
  });

  it('templates must stay draft', () => {
    const p = asthma();
    p.meta.status = 'under-review';
    expect(errorCodes(validate(withFiles(file(TEMPLATE, p, 'template'))), TEMPLATE)).toContain('tier-template-status');
  });

  it('content with placeholders cannot be marked approved', () => {
    const p = asthma();
    p.meta.status = 'approved';
    const codes = errorCodes(validate(withFiles(file('presentations/asthma.json', p))), 'presentations/asthma.json');
    expect(codes).toEqual(expect.arrayContaining(['lifecycle-incomplete-approved', 'lifecycle-approval-fields']));
  });

  it('superseded content must name its replacement; invalid dates are rejected', () => {
    const p = asthma();
    p.meta.status = 'superseded';
    p.meta.extracted.date = '2026-02-30';
    const codes = errorCodes(validate(withFiles(file('presentations/asthma.json', p))), 'presentations/asthma.json');
    expect(codes).toEqual(expect.arrayContaining(['lifecycle-superseded-by', 'invalid-date']));
  });

  it('a copy in content/presentations replaces the template with the same id', () => {
    const store = validate(withFiles(file('presentations/asthma.json', asthma())));
    expect(store.presentations.get('asthma')!.file.path).toBe('presentations/asthma.json');
    expect(store.warnings.map((w) => w.code)).toContain('template-shadowed');
  });

  it('duplicate ids in the same tier are rejected', () => {
    const store = validate(withFiles(file('presentations/a.json', asthma()), file('presentations/b.json', asthma())));
    expect(errorCodes(store, 'presentations/b.json')).toContain('duplicate-id');
  });
});

describe('cross-references', () => {
  it('broken references are named', () => {
    const p = asthma();
    p.bodySystems = ['lungz'];
    p.escalation.contactRefs = ['ghostbusters'];
    p.observationSetRefs = ['missing-set'];
    p.redFlags[0]!.populations = ['toddler'];
    const store = validate(withFiles(file('presentations/asthma.json', p)));
    expect(errorCodes(store, 'presentations/asthma.json')).toEqual(
      expect.arrayContaining(['ref-body-system', 'ref-contact', 'ref-observation-set', 'ref-population']),
    );
  });

  it('an item for a population the presentation does not cover is rejected', () => {
    const p = clone(readContent('templates/presentations/gastroenteritis-dehydration-child.json')) as Presentation;
    p.assessment.history[0]!.populations = ['adult'];
    const f = 'templates/presentations/gastroenteritis-dehydration-child.json';
    expect(errorCodes(validate(withFiles(file(f, p, 'template'))), f)).toContain('population-outside-unit');
  });

  it('rejecting a medication also blocks presentations that depend on it', () => {
    const med = clone(readContent(DEMO_MED)) as Medication;
    med.regimens[0]!.formulationIds = ['no-such-formulation'];
    const store = validate(withFiles(file(DEMO_MED, med, 'example')));
    expect(errorCodes(store, DEMO_MED)).toContain('ref-formulation');
    expect(errorCodes(store, DEMO)).toContain('ref-regimen');
    expect(store.presentations.has('demo-fictional-fever')).toBe(false);
  });

  it('duplicate checklist item ids within a presentation are rejected', () => {
    const p = asthma();
    p.investigations[0]!.id = 'history-1';
    expect(errorCodes(validate(withFiles(file(TEMPLATE, p, 'template'))), TEMPLATE)).toContain(
      'duplicate-statement-id',
    );
  });
});
