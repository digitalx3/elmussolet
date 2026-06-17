import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { Monitor, Tablet, Smartphone, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export type Device = 'desktop' | 'tablet' | 'mobile';

export const CANVAS_WIDTH: Record<Device, number> = {
  desktop: 1200,
  tablet: 768,
  mobile: 375,
};

export type ElementKey = 'badge' | 'title' | 'subtitle' | 'button1' | 'button2';

export interface ElementBox {
  visible?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: number;
  color?: string;
  bgColor?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export type DeviceLayout = Partial<Record<string, ElementBox>>;
export type Layout = Record<Device, DeviceLayout>;

export interface FloatingImage {
  id: string;
  url: string;
  frame: 'none' | 'white' | 'shadow' | 'polaroid' | 'rounded';
  rounded: number; // border-radius in px (0..9999 for full)
  opacity: number; // 0..1
  zIndex: number;
  rotation: number; // degrees
  alt?: string;
}

export const DEFAULT_BOX: Record<ElementKey, ElementBox> = {
  badge:    { visible: true, x: 40,  y: 40,  w: 220, h: 36,  fontSize: 13, color: '#7a3b1f', bgColor: '#ffffffcc', textAlign: 'center' },
  title:    { visible: true, x: 40,  y: 100, w: 560, h: 140, fontSize: 56, color: '#2a1810', textAlign: 'left' },
  subtitle: { visible: true, x: 40,  y: 250, w: 480, h: 70,  fontSize: 16, color: '#3d2418', textAlign: 'left' },
  button1:  { visible: true, x: 40,  y: 340, w: 180, h: 48,  fontSize: 15 },
  button2:  { visible: true, x: 230, y: 340, w: 180, h: 48,  fontSize: 15 },
};

export const DEFAULT_FLOATING_BOX: ElementBox = { visible: true, x: 760, y: 80, w: 360, h: 360 };

export function defaultLayout(): Layout {
  return {
    desktop: { ...DEFAULT_BOX },
    tablet: {
      ...DEFAULT_BOX,
      title: { ...DEFAULT_BOX.title, fontSize: 44, w: 480 },
    },
    mobile: {
      badge:    { ...DEFAULT_BOX.badge, x: 20, y: 20, w: 180, fontSize: 12 },
      title:    { ...DEFAULT_BOX.title, x: 20, y: 70, w: 335, h: 120, fontSize: 32, textAlign: 'center' },
      subtitle: { ...DEFAULT_BOX.subtitle, x: 20, y: 200, w: 335, h: 60, fontSize: 14, textAlign: 'center' },
      button1:  { ...DEFAULT_BOX.button1, x: 20, y: 280, w: 335, h: 46 },
      button2:  { ...DEFAULT_BOX.button2, x: 20, y: 336, w: 335, h: 46 },
    },
  };
}

interface Props {
  layout: Layout;
  onLayoutChange: (l: Layout) => void;
  canvasHeights: Record<Device, number>;
  onCanvasHeightsChange: (h: Record<Device, number>) => void;
  backgroundUrl?: string | null;
  overlay: number;
  content: {
    badge: string;
    title: string;
    subtitle: string;
    button1: string;
    button2: string;
  };
  floatingImages?: FloatingImage[];
  onFloatingImageUpdate?: (id: string, patch: Partial<FloatingImage>) => void;
}

const ELEMENT_LABELS: Record<ElementKey, string> = {
  badge: 'Badge',
  title: 'Títol',
  subtitle: 'Subtítol',
  button1: 'Botó 1',
  button2: 'Botó 2',
};

const FRAME_LABELS: Record<FloatingImage['frame'], string> = {
  none: 'Sense',
  white: 'Marc blanc',
  shadow: 'Ombra',
  polaroid: 'Polaroid',
  rounded: 'Arrodonida',
};

function frameStyle(fi: FloatingImage): React.CSSProperties {
  const base: React.CSSProperties = {
    width: '100%', height: '100%',
    opacity: fi.opacity,
    borderRadius: fi.rounded,
    overflow: 'hidden',
  };
  switch (fi.frame) {
    case 'white':
      return { ...base, background: '#fff', padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' };
    case 'shadow':
      return { ...base, boxShadow: '0 16px 40px rgba(0,0,0,0.25)' };
    case 'polaroid':
      return { ...base, background: '#fff', padding: '12px 12px 36px', boxShadow: '0 10px 28px rgba(0,0,0,0.2)' };
    case 'rounded':
      return { ...base, borderRadius: 9999 };
    default:
      return base;
  }
}

const HeroCanvasEditor: React.FC<Props> = ({
  layout, onLayoutChange, canvasHeights, onCanvasHeightsChange,
  backgroundUrl, overlay, content, floatingImages = [], onFloatingImageUpdate,
}) => {
  const [device, setDevice] = useState<Device>('desktop');
  const [selected, setSelected] = useState<string | null>('title');

  const W = CANVAS_WIDTH[device];
  const H = canvasHeights[device];
  const dl = layout[device] || {};

  const boxFor = (key: string): ElementBox => {
    if (key.startsWith('img:')) return dl[key] ?? DEFAULT_FLOATING_BOX;
    return dl[key] ?? DEFAULT_BOX[key as ElementKey];
  };

  const updateBox = (key: string, patch: Partial<ElementBox>) => {
    const current = boxFor(key);
    onLayoutChange({
      ...layout,
      [device]: { ...dl, [key]: { ...current, ...patch } },
    });
  };

  const toggleVisible = (key: string) => {
    const cur = boxFor(key);
    updateBox(key, { visible: cur.visible === false ? true : false });
  };

  const elementContent: Record<ElementKey, React.ReactNode> = {
    badge: <span className="px-3 py-1 rounded-full inline-block">{content.badge || 'Badge'}</span>,
    title: <span style={{ fontFamily: 'var(--font-display, serif)', lineHeight: 1.05 }}>{content.title || 'Títol del hero'}</span>,
    subtitle: <span style={{ lineHeight: 1.4 }}>{content.subtitle || 'Subtítol descriptiu del hero'}</span>,
    button1: <span className="inline-flex items-center justify-center w-full h-full rounded-full bg-primary text-primary-foreground font-medium">{content.button1 || 'Botó 1'}</span>,
    button2: <span className="inline-flex items-center justify-center w-full h-full rounded-full border-2 border-primary text-primary font-medium bg-background/80">{content.button2 || 'Botó 2'}</span>,
  };

  const selBox = selected ? boxFor(selected) : null;
  const selFloating = selected?.startsWith('img:') ? floatingImages.find(f => `img:${f.id}` === selected) : null;

  const allKeys: string[] = [
    ...(Object.keys(ELEMENT_LABELS) as ElementKey[]),
    ...floatingImages.map(f => `img:${f.id}`),
  ];

  const labelFor = (key: string): string => {
    if (key.startsWith('img:')) {
      const idx = floatingImages.findIndex(f => `img:${f.id}` === key);
      return `Imatge ${idx + 1}`;
    }
    return ELEMENT_LABELS[key as ElementKey];
  };

  return (
    <div className="space-y-4">
      {/* Device tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex rounded-lg border border-border bg-muted p-1">
          {([
            ['desktop', Monitor, 'PC'],
            ['tablet', Tablet, 'Tablet'],
            ['mobile', Smartphone, 'Mòbil'],
          ] as const).map(([d, Icon, label]) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                device === d ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs">Alçada canvas:</Label>
          <Input
            type="number"
            value={H}
            min={200}
            max={1200}
            className="w-24 h-8"
            onChange={(e) => onCanvasHeightsChange({ ...canvasHeights, [device]: parseInt(e.target.value) || 400 })}
          />
          <span className="text-xs text-muted-foreground">px</span>
        </div>
      </div>

      {/* Layers panel + canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        {/* Layers */}
        <div className="space-y-1 bg-muted/40 rounded-lg p-2 border border-border h-fit">
          <div className="text-xs font-semibold text-muted-foreground px-2 py-1">Elements</div>
          {allKeys.map((k) => {
            const box = boxFor(k);
            const isVisible = box.visible !== false;
            return (
              <div
                key={k}
                className={`flex items-center justify-between rounded-md px-2 py-1.5 cursor-pointer text-sm ${
                  selected === k ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted'
                }`}
                onClick={() => setSelected(k)}
              >
                <span className="truncate">{labelFor(k)}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleVisible(k); }}
                  className="text-muted-foreground hover:text-foreground"
                  title={isVisible ? 'Ocultar en aquest dispositiu' : 'Mostrar'}
                >
                  {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 opacity-50" />}
                </button>
              </div>
            );
          })}

          {selBox && selected && (
            <div className="mt-3 pt-3 border-t border-border space-y-2 px-1">
              <div className="text-xs font-semibold text-muted-foreground">Estil — {labelFor(selected)}</div>
              {(selected === 'title' || selected === 'subtitle' || selected === 'badge') && (
                <>
                  <div>
                    <Label className="text-xs">Mida (px)</Label>
                    <Input
                      type="number"
                      value={selBox.fontSize ?? 16}
                      className="h-7 text-xs"
                      onChange={(e) => updateBox(selected, { fontSize: parseInt(e.target.value) || 12 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Color text</Label>
                    <input
                      type="color"
                      value={selBox.color ?? '#000000'}
                      onChange={(e) => updateBox(selected, { color: e.target.value })}
                      className="w-full h-7 rounded border border-input"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Alineació</Label>
                    <select
                      value={selBox.textAlign ?? 'left'}
                      onChange={(e) => updateBox(selected, { textAlign: e.target.value as 'left' | 'center' | 'right' })}
                      className="w-full h-7 text-xs rounded border border-input bg-background px-2"
                    >
                      <option value="left">Esquerra</option>
                      <option value="center">Centre</option>
                      <option value="right">Dreta</option>
                    </select>
                  </div>
                </>
              )}

              {selFloating && onFloatingImageUpdate && (
                <>
                  <div>
                    <Label className="text-xs">Marc</Label>
                    <select
                      value={selFloating.frame}
                      onChange={(e) => onFloatingImageUpdate(selFloating.id, { frame: e.target.value as FloatingImage['frame'] })}
                      className="w-full h-7 text-xs rounded border border-input bg-background px-2"
                    >
                      {Object.entries(FRAME_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Arrodoniment ({selFloating.rounded}px)</Label>
                    <input type="range" min={0} max={400} value={selFloating.rounded}
                      onChange={(e) => onFloatingImageUpdate(selFloating.id, { rounded: parseInt(e.target.value) })}
                      className="w-full" />
                  </div>
                  <div>
                    <Label className="text-xs">Opacitat ({selFloating.opacity.toFixed(2)})</Label>
                    <input type="range" min={0} max={1} step={0.05} value={selFloating.opacity}
                      onChange={(e) => onFloatingImageUpdate(selFloating.id, { opacity: parseFloat(e.target.value) })}
                      className="w-full" />
                  </div>
                  <div>
                    <Label className="text-xs">Rotació ({selFloating.rotation}°)</Label>
                    <input type="range" min={-180} max={180} value={selFloating.rotation}
                      onChange={(e) => onFloatingImageUpdate(selFloating.id, { rotation: parseInt(e.target.value) })}
                      className="w-full" />
                  </div>
                  <div>
                    <Label className="text-xs">Capa (z-index)</Label>
                    <Input type="number" value={selFloating.zIndex} className="h-7 text-xs"
                      onChange={(e) => onFloatingImageUpdate(selFloating.id, { zIndex: parseInt(e.target.value) || 0 })} />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground pt-1">
                <span>x: {Math.round(selBox.x)}</span>
                <span>y: {Math.round(selBox.y)}</span>
                <span>w: {Math.round(selBox.w)}</span>
                <span>h: {Math.round(selBox.h)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="overflow-auto bg-muted/20 rounded-lg border border-border p-4">
          <div className="mx-auto" style={{ width: W }}>
            <div
              className="relative overflow-hidden rounded-lg border border-border shadow-soft"
              style={{
                width: W,
                height: H,
                backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
                backgroundColor: backgroundUrl ? undefined : 'hsl(var(--muted))',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              onClick={() => setSelected(null)}
            >
              {backgroundUrl && overlay > 0 && (
                <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: overlay }} />
              )}

              {/* Floating images */}
              {floatingImages.map((fi) => {
                const key = `img:${fi.id}`;
                const box = boxFor(key);
                if (box.visible === false) return null;
                const isSel = selected === key;
                return (
                  <Rnd
                    key={key}
                    bounds="parent"
                    size={{ width: box.w, height: box.h }}
                    position={{ x: box.x, y: box.y }}
                    onDragStop={(_e, d) => updateBox(key, { x: d.x, y: d.y })}
                    onResizeStop={(_e, _dir, ref, _delta, pos) =>
                      updateBox(key, { w: parseInt(ref.style.width), h: parseInt(ref.style.height), x: pos.x, y: pos.y })
                    }
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelected(key); }}
                    className={isSel ? 'ring-2 ring-primary' : 'ring-1 ring-transparent hover:ring-primary/40'}
                    style={{ zIndex: fi.zIndex, transform: `rotate(${fi.rotation}deg)` }}
                  >
                    <div style={frameStyle(fi)}>
                      {fi.url ? (
                        <img src={fi.url} alt={fi.alt || ''} className="w-full h-full object-cover" style={{ borderRadius: 'inherit' }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-muted">Sense imatge</div>
                      )}
                    </div>
                  </Rnd>
                );
              })}

              {/* Text/button elements */}
              {(Object.keys(ELEMENT_LABELS) as ElementKey[]).map((k) => {
                const box = boxFor(k);
                if (box.visible === false) return null;
                const isSel = selected === k;
                return (
                  <Rnd
                    key={k}
                    bounds="parent"
                    size={{ width: box.w, height: box.h }}
                    position={{ x: box.x, y: box.y }}
                    onDragStop={(_e, d) => updateBox(k, { x: d.x, y: d.y })}
                    onResizeStop={(_e, _dir, ref, _delta, pos) =>
                      updateBox(k, {
                        w: parseInt(ref.style.width),
                        h: parseInt(ref.style.height),
                        x: pos.x,
                        y: pos.y,
                      })
                    }
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelected(k); }}
                    className={`group ${isSel ? 'ring-2 ring-primary' : 'ring-1 ring-transparent hover:ring-primary/40'}`}
                    style={{ zIndex: isSel ? 9999 : 100 }}
                  >
                    <div
                      className="w-full h-full flex items-center"
                      style={{
                        fontSize: box.fontSize,
                        color: box.color,
                        backgroundColor: k === 'badge' ? box.bgColor : undefined,
                        textAlign: box.textAlign,
                        justifyContent:
                          box.textAlign === 'center' ? 'center' :
                          box.textAlign === 'right' ? 'flex-end' : 'flex-start',
                        borderRadius: k === 'badge' ? 9999 : (k === 'button1' || k === 'button2') ? 9999 : 0,
                        padding: k === 'badge' ? '0 12px' : 0,
                      }}
                    >
                      {elementContent[k]}
                    </div>
                  </Rnd>
                );
              })}
            </div>
            <div className="text-center mt-2 text-xs text-muted-foreground">
              {device.toUpperCase()} — {W} × {H}px
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroCanvasEditor;
