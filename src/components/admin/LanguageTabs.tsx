import React, { useEffect, useState } from 'react';
import { useLanguages, useDefaultLanguage } from '@/hooks/useLanguages';
import { cn } from '@/lib/utils';

interface LanguageTabsProps {
  value?: string;
  onChange?: (code: string) => void;
  /** Render-prop: receives the active language code. */
  children: (langCode: string) => React.ReactNode;
  className?: string;
}

/**
 * Renders a horizontal pill bar with one button per enabled language and
 * passes the active language code to the children render-prop.
 * Persists nothing — controlled or self-managed via internal state.
 */
const LanguageTabs: React.FC<LanguageTabsProps> = ({ value, onChange, children, className }) => {
  const { data: languages = [] } = useLanguages({ onlyEnabled: true });
  const { data: defaultLang } = useDefaultLanguage();
  const [internal, setInternal] = useState<string | null>(null);

  const active = value ?? internal ?? defaultLang?.code ?? languages[0]?.code ?? 'ca';

  useEffect(() => {
    if (!value && !internal && (defaultLang?.code || languages[0]?.code)) {
      setInternal(defaultLang?.code ?? languages[0].code);
    }
  }, [value, internal, defaultLang, languages]);

  const setActive = (code: string) => {
    if (onChange) onChange(code);
    else setInternal(code);
  };

  if (languages.length === 0) return <>{children('ca')}</>;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-1">
        {languages.map((lng) => {
          const isActive = lng.code === active;
          return (
            <button
              key={lng.code}
              type="button"
              onClick={() => setActive(lng.code)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="uppercase font-mono text-[10px]">{lng.code}</span>
              <span>{lng.native_name || lng.name}</span>
              {lng.is_default && (
                <span className="text-[9px] text-primary font-semibold">★</span>
              )}
            </button>
          );
        })}
      </div>
      <div>{children(active)}</div>
    </div>
  );
};

export default LanguageTabs;
