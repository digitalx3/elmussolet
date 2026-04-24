import React from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Gift, ShoppingBag, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PublicListStep = 'access' | 'view' | 'buy';

interface Props {
  current: PublicListStep;
}

const PublicListSteps: React.FC<Props> = ({ current }) => {
  const { t } = useTranslation();

  const steps: Array<{ key: PublicListStep; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'access', label: t('list.stepAccess'), Icon: KeyRound },
    { key: 'view', label: t('list.stepView'), Icon: Gift },
    { key: 'buy', label: t('list.stepBuy'), Icon: ShoppingBag },
  ];

  const currentIndex = steps.findIndex(s => s.key === current);

  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-center gap-2 sm:gap-4">
        {steps.map((step, idx) => {
          const isActive = idx === currentIndex;
          const isComplete = idx < currentIndex;
          const Icon = step.Icon;

          return (
            <React.Fragment key={step.key}>
              <li className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                    isActive && 'border-primary bg-primary text-primary-foreground',
                    isComplete && 'border-primary bg-primary/10 text-primary',
                    !isActive && !isComplete && 'border-border bg-muted text-muted-foreground',
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isComplete ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span
                  className={cn(
                    'text-xs sm:text-sm font-medium text-center',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </li>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-8 sm:w-16 -mt-6 transition-colors',
                    idx < currentIndex ? 'bg-primary' : 'bg-border',
                  )}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default PublicListSteps;
