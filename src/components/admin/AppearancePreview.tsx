import React, { useEffect, useId } from 'react';
import type { AppearanceConfig, ColorConfig } from '@/components/AppearanceInjector';

interface Props { config: AppearanceConfig }

function toHslTriple(input: string): string | null {
  if (!input) return null;
  const v = input.trim();
  if (/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(v)) return v;
  const hslMatch = v.match(/^hsl\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%\s*\)$/i);
  if (hslMatch) return `${hslMatch[1]} ${hslMatch[2]}% ${hslMatch[3]}%`;
  const hexMatch = v.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }
  return null;
}

const COLOR_VARS: { key: keyof ColorConfig; cssVar: string }[] = [
  { key: 'primary', cssVar: '--primary' },
  { key: 'primaryForeground', cssVar: '--primary-foreground' },
  { key: 'secondary', cssVar: '--secondary' },
  { key: 'secondaryForeground', cssVar: '--secondary-foreground' },
  { key: 'accent', cssVar: '--accent' },
  { key: 'accentForeground', cssVar: '--accent-foreground' },
  { key: 'background', cssVar: '--background' },
  { key: 'foreground', cssVar: '--foreground' },
  { key: 'border', cssVar: '--border' },
];

function buildScopedCss(scope: string, cfg: AppearanceConfig): string {
  const lines: string[] = [];

  // Colors: scope-level overrides so preview can show them isolated
  const colorDecls: string[] = [];
  for (const { key, cssVar } of COLOR_VARS) {
    const raw = cfg.colors?.[key];
    if (!raw) continue;
    const hsl = toHslTriple(raw);
    if (hsl) colorDecls.push(`${cssVar}: ${hsl}`);
  }
  if (colorDecls.length) lines.push(`${scope} { ${colorDecls.join('; ')}; background-color: hsl(var(--background)); color: hsl(var(--foreground)); }`);

  if (cfg.bodyFont) lines.push(`${scope} { font-family: '${cfg.bodyFont}', system-ui, sans-serif; }`);
  if (cfg.headingFont) lines.push(`${scope} h1, ${scope} h2, ${scope} h3, ${scope} h4, ${scope} h5, ${scope} h6, ${scope} .font-display { font-family: '${cfg.headingFont}', serif; }`);
  for (const [sel, s] of Object.entries(cfg.elements ?? {})) {
    const decls: string[] = [];
    if (s.fontFamily) decls.push(`font-family: '${s.fontFamily}', inherit`);
    if (s.fontSize) decls.push(`font-size: ${s.fontSize}`);
    if (s.fontWeight) decls.push(`font-weight: ${s.fontWeight}`);
    if (s.color) decls.push(`color: ${s.color}`);
    if (s.letterSpacing) decls.push(`letter-spacing: ${s.letterSpacing}`);
    if (decls.length) lines.push(`${scope} ${sel} { ${decls.join('; ')} !important; }`);
  }
  if (cfg.customCss) lines.push(cfg.customCss);
  return lines.join('\n');
}

export const AppearancePreview: React.FC<Props> = ({ config }) => {
  const rawId = useId();
  const cls = 'ap-' + rawId.replace(/[^a-zA-Z0-9]/g, '');
  const scope = `.${cls}`;

  useEffect(() => {
    if (!config.loadGoogleFonts?.trim()) return;
    const families = config.loadGoogleFonts.split('|').map(f => `family=${f.trim()}`).join('&');
    const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    const linkId = `appearance-preview-fonts-${cls}`;
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [config.loadGoogleFonts, cls]);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      <div className="px-4 py-2 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Vista prèvia en directe
      </div>
      <style>{buildScopedCss(scope, config)}</style>
      <div className={`${cls} p-6 space-y-4`}>
        <h1>Títol H1 d'exemple</h1>
        <h2>Títol H2 d'exemple</h2>
        <h3>Títol H3 d'exemple</h3>
        <p>
          Aquest és un paràgraf d'exemple per veure com es veu el text del cos.
          Inclou un <a href="#" onClick={e => e.preventDefault()} style={{ color: 'hsl(var(--primary))' }}>enllaç d'exemple</a>.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <button className="px-4 py-2 rounded-md text-sm font-semibold" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>Botó primari</button>
          <button className="px-4 py-2 rounded-md text-sm font-semibold" style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' }}>Botó secundari</button>
          <button className="px-4 py-2 rounded-md text-sm font-semibold" style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>Botó accent</button>
        </div>
      </div>
    </div>
  );
};

export default AppearancePreview;
