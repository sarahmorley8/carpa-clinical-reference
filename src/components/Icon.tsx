/** Small inline SVG icon set. Icons are decorative; meaning is always also given in text. */

const PATHS = {
  alert: 'M12 3 2 21h20L12 3Zm0 6v5m0 3v.5',
  caution: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v5m0 3v.5',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-9v.5',
  phone: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2Z',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM20 20l-4.8-4.8',
  home: 'M3 11 12 3l9 8v10h-6v-6H9v6H3V11Z',
  tools: 'M4 6h16M4 12h16M4 18h16',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3-2-1-.5-1.5 1-2-1.5-1.5-2 1L13.5 6 12 4l-1.5 2-1.5.5-2-1L5.5 7l1 2L6 10.5 4 12l2 1.5.5 1.5-1 2L7 18.5l2-1 1.5.5L12 20l1.5-2 1.5-.5 2 1 1.5-1.5-1-2 .5-1.5 2-1.5Z',
  chevron: 'm9 5 7 7-7 7',
  back: 'm15 5-7 7 7 7',
  check: 'm5 12 4.5 4.5L19 7',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  clear: 'M6 6l12 12M18 6 6 18',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
