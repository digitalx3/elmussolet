import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ElementStyle {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  letterSpacing?: string;
}

export interface ColorConfig {
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  accent?: string;
  accentForeground?: string;
  background?: string;
  foreground?: string;
  border?: string;
}

export interface AppearanceConfig {
  bodyFont?: string;
  headingFont?: string;
  loadGoogleFonts?: string; // e.g. "Inter:wght@400;600|Playfair+Display:wght@700"
  colors?: ColorConfig;
  elements?: Record<string, ElementStyle>;
  customCss?: string;
  customJsHead?: string;
  customJsFooter?: string;
}

const STYLE_ID = 'appearance-style';
const FONTS_ID = 'appearance-fonts';
const JS_HEAD_ID = 'appearance-js-head';
const JS_FOOTER_ID = 'appearance-js-footer';

/**
 * Accepts: "#rrggbb", "rgb(...)", "hsl(h s% l%)", or "h s% l%" (bare HSL triple).
 * Returns a bare HSL triple suitable for `hsl(var(--token))`.
 * Returns null if it can't parse.
 */
function toHslTriple(input: string): string | null {
  if (!input) return null;
  const v = input.trim();
  // Bare HSL triple already
  if (/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(v)) return v;
  // hsl(...)
  const hslMatch = v.match(/^hsl\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%\s*\)$/i);
  if (hslMatch) return `${hslMatch[1]} ${hslMatch[2]}% ${hslMatch[3]}%`;
  // Hex
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

const COLOR_MAP: { key: keyof ColorConfig; cssVar: string }[] = [
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

function buildCss(cfg: AppearanceConfig): string {
  const lines: string[] = [];

  // Colors → override CSS variables on :root
  const colorDecls: string[] = [];
  for (const { key, cssVar } of COLOR_MAP) {
    const raw = cfg.colors?.[key];
    if (!raw) continue;
    const hsl = toHslTriple(raw);
    if (hsl) colorDecls.push(`${cssVar}: ${hsl}`);
  }
  if (colorDecls.length) lines.push(`:root { ${colorDecls.join('; ')}; }`);

  if (cfg.bodyFont) {
    lines.push(`body, body p, body span, body li, body td, body input, body button, body textarea { font-family: '${cfg.bodyFont}', system-ui, sans-serif; }`);
  }
  if (cfg.headingFont) {
    lines.push(`h1, h2, h3, h4, h5, h6, .font-display { font-family: '${cfg.headingFont}', serif !important; }`);
  }
  const els = cfg.elements ?? {};
  for (const [sel, s] of Object.entries(els)) {
    const decls: string[] = [];
    if (s.fontFamily) decls.push(`font-family: '${s.fontFamily}', inherit !important`);
    if (s.fontSize) decls.push(`font-size: ${s.fontSize} !important`);
    if (s.fontWeight) decls.push(`font-weight: ${s.fontWeight} !important`);
    if (s.color) decls.push(`color: ${s.color} !important`);
    if (s.letterSpacing) decls.push(`letter-spacing: ${s.letterSpacing} !important`);
    if (decls.length) lines.push(`${sel}, .${sel}-style { ${decls.join('; ')}; }`);
  }
  if (cfg.customCss) lines.push(cfg.customCss);
  return lines.join('\n');
}

function injectScript(id: string, code: string, where: 'head' | 'body') {
  document.getElementById(id)?.remove();
  if (!code?.trim()) return;
  // Allow raw HTML (e.g. <script src="..."> snippets) or JS body
  const container = document.createElement('div');
  container.id = id;
  container.style.display = 'none';
  if (/<script|<noscript|<link|<meta/i.test(code)) {
    container.innerHTML = code;
    (where === 'head' ? document.head : document.body).appendChild(container);
    // Re-create script tags so they execute
    container.querySelectorAll('script').forEach(old => {
      const s = document.createElement('script');
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      s.text = old.textContent ?? '';
      old.replaceWith(s);
    });
  } else {
    const s = document.createElement('script');
    s.id = id;
    s.text = code;
    (where === 'head' ? document.head : document.body).appendChild(s);
  }
}

export const AppearanceInjector: React.FC = () => {
  const { data } = useQuery({
    queryKey: ['appearance-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'appearance_config')
        .maybeSingle();
      if (error) throw error;
      if (!data?.value) return null;
      try { return JSON.parse(data.value) as AppearanceConfig; } catch { return null; }
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data) return;

    // Google Fonts
    let fontsLink = document.getElementById(FONTS_ID) as HTMLLinkElement | null;
    if (data.loadGoogleFonts?.trim()) {
      const families = data.loadGoogleFonts.split('|').map(f => `family=${f.trim()}`).join('&');
      const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
      if (!fontsLink) {
        fontsLink = document.createElement('link');
        fontsLink.id = FONTS_ID;
        fontsLink.rel = 'stylesheet';
        document.head.appendChild(fontsLink);
      }
      if (fontsLink.href !== href) fontsLink.href = href;
    } else {
      fontsLink?.remove();
    }

    // CSS
    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = buildCss(data);

    // JS
    injectScript(JS_HEAD_ID, data.customJsHead ?? '', 'head');
    injectScript(JS_FOOTER_ID, data.customJsFooter ?? '', 'body');
  }, [data]);

  return null;
};

export default AppearanceInjector;
