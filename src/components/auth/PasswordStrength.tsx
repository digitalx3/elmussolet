import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PasswordRule {
  key: string;
  label: string;
  test: (pwd: string) => boolean;
}

export const getPasswordRules = (t: (k: string) => string): PasswordRule[] => [
  { key: 'length', label: t('auth.passwordRules.length'), test: (p) => p.length >= 8 },
  { key: 'uppercase', label: t('auth.passwordRules.uppercase'), test: (p) => /[A-Z]/.test(p) },
  { key: 'lowercase', label: t('auth.passwordRules.lowercase'), test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: t('auth.passwordRules.number'), test: (p) => /\d/.test(p) },
  { key: 'special', label: t('auth.passwordRules.special'), test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export const getPasswordScore = (pwd: string, rules: PasswordRule[]) =>
  rules.reduce((acc, r) => acc + (r.test(pwd) ? 1 : 0), 0);

interface Props {
  password: string;
  className?: string;
}

const PasswordStrength: React.FC<Props> = ({ password, className }) => {
  const { t } = useTranslation();
  const rules = getPasswordRules(t);
  const score = getPasswordScore(password, rules);
  const total = rules.length;
  const pct = (score / total) * 100;

  const levelLabel =
    score <= 2
      ? t('auth.passwordStrength.weak')
      : score === 3
      ? t('auth.passwordStrength.fair')
      : score === 4
      ? t('auth.passwordStrength.good')
      : t('auth.passwordStrength.strong');

  const barColor =
    score <= 2
      ? 'bg-destructive'
      : score === 3
      ? 'bg-amber-500'
      : score === 4
      ? 'bg-yellow-500'
      : 'bg-green-600';

  return (
    <div className={cn('mt-2 space-y-2', className)} aria-live="polite">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full transition-all duration-300', barColor)}
          style={{ width: `${password ? pct : 0}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{t('auth.passwordStrength.label')}</span>
        <span className="font-medium">{password ? levelLabel : '—'}</span>
      </div>
      <ul className="space-y-1 text-xs">
        {rules.map((rule) => {
          const ok = rule.test(password);
          return (
            <li
              key={rule.key}
              className={cn(
                'flex items-center gap-2 transition-colors',
                ok ? 'text-green-700' : 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full border',
                  ok
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-muted-foreground/40 text-muted-foreground/60'
                )}
              >
                {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              </span>
              <span>{rule.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PasswordStrength;
