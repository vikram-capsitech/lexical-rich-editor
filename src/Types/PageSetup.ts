export type PageSize =
  | 'pageless'
  | 'a4'
  | 'letter'
  | 'legal'
  | 'tabloid'
  | 'a3'
  | 'a5'
  | 'b4'
  | 'b5'
  | 'statement'
  | 'executive'
  | 'folio';

export type PageOrientation = 'portrait' | 'landscape';

export type PageMargin = 'narrow' | 'normal' | 'moderate' | 'wide';

export interface PageSetupValue {
  size: PageSize;
  orientation: PageOrientation;
  margin: PageMargin;
}

export const DEFAULT_PAGE_SETUP: PageSetupValue = {
  size: 'pageless',
  orientation: 'portrait',
  margin: 'normal',
};

interface PageSizeOption {
  key: Exclude<PageSize, 'pageless'>;
  label: string;
  // Portrait dimensions in inches (widthIn is always the shorter edge).
  widthIn: number;
  heightIn: number;
}

export const PAGE_SIZE_OPTIONS: PageSizeOption[] = [
  { key: 'a4', label: 'A4 (8.27" x 11.69")', widthIn: 8.27, heightIn: 11.69 },
  { key: 'letter', label: 'Letter (8.5" x 11")', widthIn: 8.5, heightIn: 11 },
  { key: 'legal', label: 'Legal (8.5" x 14")', widthIn: 8.5, heightIn: 14 },
  { key: 'tabloid', label: 'Tabloid (11" x 17")', widthIn: 11, heightIn: 17 },
  { key: 'a3', label: 'A3 (11.69" x 16.54")', widthIn: 11.69, heightIn: 16.54 },
  { key: 'a5', label: 'A5 (5.83" x 8.27")', widthIn: 5.83, heightIn: 8.27 },
  { key: 'b4', label: 'B4 (9.84" x 13.90")', widthIn: 9.84, heightIn: 13.9 },
  { key: 'b5', label: 'B5 (6.93" x 9.84")', widthIn: 6.93, heightIn: 9.84 },
  { key: 'statement', label: 'Statement (5.5" x 8.5")', widthIn: 5.5, heightIn: 8.5 },
  { key: 'executive', label: 'Executive (7.25" x 10.5")', widthIn: 7.25, heightIn: 10.5 },
  { key: 'folio', label: 'Folio (8.5" x 13")', widthIn: 8.5, heightIn: 13 },
];

interface MarginOption {
  key: PageMargin;
  label: string;
  valueIn: number;
}

export const MARGIN_OPTIONS: MarginOption[] = [
  { key: 'narrow', label: 'Narrow (0.25")', valueIn: 0.25 },
  { key: 'normal', label: 'Normal (0.4")', valueIn: 0.4 },
  { key: 'moderate', label: 'Moderate (0.75")', valueIn: 0.75 },
  { key: 'wide', label: 'Wide (1")', valueIn: 1 },
];

const CSS_PX_PER_INCH = 96;

/**
 * Resolves the on-screen canvas metrics for a page setup.
 * `widthPx` is `undefined` for Pageless (no width constraint — today's default look).
 */
export function resolvePageCanvasMetrics(value: PageSetupValue): {
  widthPx?: number;
  paddingPx: number;
} {
  const margin = MARGIN_OPTIONS.find((o) => o.key === value.margin) ?? MARGIN_OPTIONS[1];

  if (value.size === 'pageless') {
    return { widthPx: undefined, paddingPx: 20 };
  }

  const size = PAGE_SIZE_OPTIONS.find((o) => o.key === value.size);
  if (!size) return { widthPx: undefined, paddingPx: 20 };

  const widthIn = value.orientation === 'landscape' ? size.heightIn : size.widthIn;

  return {
    widthPx: Math.round(widthIn * CSS_PX_PER_INCH),
    paddingPx: Math.round(margin.valueIn * CSS_PX_PER_INCH),
  };
}
