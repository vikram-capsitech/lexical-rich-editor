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
   * for it on every intermediate color commit while open.
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

function useDrag(
  onMove: (clientX: number, clientY: number) => void,
  onEnd?: () => void,
  interactingRef?: React.MutableRefObject<boolean>,
) {
  const draggingRef = React.useRef(false);

  const start = React.useCallback(
    (e: React.MouseEvent) => {
      draggingRef.current = true;
      if (interactingRef) interactingRef.current = true;
      onMove(e.clientX, e.clientY);

      const move = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        onMove(ev.clientX, ev.clientY);
      };
      const up = () => {
        draggingRef.current = false;
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        // Releasing the drag (or even a plain click with no movement) outside
        // the picker's small hit area fires a native click there too — the
        // Callout's dismiss check runs on a *capture*-phase document listener,
        // which always completes before any *bubble*-phase listener on
        // `window` runs. So clearing the flag from a one-off bubble listener
        // here guarantees it's still true while the Callout makes its
        // decision, however long the gap between mouseup and click actually
        // is — no timer-based race.
        if (interactingRef) {
          const clearFlag = () => {
            interactingRef.current = false;
          };
          window.addEventListener('click', clearFlag, { once: true });
          // Fallback in case no click event follows this mouseup at all.
          setTimeout(() => {
            window.removeEventListener('click', clearFlag);
            interactingRef.current = false;
          }, 0);
        }
        onEnd?.();
      };

      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
    [onMove, onEnd, interactingRef],
  );

  return start;
}

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
  // Tracks whether the user is actively dragging/typing inside the callout so
  // Fluent's auto-dismiss (on scroll/resize/focus-shift/stray click) can be
  // suppressed — the callout should only close via Apply/Close or a genuine
  // click outside it.
  const interactingRef = React.useRef(false);

  // Memoized so Callout's internal dismiss-listener effect (which depends on
  // these by reference) doesn't tear down and re-attach its document
  // listeners on every render — that churn left windows where an outside
  // click could be missed (or the callout dismissed unpredictably) while
  // hue/sv state was updating continuously during a drag.
  const handleDismiss = React.useCallback(() => setOpenAndNotify(false), [setOpenAndNotify]);
  const preventDismissOnEvent = React.useCallback(
    (ev: Event | React.FocusEvent | React.KeyboardEvent | React.MouseEvent) => {
      // Block every auto-dismiss trigger (scroll/resize/focus-shift) except a
      // genuine click; while a drag is in progress, block that too, since
      // releasing it outside the small swatch/slider hit area would
      // otherwise read as an outside click.
      if (interactingRef.current) return true;
      return ev.type !== 'click';
    },
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

  const [hex, setHex] = React.useState<string>(normalizeHex(value || '#000000'));

  const { r, g, b } = React.useMemo(() => hexToRgb(hex), [hex]);
  const hsv = React.useMemo(() => rgbToHsv(r, g, b), [r, g, b]);

  const [h, setH] = React.useState(hsv.h);
  const [s, setS] = React.useState(hsv.s);
  const [v, setV] = React.useState(hsv.v);

  // Re-seed local color state from `value` only when the popover freshly
  // opens. Every drag move/preset click/hex edit round-trips through
  // `onChange` -> host applies it -> host echoes back a new `value`, and if
  // we resynced on every such echo, a momentarily-stale or default echo
  // (e.g. the host's selection-based color readback racing with focus
  // moving into the callout) would stomp the in-progress local state right
  // as the user releases the mouse. Local state is already authoritative
  // once the user starts interacting, so there's no need to keep syncing
  // from upstream while open — only when this open session begins.
  const wasOpenRef = React.useRef(open);
  // eslint-disable-next-line no-console
  console.log('[AO-ColorPicker]', title, 'render with incoming value prop:', JSON.stringify(value));

  React.useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    // eslint-disable-next-line no-console
    console.log('[AO-ColorPicker]', title, 'open-seed effect', {
      open,
      justOpened,
      incomingValue: value,
    });
    if (!justOpened) return;
    const n = normalizeHex(value || '#000000');
    // eslint-disable-next-line no-console
    console.log('[AO-ColorPicker]', title, 'seeding local state from value on open', {
      incomingValue: value,
      normalized: n,
    });
    setHex(n);
    const rgb = hexToRgb(n);
    const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setH(next.h);
    setS(next.s);
    setV(next.v);
  }, [value, open]);

  // Sets local hex/preview state only — cheap, no editor interaction. Used
  // on every mousemove during a drag so the swatch/hex field track the
  // cursor live, without touching Lexical on every pixel.
  const updateHexFromHsv = React.useCallback((hh: number, ss: number, vv: number) => {
    const rgb = hsvToRgb(hh, ss, vv);
    const nextHex = rgbToHex(rgb.r, rgb.g, rgb.b);
    setHex(nextHex);
    return nextHex;
  }, []);

  const commitHsv = React.useCallback(
    (hh: number, ss: number, vv: number, close?: boolean) => {
      const nextHex = updateHexFromHsv(hh, ss, vv);
      // eslint-disable-next-line no-console
      console.log('[AO-ColorPicker]', title, 'commitHsv -> onChange', { nextHex, close: !!close });
      onChange(nextHex);
      if (close) setOpenAndNotify(false);
    },
    [onChange, title, setOpenAndNotify, updateHexFromHsv],
  );

  // Mirror the latest h/s/v in refs (updated inline, not via effect, so
  // there's no async gap) so the drag-end handlers below always see the
  // final value — the editor is only touched once per gesture (on mouseup),
  // not on every mousemove.
  const hRef = React.useRef(h);
  const sRef = React.useRef(s);
  const vRef = React.useRef(v);
  React.useEffect(() => {
    hRef.current = h;
  }, [h]);
  React.useEffect(() => {
    sRef.current = s;
  }, [s]);
  React.useEffect(() => {
    vRef.current = v;
  }, [v]);

  const svRef = React.useRef<HTMLDivElement | null>(null);
  const onSVMove = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!svRef.current) return;
      const rect = svRef.current.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      const y = clamp(clientY - rect.top, 0, rect.height);
      const ss = rect.width === 0 ? 0 : x / rect.width;
      const vv = rect.height === 0 ? 0 : 1 - y / rect.height;
      setS(ss);
      setV(vv);
      sRef.current = ss;
      vRef.current = vv;
      // Local-only preview. Touching the editor (onChange/applyStyle) on
      // every mousemove forced a Lexical selection/DOM-sync cycle on every
      // pixel of the drag, fighting Fluent's Callout for focus dozens of
      // times a second — the actual commit happens once, on drag end below.
      updateHexFromHsv(hRef.current, ss, vv);
    },
    [updateHexFromHsv],
  );
  const commitSV = React.useCallback(() => {
    commitHsv(hRef.current, sRef.current, vRef.current);
  }, [commitHsv]);
  const startSV = useDrag(onSVMove, commitSV, interactingRef);

  const hueRef = React.useRef<HTMLDivElement | null>(null);
  const onHueMove = React.useCallback(
    (clientX: number) => {
      if (!hueRef.current) return;
      const rect = hueRef.current.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      const hh = rect.width === 0 ? 0 : (x / rect.width) * 360;
      setH(hh);
      hRef.current = hh;
      updateHexFromHsv(hh, sRef.current, vRef.current);
    },
    [updateHexFromHsv],
  );
  const commitHue = React.useCallback(() => {
    commitHsv(hRef.current, sRef.current, vRef.current);
  }, [commitHsv]);
  const startHue = useDrag((x) => onHueMove(x), commitHue, interactingRef);

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
          // eslint-disable-next-line no-console
          console.log('[AO-ColorPicker]', title, 'trigger button clicked', {
            wasOpen: open,
            activeElementBeforeToggle: document.activeElement?.tagName,
          });
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
          background: hex,
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
                onBlur={() => {
                  const n = normalizeHex(hex);
                  setHex(n);
                  const rgb = hexToRgb(n);
                  const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
                  setH(next.h);
                  setS(next.s);
                  setV(next.v);
                  // eslint-disable-next-line no-console
                  console.log('[AO-ColorPicker]', title, 'hex field blur -> onChange', { raw: hex, normalized: n });
                  onChange(n);
                }}
              />
            </div>

            <div className='aoLexSwatches'>
              {PRESET.map((c) => (
                <button
                  key={c}
                  type='button'
                  className='aoLexSwatchBtn'
                  style={{ background: c }}
                  onClick={() => {
                    setHex(c);
                    const rgb = hexToRgb(c);
                    const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
                    setH(next.h);
                    setS(next.s);
                    setV(next.v);
                    // eslint-disable-next-line no-console
                    console.log('[AO-ColorPicker]', title, 'preset swatch click -> onChange', { color: c });
                    onChange(c);
                  }}
                  title={c}
                />
              ))}
            </div>

            <div className='aoLexSV' ref={svRef} onMouseDown={startSV}>
              <div className='aoLexSVHue' style={{ background: hueColor }} />
              <div className='aoLexSVWhite' />
              <div className='aoLexSVBlack' />
              <div className='aoLexSVThumb' style={svThumb} />
            </div>

            <div className='aoLexHue' ref={hueRef} onMouseDown={startHue}>
              <div className='aoLexHueThumb' style={hueThumb} />
            </div>

            <div className='aoLexPreview' style={{ background: hex }} />

            <div className='aoLexActions'>
              <DefaultButton
                type='button'
                text='Apply'
                onClick={() => {
                  commitHsv(h, s, v, true);
                }}
              />
              <DefaultButton type='button' text='Close' onClick={() => setOpenAndNotify(false)} />
            </div>
          </Stack>
        </Callout>
      )}
    </div>
  );
};
