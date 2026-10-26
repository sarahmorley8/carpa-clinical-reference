import { useEffect, type ReactNode } from 'react';
import { useRelease, useToday } from '../app/ContentContext.tsx';
import { displayStatus } from '../content/status.ts';
import { findRejected, type LoadedUnit } from '../content/validate.ts';
import type { Citation, ObservationSet, PathwayNode, Presentation, Statement } from '../content/types.ts';
import { orderSteps } from '../decision-engine/graph.ts';
import { hrefFor } from '../navigation/router.ts';
import { usePreferences } from '../state/PreferencesContext.tsx';
import { useSession } from '../state/session.tsx';
import { CiteRef, ContentText, NumberValue, pagesOf } from '../components/ContentText.tsx';
import { ActionList, EscalationContent, StatementList } from '../components/Escalation.tsx';
import { Icon, type IconName } from '../components/Icon.tsx';
import { PopulationSwitch } from '../components/PopulationSwitch.tsx';
import { PopulationTag, appliesTo } from '../components/Population.tsx';
import { StatusBadges } from '../components/StatusBadges.tsx';

const SECTIONS = [
  ['red-flags', 'Red flags'],
  ['assessment', 'Assess'],
  ['observations', 'Obs'],
  ['investigations', 'Tests'],
  ['management', 'Manage'],
  ['medications', 'Meds'],
  ['escalation', 'Escalate'],
  ['monitoring', 'Monitor'],
  ['follow-up', 'Follow-up'],
  ['source', 'Source'],
] as const;

function Section({
  id,
  title,
  tone = 'neutral',
  icon,
  cites,
  children,
}: {
  id: string;
  title: string;
  tone?: 'critical' | 'caution' | 'neutral';
  icon?: IconName;
  cites: Citation[];
  children: ReactNode;
}) {
  const pages = pagesOf(cites);
  return (
    <section id={id} className={`section section--${tone}`} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="section__heading" tabIndex={-1}>
        {icon && <Icon name={icon} />}
        <span className="section__title">{title}</span>
        {pages && <span className="section__pages">{pages}</span>}
      </h2>
      {children}
    </section>
  );
}

function Checklist({
  presentationId,
  items,
  emptyText,
}: {
  presentationId: string;
  items: Statement[];
  emptyText: string;
}) {
  const { state, dispatch } = useSession();
  const ticked = state.checks[presentationId] ?? [];
  const shown = items.filter((i) => appliesTo(i.populations, state.population));
  if (shown.length === 0) return <p className="empty">{emptyText}</p>;
  return (
    <ul className="checklist">
      {shown.map((item) => {
        const inputId = `chk-${presentationId}-${item.id}`;
        return (
          <li key={item.id} className="checklist__item">
            <input
              id={inputId}
              type="checkbox"
              className="checklist__box"
              checked={ticked.includes(item.id)}
              onChange={() => dispatch({ type: 'toggle-check', presentationId, itemId: item.id })}
            />
            <label htmlFor={inputId} className="checklist__label">
              <ContentText text={item.text} />
              <PopulationTag populations={item.populations} />
            </label>
            <CiteRef cite={item.cite} />
          </li>
        );
      })}
    </ul>
  );
}

function ObservationTables({ sets }: { sets: LoadedUnit<ObservationSet>[] }) {
  const { state } = useSession();
  const { release } = useRelease();
  if (sets.length === 0) return <p className="empty">No observation ranges linked.</p>;
  return (
    <>
      {sets.map(({ data }) => {
        const bands = data.bands.filter((b) => appliesTo([b.populationId], state.population));
        return (
          <div key={data.meta.id} className="obs-set">
            <h3 className="subheading">{data.meta.title}</h3>
            {bands.length === 0 && <p className="empty">No ranges for this patient group.</p>}
            {bands.map((band) => (
              <table key={band.id} className="obs-table">
                <caption>
                  {release.store.refs.populations.get(band.populationId)?.label}: <ContentText text={band.label} />
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Observation</th>
                    <th scope="col">Normal range</th>
                  </tr>
                </thead>
                <tbody>
                  {data.parameters.map((p) => {
                    const v = band.values.find((x) => x.parameterKey === p.key);
                    return (
                      <tr key={p.key}>
                        <th scope="row">{p.label}</th>
                        <td>
                          {v ? (
                            <>
                              <NumberValue value={v.low} /> – <NumberValue value={v.high} /> {p.unit}
                              {v.note && <div className="obs-table__note">{v.note}</div>}
                            </>
                          ) : (
                            <span className="not-entered__tag">NOT ENTERED</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>
                      <CiteRef cite={band.cite} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            ))}
          </div>
        );
      })}
    </>
  );
}

const STEP_TYPE: Record<PathwayNode['type'], string> = {
  info: 'Information',
  question: 'Question',
  action: 'Action',
  escalation: 'Escalate',
  terminal: 'End of pathway',
};
const OUTCOME: Record<string, string> = {
  'continue-per-source': 'Continue as described in the source',
  consult: 'Consult',
  evacuate: 'Evacuate',
  'go-to-presentation': 'Go to another presentation',
};

function ManagementSteps({ presentation }: { presentation: Presentation }) {
  const { release } = useRelease();
  const { state } = useSession();
  const steps = orderSteps(presentation.pathway);
  const numberOf = new Map(steps.map((s) => [s.node.id, s.number]));
  return (
    <>
      <p className="note">
        Steps are listed in order. Step-by-step interactive navigation arrives in Phase 3. Branches are only those
        written in the source; nothing is chosen for you.
      </p>
      <ol className="steps">
        {steps.map(({ number, node, next, reassess }) => {
          const applicable = appliesTo(node.populations, state.population);
          return (
            <li
              key={node.id}
              className={`step step--${node.type}${node.severity ? ` step--${node.severity}` : ''}${applicable ? '' : ' step--na'}`}
            >
              <div className="step__head">
                <span className="step__number">Step {number}</span>
                <span className="step__type">{STEP_TYPE[node.type]}</span>
              </div>
              {!applicable && <div className="step__na">Not for the selected patient group</div>}
              <div className="step__text">
                <ContentText text={node.text} />
                <PopulationTag populations={node.populations} />
              </div>
              {node.type === 'question' && (
                <div className="step__detail">
                  Answer:{' '}
                  {node.input.kind === 'yes-no'
                    ? 'Yes / No'
                    : node.input.kind === 'choice'
                      ? (node.input.options ?? []).map((o) => o.label).join(' / ')
                      : `number (${node.input.unit ?? ''})`}
                  {node.input.allowUnknown ? ' / Unknown' : ''}
                </div>
              )}
              {node.type === 'action' && (node.regimenRefs ?? []).length > 0 && (
                <div className="step__detail">
                  Medication:{' '}
                  {(node.regimenRefs ?? [])
                    .map((id) => release.store.regimens.get(id))
                    .map((r, i) => (
                      <a key={i} href="#medications" className="inline-link" onClick={jumpTo('medications')}>
                        {r ? `${r.medication.name} (${r.regimen.route})` : 'unavailable'}
                      </a>
                    ))}
                </div>
              )}
              {node.type === 'action' && node.timer && (
                <div className="step__detail">
                  Timer: <ContentText text={node.timer.label} /> —{' '}
                  <NumberValue value={node.timer.durationMinutes} unit="min" />
                </div>
              )}
              {node.type === 'terminal' && <div className="step__outcome">{OUTCOME[node.outcome]}</div>}
              {next.map((e) => (
                <div key={e.id} className="step__branch">
                  <Icon name="chevron" size={18} />
                  {e.label ? <ContentText text={e.label} /> : 'Then'} → Step {numberOf.get(e.to)}
                </div>
              ))}
              {reassess.map((e) => (
                <div key={e.id} className="step__branch step__branch--reassess">
                  ↺ {e.label ? <ContentText text={e.label} /> : 'Reassess'}: back to Step {numberOf.get(e.to)}
                </div>
              ))}
              <CiteRef cite={node.cite} />
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Medications({ presentation }: { presentation: Presentation }) {
  const { release } = useRelease();
  const { state } = useSession();
  const regimens = presentation.medications
    .map((id) => release.store.regimens.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .filter(({ regimen }) => appliesTo(regimen.populations, state.population));
  if (regimens.length === 0) return <p className="empty">No medications entered for this presentation.</p>;
  return (
    <>
      <p className="note">
        Reference only. The dose calculator is a synthetic test harness and is not enabled for patient care.
      </p>
      {regimens.map(({ medication, regimen }) => {
        const formulations = medication.formulations.filter((f) => regimen.formulationIds.includes(f.id));
        return (
          <article key={regimen.id} className="med">
            <h3 className="med__name">
              {medication.name} <span className="med__route">{regimen.route}</span>
            </h3>
            <PopulationTag populations={regimen.populations} />
            <dl className="med__facts">
              <dt>Indication</dt>
              <dd>
                <ContentText text={regimen.indication} />
              </dd>
              <dt>Dose (as written in source)</dt>
              <dd className="med__dose">
                <ContentText text={regimen.doseText} />
              </dd>
              <dt>Frequency</dt>
              <dd>
                <ContentText text={regimen.frequency} />
              </dd>
              {regimen.maxDoseText && (
                <>
                  <dt>Maximum</dt>
                  <dd>
                    <ContentText text={regimen.maxDoseText} />
                  </dd>
                </>
              )}
              {regimen.duration && (
                <>
                  <dt>Duration</dt>
                  <dd>
                    <ContentText text={regimen.duration} />
                  </dd>
                </>
              )}
              {formulations.length > 0 && (
                <>
                  <dt>Formulation</dt>
                  <dd>
                    {formulations.map((f) => (
                      <div key={f.id}>
                        <ContentText text={f.description} />
                      </div>
                    ))}
                  </dd>
                </>
              )}
            </dl>
            {medication.contraindications.length > 0 && (
              <>
                <h4 className="med__subhead med__subhead--critical">Contraindications</h4>
                <StatementList items={medication.contraindications} emptyText="None entered." />
              </>
            )}
            {medication.cautions.length > 0 && (
              <>
                <h4 className="med__subhead med__subhead--caution">Cautions</h4>
                <StatementList items={medication.cautions} emptyText="None entered." />
              </>
            )}
            {regimen.monitoring.length > 0 && (
              <>
                <h4 className="med__subhead">Monitoring</h4>
                <StatementList items={regimen.monitoring} emptyText="None entered." />
              </>
            )}
            <CiteRef cite={regimen.cite} />
          </article>
        );
      })}
    </>
  );
}

function jumpTo(id: string) {
  return (e: React.MouseEvent) => {
    // The URL hash is used for routing, so scroll without changing it.
    e.preventDefault();
    const el = document.getElementById(id);
    el?.scrollIntoView({ block: 'start' });
    el?.querySelector<HTMLElement>('h2')?.focus();
  };
}

export function PresentationScreen({ id }: { id: string }) {
  const { release } = useRelease();
  const today = useToday();
  const { prefs, toggleFavourite, addRecent } = usePreferences();
  const loaded = release.store.presentations.get(id);
  const exists = Boolean(loaded);

  useEffect(() => {
    if (exists) addRecent(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- record once per presentation
  }, [id, exists]);

  if (!loaded) {
    const rejected = findRejected(release.store, id);
    return (
      <div className="screen">
        <div className="callout callout--critical" role="alert">
          <strong>
            {rejected ? 'This presentation has content errors and has been blocked.' : 'Presentation not found.'}
          </strong>
          <p>Use the printed manual. {rejected && <a href={hrefFor({ name: 'problems' })}>See content problems</a>}</p>
        </div>
      </div>
    );
  }

  const p = loaded.data;
  const status = displayStatus(p.meta, loaded.completeness, loaded.file.tier === 'template', today);
  const favourite = prefs.favourites.includes(id);
  const obsSets = p.observationSetRefs
    .map((ref) => release.store.observationSets.get(ref))
    .filter((s): s is LoadedUnit<ObservationSet> => Boolean(s));
  const allAssessment = [...p.assessment.history, ...p.assessment.observations, ...p.assessment.examination];

  return (
    <div className="screen screen--presentation">
      <div className="presentation-head">
        <h2 className="presentation-head__title">{p.meta.title}</h2>
        <button
          type="button"
          className="btn btn--icon btn--favourite"
          aria-pressed={favourite}
          aria-label={favourite ? 'Remove from favourites' : 'Add to favourites'}
          onClick={() => toggleFavourite(id)}
        >
          <Icon name="star" />
        </button>
      </div>
      <StatusBadges badges={status.badges} />
      <PopulationSwitch />

      <nav className="section-nav" aria-label="Sections">
        {SECTIONS.map(([sid, label]) => (
          <a key={sid} href={`#${sid}`} className="section-nav__chip" onClick={jumpTo(sid)}>
            {label}
          </a>
        ))}
      </nav>

      <Section
        id="red-flags"
        title="Red flags — consult or evacuate now"
        tone="critical"
        icon="alert"
        cites={p.redFlags.map((r) => r.cite)}
      >
        <ActionList items={p.redFlags} emptyText="No red flags entered." />
      </Section>

      <Section id="assessment" title="Assessment" cites={allAssessment.map((a) => a.cite)}>
        <h3 className="subheading">History</h3>
        <Checklist presentationId={id} items={p.assessment.history} emptyText="No history items entered." />
        <h3 className="subheading">Observations</h3>
        <Checklist presentationId={id} items={p.assessment.observations} emptyText="No observation items entered." />
        <h3 className="subheading">Examination</h3>
        <Checklist presentationId={id} items={p.assessment.examination} emptyText="No examination items entered." />
      </Section>

      <Section
        id="observations"
        title="Observation reference ranges"
        cites={obsSets.flatMap((s) => s.data.bands.map((b) => b.cite))}
      >
        <ObservationTables sets={obsSets} />
      </Section>

      <Section id="investigations" title="Investigations" cites={p.investigations.map((i) => i.cite)}>
        <Checklist presentationId={id} items={p.investigations} emptyText="No investigations entered." />
      </Section>

      <Section id="management" title="Management steps" cites={p.pathway.nodes.map((n) => n.cite)}>
        <ManagementSteps presentation={p} />
      </Section>

      <Section
        id="medications"
        title="Medication reference"
        tone="caution"
        cites={p.medications
          .map((m) => release.store.regimens.get(m)?.regimen.cite)
          .filter((c): c is Citation => Boolean(c))}
      >
        <Medications presentation={p} />
      </Section>

      <Section
        id="escalation"
        title="Consultation and retrieval"
        tone="critical"
        icon="phone"
        cites={[...p.escalation.consultCriteria, ...p.escalation.retrievalCriteria].map((c) => c.cite)}
      >
        <EscalationContent presentation={p} />
      </Section>

      <Section id="monitoring" title="Monitoring and reassessment" cites={p.monitoring.map((m) => m.cite)}>
        <StatementList items={p.monitoring} emptyText="No monitoring instructions entered." />
      </Section>

      <Section id="follow-up" title="Follow-up" cites={p.followUp.map((f) => f.cite)}>
        <StatementList items={p.followUp} emptyText="No follow-up instructions entered." />
      </Section>

      <Section id="source" title="Source and version" cites={p.meta.sources}>
        <SourceDetails loaded={loaded} />
      </Section>

      <a className="escalate-bar" href={hrefFor({ name: 'escalation', id })}>
        <Icon name="phone" />
        <span>Call for help / evacuation criteria</span>
      </a>
    </div>
  );
}

function SourceDetails({ loaded }: { loaded: LoadedUnit<Presentation> }) {
  const { release } = useRelease();
  const m = loaded.data.meta;
  const c = loaded.completeness;
  return (
    <dl className="facts">
      <dt>Sources</dt>
      <dd>
        {m.sources.map((s, i) => {
          const src = release.store.refs.sources.get(s.sourceId);
          return (
            <div key={i}>
              {src ? <ContentText text={src.title} /> : s.sourceId}
              {src && (
                <>
                  {', edition: '}
                  <ContentText text={src.edition} />
                </>
              )}
              <div>
                <CiteRef cite={s} />
              </div>
            </div>
          );
        })}
      </dd>
      <dt>Content version</dt>
      <dd>
        {m.contentVersion} ({m.status})
      </dd>
      <dt>Entered by</dt>
      <dd>
        {m.extracted.by}, {m.extracted.date}
      </dd>
      <dt>Reviewed</dt>
      <dd>
        {m.review.reviewer
          ? `${m.review.reviewer.name} (${m.review.reviewer.role}), ${m.review.reviewedDate ?? 'date not entered'}`
          : 'Not reviewed'}
      </dd>
      <dt>Next review due</dt>
      <dd>{m.review.nextReviewDate ?? 'Not set'}</dd>
      <dt>Not yet entered</dt>
      <dd>
        {c.placeholders} text item(s), {c.missingNumbers} number(s)
      </dd>
      <dt>File</dt>
      <dd className="mono">content/{loaded.file.path}</dd>
      <dt>Release</dt>
      <dd className="mono">{release.manifest.releaseId}</dd>
    </dl>
  );
}

export function EscalationScreen({ id }: { id: string }) {
  const { release } = useRelease();
  const loaded = release.store.presentations.get(id);
  if (!loaded) return <PresentationScreen id={id} />;
  return (
    <div className="screen">
      <h2 className="presentation-head__title">{loaded.data.meta.title}</h2>
      <section className="section section--critical" aria-labelledby="esc-red-flags">
        <h2 id="esc-red-flags" className="section__heading">
          <Icon name="alert" />
          <span>Red flags</span>
        </h2>
        <ActionList items={loaded.data.redFlags} emptyText="No red flags entered." />
      </section>
      <section className="section section--critical" aria-labelledby="esc-heading">
        <h2 id="esc-heading" className="section__heading">
          <Icon name="phone" />
          <span>Consultation and retrieval</span>
        </h2>
        <EscalationContent presentation={loaded.data} />
      </section>
    </div>
  );
}
