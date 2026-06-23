import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Plus, Trash2, Search, Copy, Eye, EyeOff, Share2, Loader2, Sparkles, Package, ChevronDown, ChevronUp, Check, GripVertical, FolderOpen, ShoppingBag, User, Info, Lock, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPrice } from '@/hooks/useTaxRates';

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
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [sections, setSections] = useState<PendingSection[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseCategory, setBrowseCategory] = useState<string>('all');
  const [newSectionCa, setNewSectionCa] = useState('');
  const [newSectionEs, setNewSectionEs] = useState('');
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [draggedItemIdx, setDraggedItemIdx] = useState<number | null>(null);
  const [dragOverItemIdx, setDragOverItemIdx] = useState<number | null>(null);
  // Drag payload for products: either { itemIdx } (move existing) or { product } (add new)
  const productDragRef = React.useRef<{ kind: 'move'; itemIdx: number } | { kind: 'add'; product: any } | null>(null);
  const [view, setView] = useState<'list' | 'create-choice' | 'editor'>('list');
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [initialViewSet, setInitialViewSet] = useState(false);
  const [customBabyName, setCustomBabyName] = useState('');
  const [customSectionCa, setCustomSectionCa] = useState('');
  const [customSectionEs, setCustomSectionEs] = useState('');

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

  // Browse products (loaded only when browseOpen)
  const { data: browseProducts = [], isFetching: browseLoading } = useQuery({
    queryKey: ['birthlist-browse-products', browseCategory],
    enabled: browseOpen,
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select(`id, base_price, slug, category_id, product_translations(language, name), product_images(image_url, is_primary, sort_order)`)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(60);
      if (browseCategory !== 'all') q = q.eq('category_id', browseCategory);
      const { data } = await q;
      return data || [];
    },
  });




  // All lists owned by this user (for the selector)
  const { data: myLists = [], isLoading: listsLoading } = useQuery({
    queryKey: ['my-birth-lists', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: ownerships } = await supabase
        .from('list_owners')
        .select('list_id, first_name, last_name, birth_lists(id, list_code, baby_name, expected_date, status, created_at)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      const rows = (ownerships || [])
        .filter((o: any) => o.birth_lists)
        .map((o: any) => ({
          ...o.birth_lists,
          first_name: o.first_name,
          last_name: o.last_name,
        }));
      // Item counts
      if (rows.length > 0) {
        const ids = rows.map((r: any) => r.id);
        const { data: items } = await supabase
          .from('list_items')
          .select('list_id')
          .in('list_id', ids);
        const counts: Record<string, number> = {};
        (items || []).forEach((i: any) => { counts[i.list_id] = (counts[i.list_id] || 0) + 1; });
        rows.forEach((r: any) => { r.item_count = counts[r.id] || 0; });
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
        supabase.from('birth_lists').select('*').eq('id', listIdLocal).single(),
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


  const handleProductSearch = async (query: string) => {
    setProductSearch(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('products')
      .select(`id, base_price, slug, product_translations(language, name), product_images(image_url, is_primary, sort_order)`)
      .eq('is_active', true)
      .limit(20);
    const filtered = (data || []).filter(p => {
      const tr = (p as any).product_translations?.find((t: any) => t.language === lang)
        || (p as any).product_translations?.[0];
      return tr?.name?.toLowerCase().includes(query.toLowerCase());
    });
    setSearchResults(filtered);
  };

  const pickProductImage = (product: any): string | null => {
    const imgs = (product?.product_images || []).slice().sort((a: any, b: any) =>
      (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order || 0) - (b.sort_order || 0));
    return imgs[0]?.image_url || null;
  };

  const addProduct = (product: any) => {
    if (form.items.some(i => i.product_id === product.id)) {
      toast.info(t('list.productAlreadyAdded'));
      return;
    }
    const tr = product.product_translations?.find((t: any) => t.language === lang)
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
      }],
    }));
    setProductSearch('');
    setSearchResults([]);
  };

  const removeItem = (idx: number) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((it, i) => i === idx ? { ...it, [field]: value } : it),
    }));
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
            product:products(id, base_price, slug, product_translations(language, name), product_images(image_url, is_primary, sort_order))
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

      const newItems: ListItem[] = (tplItems || []).map((it: any, idx: number) => {
        const tr = it.product?.product_translations?.find((tt: any) => tt.language === lang)
          || it.product?.product_translations?.[0];
        return {
          product_id: it.product_id,
          variant_id: it.variant_id || null,
          quantity_desired: it.quantity || 1,
          priority: 'medium',
          sort_order: idx,
          productName: tr?.name || it.product?.slug || it.product_id,
          price: it.product?.base_price,
          image_url: pickProductImage(it.product),
          section_temp_id: it.section_id ? `tpl-${it.section_id}` : null,
        };
      });

      setSections(newSections);
      setForm(prev => ({ ...prev, items: newItems }));
      toast.success(t('list.templateLoaded'));
    } catch (e: any) {
      toast.error(e.message || t('errors.generic'));
    } finally {
      setLoadingTemplate(false);
    }
  };

  const assignItemSection = (idx: number, sectionTempId: string | null) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((it, i) => i === idx ? { ...it, section_temp_id: sectionTempId } : it),
    }));
  };

  const handleAddSection = () => {
    const ca = newSectionCa.trim();
    const es = newSectionEs.trim();
    if (!ca && !es) {
      toast.error(lang === 'es' ? 'Indica un nombre para la sección' : 'Indica un nom per a la secció');
      return;
    }
    setSections(prev => [...prev, {
      temp_id: `new-${Date.now()}-${prev.length}`,
      name_ca: ca || es,
      name_es: es || ca,
      sort_order: prev.length,
    }]);
    setNewSectionCa('');
    setNewSectionEs('');
  };

  const removeSection = (tempId: string) => {
    setSections(prev => prev.filter(s => s.temp_id !== tempId).map((x, i) => ({ ...x, sort_order: i })));
    setForm(prev => ({
      ...prev,
      items: prev.items.map(it => it.section_temp_id === tempId ? { ...it, section_temp_id: null } : it),
    }));
  };

  const [sectionsSaveStatus, setSectionsSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const applySectionsOrder = (snapshot: PendingSection[], options?: { silent?: boolean }) => {
    const reindexed = snapshot.map((x, i) => ({ ...x, sort_order: i }));
    setSections(reindexed);
    persistSectionsOrder(reindexed, { silent: options?.silent });
  };

  const persistSectionsOrder = async (
    next: PendingSection[],
    options?: { previous?: PendingSection[]; silent?: boolean }
  ) => {
    if (!listId) return;
    const updates = next
      .map((s, i) => ({ id: s.id, sort_order: i }))
      .filter(u => !!u.id);
    if (updates.length === 0) return;
    setSectionsSaveStatus('saving');
    try {
      await Promise.all(updates.map(u =>
        supabase.from('list_sections').update({ sort_order: u.sort_order }).eq('id', u.id!)
      ));
      queryClient.invalidateQueries({ queryKey: ['my-birth-list-detail', listId] });
      setSectionsSaveStatus('success');
      window.setTimeout(() => {
        setSectionsSaveStatus(prev => (prev === 'success' ? 'idle' : prev));
      }, 2500);
      if (!options?.silent) {
        const description = lang === 'es'
          ? 'El nuevo orden se guardó en el servidor.'
          : 'El nou ordre s\'ha desat al servidor.';
        if (options?.previous) {
          const snapshot = options.previous;
          toast.success(lang === 'es' ? 'Orden actualizado' : 'Ordre actualitzat', {
            description,
            action: {
              label: lang === 'es' ? 'Deshacer' : 'Desfer',
              onClick: () => applySectionsOrder(snapshot, { silent: true }),
            },
          });
        } else {
          toast.success(lang === 'es' ? 'Orden actualizado' : 'Ordre actualitzat', { description });
        }
      }
    } catch (err: any) {
      setSectionsSaveStatus('error');
      toast.error(err.message || t('errors.generic'), {
        description: lang === 'es'
          ? 'No se pudo guardar el orden. Inténtalo de nuevo.'
          : 'No s\'ha pogut desar l\'ordre. Torna-ho a provar.',
        action: options?.previous ? {
          label: lang === 'es' ? 'Revertir' : 'Revertir',
          onClick: () => applySectionsOrder(options.previous!, { silent: true }),
        } : undefined,
      });
    }
  };

  const reorderSections = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setSections(prev => {
      const from = prev.findIndex(s => s.temp_id === fromId);
      const to = prev.findIndex(s => s.temp_id === toId);
      if (from < 0 || to < 0) return prev;
      const previous = prev.map(s => ({ ...s }));
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      const reindexed = next.map((x, i) => ({ ...x, sort_order: i }));
      persistSectionsOrder(reindexed, { previous });
      return reindexed;
    });
  };

  const moveSection = (tempId: string, direction: 'up' | 'down') => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.temp_id === tempId);
      if (idx < 0) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const previous = prev.map(s => ({ ...s }));
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      const reindexed = next.map((x, i) => ({ ...x, sort_order: i }));
      persistSectionsOrder(reindexed, { previous });
      return reindexed;
    });
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



  const handleSave = async () => {
    if (!user) return;
    if (!form.first_name.trim()) { toast.error(t('list.firstNameRequired')); return; }
    if (!listId && !form.password.trim()) { toast.error(t('list.passwordRequired')); return; }
    if (form.password && form.password.length < 6) { toast.error(t('list.passwordTooShort')); return; }

    setSaving(true);
    try {
      let currentId = listId;
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


      queryClient.invalidateQueries({ queryKey: ['my-birth-lists', user.id] });
      queryClient.invalidateQueries({ queryKey: ['my-birth-list-detail', currentId] });
      toast.success(t('common.success'));
      setForm(prev => ({ ...prev, password: '' }));
    } catch (err: any) {
      toast.error(err.message || t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} ${t('list.copied')}`);
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

  const atLimit = !isAdmin && myLists.length >= MAX_LISTS;

  const goToCreateChoice = () => {
    if (atLimit) return;
    resetEditor();
    setEditingListId(null);
    setSelectedTemplateId('');
    setCustomBabyName('');
    setCustomSectionCa('');
    setCustomSectionEs('');
    setView('create-choice');
  };

  const startCustomList = () => {
    if (atLimit) return;
    resetEditor();
    setEditingListId(null);
    setView('editor');
  };


  const startFromTemplate = async (tplId: string) => {
    if (atLimit) return;
    resetEditor();
    setEditingListId(null);
    setView('editor');
    await loadTemplate(tplId);
  };

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
                    onClick={() => copy(l.list_code, t('list.listCode'))}
                    title={t('list.listCode')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`/llista-naixement`, '_blank')}
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
          {templates.length > 0 && sections.length === 0 && form.items.length === 0 && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                {t('list.useTemplate')}
              </div>
              <p className="text-xs text-muted-foreground">{t('list.useTemplateHint')}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {templates.map((tpl: any) => {
                  const tr = tpl.list_template_translations?.find((tt: any) => tt.language === lang)
                    || tpl.list_template_translations?.[0];
                  const label = tr?.name || tpl.slug;
                  const isSel = selectedTemplateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      disabled={loadingTemplate}
                      onClick={() => loadTemplate(tpl.id)}
                      className={`group relative flex flex-col items-center justify-center gap-2 p-3 rounded-md border-2 bg-background hover:border-primary hover:bg-primary/5 transition-colors text-center min-h-[88px] ${isSel ? 'border-primary' : 'border-border'}`}
                    >
                      {loadingTemplate && isSel ? (
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      ) : (
                        <Heart className="h-6 w-6 text-primary" />
                      )}
                      <span className="text-xs font-medium line-clamp-2">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Sections composer + draggable bars */}
          <div className="rounded-md border border-border p-3 space-y-3">
            <Label className="text-sm font-semibold">{t('list.sections')}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
              <Input
                value={newSectionCa}
                placeholder={lang === 'es' ? 'Nombre sección (CA)' : 'Nom secció (CA)'}
                onChange={e => setNewSectionCa(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSection(); } }}
                className="h-9 text-sm"
              />
              <Input
                value={newSectionEs}
                placeholder={lang === 'es' ? 'Nombre sección (ES)' : 'Nom secció (ES)'}
                onChange={e => setNewSectionEs(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSection(); } }}
                className="h-9 text-sm"
              />
              <Button type="button" onClick={handleAddSection} className="gap-1">
                <Plus className="h-4 w-4" /> {t('list.addSection')}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-muted-foreground">
                {lang === 'es'
                  ? 'Las secciones aparecen abajo con sus productos. Usa las flechas o arrastra para reordenarlas.'
                  : 'Les seccions apareixen a sota amb els seus productes. Usa les fletxes o arrossega per reordenar-les.'}
              </p>
              {sectionsSaveStatus !== 'idle' && (
                <Badge
                  variant={sectionsSaveStatus === 'error' ? 'destructive' : 'outline'}
                  className="text-[10px] flex items-center gap-1"
                  aria-live="polite"
                >
                  {sectionsSaveStatus === 'saving' && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {lang === 'es' ? 'Guardando orden…' : 'Desant ordre…'}
                    </>
                  )}
                  {sectionsSaveStatus === 'success' && (
                    <>
                      <Check className="h-3 w-3 text-primary" />
                      {lang === 'es' ? 'Orden guardado' : 'Ordre desat'}
                    </>
                  )}
                  {sectionsSaveStatus === 'error' && (
                    <>{lang === 'es' ? 'Error al guardar' : 'Error en desar'}</>
                  )}
                </Badge>
              )}
            </div>
          </div>

          {/* Items grouped by section */}
          {loadingTemplate ? (
            <div className="space-y-4" aria-busy="true">
              {[0, 1, 2].map(i => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2 px-2 py-1.5 border-l-4 border-primary/40 bg-muted/40 rounded">
                    <div className="h-4 w-4 rounded bg-muted-foreground/20" />
                    <div className="h-4 flex-1 max-w-[180px] rounded bg-muted-foreground/20 animate-pulse" />
                    <div className="h-4 w-6 rounded bg-muted-foreground/20" />
                  </div>
                  <div className="space-y-2">
                    {[0, 1].map(j => (
                      <div key={j} className="h-14 rounded-md border border-border bg-background animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('list.templateLoading') !== 'list.templateLoading'
                  ? t('list.templateLoading')
                  : (lang === 'es' ? 'Cargando plantilla…' : 'Carregant plantilla…')}
              </div>
            </div>
          ) : form.items.length === 0 && sections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('list.emptyList')}</p>

          ) : (
            <div className="space-y-4">
              {[
                ...sections.map(s => ({ temp_id: s.temp_id, label: (lang === 'es' ? s.name_es : s.name_ca) || '(?)' })),
                { temp_id: '__none__', label: t('list.noSection') },
              ].map((sec, secIdx, arr) => {
                const sectionItems = form.items
                  .map((it, idx) => ({ it, idx }))
                  .filter(({ it }) => sec.temp_id === '__none__' ? !it.section_temp_id : it.section_temp_id === sec.temp_id);
                if (sec.temp_id === '__none__' && sectionItems.length === 0) return null;
                const isNone = sec.temp_id === '__none__';
                const realSectionsCount = arr.length - 1; // exclude __none__
                const canMoveUp = !isNone && secIdx > 0;
                const canMoveDown = !isNone && secIdx < realSectionsCount - 1;
                const isSectionDragging = !isNone && draggedSectionId === sec.temp_id;
                const isSectionDragOver = !isNone && dragOverSectionId === sec.temp_id && draggedSectionId && draggedSectionId !== sec.temp_id;
                return (
                  <div key={sec.temp_id} className="space-y-2">
                    <div
                      draggable={!isNone}
                      onDragStart={e => {
                        if (isNone) return;
                        e.stopPropagation();
                        setDraggedSectionId(sec.temp_id);
                      }}
                      onDragEnd={() => { setDraggedSectionId(null); setDragOverSectionId(null); }}
                      onDragOver={e => {
                        e.preventDefault();
                        if (!isNone && draggedSectionId && draggedSectionId !== sec.temp_id) {
                          setDragOverSectionId(sec.temp_id);
                        }
                      }}
                      onDragLeave={() => setDragOverSectionId(prev => prev === sec.temp_id ? null : prev)}
                      onDrop={e => {
                        e.preventDefault();
                        if (!isNone && draggedSectionId && draggedSectionId !== sec.temp_id) {
                          reorderSections(draggedSectionId, sec.temp_id);
                          setDraggedSectionId(null);
                          setDragOverSectionId(null);
                          return;
                        }
                        const payload = productDragRef.current;
                        const target = isNone ? null : sec.temp_id;
                        if (payload?.kind === 'move') assignItemSection(payload.itemIdx, target);
                        else if (payload?.kind === 'add') addProductToSection(payload.product, target);
                        productDragRef.current = null;
                      }}
                      className={`flex items-center gap-2 px-2 py-1.5 border-l-4 border-primary bg-muted/40 rounded transition-all ${
                        isSectionDragOver ? 'ring-2 ring-primary bg-primary/15' : ''
                      } ${isSectionDragging ? 'opacity-50' : ''} ${!isNone ? 'cursor-grab' : ''}`}
                    >
                      {!isNone && <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <FolderOpen className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold flex-1 truncate">{sec.label}</span>
                      <Badge variant="outline" className="text-[10px]">{sectionItems.length}</Badge>
                      {!isNone && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={!canMoveUp}
                            onClick={() => moveSection(sec.temp_id, 'up')}
                            title={lang === 'es' ? 'Subir sección' : 'Pujar secció'}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={!canMoveDown}
                            onClick={() => moveSection(sec.temp_id, 'down')}
                            title={lang === 'es' ? 'Bajar sección' : 'Baixar secció'}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeSection(sec.temp_id)}
                            title={lang === 'es' ? 'Eliminar sección' : 'Eliminar secció'}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                    {sectionItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic pl-3">
                        {lang === 'es' ? 'Sin productos. Arrastra uno aquí.' : "Sense productes. Arrossega'n un aquí."}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {sectionItems.map(({ it: item, idx }) => {
                          const isDragging = draggedItemIdx === idx;
                          const isDropTarget = dragOverItemIdx === idx && draggedItemIdx !== null && draggedItemIdx !== idx;
                          const showInsertAbove = isDropTarget && (draggedItemIdx as number) > idx;
                          const showInsertBelow = isDropTarget && (draggedItemIdx as number) < idx;
                          const itemPurchases = item.id ? (purchasesByItem[item.id] || []) : [];
                          const hasPaid = itemPurchases.some((p: any) => p.payment_status === 'paid');
                          const notifyLocked = (action: string) => {
                            const title = lang === 'es' ? 'Producto bloqueado' : 'Producte bloquejat';
                            const desc = lang === 'es'
                              ? `No se puede ${action}: este producto ya tiene compras pagadas. Solo se permiten cambios (cantidad, prioridad, sección o eliminar) mientras todas las compras estén pendientes.`
                              : `No es pot ${action}: aquest producte ja té compres pagades. Només es permeten canvis (quantitat, prioritat, secció o eliminar) mentre totes les compres estiguin pendents.`;
                            toast.error(title, { description: desc });
                          };
                          const lockGuard = (action: string) => (e: React.SyntheticEvent) => {
                            if (!hasPaid) return false;
                            e.preventDefault();
                            e.stopPropagation();
                            notifyLocked(action);
                            return true;
                          };
                          return (
                          <div key={idx} className="relative">
                            {showInsertAbove && (
                              <div className="absolute -top-1 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_0_2px_hsl(var(--primary)/0.25)] z-10 pointer-events-none" />
                            )}
                          <div
                            draggable={!hasPaid}
                            onDragStart={() => {
                              productDragRef.current = { kind: 'move', itemIdx: idx };
                              setDraggedItemIdx(idx);
                            }}
                            onDragEnd={() => {
                              productDragRef.current = null;
                              setDraggedItemIdx(null);
                              setDragOverItemIdx(null);
                            }}
                            onDragOver={e => {
                              if (draggedItemIdx === null || draggedItemIdx === idx) return;
                              e.preventDefault();
                              setDragOverItemIdx(idx);
                            }}
                            onDragLeave={() => setDragOverItemIdx(prev => prev === idx ? null : prev)}
                            onDrop={e => {
                              if (draggedItemIdx === null || draggedItemIdx === idx) return;
                              e.preventDefault();
                              e.stopPropagation();
                              reorderItem(draggedItemIdx, idx);
                              productDragRef.current = null;
                              setDraggedItemIdx(null);
                              setDragOverItemIdx(null);
                            }}
                            className={`flex items-center gap-3 p-3 border rounded-md bg-background transition-all ${
                              isDropTarget ? 'border-primary border-2 bg-primary/5 ring-2 ring-primary/20' : 'border-border'
                            } ${isDragging ? 'opacity-40 scale-[0.98] ring-2 ring-primary/40 shadow-lg cursor-grabbing' : 'cursor-grab hover:border-primary/40 hover:shadow-sm'}`}
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="h-12 w-12 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center border border-border">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.productName} className="h-full w-full object-cover" loading="lazy" />
                              ) : (
                                <Package className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.productName}</p>
                              {item.price !== undefined && (
                                <p className="text-xs text-muted-foreground">{formatPrice(item.price)}</p>
                              )}
                              {(() => {
                                if (itemPurchases.length === 0) {
                                  return (
                                    <p className="text-[11px] text-muted-foreground italic mt-1">
                                      {lang === 'es' ? 'Sin compras todavía' : 'Sense compres encara'}
                                    </p>
                                  );
                                }
                                const totalQty = itemPurchases.reduce((s: number, p: any) => s + (p.quantity || 0), 0);
                                return (
                                  <div className="mt-1.5 space-y-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <Badge variant="default" className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                                        <Check className="h-3 w-3 mr-0.5" />
                                        {lang === 'es' ? `Comprado: ${totalQty}/${item.quantity_desired}` : `Comprat: ${totalQty}/${item.quantity_desired}`}
                                      </Badge>
                                      {hasPaid ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 cursor-help gap-1">
                                              <Lock className="h-3 w-3" />
                                              {lang === 'es' ? 'Bloqueado' : 'Bloquejat'}
                                              <Info className="h-3 w-3 opacity-70" />
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-xs text-xs">
                                            {lang === 'es' ? (
                                              <div className="space-y-1">
                                                <p className="font-semibold">Producto bloqueado</p>
                                                <p>Este producto tiene compras con pago confirmado, por lo que no se puede modificar ni eliminar.</p>
                                                <p className="text-muted-foreground">Solo se permite editar cantidad, prioridad, sección o eliminar el producto mientras todas las compras estén en estado <strong>pendiente</strong>.</p>
                                              </div>
                                            ) : (
                                              <div className="space-y-1">
                                                <p className="font-semibold">Producte bloquejat</p>
                                                <p>Aquest producte té compres amb pagament confirmat, així que no es pot modificar ni eliminar.</p>
                                                <p className="text-muted-foreground">Només es pot editar quantitat, prioritat, secció o eliminar el producte mentre totes les compres estiguin en estat <strong>pendent</strong>.</p>
                                              </div>
                                            )}
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 cursor-help gap-1">
                                              <Clock className="h-3 w-3" />
                                              {lang === 'es' ? 'Editable (pendiente)' : 'Editable (pendent)'}
                                              <Info className="h-3 w-3 opacity-70" />
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-xs text-xs">
                                            {lang === 'es' ? (
                                              <div className="space-y-1">
                                                <p className="font-semibold">Compras pendientes de pago</p>
                                                <p>Aún puedes modificar la cantidad, la prioridad, cambiar de sección o eliminar el producto.</p>
                                                <p className="text-muted-foreground">Cuando alguna compra pase a <strong>pagada</strong>, el producto quedará bloqueado automáticamente.</p>
                                              </div>
                                            ) : (
                                              <div className="space-y-1">
                                                <p className="font-semibold">Compres pendents de pagament</p>
                                                <p>Encara pots modificar la quantitat, la prioritat, canviar de secció o eliminar el producte.</p>
                                                <p className="text-muted-foreground">Quan alguna compra passi a <strong>pagada</strong>, el producte quedarà bloquejat automàticament.</p>
                                              </div>
                                            )}
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      {itemPurchases.map((p: any, i: number) => (
                                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                          <User className="h-3 w-3 shrink-0" />
                                          <span className="font-medium text-foreground truncate">
                                            {p.buyer_full_name || (lang === 'es' ? '(sin nombre)' : '(sense nom)')}
                                          </span>
                                          <span>×{p.quantity}</span>
                                          <span className={`px-1 rounded ${p.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {p.payment_status === 'paid'
                                              ? (lang === 'es' ? 'pagado' : 'pagat')
                                              : (lang === 'es' ? 'pendiente' : 'pendent')}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                            {sections.length > 0 && (
                              <select
                                value={item.section_temp_id || ''}
                                onChange={e => { if (hasPaid) { notifyLocked(lang === 'es' ? 'reasignar la sección' : 'reassignar la secció'); return; } assignItemSection(idx, e.target.value || null); }}
                                onMouseDown={e => { if (hasPaid) { e.preventDefault(); notifyLocked(lang === 'es' ? 'reasignar la sección' : 'reassignar la secció'); } }}
                                aria-disabled={hasPaid}
                                className={`h-8 rounded-md border border-input bg-background px-2 text-xs max-w-[140px] ${hasPaid ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <option value="">— {t('list.noSection')} —</option>
                                {sections.map(s => (
                                  <option key={s.temp_id} value={s.temp_id}>
                                    {(lang === 'es' ? s.name_es : s.name_ca) || '(?)'}
                                  </option>
                                ))}
                              </select>
                            )}
                            <div className="w-20">
                              <Input
                                type="number"
                                min={1}
                                value={item.quantity_desired}
                                onChange={e => { if (hasPaid) { notifyLocked(lang === 'es' ? 'cambiar la cantidad' : 'canviar la quantitat'); return; } updateItem(idx, 'quantity_desired', parseInt(e.target.value) || 1); }}
                                onFocus={e => { if (hasPaid) { (e.target as HTMLInputElement).blur(); notifyLocked(lang === 'es' ? 'cambiar la cantidad' : 'canviar la quantitat'); } }}
                                readOnly={hasPaid}
                                className={`h-8 ${hasPaid ? 'opacity-50 cursor-not-allowed' : ''}`}
                              />
                            </div>
                            <div
                              onPointerDownCapture={e => { if (hasPaid) { e.preventDefault(); e.stopPropagation(); notifyLocked(lang === 'es' ? 'cambiar la prioridad' : 'canviar la prioritat'); } }}
                              className={hasPaid ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                              <Select value={item.priority} onValueChange={v => { if (hasPaid) return; updateItem(idx, 'priority', v); }}>
                                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="high">{t('list.priorityHigh')}</SelectItem>
                                  <SelectItem value="medium">{t('list.priorityMedium')}</SelectItem>
                                  <SelectItem value="low">{t('list.priorityLow')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { if (hasPaid) { notifyLocked(lang === 'es' ? 'eliminar el producto' : 'eliminar el producte'); return; } removeItem(idx); }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                            {showInsertBelow && (
                              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_0_2px_hsl(var(--primary)/0.25)] z-10 pointer-events-none" />
                            )}
                          </div>
                          );
                        })}

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>

          {/* Product search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={productSearch}
              onChange={e => handleProductSearch(e.target.value)}
              placeholder={t('admin.searchProductToAdd')}
              className="pl-10"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
                {searchResults.map(p => {
                  const tr = p.product_translations?.find((t: any) => t.language === lang) || p.product_translations?.[0];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between items-center"
                    >
                      <span>{tr?.name || p.slug}</span>
                      <span className="text-xs text-muted-foreground">{formatPrice(p.base_price)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Browse products with thumbnails */}
          <div className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setBrowseOpen(v => !v)}
              className="w-full flex items-center justify-between gap-2 p-3 text-sm font-medium hover:bg-muted/50"
            >
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                {lang === 'es' ? 'Explorar productos del catálogo' : 'Explorar productes del catàleg'}
              </span>
              {browseOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {browseOpen && (
              <div className="border-t border-border p-3 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBrowseCategory('all')}
                    className={`px-2.5 py-1 rounded-full text-xs border ${browseCategory === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
                  >
                    {lang === 'es' ? 'Todas' : 'Totes'}
                  </button>
                  {browseCategories.map((c: any) => {
                    const tr = c.category_translations?.find((tt: any) => tt.language === lang) || c.category_translations?.[0];
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setBrowseCategory(c.id)}
                        className={`px-2.5 py-1 rounded-full text-xs border ${browseCategory === c.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
                      >
                        {tr?.name || c.slug}
                      </button>
                    );
                  })}
                </div>

                {sections.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {lang === 'es'
                      ? 'Haz clic para añadirlo o arrástralo sobre una sección de arriba.'
                      : 'Fes clic per afegir-lo o arrossega’l sobre una secció de dalt.'}
                  </p>
                )}

                {browseLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : browseProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {lang === 'es' ? 'No hay productos en esta categoría.' : 'No hi ha productes en aquesta categoria.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[480px] overflow-y-auto pr-1">
                    {browseProducts.map((p: any) => {
                      const tr = p.product_translations?.find((tt: any) => tt.language === lang) || p.product_translations?.[0];
                      const imgs = (p.product_images || []).slice().sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order || 0) - (b.sort_order || 0));
                      const img = imgs[0]?.image_url;
                      const added = form.items.some(it => it.product_id === p.id);
                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={() => { productDragRef.current = { kind: 'add', product: p }; }}
                          onDragEnd={() => { productDragRef.current = null; }}
                          onClick={() => !added && addProduct(p)}
                          className={`group relative flex flex-col items-stretch gap-1 p-2 rounded-md border-2 bg-background transition-colors text-left cursor-grab ${added ? 'border-primary/40 opacity-70 cursor-not-allowed' : 'border-border hover:border-primary hover:bg-primary/5'}`}
                        >
                          <div className="aspect-square w-full bg-muted rounded overflow-hidden flex items-center justify-center">
                            {img ? (
                              <img src={img} alt={tr?.name || p.slug} className="w-full h-full object-cover pointer-events-none" loading="lazy" />
                            ) : (
                              <Package className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <span className="text-xs font-medium line-clamp-2">{tr?.name || p.slug}</span>
                          <span className="text-[11px] text-muted-foreground">{formatPrice(p.base_price)}</span>
                          {added ? (
                            <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                              <Check className="h-3 w-3" />
                            </span>
                          ) : (
                            <span className="absolute top-1 right-1 bg-background/90 border border-border rounded-full p-0.5 opacity-0 group-hover:opacity-100">
                              <Plus className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

      </Card>




      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {listId ? t('common.save') : t('list.createList')}
        </Button>
      </div>
    </div>
  );
};

export default MyBirthListPage;
