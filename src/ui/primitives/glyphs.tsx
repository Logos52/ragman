import type { CSSProperties, ReactElement } from 'react';

/**
 * Line icons drawn for Ragman: 24 x 24 grid, 1.75 stroke, round caps and joins, currentColor.
 * No external icon set.
 */
const P: Record<string, ReactElement> = {
  /* ---------- categories ---------- */
  tops: <path d="M8.5 3.5 4 5.5 2 10l3 1.5 1-1.5v10h12V10l1 1.5 3-1.5-2-4.5-4.5-2a3.5 3.5 0 0 1-7 0Z" />,
  bottoms: <path d="M6 3h12l1.5 18h-5L12 10l-2.5 11h-5L6 3Zm0 3h12" />,
  outerwear: (
    <>
      <path d="M8.5 3 4 5.5 2.5 21H9v-9l3-6 3 6v9h6.5L20 5.5 15.5 3 12 6 8.5 3Z" />
      <path d="M12 6v15M5.5 15h3M15.5 15h3" />
    </>
  ),
  underwear: <path d="M3 6h18v3.5c-3 1-5.5 3.5-6.5 8.5h-5C8.5 13 6 10.5 3 9.5V6Zm0 3.5h18" />,
  footwear: <path d="M4 5h5v6c3 0 6 1.5 8.5 3S21 16 21 17.5V19H4V5Zm0 10h17M4 9h5" />,
  accessories: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M9.5 8.3 10 3h4l.5 5.3M9.5 15.7 10 21h4l.5-5.3M12 10v2l1.5 1" />
    </>
  ),
  electronics: (
    <>
      <rect x="6" y="2.5" width="12" height="19" />
      <path d="M10 18.5h4M6 5.5h12M6 15.5h12" />
    </>
  ),
  'bags-and-cubes': (
    <>
      <path d="M9 6V3.5h6V6" />
      <rect x="3.5" y="6" width="17" height="15" />
      <path d="M3.5 11h17M10 11v2.5h4V11" />
    </>
  ),
  consumables: (
    <>
      <path d="M9.5 2.5h5v3l1.5 2v13.5H8V7.5l1.5-2v-3Z" />
      <path d="M8 11h8v6H8M9.5 5.5h5" />
    </>
  ),
  furniture: (
    <>
      <rect x="3" y="3" width="18" height="16" />
      <path d="M3 8.5h18M3 14h18M10 5.75h4M10 11.25h4M10 16.5h4M5 19v2M19 19v2" />
    </>
  ),

  /* ---------- slots ---------- */
  head: <path d="M4 15.5c0-5 3.5-9 8-9s8 4 8 9M2 15.5h20c0 1.5-1.5 2.5-3.5 2.5h-13C3.5 18 2 17 2 15.5ZM12 6.5V4.5" />,
  eyes: (
    <>
      <path d="M2 9h20M2 9v1.5M22 9v1.5" />
      <path d="M4.5 9.5c0 2.5 1.5 4 3.5 4s3.5-1.5 4-4M12 9.5c.5 2.5 2 4 4 4s3.5-1.5 3.5-4" />
    </>
  ),
  // a pair of earbuds: two round buds with a speaker dot on the outer face and short stems off their inner sides
  // (the old single hooked bud read as a "?" beside the unverified marks)
  ears: (
    <>
      <circle cx="6.5" cy="8" r="4" />
      <circle cx="17.5" cy="8" r="4" />
      <path d="M9.5 10.8l.8 9.2M14.5 10.8l-.8 9.2" />
      <circle cx="4.9" cy="7.3" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="19.1" cy="7.3" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  neck: <path d="M7 3c0 4 2 6.5 5 9 3-2.5 5-5 5-9M7 3 3.5 5v16h17V5L17 3M12 12v9" />,
  wrist: (
    <>
      <circle cx="12" cy="12" r="5" />
      <path d="M8.5 8.5 9 3h6l.5 5.5M8.5 15.5 9 21h6l.5-5.5M12 9.5V12h2" />
    </>
  ),
  'torso-base': <path d="M9 3 5 4.5 3.5 11l2.5.5V21h12v-9.5l2.5-.5L19 4.5 15 3a3 3 0 0 1-6 0Z" />,
  'torso-mid': (
    <>
      <path d="M8.5 3 4 5 2 13l3 .5L6 11v10h12V11l1 2.5 3-.5-2-8-4.5-2L12 7 8.5 3Z" />
      <path d="M12 7v14" />
    </>
  ),
  'torso-outer': (
    <>
      <path d="M8 3 3.5 5 2 21h7v-8l3-7 3 7v8h7L20.5 5 16 3l-4 3-4-3Z" />
      <path d="M12 6v15M2.7 15h6.3M15 15h6.3" />
    </>
  ),
  hands: (
    <path d="M7 21v-4.5L4 12.5c-.8-1-.5-2.2.5-2.5s1.8.3 2.5 1V4.5a1.25 1.25 0 0 1 2.5 0V10m0-6.5a1.25 1.25 0 0 1 2.5 0V10m0-5.5a1.25 1.25 0 0 1 2.5 0V10m0-4a1.25 1.25 0 0 1 2.5 0V15c0 2-1 3.5-2 4.5V21" />
  ),
  legs: <path d="M6.5 3h11l1 18h-4.5L12 9.5 10 21H5.5l1-18Zm0 2.5h11" />,
  socks: <path d="M8 3h7v9.5l2.5 3.5c1 1.5.5 3.5-1 4.5s-3.5.5-4.5-1L8.5 15c-.3-.5-.5-1-.5-1.5V3Zm0 3h7" />,
  feet: <path d="M3 9.5c1 0 2-.5 3-1.5l2.5 1.5 2-3c2 2.5 5 4.5 9.5 5.5 1 .3 1.5 1 1.5 2V17H3V9.5Zm0 5h19" />,
  pockets: (
    <>
      <path d="M5 4h14v10a7 7 0 0 1-14 0V4Z" />
      <path d="M5 8h14" />
    </>
  ),
  backpack: (
    <>
      <path d="M9 5V3h6v2" />
      <path d="M5 21V10a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v11H5Z" />
      <path d="M8 21v-6h8v6M8 11h8" />
    </>
  ),
  'carry-on': (
    <>
      <path d="M10 6V2.5h4V6" />
      <rect x="6" y="6" width="12" height="13" />
      <path d="M10 9.5v6M14 9.5v6" />
      <circle cx="8.5" cy="20.5" r="1" />
      <circle cx="15.5" cy="20.5" r="1" />
    </>
  ),
  pouch: (
    <>
      <path d="M4 8h16v9.5a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 17.5V8Z" />
      <path d="M4 8l2-4h12l2 4M8 12h8" />
    </>
  ),

  /* ---------- ui ---------- */
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5.5 5.5" />
    </>
  ),
  sort: <path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" />,
  plus: <path d="M12 4v16M4 12h16" />,
  close: <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />,
  archive: (
    <>
      <rect x="2.5" y="4" width="19" height="5" />
      <path d="M4 9v11h16V9M9.5 13h5" />
    </>
  ),
  tag: (
    <>
      <path d="M3 8.5 8 4h13v16H8l-5-4.5v-7Z" />
      <circle cx="8.5" cy="12" r="1.5" />
      <path d="M13 9.5h5M13 14.5h5" />
    </>
  ),
  weight: (
    <>
      <circle cx="12" cy="6" r="2.5" />
      <path d="M7.5 9h9L20 21H4L7.5 9Z" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  undo: <path d="M8 4.5 3.5 9 8 13.5M3.5 9H14a6 6 0 0 1 0 12h-3" />,
  grip: (
    <>
      <circle cx="9" cy="6" r=".6" />
      <circle cx="15" cy="6" r=".6" />
      <circle cx="9" cy="12" r=".6" />
      <circle cx="15" cy="12" r=".6" />
      <circle cx="9" cy="18" r=".6" />
      <circle cx="15" cy="18" r=".6" />
    </>
  ),
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  pin: <path d="M9 3h6l-1 6 4 4H6l4-4-1-6Zm3 10v8" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v3" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3.6-3.6a4 4 0 0 0-5.7-5.7L12 6.3M14 10a4 4 0 0 0-5.7 0l-3.6 3.6a4 4 0 0 0 5.7 5.7l1.6-1.6" />,
};

export const categoryGlyphNames = [
  'tops', 'bottoms', 'outerwear', 'underwear', 'footwear', 'accessories', 'electronics', 'bags-and-cubes', 'consumables', 'furniture',
];
export const slotGlyphNames = [
  'head', 'eyes', 'ears', 'neck', 'wrist', 'torso-base', 'torso-mid', 'torso-outer', 'hands', 'legs', 'underwear', 'socks', 'feet',
  'pockets', 'backpack', 'carry-on', 'pouch',
];
export const uiGlyphNames = ['search', 'sort', 'plus', 'close', 'archive', 'tag', 'weight', 'check', 'undo', 'grip', 'chevron-down', 'pin', 'lock', 'link'];

export function hasGlyph(name: string): boolean {
  return name in P;
}

export interface GlyphProps {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/** `<Glyph name="backpack" size={24} />`. Unknown names draw a dashed square, never nothing. */
export function Glyph({ name, size = 24, strokeWidth = 1.75, className, style, title }: GlyphProps) {
  const body = P[name] ?? <rect x="5" y="5" width="14" height="14" strokeDasharray="2 2.5" />;
  return (
    <svg
      className={className ? `rg-glyph ${className}` : 'rg-glyph'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  );
}

/** Data strings ("bags and cubes", "Torso Outer", "Carry-on") to glyph names ("bags-and-cubes"). */
export function glyphNameFor(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export interface CategoryGlyphProps extends Omit<GlyphProps, 'name'> {
  category: string;
}

/** `<CategoryGlyph category="bags and cubes" />` */
export function CategoryGlyph({ category, ...rest }: CategoryGlyphProps) {
  return <Glyph name={glyphNameFor(category)} {...rest} />;
}

/** Same mapping for slot names from the data ("Torso Base" -> "torso-base"). */
export function SlotGlyph({ slot, ...rest }: Omit<GlyphProps, 'name'> & { slot: string }) {
  return <Glyph name={glyphNameFor(slot)} {...rest} />;
}
