import { Callout, DefaultButton, Stack, TextField } from '@fluentui/react';
import { Button } from '@fluentui/react-components';
import * as React from 'react';
import './ColorPickerComponent.css';

type Props = {
  value: string;
  title: string;
  disabled?: boolean;
  icon: any;
  onChange: (hex: string) => void;
  /**
   * Fires synchronously whenever the popover opens or closes — including the
   * trigger-button click, before Fluent's Callout has a chance to steal DOM
   * focus via setInitialFocus. Lets the host capture "was the editor the
   * active surface right before this opened" at the only moment that's
   * actually knowable, and restore focus once on close rather than fighting
   * for it while the popover is open.
   */
  onOpenChange?: (open: boolean) => void;
};

const PRESET = [
  '#000000',
  '#434343',
  '#666666',
  '#999999',
  '#b7b7b7',
  '#cccccc',
  '#d9d9d9',
  '#ffffff',

  '#980000',
  '#ff0000',
  '#ff9900',
  '#ffff00',
  '#00ff00',
  '#00ffff',
  '#4a86e8',
  '#0000ff',
  '#9900ff',
  '#ff00ff',
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const normalizeHex = (v: string) => {
  const s = (v ?? '').trim();
  if (!s) return '#000000';

  // Selection style values aren't guaranteed to be hex — content pasted or
  // authored elsewhere (other editors, email clients) commonly carries
  // `rgb()`/`rgba()` inline colors. Without this, such a value would silently
  // fall through to the '#000000' default below, showing the wrong color.
  const rgbMatch = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return rgbToHex(clamp(+r, 0, 255), clamp(+g, 0, 255), clamp(+b, 0, 255));
  }

  let hex = s.startsWith('#') ? s : `#${s}`;
  if (hex.length === 9) hex = hex.slice(0, 7); // #rrggbbaa — drop alpha, picker has no alpha control
  if (hex.length === 4 || hex.length === 7) return hex.toLowerCase();
  return '#000000';
};

const hexToRgb = (hex: string) => {
  const h = normalizeHex(hex).replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;

const rgbToHsv = (r: number, g: number, b: number) => {
  const rr = r / 255,
    gg = g / 255,
    bb = b / 255;
  const max = Math.max(rr, gg, bb),
    min = Math.min(rr, gg, bb);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : d / max;
  const v = max;

  return { h, s, v };
};

const hsvToRgb = (h: number, s: number, v: number) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let rr = 0,
    gg = 0,
    bb = 0;
  if (h < 60) [rr, gg, bb] = [c, x, 0];
  else if (h < 120) [rr, gg, bb] = [x, c, 0];
  else if (h < 180) [rr, gg, bb] = [0, c, x];
  else if (h < 240) [rr, gg, bb] = [0, x, c];
  else if (h < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];

  return {
    r: Math.round((rr + m) * 255),
    g: Math.round((gg + m) * 255),
    b: Math.round((bb + m) * 255),
  };
};

export const ColorPickerControl = ({ value, title, disabled, onChange, icon, onOpenChange }: Props) => {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLDivElement | null>(null);
  const setOpenAndNotify = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const handleDismiss = React.useCallback(() => setOpenAndNotify(false), [setOpenAndNotify]);
  // Block every auto-dismiss trigger (scroll/resize/focus-shift) except a
  // genuine click — clicks on the picker's own controls are already inside
  // the Callout's DOM, so Fluent never treats them as an outside click in
  // the first place; nothing extra is needed for them here.
  const preventDismissOnEvent = React.useCallback(
    (ev: Event | React.FocusEvent | React.KeyboardEvent | React.MouseEvent) => ev.type !== 'click',
    [],
  );

  // Since scroll/resize no longer auto-close the callout, it must instead
  // actively follow the button as the page scrolls. Fluent recalculates the
  // Callout's position on every render of this component (its internal
  // effect depends on the whole `props` object, which is a new reference
  // each render), so forcing a re-render on scroll/resize is enough to keep
  // it correctly anchored — no manual position math needed.
  const [, forceReposition] = React.useState(0);
  React.useEffect(() => {
    if (!open) return;
    let rafId: number | null = null;
    const reposition = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        forceReposition((n) => n + 1);
      });
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  // The color actually applied to the editor right now — independent of
  // whatever the user may be experimenting with in the (unapplied) draft
  // below. Used for the small indicator under the trigger button so it
  // never shows a color the user picked but then discarded via Close.
  const appliedHex = React.useMemo(() => normalizeHex(value || '#000000'), [value]);

  // Draft state, local to this open session — nothing here touches the
  // editor. The picker no longer applies color live while the user is
  // experimenting (via drag or otherwise): only a single, deliberate Apply
  // click commits a color, so stray pointer activity can never silently
  // overwrite the document.
  const [hex, setHex] = React.useState<string>(appliedHex);
  const { r, g, b } = React.useMemo(() => hexToRgb(hex), [hex]);
  const hsv = React.useMemo(() => rgbToHsv(r, g, b), [r, g, b]);
  const [h, setH] = React.useState(hsv.h);
  const [s, setS] = React.useState(hsv.s);
  const [v, setV] = React.useState(hsv.v);

  const setDraft = React.useCallback((nextHex: string) => {
    setHex(nextHex);
    const rgb = hexToRgb(nextHex);
    const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setH(next.h);
    setS(next.s);
    setV(next.v);
  }, []);

  const setDraftFromHsv = React.useCallback((hh: number, ss: number, vv: number) => {
    const rgb = hsvToRgb(hh, ss, vv);
    setHex(rgbToHex(rgb.r, rgb.g, rgb.b));
    setH(hh);
    setS(ss);
    setV(vv);
  }, []);

  // Re-seed the draft from the editor's actual color only when the popover
  // freshly opens — never while it's open. The draft is the single source
  // of truth for the whole open session; there's no live round trip through
  // the editor to resync from anymore.
  const wasOpenRef = React.useRef(open);
  React.useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;
    setDraft(appliedHex);
  }, [appliedHex, open, setDraft]);

  const svRef = React.useRef<HTMLDivElement | null>(null);
  const handleSVClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (!svRef.current) return;
      const rect = svRef.current.getBoundingClientRect();
      const x = clamp(e.clientX - rect.left, 0, rect.width);
      const y = clamp(e.clientY - rect.top, 0, rect.height);
      const ss = rect.width === 0 ? 0 : x / rect.width;
      const vv = rect.height === 0 ? 0 : 1 - y / rect.height;
      setDraftFromHsv(h, ss, vv);
    },
    [h, setDraftFromHsv],
  );

  const hueRef = React.useRef<HTMLDivElement | null>(null);
  const handleHueClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (!hueRef.current) return;
      const rect = hueRef.current.getBoundingClientRect();
      const x = clamp(e.clientX - rect.left, 0, rect.width);
      const hh = rect.width === 0 ? 0 : (x / rect.width) * 360;
      setDraftFromHsv(hh, s, v);
    },
    [s, v, setDraftFromHsv],
  );

  const handleApply = React.useCallback(() => {
    onChange(hex);
    setOpenAndNotify(false);
  }, [onChange, hex, setOpenAndNotify]);

  const svThumb = React.useMemo(() => ({ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }), [s, v]);
  const hueThumb = React.useMemo(() => ({ left: `${(h / 360) * 100}%` }), [h]);

  const hueColor = React.useMemo(() => {
    const { r, g, b } = hsvToRgb(h, 1, 1);
    return rgbToHex(r, g, b);
  }, [h]);

  return (
    <div ref={btnRef} style={{ position: 'relative', display: 'inline-block' }}>
      <Button
        type='button'
        size='small'
        icon={icon}
        value={title}
        title={title}
        disabled={disabled}
        style={{
          background: open ? '#ebebeb' : 'none',
          border: 'none',
          margin: 2,
          paddingBottom: 6,
        }}
        onClick={() => {
          if (disabled) return;
          setOpenAndNotify(!open);
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 5,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 14,
          height: 3,
          background: appliedHex,
          borderRadius: 1,
          border: '0.5px solid rgba(0,0,0,0.18)',
          pointerEvents: 'none',
        }}
      />

      {open && !disabled && (
        <Callout
          target={btnRef}
          onDismiss={handleDismiss}
          setInitialFocus
          directionalHint={4}
          className='aoColorCallout'
          preventDismissOnEvent={preventDismissOnEvent}>
          <Stack tokens={{ childrenGap: 10 }} styles={{ root: { padding: 12, width: 320 } }}>
            <div className='aoLexRow'>
              <div className='aoLexSwatch' style={{ background: hex }} />
              <div className='aoLexTitle'>{title}</div>
            </div>

            <div className='aoLexRow'>
              <div className='aoLexLabel'>Hex</div>
              <TextField
                value={hex}
                onChange={(_, val) => setHex(normalizeHex(val || ''))}
                onBlur={() => setDraft(normalizeHex(hex))}
              />
            </div>

            <div className='aoLexSwatches'>
              {PRESET.map((c) => (
                <button
                  key={c}
                  type='button'
                  className='aoLexSwatchBtn'
                  style={{ background: c }}
                  onClick={() => setDraft(c)}
                  title={c}
                />
              ))}
            </div>

            <div className='aoLexSV' ref={svRef} onClick={handleSVClick}>
              <div className='aoLexSVHue' style={{ background: hueColor }} />
              <div className='aoLexSVWhite' />
              <div className='aoLexSVBlack' />
              <div className='aoLexSVThumb' style={svThumb} />
            </div>

            <div className='aoLexHue' ref={hueRef} onClick={handleHueClick}>
              <div className='aoLexHueThumb' style={hueThumb} />
            </div>

            <div className='aoLexPreview' style={{ background: hex }} />

            <div className='aoLexActions'>
              <DefaultButton type='button' text='Apply' onClick={handleApply} />
              <DefaultButton type='button' text='Close' onClick={() => setOpenAndNotify(false)} />
            </div>
          </Stack>
        </Callout>
      )}
    </div>
  );
};
