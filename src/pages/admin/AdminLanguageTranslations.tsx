import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sparkles, Save, Search, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import i18n from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import { useLanguages } from '@/hooks/useLanguages';
import { useAiProvider, isAiReady } from '@/hooks/useAiProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import ca from '@/locales/ca.json';
import es from '@/locales/es.json';
import { flattenTranslations, type FlatTranslations } from '@/lib/translationFlatten';
import { invokeWithRetry, logAiTranslation } from '@/lib/aiTranslationLog';

const BUNDLED: Record<string, FlatTranslations> = {
  ca: flattenTranslations(ca),
  es: flattenTranslations(es),
};

// Dynamic content tables we know how to translate in batch.
// Each entry maps target column -> source column from the default-language row.
type DynTable = {
  table: string;
  fkColumn: string;        // FK to its parent (product_id, brand_id...)
  langColumn: string;      // language column (default 'language')
  fields: { source: string; target: string; col: string }[]; // col is the actual column name
  label: string;
};
const DYNAMIC_TABLES: DynTable[] = [
  { table: 'product_translations', fkColumn: 'product_id', langColumn: 'language', label: 'Productes',
    fields: [
      { col: 'name', source: 'name', target: 'name' },
      { col: 'short_description', source: 'short_description', target: 'short_description' },
      { col: 'description', source: 'description', target: 'description' },
    ] },
  { table: 'category_translations', fkColumn: 'category_id', langColumn: 'language', label: 'Categories',
    fields: [{ col: 'name', source: 'name', target: 'name' }] },
  { table: 'brand_translations', fkColumn: 'brand_id', langColumn: 'language', label: 'Marques',
    fields: [{ col: 'name', source: 'name', target: 'name' }] },
  { table: 'list_section_translations', fkColumn: 'section_id', langColumn: 'language', label: 'Famílies de llistes',
    fields: [{ col: 'name', source: 'name', target: 'name' }] },
  { table: 'default_list_section_translations', fkColumn: 'section_id', langColumn: 'language', label: 'Famílies per defecte',
    fields: [{ col: 'name', source: 'name', target: 'name' }] },
  { table: 'variant_type_translations', fkColumn: 'variant_type_id', langColumn: 'language', label: 'Tipus de variants',
    fields: [{ col: 'name', source: 'name', target: 'name' }] },
  { table: 'order_status_translations', fkColumn: 'status_id', langColumn: 'language', label: 'Estats de comanda',
    fields: [{ col: 'label', source: 'label', target: 'label' }] },
];

const AdminLanguageTranslations: React.FC = () => {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = (rawCode || '').toLowerCase();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: languages = [] } = useLanguages({ onlyEnabled: false });
  const { data: aiStatus } = useAiProvider();
  const aiReady = isAiReady(aiStatus);

  const lang = languages.find(l => l.code === code);
  const defaultLang = languages.find(l => l.is_default) || languages[0];
  const defaultCode = defaultLang?.code || 'ca';

  // ---- UI strings ----
  const sourceFlat: FlatTranslations = useMemo(() => {
    return BUNDLED[defaultCode] || BUNDLED.ca;
  }, [defaultCode]);

  const sourceKeys = useMemo(() => Object.keys(sourceFlat).sort(), [sourceFlat]);

  const [uiValues, setUiValues] = useState<Record<string, string>>({});
  const [uiLoaded, setUiLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'empty' | 'filled'>('all');
  const [savingUi, setSavingUi] = useState(false);
  const [translatingUi, setTranslatingUi] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [uiProgress, setUiProgress] = useState<{ done: number; total: number; errors: number } | null>(null);
  const [dynProgress, setDynProgress] = useState<{ table: string; done: number; total: number; errors: number } | null>(null);
  const [lastSummary, setLastSummary] = useState<
    | null
    | {
        scope: string;
        label: string;
        translated: number;
        failed: number;
        total: number;
        durationMs: number;
        error?: string;
      }
  >(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Start with bundled translations as default values for ca/es (so admin can edit them), empty otherwise
      const seed: Record<string, string> = {};
      const bundled = BUNDLED[code];
      if (bundled) {
        for (const k of sourceKeys) seed[k] = bundled[k] || '';
      } else {
        for (const k of sourceKeys) seed[k] = '';
      }
      const { data } = await supabase
        .from('ui_translations')
        .select('key,value')
        .eq('language_code', code);
      if (!alive) return;
      for (const row of data || []) seed[row.key] = row.value || '';
      setUiValues(seed);
      setUiLoaded(true);
    })();
    return () => { alive = false; };
  }, [code, sourceKeys]);

  const filteredKeys = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sourceKeys.filter(k => {
      if (q && !k.toLowerCase().includes(q) && !(sourceFlat[k] || '').toLowerCase().includes(q) && !(uiValues[k] || '').toLowerCase().includes(q)) return false;
      const isEmpty = !(uiValues[k] || '').trim();
      if (filter === 'empty' && !isEmpty) return false;
      if (filter === 'filled' && isEmpty) return false;
      return true;
    });
  }, [sourceKeys, search, filter, uiValues, sourceFlat]);

  const emptyCount = useMemo(() => sourceKeys.filter(k => !(uiValues[k] || '').trim()).length, [sourceKeys, uiValues]);

  const saveUi = async () => {
    setSavingUi(true);
    // Only persist non-empty values to avoid overwriting bundle fallback with empty
    const rows = Object.entries(uiValues)
      .filter(([, v]) => v && v.trim())
      .map(([key, value]) => ({ language_code: code, key, value, ai_generated: false }));
    if (rows.length === 0) {
      setSavingUi(false);
      toast({ title: t('admin.aiTrNothingToSave', 'No hi ha res a desar'), variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('ui_translations')
      .upsert(rows, { onConflict: 'language_code,key' });
    setSavingUi(false);
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: t('admin.aiTrUiSaved', 'Traduccions de la interfície desades') });
    // Reload i18n bundle for this language
    try {
      const { unflattenTranslations } = await import('@/lib/translationFlatten');
      const resource = unflattenTranslations(uiValues);
      i18n.addResourceBundle(code, 'translation', resource, true, true);
    } catch (e) {
      console.warn('i18n reload failed', e);
    }
  };

  // Chunked client-side translation with progress + per-chunk retry.
  const CHUNK = 30;
  async function translateChunked(
    items: string[],
    scope: string,
    contextLabel: string,
    onProgress: (done: number, errors: number) => void,
  ): Promise<{ translations: string[]; errors: number }> {
    const out: string[] = new Array(items.length).fill('');
    let errors = 0;
    let lastError = '';
    const started = Date.now();
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      try {
        const data: any = await invokeWithRetry('ai-translate', {
          items: chunk,
          source_language: defaultCode,
          target_language: code,
          context: contextLabel,
          scope,
        });
        const translations: string[] = data?.translations || [];
        translations.forEach((tr, j) => { out[i + j] = tr ?? ''; });
      } catch (e: any) {
        errors += chunk.length;
        lastError = String(e?.message || e);
        console.error('chunk failed', e);
      }
      onProgress(Math.min(i + chunk.length, items.length), errors);
    }
    // Edge function already logs each call; client logs one overall summary for the operation
    await logAiTranslation({
      function_name: 'ai-translate',
      scope: `${scope}:summary`,
      source_language: defaultCode,
      target_language: code,
      items_count: items.length,
      success_count: items.length - errors,
      error_count: errors,
      status: errors === 0 ? 'success' : (errors === items.length ? 'error' : 'partial'),
      error_message: errors > 0 ? lastError.slice(0, 500) : null,
      duration_ms: Date.now() - started,
      metadata: { chunk_size: CHUNK, chunks: Math.ceil(items.length / CHUNK) },
    });
    return { translations: out, errors };
  }

  const aiTranslateUi = async (onlyEmpty: boolean) => {
    if (!aiReady) {
      toast({ title: t('admin.aiNotReady', "Configura primer un proveïdor d'IA"), variant: 'destructive' });
      return;
    }
    const targets = sourceKeys.filter(k => (onlyEmpty ? !(uiValues[k] || '').trim() : true));
    if (targets.length === 0) {
      toast({ title: t('admin.aiTrNothingToTranslate', 'No hi ha res a traduir') });
      return;
    }
    setTranslatingUi(true);
    setUiProgress({ done: 0, total: targets.length, errors: 0 });
    setLastSummary(null);
    const started = Date.now();
    try {
      const items = targets.map(k => sourceFlat[k] || '');
      const { translations, errors } = await translateChunked(
        items,
        'ui',
        `Ecommerce UI strings (baby & childcare). Keys e.g. ${targets.slice(0, 3).join(', ')}`,
        (done, err) => setUiProgress({ done, total: items.length, errors: err }),
      );
      const next = { ...uiValues };
      targets.forEach((k, i) => { if (translations[i]) next[k] = translations[i]; });
      setUiValues(next);
      const translated = items.length - errors;
      setLastSummary({
        scope: 'ui',
        label: t('admin.aiTrTabUi', 'Interfície'),
        translated,
        failed: errors,
        total: items.length,
        durationMs: Date.now() - started,
      });
      if (errors > 0) {
        toast({
          title: `Traducció parcial: ${translated}/${items.length}. ${errors} amb errors.`,
          variant: 'destructive',
        });
      } else {
        toast({ title: t('admin.aiTrUiDone', `${translated} cadenes traduïdes amb IA`) });
      }
    } catch (e: any) {
      const msg = e?.message || 'Error';
      setLastSummary({
        scope: 'ui',
        label: t('admin.aiTrTabUi', 'Interfície'),
        translated: 0,
        failed: targets.length,
        total: targets.length,
        durationMs: Date.now() - started,
        error: msg,
      });
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setTranslatingUi(false);
      setTimeout(() => setUiProgress(null), 1500);
    }
  };

  // ---- Dynamic content batch translation ----
  const translateDynamic = async (def: DynTable) => {
    if (!aiReady) {
      toast({ title: t('admin.aiNotReady', "Configura primer un proveïdor d'IA"), variant: 'destructive' });
      return;
    }
    setAiBusy(def.table);
    setDynProgress({ table: def.table, done: 0, total: 0, errors: 0 });
    setLastSummary(null);
    const started = Date.now();
    try {
      const cols = ['id', def.fkColumn, ...def.fields.map(f => f.col)];
      const { data: sourceRows, error: srcErr } = await supabase
        .from(def.table as any)
        .select(cols.join(','))
        .eq(def.langColumn, defaultCode);
      if (srcErr) throw srcErr;
      const { data: targetRows, error: tgtErr } = await supabase
        .from(def.table as any)
        .select(`${def.fkColumn}`)
        .eq(def.langColumn, code);
      if (tgtErr) throw tgtErr;

      const existing = new Set((targetRows || []).map((r: any) => r[def.fkColumn]));
      const missing = (sourceRows || []).filter((r: any) => !existing.has(r[def.fkColumn]));

      if (missing.length === 0) {
        toast({ title: t('admin.aiTrNoMissing', 'Tot ja està traduït') });
        setDynProgress(null);
        return;
      }

      const flatItems: string[] = [];
      const map: { rowIdx: number; field: string }[] = [];
      missing.forEach((r: any, rowIdx: number) => {
        def.fields.forEach(f => {
          const val = String(r[f.col] || '');
          if (val.trim()) {
            map.push({ rowIdx, field: f.col });
            flatItems.push(val);
          }
        });
      });

      if (flatItems.length === 0) {
        toast({ title: t('admin.aiTrNoMissing', 'No hi ha contingut origen per traduir') });
        setDynProgress(null);
        return;
      }

      setDynProgress({ table: def.table, done: 0, total: flatItems.length, errors: 0 });
      const { translations, errors } = await translateChunked(
        flatItems,
        def.table,
        `Ecommerce ${def.label}. Some fields contain HTML; preserve tags.`,
        (done, err) => setDynProgress({ table: def.table, done, total: flatItems.length, errors: err }),
      );

      const updates: Record<number, Record<string, string>> = {};
      map.forEach((m, i) => {
        updates[m.rowIdx] = updates[m.rowIdx] || {};
        updates[m.rowIdx][m.field] = translations[i] || '';
      });

      const insertRows = missing
        .map((r: any, idx: number) => {
          const base: any = { [def.fkColumn]: r[def.fkColumn], [def.langColumn]: code };
          const fields = updates[idx] || {};
          for (const f of def.fields) base[f.col] = fields[f.col] ?? r[f.col] ?? '';
          // Skip rows where no field got translated (full failure)
          const hasContent = def.fields.some(f => (base[f.col] || '').toString().trim());
          return hasContent ? base : null;
        })
        .filter(Boolean);

      if (insertRows.length > 0) {
        const { error: insErr } = await supabase.from(def.table as any).insert(insertRows);
        if (insErr) throw insErr;
      }

      setLastSummary({
        scope: def.table,
        label: def.label,
        translated: insertRows.length,
        failed: missing.length - insertRows.length,
        total: missing.length,
        durationMs: Date.now() - started,
        error: errors > 0 ? `${errors} camp(s) sense traduir` : undefined,
      });

      if (errors > 0) {
        toast({
          title: `${insertRows.length}/${missing.length} ${def.label.toLowerCase()} traduïts. ${errors} camps fallits.`,
          variant: 'destructive',
        });
      } else {
        toast({ title: `${insertRows.length} ${def.label.toLowerCase()} traduïts amb IA` });
      }
    } catch (e: any) {
      const msg = e?.message || 'Error';
      setLastSummary({
        scope: def.table,
        label: def.label,
        translated: 0,
        failed: 0,
        total: 0,
        durationMs: Date.now() - started,
        error: msg,
      });
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setAiBusy(null);
      setTimeout(() => setDynProgress(null), 1500);
    }
  };


  if (!lang) {
    return (
      <div className="space-y-4">
        <Link to="/admin/idiomes" className="inline-flex items-center text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('common.back', 'Tornar')}
        </Link>
        <p>{t('admin.aiTrLangNotFound', 'Idioma no trobat.')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/idiomes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('admin.languagesTitle', 'Idiomes')}
        </Link>
        <h1 className="font-display text-2xl font-bold">
          {t('admin.aiTrTitle', 'Traduccions')}: {lang.native_name} <span className="text-muted-foreground font-mono text-base">({code})</span>
        </h1>
        <p className="text-muted-foreground text-sm">
          {t('admin.aiTrDesc', 'Edita manualment cada cadena o utilitza la IA per traduir-ho tot automàticament. Origen:')} <strong>{defaultLang?.native_name} ({defaultCode})</strong>
        </p>
        {!aiReady && (
          <div className="mt-3 border border-amber-200 bg-amber-50 text-amber-900 rounded-md p-3 text-sm">
            {t('admin.aiTrNotReady', "Per habilitar els botons \"Traduir amb IA\" configura un proveïdor d'IA a")}{' '}
            <Link to="/admin/ia" className="underline font-medium">{t('admin.aiSettingsTitle', "Configuració d'IA")}</Link>.
          </div>
        )}
      </div>

      {code === defaultCode && (
        <div className="border border-primary/30 bg-primary/5 text-sm rounded-md p-3">
          {t('admin.aiTrIsDefault', "Aquest és l'idioma per defecte. Edita els valors aquí si vols sobreescriure el fitxer de codi (les modificacions queden a la base de dades).")}
        </div>
      )}

      <Tabs defaultValue="ui">
        <TabsList>
          <TabsTrigger value="ui">{t('admin.aiTrTabUi', 'Interfície')} ({sourceKeys.length})</TabsTrigger>
          <TabsTrigger value="content">{t('admin.aiTrTabContent', 'Continguts')}</TabsTrigger>
        </TabsList>

        <TabsContent value="ui" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('admin.aiTrSearch', 'Cerca clau o text...')}
                className="pl-9"
              />
            </div>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value as any)}
              className="border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="all">{t('admin.aiTrFilterAll', 'Totes')}</option>
              <option value="empty">{t('admin.aiTrFilterEmpty', `Buides (${emptyCount})`)}</option>
              <option value="filled">{t('admin.aiTrFilterFilled', 'Omplertes')}</option>
            </select>
            <Button
              variant="outline"
              onClick={() => aiTranslateUi(true)}
              disabled={!aiReady || translatingUi || emptyCount === 0}
            >
              {translatingUi ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {t('admin.aiTrTranslateEmpty', `Traduir buides amb IA (${emptyCount})`)}
            </Button>
            <Button
              variant="outline"
              onClick={() => aiTranslateUi(false)}
              disabled={!aiReady || translatingUi}
            >
              {translatingUi ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {t('admin.aiTrTranslateAll', 'Traduir-ho tot')}
            </Button>
            <Button onClick={saveUi} disabled={savingUi || !uiLoaded}>
              <Save className="h-4 w-4 mr-2" />
              {savingUi ? t('common.saving', 'Desant...') : t('common.save', 'Desar')}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            {filteredKeys.length} {t('admin.aiTrShowing', 'de')} {sourceKeys.length} {t('admin.aiTrKeys', 'claus')}
          </div>

          <div className="border rounded-md divide-y">
            {filteredKeys.map(k => {
              const src = sourceFlat[k] || '';
              const v = uiValues[k] || '';
              const isLong = src.length > 80 || v.length > 80;
              return (
                <div key={k} className="grid grid-cols-1 md:grid-cols-[280px_1fr_1fr] gap-3 p-3">
                  <div className="font-mono text-xs text-muted-foreground break-all">{k}</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{src}</div>
                  {isLong ? (
                    <textarea
                      value={v}
                      onChange={e => setUiValues(s => ({ ...s, [k]: e.target.value }))}
                      rows={Math.min(6, Math.max(2, Math.ceil((v.length || src.length) / 60)))}
                      className="border rounded px-2 py-1 text-sm bg-background"
                    />
                  ) : (
                    <Input
                      value={v}
                      onChange={e => setUiValues(s => ({ ...s, [k]: e.target.value }))}
                      placeholder={src}
                      className="text-sm"
                    />
                  )}
                </div>
              );
            })}
            {filteredKeys.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">
                {t('admin.aiTrNoMatch', 'Cap clau coincideix amb el filtre.')}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('admin.aiTrContentDesc', "Genera amb IA les traduccions que falten per a cada tipus de contingut. Es traduiran només les files que encara no tenen cap traducció en aquest idioma. Les ja existents no es modifiquen.")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DYNAMIC_TABLES.map(def => (
              <div key={def.table} className="border rounded-md p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{def.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{def.table}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!aiReady || aiBusy === def.table || code === defaultCode}
                  onClick={() => translateDynamic(def)}
                >
                  {aiBusy === def.table ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {t('admin.aiTrFillMissing', 'Omplir amb IA')}
                </Button>
              </div>
            ))}
          </div>
          {code === defaultCode && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('admin.aiTrIsDefaultShort', "Aquest és l'idioma origen; no cal traduir contingut.")}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminLanguageTranslations;
