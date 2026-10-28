/**
 * TypeScript types mirroring schemas/*.schema.json (schema major version 1).
 * If you change a schema, update these types and the schema CHANGELOG.
 */

export type Id = string;
export type Severity = 'critical' | 'caution' | 'info';
export type Unit = 'g' | 'mg' | 'microgram' | 'nanogram' | 'mL' | 'L' | 'unit' | 'mmol';
export type LifecycleStatus = 'draft' | 'under-review' | 'approved' | 'published' | 'superseded';

export interface Citation {
  sourceId: Id;
  section: string;
  page: string;
}

export interface Statement {
  id: Id;
  text: string;
  cite: Citation;
  populations: Id[];
  severity?: Severity;
}

export type EscalationAction = 'evacuate' | 'consult-now' | 'consult-soon' | 'see-source';

export interface ActionStatement extends Statement {
  action: EscalationAction;
}

export interface ObservationItem extends Statement {
  parameterKey?: Id;
}

export interface Quantity {
  amount: number | null;
  unit: Unit;
}

export interface Person {
  name: string;
  role: string;
}

export interface Meta {
  id: Id;
  title: string;
  contentVersion: string;
  status: LifecycleStatus;
  demonstration?: boolean;
  populations: Id[];
  sources: Citation[];
  extracted: { date: string; by: string };
  review: {
    reviewedDate: string | null;
    reviewer: Person | null;
    approvalDate: string | null;
    nextReviewDate: string | null;
  };
  supersededBy: Id | null;
  dependsOn: Id[];
  authoringNotes?: string[];
}

// ---------- Pathway ----------

export interface InputSpec {
  kind: 'yes-no' | 'choice' | 'number';
  options?: { value: Id; label: string }[];
  unit?: string;
  required: boolean;
  allowUnknown: boolean;
}

export interface TimerSpec {
  label: string;
  durationMinutes: number | null;
  cite: Citation;
}

interface NodeBase {
  id: Id;
  text: string;
  cite: Citation;
  populations: Id[];
  severity?: Severity;
}

export interface InfoNode extends NodeBase {
  type: 'info';
}
export interface QuestionNode extends NodeBase {
  type: 'question';
  input: InputSpec;
}
export interface ActionNode extends NodeBase {
  type: 'action';
  regimenRefs?: Id[];
  timer?: TimerSpec;
}
export interface EscalationNode extends NodeBase {
  type: 'escalation';
  contactRefs?: Id[];
}
export type TerminalOutcome = 'continue-per-source' | 'consult' | 'evacuate' | 'go-to-presentation';
export interface TerminalNode extends NodeBase {
  type: 'terminal';
  outcome: TerminalOutcome;
  targetPresentation?: Id;
}

export type PathwayNode = InfoNode | QuestionNode | ActionNode | EscalationNode | TerminalNode;

export type Condition =
  | { answer: Id; eq: Id }
  | { answer: Id; in: Id[] }
  | { answer: Id; compare: 'gt' | 'gte' | 'lt' | 'lte'; value: number | null; unit: string }
  | { unknown: Id }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export interface PathwayEdge {
  id: Id;
  from: Id;
  to: Id;
  kind: 'normal' | 'reassess';
  condition?: Condition;
  label?: string;
  cite: Citation;
}

export interface Pathway {
  entryNode: Id;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
}

// ---------- Content units ----------

export interface Presentation {
  schemaVersion: string;
  kind: 'presentation';
  meta: Meta;
  bodySystems: Id[];
  keywords: string[];
  symptoms?: string[];
  redFlags: ActionStatement[];
  assessment: {
    history: Statement[];
    observations: ObservationItem[];
    examination: Statement[];
  };
  observationSetRefs: Id[];
  investigations: Statement[];
  pathway: Pathway;
  medications: Id[];
  escalation: {
    consultCriteria: ActionStatement[];
    retrievalCriteria: Statement[];
    contactRefs: Id[];
  };
  monitoring: Statement[];
  followUp: Statement[];
  relatedPresentations?: Id[];
}

export interface Formulation {
  id: Id;
  description: string;
  strength: {
    amount: number | null;
    unit: Unit;
    perVolume: { amount: number | null; unit: 'mL' | 'L' } | null;
  };
  cite: Citation;
}

export type Dosing =
  | {
      type: 'weight-based';
      dosePerKg: Quantity;
      maxSingleDose: Quantity | null;
      minSingleDose: Quantity | null;
      maxCumulative: { amount: number | null; unit: Unit; periodHours: number | null } | null;
      applicableWeightKg: { min: number | null; max: number | null } | null;
      rounding: { mode: 'nearest' | 'down'; increment: number | null; unit: Unit } | null;
    }
  | { type: 'fixed'; dose: Quantity }
  | { type: 'age-band'; bands: { label: string; dose: Quantity }[] }
  | { type: 'reference-only' };

export interface Regimen {
  id: Id;
  indication: string;
  populations: Id[];
  route: string;
  formulationIds: Id[];
  dosing: Dosing;
  doseText: string;
  frequency: string;
  duration: string | null;
  maxDoseText: string | null;
  monitoring: Statement[];
  cite: Citation;
}

export interface Medication {
  schemaVersion: string;
  kind: 'medication';
  meta: Meta;
  name: string;
  formulations: Formulation[];
  contraindications: Statement[];
  cautions: Statement[];
  regimens: Regimen[];
}

export interface ObservationSet {
  schemaVersion: string;
  kind: 'observation-set';
  meta: Meta;
  parameters: { key: Id; label: string; unit: string }[];
  bands: {
    id: Id;
    populationId: Id;
    label: string;
    values: { parameterKey: Id; low: number | null; high: number | null; note?: string }[];
    cite: Citation;
  }[];
}

// ---------- Reference lists ----------

export interface Source {
  id: Id;
  title: string;
  publisher: string;
  edition: string;
  editionDate: string;
  demonstration?: boolean;
  notes?: string;
}
export interface Population {
  id: Id;
  label: string;
  definition: string;
  cite: Citation | null;
}
export interface BodySystem {
  id: Id;
  label: string;
}
export interface CriticalCategory {
  id: Id;
  label: string;
  presentationIds: Id[];
}
export interface SynonymGroup {
  id: Id;
  terms: string[];
}
export interface Contact {
  id: Id;
  label: string;
  phone: string;
  description: string;
  verified: { date: string; by: string } | null;
}

export interface ReferenceListMap {
  sources: Source;
  populations: Population;
  'body-systems': BodySystem;
  'critical-categories': CriticalCategory;
  synonyms: SynonymGroup;
  contacts: Contact;
}
export type ReferenceKind = keyof ReferenceListMap;
export const REFERENCE_KINDS: readonly ReferenceKind[] = [
  'sources',
  'populations',
  'body-systems',
  'critical-categories',
  'synonyms',
  'contacts',
];

export type ReferenceList = {
  [K in ReferenceKind]: { schemaVersion: string; kind: K; items: ReferenceListMap[K][] };
}[ReferenceKind];

export type ContentUnit = Presentation | Medication | ObservationSet;
export type UnitKind = ContentUnit['kind'];
export const UNIT_KINDS: readonly UnitKind[] = ['presentation', 'medication', 'observation-set'];

/** Where a content file came from. Determines what is allowed in which build profile. */
export type ContentTier = 'main' | 'template' | 'example';

export interface ContentFile {
  /** Path relative to the content/ folder, e.g. "presentations/asthma.json". */
  path: string;
  tier: ContentTier;
  text: string;
}
