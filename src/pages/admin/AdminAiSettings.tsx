import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, KeyRound, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAiProvider, type AiProvider } from '@/hooks/useAiProvider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const PROVIDERS: { id: AiProvider; label: string; description: string; secretName?: string; secretUrl?: string }[] = [
  {
    id: 'lovable',
    label: 'CIBAI (recomanat)',
    description: "Inclòs amb la plataforma. No requereix configurar cap clau. Accés a models Gemini, GPT i Claude pagant per ús a través de CIBAI.",
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: "Utilitza el teu compte d'OpenAI amb el model gpt-4o-mini.",
    secretName: 'OPENAI_API_KEY',
    secretUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    description: "Utilitza el teu compte d'Anthropic amb Claude 3.5 Sonnet/Haiku.",
    secretName: 'ANTHROPIC_API_KEY',
    secretUrl: 'https://console.anthropic.com/settings/keys',
  },
];

const AdminAiSettings: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: status, isLoading, refetch } = useAiProvider();
  const [selected, setSelected] = useState<AiProvider>('lovable');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status?.provider) setSelected(status.provider);
  }, [status?.provider]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'ai_provider', value: selected }, { onConflict: 'key' });
    setSaving(false);
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: t('admin.aiProviderSaved', "Proveïdor d'IA actualitzat") });
    qc.invalidateQueries({ queryKey: ['ai-provider-status'] });
    refetch();
  };

  const availability = status?.available ?? { lovable: false, openai: false, anthropic: false };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          {t('admin.aiSettingsTitle', "Configuració d'IA")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('admin.aiSettingsDesc', "Tria quin proveïdor s'utilitzarà per a les funcions amb IA: traducció automàtica d'idiomes i generació de descripcions SEO de productes.")}
        </p>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">{t('common.loading')}</div>
      ) : (
        <div className="space-y-3">
          {PROVIDERS.map(p => {
            const isActive = selected === p.id;
            const isAvailable = availability[p.id];
            return (
              <label
                key={p.id}
                className={`block border rounded-md p-4 cursor-pointer transition ${
                  isActive ? 'border-primary bg-primary/5' : 'hover:border-primary/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="provider"
                    value={p.id}
                    checked={isActive}
                    onChange={() => setSelected(p.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{p.label}</span>
                      {isAvailable ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t('admin.aiKeyConfigured', 'Configurat')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <XCircle className="h-3.5 w-3.5" />
                          {t('admin.aiKeyMissing', 'Sense clau')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                    {p.secretName && (
                      <div className="mt-2 text-xs flex items-center gap-2 text-muted-foreground">
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>
                          {t('admin.aiSecretHint', 'Cal definir el secret')}{' '}
                          <code className="bg-muted px-1 py-0.5 rounded">{p.secretName}</code>
                          {p.secretUrl && (
                            <>
                              {' · '}
                              <a className="underline" href={p.secretUrl} target="_blank" rel="noreferrer">
                                {t('admin.aiSecretGet', 'on obtenir la clau')}
                              </a>
                            </>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {selected !== 'lovable' && !availability[selected] && (
        <div className="border border-amber-200 bg-amber-50 text-amber-900 rounded-md p-3 text-sm flex gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            {t('admin.aiKeyMissingWarn', "Aquest proveïdor està seleccionat però no té cap clau configurada. Els botons \"Traduir amb IA\" i \"Generar descripció SEO\" estaran desactivats fins que un administrador hi afegeixi la clau corresponent als secrets de la plataforma.")}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || selected === status?.provider}>
          {saving ? t('common.saving', 'Desant…') : t('common.save', 'Desar')}
        </Button>
      </div>
    </div>
  );
};

export default AdminAiSettings;
