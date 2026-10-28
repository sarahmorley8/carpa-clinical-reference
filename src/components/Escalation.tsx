import { useRelease } from '../app/ContentContext.tsx';
import { isPlaceholder } from '../content/placeholders.ts';
import type { ActionStatement, Contact, Presentation, Statement } from '../content/types.ts';
import { useSession } from '../state/session.tsx';
import { CiteRef, ContentText } from './ContentText.tsx';
import { Icon } from './Icon.tsx';
import { PopulationTag, appliesTo } from './Population.tsx';

const ACTION_LABEL: Record<ActionStatement['action'], string> = {
  evacuate: 'EVACUATE',
  'consult-now': 'CONSULT NOW',
  'consult-soon': 'CONSULT SOON',
  'see-source': 'SEE SOURCE',
};

export function ActionList({ items, emptyText }: { items: ActionStatement[]; emptyText: string }) {
  const { state } = useSession();
  const shown = items.filter((i) => appliesTo(i.populations, state.population));
  if (shown.length === 0) return <p className="empty">{emptyText}</p>;
  return (
    <ul className="action-list">
      {shown.map((item) => (
        <li key={item.id} className={`action-item action-item--${item.action}`}>
          <span className="action-item__tag">
            <Icon name="alert" size={18} />
            {ACTION_LABEL[item.action]}
          </span>
          <span className="action-item__text">
            <ContentText text={item.text} />
          </span>
          <PopulationTag populations={item.populations} />
          <CiteRef cite={item.cite} />
        </li>
      ))}
    </ul>
  );
}

export function StatementList({ items, emptyText }: { items: Statement[]; emptyText: string }) {
  const { state } = useSession();
  const shown = items.filter((i) => appliesTo(i.populations, state.population));
  if (shown.length === 0) return <p className="empty">{emptyText}</p>;
  return (
    <ul className="statement-list">
      {shown.map((item) => (
        <li key={item.id} className={`statement statement--${item.severity ?? 'info'}`}>
          {item.severity === 'critical' && <span className="visually-hidden">Critical: </span>}
          {item.severity === 'caution' && <span className="visually-hidden">Caution: </span>}
          <ContentText text={item.text} />
          <PopulationTag populations={item.populations} />
          <CiteRef cite={item.cite} />
        </li>
      ))}
    </ul>
  );
}

const PHONE = /^\+?[\d\s()-]{6,20}$/;

export function ContactCard({ contact }: { contact: Contact }) {
  const usable = !isPlaceholder(contact.phone) && PHONE.test(contact.phone);
  return (
    <div className="contact">
      <div className="contact__label">{contact.label}</div>
      <div className="contact__desc">
        <ContentText text={contact.description} />
      </div>
      {usable ? (
        <a className="btn btn--call btn--block" href={`tel:${contact.phone.replace(/[\s()-]/g, '')}`}>
          <Icon name="phone" />
          <span>
            Call {contact.phone}
            <span className="btn__sub">Opens your phone dialler</span>
          </span>
        </a>
      ) : (
        <div className="contact__missing">
          <span className="not-entered__tag">NUMBER NOT ENTERED</span> Add a verified number in
          content/references/contacts.json.
        </div>
      )}
      {usable && !contact.verified && <div className="contact__unverified">Number not marked as verified.</div>}
    </div>
  );
}

export function EscalationContent({ presentation }: { presentation: Presentation }) {
  const { release } = useRelease();
  const contacts = presentation.escalation.contactRefs
    .map((id) => release.store.refs.contacts.get(id))
    .filter((c): c is Contact => Boolean(c));
  return (
    <>
      <h3 className="subheading">Consult criteria</h3>
      <ActionList items={presentation.escalation.consultCriteria} emptyText="No consult criteria entered." />
      <h3 className="subheading">Retrieval / evacuation criteria</h3>
      <StatementList items={presentation.escalation.retrievalCriteria} emptyText="No retrieval criteria entered." />
      <h3 className="subheading">Who to call</h3>
      <p className="note">
        This app does not contact anyone for you. Follow your local consultation and escalation procedures.
      </p>
      {contacts.map((c) => (
        <ContactCard key={c.id} contact={c} />
      ))}
    </>
  );
}
