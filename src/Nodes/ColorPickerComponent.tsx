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
  let s = (v ?? '').trim();
  if (!s) return '#000000';
  if (!s.startsWith('#')) s = `#${s}`;
  if (s.length === 4 || s.length === 7) return s;
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

function useDrag(onMove: (clientX: number, clientY: number) => void, onEnd?: () => void) {
  const draggingRef = React.useRef(false);

  const start = React.useCallback(
    (e: React.MouseEvent) => {
      draggingRef.current = true;
      onMove(e.clientX, e.clientY);

      const move = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        onMove(ev.clientX, ev.clientY);
      };
      const up = () => {
        draggingRef.current = false;
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        onEnd?.();
      };

      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
    [onMove, onEnd],
  );

  return start;
}

export const ColorPickerControl = ({ value, title, disabled, onChange, icon }: Props) => {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLDivElement | null>(null);

  const [hex, setHex] = React.useState<string>(normalizeHex(value || '#000000'));

  const { r, g, b } = React.useMemo(() => hexToRgb(hex), [hex]);
  const hsv = React.useMemo(() => rgbToHsv(r, g, b), [r, g, b]);

  const [h, setH] = React.useState(hsv.h);
  const [s, setS] = React.useState(hsv.s);
  const [v, setV] = React.useState(hsv.v);

  React.useEffect(() => {
    const n = normalizeHex(value || '#000000');
    setHex(n);
    const rgb = hexToRgb(n);
    const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setH(next.h);
    setS(next.s);
    setV(next.v);
  }, [value]);

  const commitHsv = React.useCallback(
    (hh: number, ss: number, vv: number, close?: boolean) => {
      const rgb = hsvToRgb(hh, ss, vv);
      const nextHex = rgbToHex(rgb.r, rgb.g, rgb.b);
      setHex(nextHex);
      onChange(nextHex);
      if (close) setOpen(false);
    },
    [onChange],
  );

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
      commitHsv(h, ss, vv);
    },
    [h, commitHsv],
  );
  const startSV = useDrag(onSVMove);

  const hueRef = React.useRef<HTMLDivElement | null>(null);
  const onHueMove = React.useCallback(
    (clientX: number) => {
      if (!hueRef.current) return;
      const rect = hueRef.current.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      const hh = rect.width === 0 ? 0 : (x / rect.width) * 360;
      setH(hh);
      commitHsv(hh, s, v);
    },
    [s, v, commitHsv],
  );
  const startHue = useDrag((x) => onHueMove(x));

  const svThumb = React.useMemo(() => ({ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }), [s, v]);
  const hueThumb = React.useMemo(() => ({ left: `${(h / 360) * 100}%` }), [h]);

  const hueColor = React.useMemo(() => {
    const { r, g, b } = hsvToRgb(h, 1, 1);
    return rgbToHex(r, g, b);
  }, [h]);

  return (
    <div ref={btnRef} style={{ position: 'relative', display: 'inline-block' }}>
      <Button
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
          setOpen((p) => !p);
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
          onDismiss={() => setOpen(false)}
          setInitialFocus
          directionalHint={4}
          className='aoColorCallout'>
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
                text='Apply'
                onClick={() => {
                  commitHsv(h, s, v, true);
                }}
              />
              <DefaultButton text='Close' onClick={() => setOpen(false)} />
            </div>
          </Stack>
        </Callout>
      )}
    </div>
  );
};
