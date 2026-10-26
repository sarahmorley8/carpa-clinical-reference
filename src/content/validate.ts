/**
 * The content validation pipeline. Runs identically at build time (Node) and on
 * the device (browser), so invalid content can never become active.
 *
 *   parse JSON → schema check → tier rules → lifecycle rules → duplicates
 *     → cross-references (repeated until stable) → pathway graph checks
 *
 * A unit that fails any check is rejected with plain-English problems; the rest
 * of the content keeps working. Nothing is repaired or defaulted.
 */
import { checkPathway } from '../decision-engine/graph.ts';
import { describeJsonError, humaniseSchemaErrors, issue, type ContentIssue } from './issues.ts';
import { measureCompleteness, type Completeness } from './placeholders.ts';
import {
  REFERENCE_KINDS,
  UNIT_KINDS,
  type Citation,
  type ContentFile,
  type ContentUnit,
  type Id,
  type Medication,
  type ObservationSet,
  type Presentation,
  type ReferenceKind,
  type ReferenceList,
  type ReferenceListMap,
  type Regimen,
  type UnitKind,
} from './types.ts';
import type { ValidatorSet } from './validators.ts';

export const SUPPORTED_SCHEMA_MAJOR = 1;

export interface LoadedUnit<T extends ContentUnit = ContentUnit> {
  data: T;
  file: ContentFile;
  completeness: Completeness;
  warnings: ContentIssue[];
}

export interface RejectedFile {
  file: ContentFile;
  /** Id and title if they could be read, to help find the file. */
  id?: string;
  title?: string;
  kind?: string;
  errors: ContentIssue[];
}

export interface ContentStore {
  presentations: Map<Id, LoadedUnit<Presentation>>;
  medications: Map<Id, LoadedUnit<Medication>>;
  observationSets: Map<Id, LoadedUnit<ObservationSet>>;
  regimens: Map<Id, { medication: Medication; regimen: Regimen }>;
  refs: { [K in ReferenceKind]: Map<Id, ReferenceListMap[K]> };
  rejected: RejectedFile[];
  /** Warnings that do not block content (e.g. unanswered branches, shadowed templates). */
  warnings: ContentIssue[];
}

type Parsed =
  | { file: ContentFile; kind: UnitKind; data: ContentUnit }
  | { file: ContentFile; kind: ReferenceKind; data: ReferenceList };

const isUnitKind = (k: unknown): k is UnitKind => UNIT_KINDS.includes(k as UnitKind);
const isReferenceKind = (k: unknown): k is ReferenceKind => REFERENCE_KINDS.includes(k as ReferenceKind);

function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function peek(data: unknown): { id?: string; title?: string; kind?: string } {
  if (data === null || typeof data !== 'object') return {};
  const d = data as Record<string, unknown>;
  const meta = (d.meta ?? {}) as Record<string, unknown>;
  return {
    kind: typeof d.kind === 'string' ? d.kind : undefined,
    id: typeof meta.id === 'string' ? meta.id : undefined,
    title: typeof meta.title === 'string' ? meta.title : undefined,
  };
}

/** Collect every citation and population reference inside a value, with its JSON pointer. */
function collectRefs(value: unknown) {
  const citations: { cite: Citation; path: string }[] = [];
  const populations: { id: Id; path: string }[] = [];
  const walk = (v: unknown, path: string, key: string | null) => {
    if (Array.isArray(v)) {
      if (key === 'populations') v.forEach((p, i) => populations.push({ id: p as Id, path: `${path}/${i}` }));
      else v.forEach((x, i) => walk(x, `${path}/${i}`, null));
      return;
    }
    if (v === null || typeof v !== 'object') {
      if (key === 'populationId' && typeof v === 'string') populations.push({ id: v, path });
      return;
    }
    const o = v as Record<string, unknown>;
    if (typeof o.sourceId === 'string' && 'page' in o) citations.push({ cite: o as unknown as Citation, path });
    for (const [k, x] of Object.entries(o)) walk(x, `${path}/${k}`, k);
  };
  walk(value, '', null);
  return { citations, populations };
}

function collectDates(meta: ContentUnit['meta']): { value: string; where: string }[] {
  const out = [{ value: meta.extracted.date, where: 'meta → extracted → date' }];
  for (const k of ['reviewedDate', 'approvalDate', 'nextReviewDate'] as const) {
    const v = meta.review[k];
    if (v) out.push({ value: v, where: `meta → review → ${k}` });
  }
  return out;
}

/** All statement ids in a presentation (used for checklist ticks), which must be unique. */
function presentationStatementIds(p: Presentation): { id: Id; where: string }[] {
  const groups: [string, { id: Id }[]][] = [
    ['redFlags', p.redFlags],
    ['assessment → history', p.assessment.history],
    ['assessment → observations', p.assessment.observations],
    ['assessment → examination', p.assessment.examination],
    ['investigations', p.investigations],
    ['escalation → consultCriteria', p.escalation.consultCriteria],
    ['escalation → retrievalCriteria', p.escalation.retrievalCriteria],
    ['monitoring', p.monitoring],
    ['followUp', p.followUp],
  ];
  return groups.flatMap(([where, items]) => items.map((s) => ({ id: s.id, where })));
}

export function validateContent(files: readonly ContentFile[], validators: ValidatorSet): ContentStore {
  const rejected: RejectedFile[] = [];
  const warnings: ContentIssue[] = [];
  const reject = (file: ContentFile, data: unknown, errors: ContentIssue[]) =>
    rejected.push({ file, ...peek(data), errors });

  // ---------- 1. parse, version, schema, tier rules ----------
  const parsed: Parsed[] = [];
  for (const file of files) {
    let data: unknown;
    try {
      data = JSON.parse(file.text);
    } catch (e) {
      reject(file, undefined, [describeJsonError(file.path, file.text, e)]);
      continue;
    }
    const { kind } = peek(data);
    const sv = (data as { schemaVersion?: unknown } | null)?.schemaVersion;
    if (typeof sv === 'string' && /^\d+\./.test(sv) && Number(sv.split('.')[0]) !== SUPPORTED_SCHEMA_MAJOR) {
      reject(file, data, [
        issue(
          'error',
          'schema-version-incompatible',
          file.path,
          'schemaVersion',
          `This file uses schema version ${sv}, but this app reads version ${SUPPORTED_SCHEMA_MAJOR}.x.x. Migrate the file or update the app.`,
          { value: sv, expected: `${SUPPORTED_SCHEMA_MAJOR}.x.x` },
        ),
      ]);
      continue;
    }
    const validator = isUnitKind(kind) ? validators[kind] : isReferenceKind(kind) ? validators['reference-list'] : null;
    if (!validator) {
      reject(file, data, [
        issue(
          'error',
          'unknown-kind',
          file.path,
          'kind',
          'Missing or unknown "kind". This tells the app what type of file it is.',
          {
            value: JSON.stringify(kind),
            expected: [...UNIT_KINDS, ...REFERENCE_KINDS].map((k) => `"${k}"`).join(', '),
          },
        ),
      ]);
      continue;
    }
    if (!validator(data)) {
      reject(file, data, humaniseSchemaErrors(file.path, data, validator.errors ?? []));
      continue;
    }

    const tierErrors: ContentIssue[] = [];
    if (isUnitKind(kind)) {
      const unit = data as ContentUnit;
      const demo = unit.meta.demonstration === true;
      if (file.tier === 'example' && !demo)
        tierErrors.push(
          issue(
            'error',
            'tier-example-not-demo',
            file.path,
            'meta → demonstration',
            'Files in content/examples must set "demonstration": true.',
          ),
        );
      if (file.tier !== 'example' && demo)
        tierErrors.push(
          issue(
            'error',
            'tier-demo-outside-examples',
            file.path,
            'meta → demonstration',
            'Demonstration content must live in content/examples so it can never enter a clinical build.',
          ),
        );
      if (demo && !unit.meta.title.toUpperCase().includes('DEMONSTRATION'))
        tierErrors.push(
          issue(
            'error',
            'demo-title',
            file.path,
            'meta → title',
            'Demonstration content must have "DEMONSTRATION" in its title.',
          ),
        );
      if (file.tier === 'template' && unit.meta.status !== 'draft')
        tierErrors.push(
          issue(
            'error',
            'tier-template-status',
            file.path,
            'meta → status',
            'Templates must have status "draft". Copy the template into content/presentations to start entering content.',
          ),
        );
    } else if (kind === 'sources') {
      const list = data as Extract<ReferenceList, { kind: 'sources' }>;
      list.items.forEach((s, i) => {
        if ((file.tier === 'example') !== (s.demonstration === true))
          tierErrors.push(
            issue(
              'error',
              'tier-demo-source',
              file.path,
              `items → item ${i + 1}`,
              file.tier === 'example'
                ? 'Sources in content/examples must set "demonstration": true.'
                : 'Demonstration sources must live in content/examples.',
            ),
          );
      });
    }
    if (tierErrors.length) {
      reject(file, data, tierErrors);
      continue;
    }
    parsed.push({ file, kind, data } as Parsed);
  }

  // ---------- 2. reference lists (merged by kind) ----------
  const refs = Object.fromEntries(REFERENCE_KINDS.map((k) => [k, new Map()])) as ContentStore['refs'];
  const demoSources = new Set<Id>();
  for (const p of parsed) {
    if (!isReferenceKind(p.kind)) continue;
    const list = p.data as ReferenceList;
    const map = refs[list.kind] as Map<Id, { id: Id }>;
    const seenHere = new Set<Id>();
    const dupes = list.items.filter((item) => {
      const dup = map.has(item.id) || seenHere.has(item.id);
      seenHere.add(item.id);
      return dup;
    });
    if (dupes.length) {
      reject(
        p.file,
        p.data,
        dupes.map((d) =>
          issue(
            'error',
            'duplicate-id',
            p.file.path,
            `items → "${d.id}"`,
            `The id "${d.id}" is already used in another ${list.kind} entry.`,
          ),
        ),
      );
      continue;
    }
    for (const item of list.items) map.set(item.id, item);
    if (list.kind === 'sources') for (const s of list.items) if (s.demonstration) demoSources.add(s.id);
  }

  // ---------- 3. units: lifecycle, duplicates ----------
  type Candidate = { file: ContentFile; data: ContentUnit; completeness: Completeness; warnings: ContentIssue[] };
  const tierRank = { main: 0, template: 1, example: 2 } as const;
  const candidates = new Map<string, Candidate>(); // key: kind:id
  const allUnitIds = new Set<Id>(); // every id seen, even if later rejected (for "exists" checks)
  const allPresentationIds = new Set<Id>();

  const unitParsed = parsed.filter((p): p is Extract<Parsed, { kind: UnitKind }> => isUnitKind(p.kind));
  unitParsed.sort((a, b) => tierRank[a.file.tier] - tierRank[b.file.tier]);
  for (const p of unitParsed) {
    const unit = p.data;
    const m = unit.meta;
    allUnitIds.add(m.id);
    if (unit.kind === 'presentation') allPresentationIds.add(m.id);
    const errors: ContentIssue[] = [];
    const completeness = measureCompleteness(unit);

    for (const d of collectDates(m)) {
      if (!isRealDate(d.value))
        errors.push(
          issue('error', 'invalid-date', p.file.path, d.where, 'This is not a real calendar date.', { value: d.value }),
        );
    }
    if (m.status === 'approved' || m.status === 'published') {
      if (completeness.placeholders || completeness.missingNumbers)
        errors.push(
          issue(
            'error',
            'lifecycle-incomplete-approved',
            p.file.path,
            'meta → status',
            `Marked "${m.status}" but still has ${completeness.placeholders} placeholder(s) and ${completeness.missingNumbers} missing value(s). Only complete content can be approved.`,
          ),
        );
      if (!m.review.reviewer || !m.review.approvalDate || !m.review.nextReviewDate || !m.review.reviewedDate)
        errors.push(
          issue(
            'error',
            'lifecycle-approval-fields',
            p.file.path,
            'meta → review',
            `Marked "${m.status}" but the reviewer, reviewed date, approval date and next review date are not all filled in.`,
          ),
        );
    }
    if (m.status === 'superseded' && !m.supersededBy)
      errors.push(
        issue(
          'error',
          'lifecycle-superseded-by',
          p.file.path,
          'meta → supersededBy',
          'Superseded content must say what replaced it.',
        ),
      );
    if (m.status !== 'superseded' && m.supersededBy)
      errors.push(
        issue(
          'error',
          'lifecycle-superseded-status',
          p.file.path,
          'meta → status',
          '"supersededBy" is set, so status must be "superseded".',
        ),
      );

    const key = `${unit.kind}:${m.id}`;
    const existing = candidates.get(key);
    if (existing) {
      if (existing.file.tier === 'main' && p.file.tier === 'template') {
        warnings.push(
          issue(
            'warning',
            'template-shadowed',
            p.file.path,
            'meta → id',
            `Template not shown because content/${existing.file.path} has the same id "${m.id}".`,
          ),
        );
        continue;
      }
      errors.push(
        issue(
          'error',
          'duplicate-id',
          p.file.path,
          'meta → id',
          `The id "${m.id}" is already used by content/${existing.file.path}.`,
        ),
      );
    }
    if (errors.length) {
      reject(p.file, unit, errors);
      continue;
    }
    candidates.set(key, { file: p.file, data: unit, completeness, warnings: [] });
  }

  // regimen ids are global
  const regimenOwner = new Map<Id, Id>();
  for (const [key, c] of [...candidates]) {
    if (c.data.kind !== 'medication') continue;
    const clashes = c.data.regimens.filter((r) => regimenOwner.has(r.id) && regimenOwner.get(r.id) !== c.data.meta.id);
    const local = c.data.regimens.map((r) => r.id);
    const localDupes = local.filter((id, i) => local.indexOf(id) !== i);
    if (clashes.length || localDupes.length) {
      reject(
        c.file,
        c.data,
        [...clashes.map((r) => r.id), ...localDupes].map((id) =>
          issue(
            'error',
            'duplicate-regimen-id',
            c.file.path,
            `regimens → "${id}"`,
            `Regimen id "${id}" is used more than once.`,
          ),
        ),
      );
      candidates.delete(key);
      continue;
    }
    for (const r of c.data.regimens) regimenOwner.set(r.id, c.data.meta.id);
  }

  // ---------- 4. cross-references, repeated until no more rejections ----------
  const unitIsDemo = (id: Id) =>
    [...candidates.values()].some((c) => c.data.meta.id === id && c.data.meta.demonstration === true);

  const checkRefs = (c: Candidate): ContentIssue[] => {
    const f = c.file.path;
    const u = c.data;
    const errs: ContentIssue[] = [];
    const missing = (code: string, where: string, what: string, id: string, list: string) =>
      errs.push(
        issue('error', code, f, where, `${what} "${id}" does not exist. Check the spelling, or add it to ${list}.`, {
          value: id,
        }),
      );
    const demo = u.meta.demonstration === true;

    const { citations, populations } = collectRefs(u);
    for (const { cite, path } of citations) {
      const loc = path === '' ? '(top of file)' : path.split('/').slice(1).join(' → ');
      if (!refs.sources.has(cite.sourceId))
        missing('ref-source', loc, 'Source', cite.sourceId, 'references/sources.json');
      else if (!demo && demoSources.has(cite.sourceId))
        errs.push(issue('error', 'ref-demo-source', f, loc, 'Real content must not cite a demonstration source.'));
    }
    for (const { id, path } of populations) {
      if (!refs.populations.has(id))
        missing(
          'ref-population',
          path.split('/').slice(1).join(' → '),
          'Population',
          id,
          'references/populations.json',
        );
    }
    for (const id of u.meta.dependsOn) {
      if (
        !candidates.has(`presentation:${id}`) &&
        !candidates.has(`medication:${id}`) &&
        !candidates.has(`observation-set:${id}`)
      )
        missing('ref-depends-on', 'meta → dependsOn', 'Content unit', id, 'the content folder');
      else if (!demo && unitIsDemo(id))
        errs.push(
          issue(
            'error',
            'ref-demo-unit',
            f,
            'meta → dependsOn',
            `Real content must not depend on demonstration content "${id}".`,
          ),
        );
    }

    const metaPops = u.meta.populations;
    for (const { id, path } of populations) {
      if (path.startsWith('/meta/')) continue;
      if (u.kind === 'observation-set') continue; // bands may describe any defined population
      if (!metaPops.includes(id))
        errs.push(
          issue(
            'error',
            'population-outside-unit',
            f,
            path.split('/').slice(1).join(' → '),
            `Applies to "${id}", but this content only covers: ${metaPops.join(', ')}. Add "${id}" to meta → populations or correct the item.`,
          ),
        );
    }

    if (u.kind === 'presentation') {
      for (const id of u.bodySystems)
        if (!refs['body-systems'].has(id))
          missing('ref-body-system', 'bodySystems', 'Body system', id, 'references/body-systems.json');
      for (const id of u.observationSetRefs)
        if (!candidates.has(`observation-set:${id}`))
          missing('ref-observation-set', 'observationSetRefs', 'Observation set', id, 'content/observations');
      const contactIds = [
        ...u.escalation.contactRefs,
        ...u.pathway.nodes.flatMap((n) => (n.type === 'escalation' ? (n.contactRefs ?? []) : [])),
      ];
      for (const id of contactIds)
        if (!refs.contacts.has(id))
          missing('ref-contact', 'escalation → contactRefs', 'Contact', id, 'references/contacts.json');
      const regimenIds = [
        ...u.medications,
        ...u.pathway.nodes.flatMap((n) => (n.type === 'action' ? (n.regimenRefs ?? []) : [])),
      ];
      for (const id of regimenIds) {
        const owner = regimenOwner.get(id);
        if (!owner || !candidates.has(`medication:${owner}`))
          missing('ref-regimen', 'medications', 'Medication regimen', id, 'a file in content/medications');
        else if (!demo && unitIsDemo(owner))
          errs.push(
            issue(
              'error',
              'ref-demo-unit',
              f,
              'medications',
              `Real content must not use demonstration medication "${owner}".`,
            ),
          );
      }
      for (const n of u.pathway.nodes) {
        if (n.type === 'action')
          for (const id of n.regimenRefs ?? [])
            if (!u.medications.includes(id))
              c.warnings.push(
                issue(
                  'warning',
                  'regimen-not-listed',
                  f,
                  `pathway → step "${n.id}"`,
                  `Regimen "${id}" is used in a step but not listed in "medications", so it will not appear in the medication reference section.`,
                ),
              );
        if (n.type === 'terminal' && n.targetPresentation && !allPresentationIds.has(n.targetPresentation))
          missing(
            'ref-presentation',
            `pathway → step "${n.id}"`,
            'Presentation',
            n.targetPresentation,
            'content/presentations',
          );
      }
      for (const id of u.relatedPresentations ?? [])
        if (!allPresentationIds.has(id))
          missing('ref-presentation', 'relatedPresentations', 'Presentation', id, 'content/presentations');

      const params = new Set(
        u.observationSetRefs.flatMap((id) => {
          const set = candidates.get(`observation-set:${id}`)?.data as ObservationSet | undefined;
          return set ? set.parameters.map((p) => p.key) : [];
        }),
      );
      for (const o of u.assessment.observations)
        if (o.parameterKey && !params.has(o.parameterKey))
          errs.push(
            issue(
              'error',
              'ref-parameter',
              f,
              `assessment → observations → "${o.id}"`,
              `parameterKey "${o.parameterKey}" is not a parameter in this presentation's observation sets.`,
            ),
          );

      const seen = new Map<Id, string>();
      for (const s of presentationStatementIds(u)) {
        if (seen.has(s.id))
          errs.push(
            issue(
              'error',
              'duplicate-statement-id',
              f,
              s.where,
              `Item id "${s.id}" is also used in ${seen.get(s.id)}. Item ids must be unique within a presentation.`,
            ),
          );
        else seen.set(s.id, s.where);
      }
    }

    if (u.kind === 'medication') {
      const formulations = new Set(u.formulations.map((x) => x.id));
      for (const r of u.regimens)
        for (const id of r.formulationIds)
          if (!formulations.has(id))
            missing(
              'ref-formulation',
              `regimens → "${r.id}" → formulationIds`,
              'Formulation',
              id,
              'this medication\'s "formulations"',
            );
    }

    if (u.kind === 'observation-set') {
      const keys = new Set(u.parameters.map((p) => p.key));
      const bandIds = new Set<Id>();
      for (const b of u.bands) {
        if (bandIds.has(b.id))
          errs.push(issue('error', 'duplicate-id', f, `bands → "${b.id}"`, `Band id "${b.id}" is used twice.`));
        bandIds.add(b.id);
        for (const v of b.values)
          if (!keys.has(v.parameterKey))
            missing('ref-parameter', `bands → "${b.id}"`, 'Parameter', v.parameterKey, 'this file\'s "parameters"');
      }
    }
    return errs;
  };

  for (;;) {
    let changed = false;
    for (const [key, c] of [...candidates]) {
      c.warnings = [];
      const errs = checkRefs(c);
      if (errs.length) {
        reject(c.file, c.data, errs);
        candidates.delete(key);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // ---------- 5. pathway graph checks ----------
  for (const [key, c] of [...candidates]) {
    if (c.data.kind !== 'presentation') continue;
    const graphIssues = checkPathway(c.data.pathway, c.data.meta.populations, c.file.path);
    const errs = graphIssues.filter((i) => i.severity === 'error');
    if (errs.length) {
      reject(c.file, c.data, errs);
      candidates.delete(key);
    } else {
      c.warnings.push(...graphIssues);
    }
  }
  // A rejected presentation cannot break medications or observation sets, so one pass suffices.

  // ---------- 6. reference-list cross-references ----------
  for (const cat of refs['critical-categories'].values()) {
    for (const id of cat.presentationIds)
      if (!allPresentationIds.has(id))
        warnings.push(
          issue(
            'warning',
            'ref-critical-presentation',
            'references/critical-categories.json',
            `"${cat.id}"`,
            `Presentation "${id}" does not exist in any content file.`,
          ),
        );
  }
  for (const pop of refs.populations.values()) {
    if (pop.cite && !refs.sources.has(pop.cite.sourceId))
      warnings.push(
        issue(
          'warning',
          'ref-source',
          'references/populations.json',
          `"${pop.id}"`,
          `Source "${pop.cite.sourceId}" does not exist.`,
        ),
      );
  }

  // ---------- 7. assemble ----------
  const store: ContentStore = {
    presentations: new Map(),
    medications: new Map(),
    observationSets: new Map(),
    regimens: new Map(),
    refs,
    rejected,
    warnings,
  };
  for (const c of candidates.values()) {
    const loaded = { data: c.data, file: c.file, completeness: c.completeness, warnings: c.warnings };
    if (c.data.kind === 'presentation') store.presentations.set(c.data.meta.id, loaded as LoadedUnit<Presentation>);
    if (c.data.kind === 'medication') {
      store.medications.set(c.data.meta.id, loaded as LoadedUnit<Medication>);
      for (const r of c.data.regimens) store.regimens.set(r.id, { medication: c.data, regimen: r });
    }
    if (c.data.kind === 'observation-set')
      store.observationSets.set(c.data.meta.id, loaded as LoadedUnit<ObservationSet>);
    warnings.push(...c.warnings);
  }
  return store;
}

export function allErrors(store: ContentStore): ContentIssue[] {
  return store.rejected.flatMap((r) => r.errors);
}

/**
 * The blocked file that most likely holds a presentation. If a file was too broken
 * to read its id, its file name (without .json) is used as a best guess.
 */
export function findRejected(store: ContentStore, id: Id): RejectedFile | undefined {
  return (
    store.rejected.find((r) => r.id === id) ??
    store.rejected.find(
      (r) =>
        r.id === undefined &&
        r.file.path
          .split('/')
          .pop()
          ?.replace(/\.json$/, '') === id,
    )
  );
}
