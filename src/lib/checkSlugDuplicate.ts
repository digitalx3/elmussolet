import { supabase } from '@/integrations/supabase/client';

type BaseTable = 'products' | 'categories' | 'variant_types';

/**
 * Returns true when another row in `table` already uses the given base slug.
 * Empty slug is treated as "no duplicate" (server will auto-generate).
 */
export async function checkBaseSlugDuplicate(
  table: BaseTable,
  slug: string,
  currentId?: string | null,
): Promise<boolean> {
  const v = (slug ?? '').trim();
  if (!v) return false;
  let q: any = supabase.from(table).select('id', { count: 'exact', head: true }).eq('slug', v);
  if (currentId) q = q.neq('id', currentId);
  const { count, error } = await q;
  if (error) {
    console.warn('[slug-dup] base check error', table, error);
    return false;
  }
  return (count ?? 0) > 0;
}

export type TrSlugConfig =
  | { table: 'product_translations'; fk: 'product_id'; langCol: 'language' }
  | { table: 'brand_translations'; fk: 'brand_id'; langCol: 'language_code' }
  | { table: 'category_translations'; fk: 'category_id'; langCol: 'language' }
  | { table: 'variant_type_translations'; fk: 'variant_type_id'; langCol: 'language' };

/**
 * Returns true when another translation row already uses the given slug for
 * the same language.
 */
export async function checkTranslationSlugDuplicate(
  cfg: TrSlugConfig,
  language: string,
  slug: string,
  currentParentId?: string | null,
): Promise<boolean> {
  const v = (slug ?? '').trim();
  if (!v) return false;
  let q: any = supabase
    .from(cfg.table)
    .select(cfg.fk, { count: 'exact', head: true })
    .eq(cfg.langCol, language)
    .eq('slug', v);
  if (currentParentId) q = q.neq(cfg.fk, currentParentId);
  const { count, error } = await q;
  if (error) {
    console.warn('[slug-dup] translation check error', cfg.table, error);
    return false;
  }
  return (count ?? 0) > 0;
}
