import { useRelease } from '../app/ContentContext.tsx';
import { useSession } from '../state/session.tsx';

/** True if an item applies to the selected group (or no group is selected yet). */
export function appliesTo(populations: readonly string[], selected: string | null): boolean {
  return selected === null || populations.includes(selected);
}

/** Shows which groups an item is for, when no group has been selected and the item is not for everyone. */
export function PopulationTag({ populations }: { populations: readonly string[] }) {
  const { release } = useRelease();
  const { state } = useSession();
  const all = [...release.store.refs.populations.keys()];
  if (state.population !== null || all.every((p) => populations.includes(p))) return null;
  const labels = populations.map((p) => release.store.refs.populations.get(p)?.label ?? p);
  return <span className="population-tag">{labels.join(' / ').toUpperCase()} ONLY</span>;
}
