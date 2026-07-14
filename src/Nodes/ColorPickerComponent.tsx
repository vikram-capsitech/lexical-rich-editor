import { Callout, Stack, TextField } from '@fluentui/react';
import { Button } from '@fluentui/react-components';
import { Dismiss16Regular } from '@fluentui/react-icons';
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

// A hex string is only safe to commit once it's a complete token — while the
// user is mid-keystroke ("#3", "#3a4") it's neither valid nor intentional,
// so live-apply must not fire for those partial states.
const isCompleteHex = (v: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test((v ?? '').trim());

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
  else[rr, gg, bb] = [c, 0, x];

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

  const appliedHex = React.useMemo(() => normalizeHex(value || '#000000'), [value]);

  // There's no more "draft vs applied" split — every interaction commits
  // straight to the editor via onChange, so this state IS the live color.
  const [hex, setHexState] = React.useState<string>(appliedHex);
  const [hexText, setHexText] = React.useState<string>(appliedHex);
  const { r, g, b } = React.useMemo(() => hexToRgb(hex), [hex]);
  const hsv = React.useMemo(() => rgbToHsv(r, g, b), [r, g, b]);
  const [h, setH] = React.useState(hsv.h);
  const [s, setS] = React.useState(hsv.s);
  const [v, setV] = React.useState(hsv.v);

  // Commits a color: updates local state for the swatches/thumbs AND pushes
  // it straight to the editor. Every gesture in this popover funnels through
  // here so there is a single point where "live apply" happens.
  const commit = React.useCallback(
    (nextHex: string) => {
      const rgb = hexToRgb(nextHex);
      const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setHexState(nextHex);
      setHexText(nextHex);
      setH(next.h);
      setS(next.s);
      setV(next.v);
      onChange(nextHex);
    },
    [onChange],
  );

  const commitFromHsv = React.useCallback(
    (hh: number, ss: number, vv: number) => {
      const rgb = hsvToRgb(hh, ss, vv);
      const nextHex = rgbToHex(rgb.r, rgb.g, rgb.b);
      setHexState(nextHex);
      setHexText(nextHex);
      setH(hh);
      setS(ss);
      setV(vv);
      onChange(nextHex);
    },
    [onChange],
  );

  // Re-seed from the editor's actual color only when the popover freshly
  // opens — never while it's open, since our own commits are already the
  // source of truth for the rest of the session.
  const wasOpenRef = React.useRef(open);
  React.useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;
    setHexState(appliedHex);
    setHexText(appliedHex);
    const rgb = hexToRgb(appliedHex);
    const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setH(next.h);
    setS(next.s);
    setV(next.v);
  }, [appliedHex, open]);

  // --- Saturation/Value square: click-to-set and drag-to-follow -----------
  const svRef = React.useRef<HTMLDivElement | null>(null);
  const svPointFromEvent = React.useCallback((clientX: number, clientY: number) => {
    if (!svRef.current) return null;
    const rect = svRef.current.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);
    const ss = rect.width === 0 ? 0 : x / rect.width;
    const vv = rect.height === 0 ? 0 : 1 - y / rect.height;
    return { ss, vv };
  }, []);

  const hRef = React.useRef(h);
  hRef.current = h;

  const handleSVPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const pt = svPointFromEvent(e.clientX, e.clientY);
      if (pt) commitFromHsv(hRef.current, pt.ss, pt.vv);
    },
    [svPointFromEvent, commitFromHsv],
  );
  const handleSVPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons !== 1) return;
      const pt = svPointFromEvent(e.clientX, e.clientY);
      if (pt) commitFromHsv(hRef.current, pt.ss, pt.vv);
    },
    [svPointFromEvent, commitFromHsv],
  );

  // --- Hue slider: click-to-set and drag-to-follow -------------------------
  const hueRef = React.useRef<HTMLDivElement | null>(null);
  const sRef = React.useRef(s);
  sRef.current = s;
  const vRef = React.useRef(v);
  vRef.current = v;

  const huePointFromEvent = React.useCallback((clientX: number) => {
    if (!hueRef.current) return null;
    const rect = hueRef.current.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    return rect.width === 0 ? 0 : (x / rect.width) * 360;
  }, []);

  const handleHuePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const hh = huePointFromEvent(e.clientX);
      if (hh != null) commitFromHsv(hh, sRef.current, vRef.current);
    },
    [huePointFromEvent, commitFromHsv],
  );
  const handleHuePointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons !== 1) return;
      const hh = huePointFromEvent(e.clientX);
      if (hh != null) commitFromHsv(hh, sRef.current, vRef.current);
    },
    [huePointFromEvent, commitFromHsv],
  );

  // --- Hex field: live-commit once the text is a complete token -----------
  const handleHexChange = React.useCallback(
    (_: any, val?: string) => {
      const next = val ?? '';
      setHexText(next);
      if (isCompleteHex(next.trim())) commit(normalizeHex(next));
    },
    [commit],
  );
  const handleHexBlur = React.useCallback(() => {
    commit(normalizeHex(hexText));
  }, [hexText, commit]);

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
          <Stack tokens={{ childrenGap: 14 }} styles={{ root: { padding: '14px 16px 16px', width: 250 } }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#242424', letterSpacing: 0.1 }}>{title}</div>
              <button
                type='button'
                aria-label='Close'
                onClick={() => setOpenAndNotify(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  padding: 0,
                  border: 'none',
                  borderRadius: 4,
                  background: 'transparent',
                  color: '#616161',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <Dismiss16Regular />
              </button>
            </div>

            {/* Saturation / Value square */}
            <div
              ref={svRef}
              data-testid='color-sv-box'
              onPointerDown={handleSVPointerDown}
              onPointerMove={handleSVPointerMove}
              style={{
                position: 'relative',
                width: '100%',
                height: 125,
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'crosshair',
                touchAction: 'none',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
              }}>
              <div style={{ position: 'absolute', inset: 0, background: hueColor }} />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to right, #fff, rgba(255,255,255,0))',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, #000, rgba(0,0,0,0))',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: '2px solid #fff',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.4)',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  ...svThumb,
                }}
              />
            </div>

            {/* Hue slider */}
            <div
              ref={hueRef}
              data-testid='color-hue-bar'
              onPointerDown={handleHuePointerDown}
              onPointerMove={handleHuePointerMove}
              style={{
                position: 'relative',
                width: '100%',
                height: 12,
                borderRadius: 999,
                cursor: 'pointer',
                touchAction: 'none',
                background:
                  'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
              }}>
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: hueColor,
                  border: '2px solid #fff',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.4)',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  ...hueThumb,
                }}
              />
            </div>

            {/* Hex + live preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  flexShrink: 0,
                  background: hex,
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
                }}
              />
              <TextField
                data-testid='color-hex-input'
                value={hexText}
                onChange={handleHexChange}
                onBlur={handleHexBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit(normalizeHex(hexText));
                }}
                styles={{ root: { flex: 1 }, fieldGroup: { borderRadius: 6 } }}
              />
            </div>

            {/* Preset swatches */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8a8a8a', marginBottom: 6, letterSpacing: 0.3 }}>
                STANDARD COLORS
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(9, 1fr)',
                  gap: 6,
                }}>
                {PRESET.map((c) => {
                  const isSelected = c.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={c}
                      type='button'
                      onClick={() => commit(c)}
                      title={c}
                      aria-label={c}
                      style={{
                        width: 18,
                        height: 18,
                        padding: 0,
                        borderRadius: 4,
                        background: c,
                        cursor: 'pointer',
                        boxShadow: isSelected
                          ? '0 0 0 2px #fff, 0 0 0 3px #4a86e8'
                          : 'inset 0 0 0 1px rgba(0,0,0,0.15)',
                        border: 'none',
                        transition: 'transform 80ms ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.12)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    />
                  );
                })}
              </div>
            </div>
          </Stack>
        </Callout>
      )}
    </div>
  );
};
