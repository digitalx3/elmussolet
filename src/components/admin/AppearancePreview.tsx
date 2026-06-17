import React, { useEffect, useId } from 'react';
import type { AppearanceConfig } from '@/components/AppearanceInjector';

interface Props { config: AppearanceConfig }

function buildScopedCss(scope: string, cfg: AppearanceConfig): string {
  const lines: string[] = [];
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
      <div className={`${cls} p-6 space-y-3`}>
        <h1>Títol H1 d'exemple</h1>
        <h2>Títol H2 d'exemple</h2>
        <h3>Títol H3 d'exemple</h3>
        <h4>Títol H4 d'exemple</h4>
        <p>
          Aquest és un paràgraf d'exemple per veure com es veu el text del cos.
          Inclou un <a href="#" onClick={e => e.preventDefault()}>enllaç d'exemple</a> per validar l'estil.
        </p>
        <p className="text-sm">Una segona línia de paràgraf més curta amb informació addicional.</p>
      </div>
    </div>
  );
};

export default AppearancePreview;
