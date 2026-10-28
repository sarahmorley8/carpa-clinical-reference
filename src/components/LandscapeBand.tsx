/**
 * Decorative landscape band (rolling hills in the earth palette). It is a generic
 * placeholder, deliberately NOT an imitation of Aboriginal art; licensed artwork by an
 * Aboriginal artist can replace it (see docs/design/visual-design.md).
 */
export function LandscapeBand() {
  return (
    <div className="landscape" aria-hidden="true">
      <svg viewBox="0 0 400 70" preserveAspectRatio="none" focusable="false">
        <path d="M0 40 C60 10 110 12 170 32 S290 50 400 18 V70 H0Z" fill="var(--peach)" />
        <path d="M0 50 C70 30 130 34 200 46 S320 58 400 36 V70 H0Z" fill="var(--ochre)" />
        <path d="M0 58 C80 44 150 48 220 56 S330 64 400 50 V70 H0Z" fill="var(--sage)" />
        <path d="M0 66 C90 58 170 60 250 64 S350 68 400 62 V70 H0Z" fill="var(--teal)" />
      </svg>
    </div>
  );
}
