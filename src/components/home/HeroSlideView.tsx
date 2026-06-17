import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { CANVAS_WIDTH, DEFAULT_BOX, DEFAULT_FLOATING_BOX, Device, ElementBox, FloatingImage, Layout } from '@/components/admin/HeroCanvasEditor';

export type Slide = {
  id?: string;
  background_image_url: string | null;
  background_overlay: number;
  badge_text_ca: string | null; badge_text_es: string | null;
  title_ca: string | null; title_es: string | null;
  subtitle_ca: string | null; subtitle_es: string | null;
  button1_text_ca: string | null; button1_text_es: string | null;
  button1_url: string | null; button1_variant: string | null;
  button2_text_ca: string | null; button2_text_es: string | null;
  button2_url: string | null; button2_variant: string | null;
  layout: Layout;
  canvas_heights: Record<Device, number>;
  floating_images?: FloatingImage[];
};

function floatingFrameStyle(fi: FloatingImage): React.CSSProperties {
  const base: React.CSSProperties = {
    width: '100%', height: '100%',
    opacity: fi.opacity,
    borderRadius: fi.rounded,
    overflow: 'hidden',
  };
  switch (fi.frame) {
    case 'white':
      return { ...base, background: '#fff', padding: '4%', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' };
    case 'shadow':
      return { ...base, boxShadow: '0 16px 40px rgba(0,0,0,0.25)' };
    case 'polaroid':
      return { ...base, background: '#fff', padding: '5% 5% 15%', boxShadow: '0 10px 28px rgba(0,0,0,0.2)' };
    case 'rounded':
      return { ...base, borderRadius: 9999 };
    default:
      return base;
  }
}

interface Props {
  slide: Slide;
  device: Device;
  /** If true, button clicks are disabled (preview mode). */
  interactive?: boolean;
}

const HeroSlideView: React.FC<Props> = ({ slide, device, interactive = true }) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language?.startsWith('es') ? 'es' : 'ca';
  const pick = (ca: string | null, es: string | null) => (lang === 'es' ? es || ca : ca || es) ?? '';

  const layout = (slide.layout?.[device] ?? slide.layout?.desktop ?? {}) as Partial<Record<string, ElementBox>>;
  const canvasW = CANVAS_WIDTH[device];
  const canvasH = slide.canvas_heights?.[device] ?? 500;

  const get = (k: keyof typeof DEFAULT_BOX): ElementBox => (layout[k] ?? DEFAULT_BOX[k]);

  const items: Array<{ key: keyof typeof DEFAULT_BOX; node: React.ReactNode; box: ElementBox }> = [];

  const badgeText = pick(slide.badge_text_ca, slide.badge_text_es);
  if (badgeText) {
    const box = get('badge');
    if (box.visible !== false) items.push({
      key: 'badge', box,
      node: <span className="px-3 py-1 rounded-full inline-block" style={{ backgroundColor: box.bgColor }}>{badgeText}</span>,
    });
  }
  const titleText = pick(slide.title_ca, slide.title_es);
  if (titleText) {
    const box = get('title');
    if (box.visible !== false) items.push({
      key: 'title', box,
      node: <h1 className="font-display leading-[1.05] m-0" style={{ fontSize: 'inherit', color: 'inherit' }}>{titleText}</h1>,
    });
  }
  const subtitleText = pick(slide.subtitle_ca, slide.subtitle_es);
  if (subtitleText) {
    const box = get('subtitle');
    if (box.visible !== false) items.push({
      key: 'subtitle', box,
      node: <p className="m-0 leading-snug" style={{ fontSize: 'inherit', color: 'inherit' }}>{subtitleText}</p>,
    });
  }
  const btn1Text = pick(slide.button1_text_ca, slide.button1_text_es);
  if (btn1Text) {
    const box = get('button1');
    if (box.visible !== false) items.push({
      key: 'button1', box,
      node: (
        <Button
          variant={(slide.button1_variant as 'default' | 'outline' | 'secondary' | 'ghost') ?? 'default'}
          className="rounded-full w-full h-full"
          onClick={() => interactive && slide.button1_url && navigate(slide.button1_url)}
        >
          {btn1Text}
        </Button>
      ),
    });
  }
  const btn2Text = pick(slide.button2_text_ca, slide.button2_text_es);
  if (btn2Text) {
    const box = get('button2');
    if (box.visible !== false) items.push({
      key: 'button2', box,
      node: (
        <Button
          variant={(slide.button2_variant as 'default' | 'outline' | 'secondary' | 'ghost') ?? 'outline'}
          className="rounded-full w-full h-full"
          onClick={() => interactive && slide.button2_url && navigate(slide.button2_url)}
        >
          {btn2Text}
        </Button>
      ),
    });
  }

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: `${canvasW} / ${canvasH}`,
        backgroundImage: slide.background_image_url ? `url(${slide.background_image_url})` : undefined,
        backgroundColor: slide.background_image_url ? undefined : 'hsl(var(--secondary))',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        containerType: 'inline-size',
      }}
    >
      {slide.background_image_url && slide.background_overlay > 0 && (
        <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: slide.background_overlay }} />
      )}
      <div className="absolute inset-0">
        {(slide.floating_images ?? []).map((fi) => {
          const box: ElementBox = (layout[`img:${fi.id}`] ?? DEFAULT_FLOATING_BOX);
          if (box.visible === false || !fi.url) return null;
          const leftPct = (box.x / canvasW) * 100;
          const topPct = (box.y / canvasH) * 100;
          const widthPct = (box.w / canvasW) * 100;
          const heightPct = (box.h / canvasH) * 100;
          return (
            <div
              key={`img:${fi.id}`}
              className="absolute"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                zIndex: fi.zIndex,
                transform: `rotate(${fi.rotation}deg)`,
              }}
            >
              <div style={floatingFrameStyle(fi)}>
                <img src={fi.url} alt={fi.alt || ''} className="w-full h-full object-cover" style={{ borderRadius: 'inherit' }} />
              </div>
            </div>
          );
        })}
        {items.map((it) => {
          const leftPct = (it.box.x / canvasW) * 100;
          const topPct = (it.box.y / canvasH) * 100;
          const widthPct = (it.box.w / canvasW) * 100;
          const heightPct = (it.box.h / canvasH) * 100;
          const fontSizeStyle = it.box.fontSize
            ? `clamp(10px, ${(it.box.fontSize / canvasW) * 100}cqw, ${it.box.fontSize * 1.2}px)`
            : undefined;
          return (
            <div
              key={it.key}
              className="absolute flex items-center"
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                fontSize: fontSizeStyle,
                color: it.box.color,
                textAlign: it.box.textAlign,
                zIndex: 100,
                justifyContent:
                  it.box.textAlign === 'center' ? 'center' :
                  it.box.textAlign === 'right' ? 'flex-end' : 'flex-start',
              }}
            >
              <div className="w-full" style={{ textAlign: it.box.textAlign }}>
                {it.node}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default HeroSlideView;
