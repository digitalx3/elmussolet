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

export interface AppearanceConfig {
  bodyFont?: string;
  headingFont?: string;
  loadGoogleFonts?: string; // e.g. "Inter:wght@400;600|Playfair+Display:wght@700"
  elements?: Record<string, ElementStyle>;
  customCss?: string;
  customJsHead?: string;
  customJsFooter?: string;
}

const STYLE_ID = 'appearance-style';
const FONTS_ID = 'appearance-fonts';
const JS_HEAD_ID = 'appearance-js-head';
const JS_FOOTER_ID = 'appearance-js-footer';

function buildCss(cfg: AppearanceConfig): string {
  const lines: string[] = [];
  if (cfg.bodyFont) {
    lines.push(`body { font-family: '${cfg.bodyFont}', system-ui, sans-serif; }`);
  }
  if (cfg.headingFont) {
    lines.push(`h1,h2,h3,h4,h5,h6,.font-display { font-family: '${cfg.headingFont}', serif; }`);
  }
  const els = cfg.elements ?? {};
  for (const [sel, s] of Object.entries(els)) {
    const decls: string[] = [];
    if (s.fontFamily) decls.push(`font-family: '${s.fontFamily}', inherit`);
    if (s.fontSize) decls.push(`font-size: ${s.fontSize}`);
    if (s.fontWeight) decls.push(`font-weight: ${s.fontWeight}`);
    if (s.color) decls.push(`color: ${s.color}`);
    if (s.letterSpacing) decls.push(`letter-spacing: ${s.letterSpacing}`);
    if (decls.length) lines.push(`${sel} { ${decls.join('; ')}; }`);
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
