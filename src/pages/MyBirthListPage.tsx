import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Plus, Trash2, Copy, Eye, EyeOff, Share2, Loader2, Sparkles, Package, ShoppingBag, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { formatPrice } from '@/hooks/useTaxRates';
import { useDefaultListSections, pickSectionName } from '@/hooks/useDefaultListSections';
import FamilyProductSelector from '@/components/list/FamilyProductSelector';

interface ListItem {
  id?: string;
  product_id: string;
  variant_id: string | null;
  quantity_desired: number;
  priority: string;
  sort_order: number;
  productName?: string;
  price?: number;
  image_url?: string | null;
  section_id?: string | null;
  section_temp_id?: string | null;
}

interface PendingSection {
  temp_id: string;
  id?: string;
  name_ca: string;
  name_es: string;
  sort_order: number;
}


const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MUSSOLET-' + new Date().getFullYear() + '-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const MyBirthListPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const lang = i18n.language === 'es' ? 'es' : 'ca';

  const [listId, setListId] = useState<string | null>(null);
  const [form, setForm] = useState({
    list_code: generateCode(),
    password: '',
    baby_name: '',
    expected_date: '',
    status: 'draft',
    notes: '',
    first_name: '',
    last_name: '',
    items: [] as ListItem[],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<PendingSection[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [view, setView] = useState<'list' | 'create-choice' | 'editor' | 'share'>('list');
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [sharingList, setSharingList] = useState<{ id: string; code: string; babyName: string } | null>(null);
  const [sharePassword, setSharePassword] = useState('');
  const [showSharePassword, setShowSharePassword] = useState(false);
  const [initialViewSet, setInitialViewSet] = useState(false);
  const [deletingList, setDeletingList] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { data: defaultSectionsData = [] } = useDefaultListSections({ onlyActive: true });

  const handleDeleteList = async () => {
    if (!deletingList) return;
    setDeleting(true);
    try {
      const lid = deletingList.id;
      await supabase.from('list_items').delete().eq('list_id', lid);
      await supabase.from('list_sections').delete().eq('list_id', lid);
      await supabase.from('list_owners').delete().eq('list_id', lid);
      const { error } = await supabase.from('birth_lists').delete().eq('id', lid);
      if (error) throw error;
      notify.success(lang === 'es' ? 'Lista eliminada' : 'Llista eliminada');
      if (editingListId === lid) {
        setEditingListId(null);
        setView('list');
        resetEditor();
      }
      await queryClient.invalidateQueries({ queryKey: ['my-birth-lists', user?.id] });
      await queryClient.refetchQueries({ queryKey: ['my-birth-lists', user?.id] });
      setDeletingList(null);
    } catch (e: any) {
      notify.error(e?.message || (lang === 'es' ? 'No se pudo eliminar' : 'No s\'ha pogut eliminar'));
    } finally {
      setDeleting(false);
    }
  };

  const MAX_LISTS = 10;
  const isAdmin = profile?.role === 'admin';

  const resetEditor = () => {
    setListId(null);
    setSections([]);
    setSelectedTemplateId('');
    setForm({
      list_code: generateCode(),
      password: '',
      baby_name: '',
      expected_date: '',
      status: 'draft',
      notes: '',
      first_name: profile?.full_name?.trim().split(' ')[0] || '',
      last_name: profile?.full_name?.trim().split(' ').slice(1).join(' ') || '',
      items: [],
    });
  };


  // Templates available to copy from (only relevant while creating)
  const { data: templates = [] } = useQuery({
    queryKey: ['list-templates-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_templates')
        .select('id, slug, is_active, list_template_translations(language, name, description)')
        .eq('is_active', true)
        .order('slug');
      if (error) throw error;
      return data || [];
    },
  });

  // Categories for browse filter
  const { data: browseCategories = [] } = useQuery({
    queryKey: ['birthlist-browse-cats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, slug, category_translations(language, name)')
        .eq('is_active', true)
        .order('sort_order');
      return data || [];
    },
  });





  // All lists owned by this user (for the selector)
  const { data: myLists = [], isLoading: listsLoading, error: listsError } = useQuery({
    queryKey: ['my-birth-lists', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: ownerships, error } = await supabase
        .from('list_owners')
        .select('list_id, first_name, last_name')
        .eq('user_id', user!.id);
      if (error) throw error;
      const ownerByListId = new Map((ownerships || []).map((o: any) => [o.list_id, o]));
      const ownedIds = Array.from(ownerByListId.keys());

      let ownedLists: any[] = [];
      if (ownedIds.length > 0) {
        const { data, error: ownedError } = await supabase
          .from('birth_lists')
          .select('id, list_code, baby_name, expected_date, status, created_at')
          .in('id', ownedIds);
        if (ownedError) throw ownedError;
        ownedLists = data || [];
      }

      const { data: createdLists, error: createdError } = await supabase
        .from('birth_lists')
        .select('id, list_code, baby_name, expected_date, status, created_at')
        .eq('created_by', user!.id);
      if (createdError) throw createdError;

      const rowsById = new Map<string, any>();
      [...ownedLists, ...(createdLists || [])].forEach((list: any) => {
        const owner = ownerByListId.get(list.id) as any;
        rowsById.set(list.id, {
          ...list,
          first_name: owner?.first_name || '',
          last_name: owner?.last_name || '',
        });
      });
      const rows = Array.from(rowsById.values())
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      // Item counts and purchase progress
      if (rows.length > 0) {
        const ids = rows.map((r: any) => r.id);
        const { data: items } = await supabase
          .from('list_items')
          .select('list_id, quantity_desired, quantity_purchased')
          .in('list_id', ids);
        const counts: Record<string, number> = {};
        const desired: Record<string, number> = {};
        const purchased: Record<string, number> = {};
        (items || []).forEach((i: any) => {
          counts[i.list_id] = (counts[i.list_id] || 0) + 1;
          desired[i.list_id] = (desired[i.list_id] || 0) + (i.quantity_desired || 0);
          purchased[i.list_id] = (purchased[i.list_id] || 0) + Math.min(i.quantity_purchased || 0, i.quantity_desired || 0);
        });
        rows.forEach((r: any) => {
          r.item_count = counts[r.id] || 0;
          r.total_desired = desired[r.id] || 0;
          r.total_purchased = purchased[r.id] || 0;
        });
      }
      return rows;
    },
  });

  // Detail for the list currently being edited
  const { data: existing, isLoading } = useQuery({
    queryKey: ['my-birth-list-detail', editingListId],
    enabled: !!editingListId,
    queryFn: async () => {
      const listIdLocal = editingListId!;
      const [{ data: list }, { data: owner }, { data: items }, { data: secs }] = await Promise.all([
        supabase.from('birth_lists').select('id, list_code, status, baby_name, expected_date, template_id, notes, created_by, created_at, updated_at').eq('id', listIdLocal).single(),
        supabase.from('list_owners').select('first_name, last_name').eq('list_id', listIdLocal).eq('user_id', user!.id).maybeSingle(),
        supabase
          .from('list_items')
          .select(`
            id, product_id, variant_id, section_id, quantity_desired, priority, sort_order,
            product:products(id, base_price, product_translations(language, name), product_images(image_url, is_primary, sort_order))
          `)
          .eq('list_id', listIdLocal)
          .order('sort_order', { ascending: true }),
        supabase
          .from('list_sections')
          .select('id, name_ca, name_es, sort_order')
          .eq('list_id', listIdLocal)
          .order('sort_order', { ascending: true }),
      ]);
      return { list, items: items || [], owner: owner || { first_name: '', last_name: '' }, sections: secs || [] };
    },
  });

  // Purchases for the list currently being edited (who bought which item)
  const { data: purchases = [] } = useQuery({
    queryKey: ['my-birth-list-purchases', editingListId],
    enabled: !!editingListId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_list_purchases', { _list_id: editingListId! });
      if (error) throw error;
      return data || [];
    },
  });

  // Group purchases by list_item_id
  const purchasesByItem = useMemo(() => {
    const map: Record<string, any[]> = {};
    (purchases as any[]).forEach((p: any) => {
      if (!p.list_item_id) return;
      (map[p.list_item_id] ||= []).push(p);
    });
    return map;
  }, [purchases]);

  // Fetch variants for all products currently in the editor
  const itemProductIds = useMemo(() => {
    const ids = Array.from(new Set(form.items.map(i => i.product_id))).filter(Boolean);
    return ids.sort();
  }, [form.items]);

  const { data: variantsByProduct = {} } = useQuery({
    queryKey: ['my-birth-list-variants', itemProductIds.join(',')],
    enabled: itemProductIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, product_id, value, price_override, is_active, variant_type_id, variant_types(id, variant_type_translations(language, name))')
        .in('product_id', itemProductIds)
        .eq('is_active', true);
      if (error) throw error;
      const map: Record<string, any[]> = {};
      (data || []).forEach((v: any) => {
        (map[v.product_id] ||= []).push(v);
      });
      return map;
    },
  });


  // Decide initial view once lists are loaded
  useEffect(() => {
    if (initialViewSet || listsLoading) return;
    setView('list');
    setInitialViewSet(true);
  }, [listsLoading, myLists.length, initialViewSet]);

  useEffect(() => {
    if (existing?.list) {
      setListId(existing.list.id);
      setForm(prev => ({
        ...prev,
        list_code: existing.list.list_code,
        password: '',
        baby_name: existing.list.baby_name || '',
        expected_date: existing.list.expected_date || '',
        status: existing.list.status || 'draft',
        notes: existing.list.notes || '',
        first_name: existing.owner?.first_name || '',
        last_name: existing.owner?.last_name || '',
        items: (existing.items || []).map((item: any) => {
          const tr = item.product?.product_translations?.find((t: any) => t.language === lang)
            || item.product?.product_translations?.[0];
          const imgs = (item.product?.product_images || []).slice().sort((a: any, b: any) =>
            (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order || 0) - (b.sort_order || 0));
          return {
            id: item.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity_desired: item.quantity_desired,
            priority: item.priority,
            sort_order: item.sort_order,
            productName: tr?.name || item.product_id,
            price: item.product?.base_price,
            image_url: imgs[0]?.image_url || null,
            section_id: item.section_id || null,
            section_temp_id: item.section_id || null,
          };
        }),
      }));
      setSections((existing.sections || []).map((s: any) => ({
        temp_id: s.id,
        id: s.id,
        name_ca: s.name_ca,
        name_es: s.name_es,
        sort_order: s.sort_order,
      })));
    }
  }, [existing, lang]);


  const getEffectiveStock = (product: any): number => {
    const variants = (product?.product_variants || []).filter((v: any) => v.is_active !== false);
    if (variants.length > 0) {
      return variants.reduce((s: number, v: any) => s + (v.stock_quantity || 0), 0);
    }
    return product?.stock_quantity || 0;
  };


  const pickProductImage = (product: any): string | null => {
    const imgs = (product?.product_images || []).slice().sort((a: any, b: any) =>
      (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order || 0) - (b.sort_order || 0));
    return imgs[0]?.image_url || null;
  };



  const loadTemplate = async (templateIdArg?: string) => {
    const tplId = templateIdArg || selectedTemplateId;
    if (!tplId) return;
    setSelectedTemplateId(tplId);
    setLoadingTemplate(true);
    try {
      const [{ data: secs }, { data: tplItems }] = await Promise.all([
        supabase
          .from('list_template_sections')
          .select('id, name_ca, name_es, sort_order')
          .eq('template_id', tplId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('list_template_items')
          .select(`
            section_id, product_id, variant_id, quantity, sort_order,
            product:products(id, base_price, slug, stock_quantity, has_variants, product_translations(language, name), product_images(image_url, is_primary, sort_order), product_variants(stock_quantity, is_active))
          `)
          .eq('template_id', tplId)
          .order('sort_order', { ascending: true }),
      ]);

      const newSections: PendingSection[] = (secs || []).map((s: any) => ({
        temp_id: `tpl-${s.id}`,
        name_ca: s.name_ca,
        name_es: s.name_es,
        sort_order: s.sort_order,
      }));

      const skipped: string[] = [];
      const newItems: ListItem[] = [];
      (tplItems || []).forEach((it: any, idx: number) => {
        const tr = it.product?.product_translations?.find((tt: any) => tt.language === lang)
          || it.product?.product_translations?.[0];
        const name = tr?.name || it.product?.slug || it.product_id;
        if (getEffectiveStock(it.product) <= 0) {
          skipped.push(name);
          return;
        }
        newItems.push({
          product_id: it.product_id,
          variant_id: it.variant_id || null,
          quantity_desired: it.quantity || 1,
          priority: 'medium',
          sort_order: idx,
          productName: name,
          price: it.product?.base_price,
          image_url: pickProductImage(it.product),
          section_temp_id: it.section_id ? `tpl-${it.section_id}` : null,
        });
      });

      setSections(newSections);
      setForm(prev => ({ ...prev, items: newItems }));
      notify.success(t('list.templateLoaded'));
      if (skipped.length > 0) {
        notify.warning(
          (lang === 'es'
            ? `${skipped.length} producto(s) sin stock no se han añadido: `
            : `${skipped.length} producte(s) sense estoc no s'han afegit: `) + skipped.join(', '),
          { duration: 8000 },
        );
      }
    } catch (e: any) {
      notify.error(e.message || t('errors.generic'));
    } finally {
      setLoadingTemplate(false);
    }
  };





  const reorderItem = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setForm(prev => {
      if (fromIdx < 0 || toIdx < 0 || fromIdx >= prev.items.length || toIdx >= prev.items.length) return prev;
      const next = [...prev.items];
      const [moved] = next.splice(fromIdx, 1);
      // Ensure dropped item keeps the target's section
      moved.section_temp_id = next[toIdx]?.section_temp_id ?? moved.section_temp_id;
      next.splice(toIdx, 0, moved);
      return { ...prev, items: next.map((it, i) => ({ ...it, sort_order: i })) };
    });
  };

  const addProductToSection = (product: any, sectionTempId: string | null) => {
    if (form.items.some(i => i.product_id === product.id)) {
      // Already in the list — just reassign its section
      setForm(prev => ({
        ...prev,
        items: prev.items.map(it => it.product_id === product.id ? { ...it, section_temp_id: sectionTempId } : it),
      }));
      return;
    }
    if (getEffectiveStock(product) <= 0) {
      notify.error(lang === 'es'
        ? 'Este producto no tiene stock. Busca uno similar.'
        : 'Aquest producte no té estoc. Busca\'n un de similar.');
      return;
    }
    const tr = product.product_translations?.find((tt: any) => tt.language === lang)
      || product.product_translations?.[0];
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: product.id,
        variant_id: null,
        quantity_desired: 1,
        priority: 'medium',
        sort_order: prev.items.length,
        productName: tr?.name || product.slug,
        price: product.base_price,
        image_url: pickProductImage(product),
        section_temp_id: sectionTempId,
      }],
    }));
  };

  /** Quick selector: toggle a product on/off by clicking its tile in the family grid. */
  const toggleProductFromFamily = (product: any, checked: boolean) => {
    if (!checked) {
      setForm(prev => ({ ...prev, items: prev.items.filter(it => it.product_id !== product.id) }));
      return;
    }
    if (form.items.some(i => i.product_id === product.id)) return;
    let targetTempId: string | null = null;
    if (product.default_section_id) {
      targetTempId = `def-${product.default_section_id}`;
      // Ensure a PendingSection exists with this temp_id
      if (!sections.some(s => s.temp_id === targetTempId)) {
        const def = defaultSectionsData.find(d => d.id === product.default_section_id);
        const nameCa = def?.translations.find(tr => tr.language === 'ca')?.name || def?.slug || 'Família';
        const nameEs = def?.translations.find(tr => tr.language === 'es')?.name || nameCa;
        setSections(prev => [
          ...prev,
          { temp_id: targetTempId!, name_ca: nameCa, name_es: nameEs, sort_order: prev.length },
        ]);
      }
    }
    addProductToSection(product, targetTempId);
  };

  /** Set of product ids currently selected in this list. */
  const selectedProductIds = useMemo(
    () => new Set(form.items.map(i => i.product_id)),
    [form.items],
  );




  const handleSave = async () => {
    if (!user) return;
    if (!form.first_name.trim()) { notify.error(t('list.firstNameRequired')); return; }
    if (!listId && !form.password.trim()) { notify.error(t('list.passwordRequired')); return; }
    if (form.password && form.password.length < 6) { notify.error(t('list.passwordTooShort')); return; }
    if (form.items.length === 0) {
      notify.warning(
        lang === 'es'
          ? 'Selecciona al menos un producto antes de guardar la lista.'
          : 'Selecciona com a mínim un producte abans de desar la llista.'
      );
      return;
    }

    setSaving(true);
    try {
      let currentId = listId;
      const wasCreating = !currentId;
      let passwordHash: string | undefined;

      if (form.password.trim()) {
        const { data: hashData, error: hashError } = await supabase.functions.invoke(
          'hash-password-util',
          { body: { password: form.password } }
        );
        if (hashError || !hashData?.hash) throw new Error('Hash error');
        passwordHash = hashData.hash;
      }

      if (!currentId) {
        // Create new list
        const { data, error } = await supabase
          .from('birth_lists')
          .insert({
            list_code: form.list_code.trim().toUpperCase(),
            password_hash: passwordHash!,
            baby_name: form.baby_name || null,
            expected_date: form.expected_date || null,
            status: form.status,
            notes: form.notes || null,
            created_by: user.id,
          })
          .select('id')
          .single();
        if (error) {
          if ((error as any).message?.includes('BIRTH_LIST_LIMIT_REACHED')) {
            throw new Error(t('list.limitReached'));
          }
          throw error;
        }
        currentId = data.id;
        setListId(currentId);
        setEditingListId(currentId);

        // Insert owner linked to this user
        const { error: ownerErr } = await supabase.from('list_owners').insert({
          list_id: currentId,
          user_id: user.id,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: user.email || '',
          is_primary: true,
        });
        if (ownerErr) throw ownerErr;
      } else {
        // Update list
        const updateData: any = {
          baby_name: form.baby_name || null,
          expected_date: form.expected_date || null,
          status: form.status,
          notes: form.notes || null,
        };
        if (passwordHash) updateData.password_hash = passwordHash;
        const { error } = await supabase.from('birth_lists').update(updateData).eq('id', currentId);
        if (error) throw error;

        // Update owner name
        await supabase.from('list_owners')
          .update({
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
          })
          .eq('list_id', currentId)
          .eq('user_id', user.id);
      }

      // Sync sections: delete + insert (simple resync each save)
      await supabase.from('list_items').delete().eq('list_id', currentId);
      await supabase.from('list_sections').delete().eq('list_id', currentId);

      const sectionIdMap = new Map<string, string>(); // temp_id -> real id
      if (sections.length > 0) {
        const secsToInsert = sections.map((s, i) => ({
          list_id: currentId!,
          name_ca: s.name_ca,
          name_es: s.name_es,
          sort_order: i,
        }));
        const { data: insertedSecs, error: secErr } = await supabase
          .from('list_sections')
          .insert(secsToInsert)
          .select('id, sort_order');
        if (secErr) throw secErr;
        // Map by order (we inserted in array order)
        sections.forEach((s, i) => {
          const match = (insertedSecs || []).find(is => is.sort_order === i);
          if (match) sectionIdMap.set(s.temp_id, match.id);
        });

        // Mirror ca/es names into list_section_translations so the dynamic
        // language system can resolve section names by language_code.
        const trRows: Array<{ section_id: string; language_code: string; name: string }> = [];
        sections.forEach((s) => {
          const realId = sectionIdMap.get(s.temp_id);
          if (!realId) return;
          if (s.name_ca && s.name_ca.trim()) {
            trRows.push({ section_id: realId, language_code: 'ca', name: s.name_ca.trim() });
          }
          if (s.name_es && s.name_es.trim()) {
            trRows.push({ section_id: realId, language_code: 'es', name: s.name_es.trim() });
          }
        });
        if (trRows.length > 0) {
          await supabase
            .from('list_section_translations')
            .upsert(trRows, { onConflict: 'section_id,language_code' });
        }
      }

      if (form.items.length > 0) {
        const itemsToInsert = form.items.map((item, idx) => ({
          list_id: currentId!,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity_desired: item.quantity_desired,
          priority: item.priority,
          sort_order: idx,
          section_id: item.section_temp_id ? (sectionIdMap.get(item.section_temp_id) || null) : null,
        }));
        const { error } = await supabase.from('list_items').insert(itemsToInsert);
        if (error) throw error;
      }


      await queryClient.invalidateQueries({ queryKey: ['my-birth-lists', user.id] });
      await queryClient.refetchQueries({ queryKey: ['my-birth-lists', user.id] });

      queryClient.invalidateQueries({ queryKey: ['my-birth-list-detail', currentId] });
      notify.success(t('common.success'));
      setForm(prev => ({ ...prev, password: '' }));
      if (wasCreating) {
        setEditingListId(null);
        setView('list');
      }
    } catch (err: any) {
      notify.error(err.message || t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      notify.success(`${label} ${t('list.copied')}`);
    } catch {
      notify.error(lang === 'es' ? 'No se pudo copiar' : 'No s\'ha pogut copiar');
    }
  };


  const shareWhatsApp = () => {
    const message = t('list.shareMessage', {
      babyName: form.baby_name || '',
      code: form.list_code,
      url: `${window.location.origin}/llista-naixement`,
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (listsLoading || (view === 'editor' && editingListId && isLoading)) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (listsError) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="py-4 text-sm text-destructive">
          {lang === 'es'
            ? 'No se han podido cargar tus listas. Vuelve a intentarlo en unos segundos.'
            : 'No s\'han pogut carregar les teves llistes. Torna-ho a intentar d\'aquí uns segons.'}
        </CardContent>
      </Card>
    );
  }

  const atLimit = !isAdmin && myLists.length >= MAX_LISTS;

  const goToCreateChoice = () => {
    if (atLimit) return;
    resetEditor();
    setEditingListId(null);
    setSelectedTemplateId('');
    setView('create-choice');
  };

  const FALLBACK_DEFAULT_SECTIONS: Array<{ name_ca: string; name_es: string }> = [
    { name_ca: 'Higiene personal', name_es: 'Higiene personal' },
    { name_ca: 'Dormir', name_es: 'Dormir' },
    { name_ca: 'Alimentació', name_es: 'Alimentación' },
    { name_ca: 'Passeig', name_es: 'Paseo' },
    { name_ca: 'Per a casa', name_es: 'Para casa' },
    { name_ca: 'Cotxe', name_es: 'Coche' },
    { name_ca: 'Per a la mare (hospital)', name_es: 'Para la madre (hospital)' },
    { name_ca: 'Per al bebè (hospital)', name_es: 'Para el bebé (hospital)' },
    { name_ca: "Per a l'espera (hospital)", name_es: 'Para la espera (hospital)' },
  ];

  const startCustomList = () => {
    if (atLimit) return;
    resetEditor();
    setEditingListId(null);
    const fromDb = defaultSectionsData.map(s => ({
      name_ca: pickSectionName(s, 'ca'),
      name_es: pickSectionName(s, 'es'),
    }));
    const source = fromDb.length > 0 ? fromDb : FALLBACK_DEFAULT_SECTIONS;
    setSections(source.map((s, i) => ({
      temp_id: `new-${Date.now()}-${i}`,
      name_ca: s.name_ca,
      name_es: s.name_es,
      sort_order: i,
    })));
    setView('editor');
  };



  const startFromTemplate = async (tplId: string) => {
    if (atLimit) return;
    resetEditor();
    setEditingListId(null);
    setView('editor');
    await loadTemplate(tplId);
  };

  // ---------- SHARE VIEW ----------
  if (view === 'share' && sharingList) {
    const shareUrl = `${window.location.origin}/llista-naixement?code=${encodeURIComponent(sharingList.code)}`;
    const pwd = sharePassword.trim();
    const fullMessage = lang === 'es'
      ? `Hola! Te comparto ${sharingList.babyName ? `la lista de nacimiento de ${sharingList.babyName}` : 'nuestra lista de nacimiento'} en El Mussolet:\n\n${shareUrl}\n\nContraseña: ${pwd || '[escribe aquí tu contraseña]'}\n\nGracias!`
      : `Hola! Et comparteixo ${sharingList.babyName ? `la llista de naixement de ${sharingList.babyName}` : 'la nostra llista de naixement'} a El Mussolet:\n\n${shareUrl}\n\nContrasenya: ${pwd || '[escriu aquí la teva contrasenya]'}\n\nGràcies!`;
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Share2 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="font-display text-2xl font-bold">
              {lang === 'es' ? 'Compartir tu lista' : 'Compartir la teva llista'}
            </h2>
            <p className="text-sm text-muted-foreground font-mono">{sharingList.code}</p>
          </div>
        </div>

        <Card>
          <CardContent className="py-6 space-y-5 text-sm">
            <p>
              {lang === 'es'
                ? 'Para compartir tu lista, copia el enlace con el botón de abajo y envíaselo a tus conocidos. También deberás indicarles la contraseña que configuraste para tu lista.'
                : 'Per compartir la teva llista, copia l\'enllaç amb el botó de sota i envia\'l als teus coneguts. També hauràs d\'indicar-los la contrasenya que vas configurar per a la teva llista.'}
            </p>

            <div className="space-y-2">
              <Label>{lang === 'es' ? 'Enlace de tu lista' : 'Enllaç de la teva llista'}</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" onClick={() => copy(shareUrl, lang === 'es' ? 'Enlace' : 'Enllaç')} className="gap-2">
                  <Copy className="h-4 w-4" />
                  {lang === 'es' ? 'Copiar' : 'Copiar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {lang === 'es'
                  ? 'El código de la lista ya va incluido en el enlace; quien lo abra solo tendrá que escribir la contraseña.'
                  : 'El codi de la llista ja va inclòs a l\'enllaç; qui l\'obri només haurà d\'escriure la contrasenya.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{lang === 'es' ? 'Contraseña de tu lista' : 'Contrasenya de la teva llista'}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showSharePassword ? 'text' : 'password'}
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder={lang === 'es' ? 'Escribe la contraseña que configuraste' : 'Escriu la contrasenya que vas configurar'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSharePassword(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showSharePassword ? 'Hide' : 'Show'}
                  >
                    {showSharePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => pwd && copy(pwd, lang === 'es' ? 'Contraseña' : 'Contrasenya')}
                  disabled={!pwd}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  {lang === 'es' ? 'Copiar' : 'Copiar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {lang === 'es'
                  ? 'Por seguridad no guardamos la contraseña en texto plano: escríbela aquí para incluirla en el mensaje a compartir.'
                  : 'Per seguretat no desem la contrasenya en text pla: escriu-la aquí per incloure-la al missatge a compartir.'}
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>{lang === 'es' ? 'Mensaje listo para WhatsApp o email' : 'Missatge llest per WhatsApp o email'}</Label>
              <Textarea value={fullMessage} readOnly rows={7} className="font-mono text-xs" />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => copy(fullMessage, lang === 'es' ? 'Mensaje' : 'Missatge')}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  {lang === 'es' ? 'Copiar mensaje completo' : 'Copiar missatge complet'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(fullMessage)}`, '_blank')}
                  className="gap-2"
                >
                  {lang === 'es' ? 'Abrir en WhatsApp' : 'Obrir a WhatsApp'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open(`mailto:?subject=${encodeURIComponent(lang === 'es' ? 'Mi lista de nacimiento - El Mussolet' : 'La meva llista de naixement - El Mussolet')}&body=${encodeURIComponent(fullMessage)}`, '_self')}
                  className="gap-2"
                >
                  {lang === 'es' ? 'Enviar por email' : 'Enviar per email'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" onClick={() => { setView('list'); setSharingList(null); }}>
          {lang === 'es' ? '← Volver a mis listas' : '← Tornar a les meves llistes'}
        </Button>
      </div>
    );
  }

  // ---------- LIST VIEW ----------
  if (view === 'list' || view === 'create-choice') {

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-primary" />
          <div>
            <h2 className="font-display text-2xl font-bold">{t('list.myLists')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('list.listsCount', { count: myLists.length, max: MAX_LISTS })}
            </p>
          </div>
        </div>

        {atLimit && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="py-4 text-sm space-y-2">
              <p className="font-medium text-destructive">{t('list.limitReached')}</p>
              <p className="text-muted-foreground">{t('list.contactAdmin')}</p>
              <a href="/contacte" className="inline-block text-primary underline text-sm">{t('nav.contact') || 'Contacte'}</a>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {myLists.map((l: any) => (
            <Card key={l.id} className="hover:border-primary transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display font-semibold truncate">{l.baby_name || l.list_code}</p>
                    <p className="font-mono text-xs text-muted-foreground truncate">{l.list_code}</p>
                  </div>
                  <Badge variant={l.status === 'active' ? 'default' : l.status === 'closed' ? 'secondary' : 'outline'}>
                    {l.status === 'active' ? t('admin.statusActive') : l.status === 'closed' ? t('admin.statusClosed') : t('admin.statusDraft')}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {l.expected_date && <p>{t('list.expectedDate')}: {l.expected_date}</p>}
                  <p className="flex items-center gap-1"><Package className="h-3 w-3" />{l.item_count || 0} {(l.item_count || 0) === 1 ? (lang === 'es' ? 'producto' : 'producte') : (lang === 'es' ? 'productos' : 'productes')}</p>
                </div>
                {(l.total_desired || 0) > 0 && (() => {
                  const desiredQty = l.total_desired || 0;
                  const purchasedQty = Math.min(l.total_purchased || 0, desiredQty);
                  const pct = Math.round((purchasedQty / desiredQty) * 100);
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t('list.progress')}</span>
                        <span className="font-medium">{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-[11px] text-muted-foreground">
                        {purchasedQty} / {desiredQty} {t('list.itemsPurchased')}
                      </p>
                    </div>
                  );
                })()}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1"
                    onClick={() => {
                      setEditingListId(l.id);
                      setListId(l.id);
                      setView('editor');
                    }}
                  >
                    {t('list.editList')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSharingList({ id: l.id, code: l.list_code, babyName: l.baby_name || '' });
                      setSharePassword('');
                      setShowSharePassword(false);
                      setView('share');
                    }}
                    title={lang === 'es' ? 'Compartir' : 'Compartir'}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/llista-naixement?code=${encodeURIComponent(l.list_code)}`, '_blank')}
                    title={lang === 'es' ? 'Ver' : 'Veure'}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {!atLimit && (
            <button
              type="button"
              onClick={goToCreateChoice}
              className={`group flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed bg-background hover:bg-primary/5 hover:border-primary transition-colors min-h-[180px] ${view === 'create-choice' ? 'border-primary bg-primary/5' : 'border-primary/40'}`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Plus className="h-5 w-5" />
              </span>
              <span className="font-display font-semibold">{t('list.createNew')}</span>
              <span className="text-xs text-muted-foreground text-center">
                {lang === 'es' ? 'Empieza desde una plantilla o crea una personalizada' : 'Comença des d\'una plantilla o crea\'n una personalitzada'}
              </span>
            </button>
          )}
        </div>

        {myLists.length === 0 && view === 'list' && !atLimit && (
          <p className="text-sm text-muted-foreground text-center">
            {lang === 'es' ? 'Aún no tienes ninguna lista. Crea la primera para empezar.' : 'Encara no tens cap llista. Crea la primera per començar.'}
          </p>
        )}

        {/* Create-choice expanded panel */}
        {view === 'create-choice' && (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {lang === 'es' ? 'Crear una lista nueva' : 'Crear una llista nova'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Templates */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">
                    {lang === 'es' ? 'Empezar con una plantilla' : 'Començar amb una plantilla'}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lang === 'es'
                    ? 'Carga una lista predefinida con sus secciones y productos. Después podrás eliminar o reordenar a tu gusto.'
                    : 'Carrega una llista predefinida amb les seves seccions i productes. Després podràs eliminar o reordenar al teu gust.'}
                </p>
                {templates.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    {lang === 'es' ? 'No hay plantillas disponibles.' : 'No hi ha plantilles disponibles.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {templates.map((tpl: any) => {
                      const tr = tpl.list_template_translations?.find((tt: any) => tt.language === lang)
                        || tpl.list_template_translations?.[0];
                      const label = tr?.name || tpl.slug;
                      const desc = tr?.description;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          disabled={loadingTemplate}
                          onClick={() => startFromTemplate(tpl.id)}
                          className="group relative flex flex-col items-center justify-center gap-2 p-3 rounded-md border-2 border-border bg-background hover:border-primary hover:bg-primary/5 transition-colors text-center min-h-[100px]"
                        >
                          {loadingTemplate ? (
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          ) : (
                            <Heart className="h-6 w-6 text-primary" />
                          )}
                          <span className="text-xs font-semibold line-clamp-2">{label}</span>
                          {desc && <span className="text-[10px] text-muted-foreground line-clamp-2">{desc}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Custom */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">
                    {lang === 'es' ? 'Crear una lista personalizada' : 'Crear una llista personalitzada'}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lang === 'es'
                    ? 'Empieza desde cero. Configura la información de la lista y añade tus secciones y productos.'
                    : 'Comença de zero. Configura la informació de la llista i afegeix les teves seccions i productes.'}
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setView('list')}>
                    {t('common.cancel') !== 'common.cancel' ? t('common.cancel') : (lang === 'es' ? 'Cancelar' : 'Cancel·lar')}
                  </Button>
                  <Button onClick={startCustomList} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {lang === 'es' ? 'Crear lista personalizada' : 'Crear llista personalitzada'}
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        )}
      </div>
    );
  }


  // ---------- EDITOR VIEW ----------
  // Determine current step: 1=create, 2=edit, 3=share
  const currentStep = !listId ? 1 : (form.status === 'active' || form.status === 'closed' ? 3 : 2);
  const steps = [
    { n: 1, label: t('list.stepCreate') },
    { n: 2, label: t('list.stepEdit') },
    { n: 3, label: t('list.stepShare') },
  ];

  return (
    <div className="space-y-6">
      {myLists.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setView('list'); setEditingListId(null); }}
          className="gap-2 -ml-2"
        >
          ← {t('list.backToLists')}
        </Button>
      )}
      {/* Breadcrumbs / Steps */}
      <nav aria-label="Progress">
        <ol className="flex items-center gap-2 sm:gap-3 text-sm">
          {steps.map((s, i) => {
            const isActive = s.n === currentStep;
            const isDone = s.n < currentStep;
            return (
              <li key={s.n} className="flex items-center gap-2 sm:gap-3">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary font-medium'
                      : isDone
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-muted text-muted-foreground border-border'
                  }`}
                >
                  <span className={`flex items-center justify-center h-5 w-5 rounded-full text-xs font-semibold ${
                    isActive ? 'bg-primary-foreground text-primary' : isDone ? 'bg-primary text-primary-foreground' : 'bg-background'
                  }`}>
                    {s.n}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <span className="h-px w-4 sm:w-8 bg-border" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex items-center gap-3">
        <Heart className="h-6 w-6 text-primary" />
        <div>
          <h2 className="font-display text-2xl font-bold">{t('list.myList')}</h2>
          <p className="text-sm text-muted-foreground">
            {currentStep === 1 ? t('list.myListCreateDesc')
              : currentStep === 2 ? t('list.myListEditDesc')
              : t('list.myListShareDesc')}
          </p>
        </div>
      </div>

      {/* Share credentials (only if exists) */}
      {listId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4" /> {t('list.shareCredentials')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 p-3 bg-background rounded-md border">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t('list.listCode')}</p>
                <p className="font-mono text-sm font-semibold truncate">{form.list_code}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copy(form.list_code, t('list.listCode'))}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('list.shareHint')}</p>
            <Button variant="outline" size="sm" onClick={shareWhatsApp} className="gap-2">
              <Share2 className="h-3.5 w-3.5" /> {t('list.shareWhatsApp')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Purchases summary */}
      {listId && (purchases as any[]).length > 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-emerald-600" />
              {lang === 'es' ? 'Compras de tu lista' : 'Compres de la teva llista'}
              <Badge variant="secondary" className="ml-2">{(purchases as any[]).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {lang === 'es'
                ? 'Estas personas han comprado productos de tu lista. Encuentra el detalle de cada producto más abajo.'
                : 'Aquestes persones han comprat productes de la teva llista. Trobaràs el detall de cada producte més avall.'}
            </p>
            <div className="space-y-1.5">
              {(purchases as any[]).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-2 p-2 bg-background border rounded-md text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{p.buyer_full_name || (lang === 'es' ? '(sin nombre)' : '(sense nom)')}</span>
                    <span className="text-muted-foreground font-mono shrink-0">#{p.order_number}</span>
                  </div>
                  <Badge
                    variant={p.payment_status === 'paid' ? 'default' : p.payment_status === 'pending' ? 'secondary' : 'outline'}
                    className="shrink-0 text-[10px]"
                  >
                    {p.payment_status === 'paid'
                      ? (lang === 'es' ? 'Pagado' : 'Pagat')
                      : p.payment_status === 'pending'
                        ? (lang === 'es' ? 'Pendiente' : 'Pendent')
                        : p.payment_status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('admin.listInfo')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('list.listCode')}</Label>
              <Input value={form.list_code} disabled className="font-mono" />
              <p className="text-xs text-muted-foreground">{t('list.codeAutoGen')}</p>
            </div>
            <div className="space-y-2">
              <Label>
                {t('list.listPassword')} {listId && <span className="text-muted-foreground text-xs">({t('admin.leaveBlank')})</span>}
              </Label>
              <div className="flex gap-2">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder={listId ? '••••••••' : ''}
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('list.firstName')}</Label>
              <Input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('list.lastName')}</Label>
              <Input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('list.babyName')}</Label>
              <Input value={form.baby_name} onChange={e => setForm(p => ({ ...p, baby_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('list.expectedDate')}</Label>
              <Input
                type="date"
                value={form.expected_date}
                onChange={e => setForm(p => ({ ...p, expected_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('account.orderStatus')}</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t('admin.statusDraft')}</SelectItem>
                  <SelectItem value="active">{t('admin.statusActive')}</SelectItem>
                  <SelectItem value="closed">{t('admin.statusClosed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('admin.notes')}</Label>
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.listProducts')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Quick selector: full-width grid grouped by family with check toggles */}
          <div className="rounded-lg border bg-card p-3 sm:p-4">
            <div className="mb-3">
              <h3 className="font-display text-lg font-semibold">
                {lang === 'es' ? 'Selección rápida por familias' : 'Selecció ràpida per famílies'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {lang === 'es'
                  ? 'Marca los productos que quieres incluir en tu lista. Se agruparán automáticamente por familia.'
                  : 'Marca els productes que vols incloure a la teva llista. S\'agruparan automàticament per família.'}
              </p>
            </div>
            <FamilyProductSelector
              selectedIds={selectedProductIds}
              onToggle={toggleProductFromFamily}
            />
          </div>

        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || form.items.length === 0}
          size="lg"
          className="gap-2"
          title={form.items.length === 0 ? (lang === 'es' ? 'Selecciona al menos un producto' : 'Selecciona com a mínim un producte') : undefined}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {listId ? t('common.save') : t('list.createList')}
        </Button>
      </div>

      <AlertDialog open={!!deletingList} onOpenChange={(o) => !o && !deleting && setDeletingList(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang === 'es' ? 'Eliminar lista' : 'Eliminar llista'}</AlertDialogTitle>
            <AlertDialogDescription>
              {lang === 'es'
                ? `Esta acción eliminará permanentemente la lista "${deletingList?.label ?? ''}", sus productos y secciones. No se puede deshacer.`
                : `Aquesta acció eliminarà permanentment la llista "${deletingList?.label ?? ''}", els seus productes i seccions. No es pot desfer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common.cancel') || (lang === 'es' ? 'Cancelar' : 'Cancel·lar')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteList(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {lang === 'es' ? 'Eliminar' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyBirthListPage;
