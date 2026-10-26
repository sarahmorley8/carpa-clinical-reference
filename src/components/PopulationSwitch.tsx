import { useState } from 'react';
import { useRelease } from '../app/ContentContext.tsx';
import { useSession } from '../state/session.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';

/**
 * Patient group selector. There is deliberately no default: until a group is
 * chosen, every item is shown with its group label, so adult content is never
 * silently shown for a child (or the reverse).
 */
export function PopulationSwitch() {
  const { release } = useRelease();
  const { state, dispatch } = useSession();
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const populations = [...release.store.refs.populations.values()];
  const anyTicks = Object.values(state.checks).some((c) => c.length > 0);

  const choose = (id: string | null) => {
    if (id === state.population) return;
    if (anyTicks) setPending(id);
    else dispatch({ type: 'set-population', population: id });
  };

  return (
    <div className="population">
      <div className="population__label" id="population-label">
        Patient group
        {state.population === null && <span className="population__hint"> — not selected, showing all</span>}
      </div>
      <div className="segmented" role="radiogroup" aria-labelledby="population-label">
        {populations.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={state.population === p.id}
            className="segmented__option"
            onClick={() => choose(state.population === p.id ? null : p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {pending !== undefined && (
        <ConfirmDialog
          title="Change patient group?"
          message="Ticked items will be cleared, because items differ between patient groups."
          confirmLabel="Change and clear ticks"
          onConfirm={() => {
            dispatch({ type: 'set-population', population: pending });
            setPending(undefined);
          }}
          onCancel={() => setPending(undefined)}
        />
      )}
    </div>
  );
}
