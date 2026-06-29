import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Search, Copy, Eye, EyeOff, Package, FolderOpen, ChevronUp, ChevronDown, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { useDefaultListSections, pickSectionName } from '@/hooks/useDefaultListSections';
import { useLanguages } from '@/hooks/useLanguages';
import LanguageTabs from '@/components/admin/LanguageTabs';
import FamilyProductSelector from '@/components/list/FamilyProductSelector';

interface Owner {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  is_primary: boolean;
}

interface ListItem {
  id?: string;
  product_id: string;
  variant_id: string | null;
  quantity_desired: number;
  priority: string;
  sort_order: number;
  section_temp_id?: string | null;
  // joined
  productName?: string;
  variantLabel?: string;
  price?: number;
  image_url?: string | null;
}

interface PendingSection {
  temp_id: string;
  id?: string;
  name_ca: string;
  name_es: string;
  sort_order: number;
  translations: Record<string, string>; // language_code -> name
}

const pickProductImage = (p: any): string | null => {
  const imgs = p?.product_images || [];
  if (!imgs.length) return null;
  const primary = imgs.find((i: any) => i.is_primary);
  return (primary || imgs[0])?.image_url || null;
};

interface ListForm {
  list_code: string;
  password: string;
  baby_name: string;
  expected_date: string;
  status: string;
  notes: string;
  owners: Owner[];
  items: ListItem[];
}

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MUSSOLET-';
  code += new Date().getFullYear() + '-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const AdminBirthListForm: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'nova';
  const queryClient = useQueryClient();
  const lang = i18n.language === 'es' ? 'es' : 'ca';

  const [form, setForm] = useState<ListForm>({
    list_code: generateCode(),
    password: '',
    baby_name: '',
    expected_date: '',
    status: 'draft',
    notes: '',
    owners: [{ first_name: '', last_name: '', email: '', is_primary: true }],
    items: [],
  });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [sections, setSections] = useState<PendingSection[]>([]);
  const [activeSectionTempId, setActiveSectionTempId] = useState<string | null>(null);
  const [browseCategory, setBrowseCategory] = useState<string>('all');
  const [browseSearch, setBrowseSearch] = useState('');
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [translatingTempId, setTranslatingTempId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const { data: enabledLanguages = [] } = useLanguages({ onlyEnabled: true });

  const { data: defaultSectionsData = [] } = useDefaultListSections({ onlyActive: true });

  // Available templates (admin can preload a list configuration from one)
  const { data: templates = [] } = useQuery({
    queryKey: ['admin-birthlist-templates'],
    enabled: isNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_templates')
        .select('id, slug, is_active, list_template_translations(language, name)')
        .eq('is_active', true)
        .order('slug');
      if (error) throw error;
      return data || [];
    },
  });

  const templateLabel = (tpl: any): string => {
    const tr = (tpl.list_template_translations || []).find((x: any) => x.language === lang)
      || (tpl.list_template_translations || [])[0];
    return tr?.name || tpl.slug;
  };

  const applyTemplate = async (templateId: string) => {
    if (!templateId) return;
    setLoadingTemplate(true);
    try {
      const [secRes, itemRes] = await Promise.all([
        supabase
          .from('list_template_sections')
          .select('id, name_ca, name_es, sort_order')
          .eq('template_id', templateId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('list_template_items')
          .select(`
            id, product_id, section_id, quantity, sort_order,
            product:products(
              id, base_price, slug, stock_quantity, has_variants,
              product_translations(language, name),
              product_images(image_url, is_primary, sort_order),
              product_variants(stock_quantity, is_active)
            )
          `)
          .eq('template_id', templateId)
          .order('sort_order', { ascending: true }),
      ]);
      if (secRes.error) throw secRes.error;
      if (itemRes.error) throw itemRes.error;

      const secs = secRes.data || [];
      const its = itemRes.data || [];

      const nextSections: PendingSection[] = secs.map((s: any, i: number) => ({
        temp_id: `tpl-${s.id}`,
        name_ca: s.name_ca || '',
        name_es: s.name_es || s.name_ca || '',
        sort_order: i,
        translations: {
          ...(s.name_ca ? { ca: s.name_ca } : {}),
          ...(s.name_es ? { es: s.name_es } : {}),
        },
      }));

      const getStock = (p: any): number => {
        const vs = (p?.product_variants || []).filter((v: any) => v.is_active !== false);
        if (vs.length > 0) return vs.reduce((s: number, v: any) => s + (v.stock_quantity || 0), 0);
        return p?.stock_quantity || 0;
      };
      const skipped: string[] = [];
      const nextItems: ListItem[] = [];
      its.forEach((it: any, i: number) => {
        const tr = it.product?.product_translations?.find((x: any) => x.language === lang)
          || it.product?.product_translations?.[0];
        const name = tr?.name || it.product?.slug || it.product_id;
        if (getStock(it.product) <= 0) {
          skipped.push(name);
          return;
        }
        nextItems.push({
          product_id: it.product_id,
          variant_id: null,
          quantity_desired: it.quantity || 1,
          priority: 'medium',
          sort_order: i,
          productName: name,
          price: it.product?.base_price,
          image_url: pickProductImage(it.product),
          section_temp_id: it.section_id ? `tpl-${it.section_id}` : null,
        });
      });

      setSections(nextSections);
      setActiveSectionTempId(nextSections[0]?.temp_id ?? null);
      setForm(prev => ({ ...prev, items: nextItems }));
      setDefaultsLoaded(true); // prevent the default-sections effect from overriding
      notify.success(
        lang === 'es'
          ? `Plantilla cargada: ${nextSections.length} familias, ${nextItems.length} productos`
          : `Plantilla carregada: ${nextSections.length} famílies, ${nextItems.length} productes`,
      );
      if (skipped.length > 0) {
        notify.warning(
          (lang === 'es'
            ? `${skipped.length} producto(s) sin stock no se añadieron: `
            : `${skipped.length} producte(s) sense estoc no s'han afegit: `) + skipped.join(', '),
          { duration: 8000 },
        );
      }
    } catch (err: any) {
      notify.error(err?.message || (lang === 'es' ? 'No se pudo cargar la plantilla' : 'No s\'ha pogut carregar la plantilla'));
    } finally {
      setLoadingTemplate(false);
    }
  };


  // Pre-load default sections when creating a new list
  useEffect(() => {
    if (!isNew || defaultsLoaded) return;
    if (defaultSectionsData.length === 0) return;
    const initial: PendingSection[] = defaultSectionsData.map((s, i) => {
      const translations: Record<string, string> = {};
      (s.translations || []).forEach(tr => {
        if (tr?.name) translations[tr.language] = tr.name;
      });
      return {
        temp_id: `def-${s.id}`,
        name_ca: pickSectionName(s, 'ca'),
        name_es: pickSectionName(s, 'es'),
        sort_order: i,
        translations,
      };
    });
    setSections(initial);
    setActiveSectionTempId(initial[0]?.temp_id ?? null);
    setDefaultsLoaded(true);
  }, [isNew, defaultsLoaded, defaultSectionsData]);

  // Existing sections when editing
  const { data: existingSections } = useQuery({
    queryKey: ['admin-birth-list-sections', id],
    enabled: !isNew && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_sections')
        .select('id, name_ca, name_es, sort_order, list_section_translations(language_code, name)')
        .eq('list_id', id!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (existingSections && existingSections.length > 0) {
      const mapped: PendingSection[] = existingSections.map((s: any) => {
        const translations: Record<string, string> = {};
        (s.list_section_translations || []).forEach((tr: any) => {
          if (tr?.name) translations[tr.language_code] = tr.name;
        });
        if (s.name_ca && !translations.ca) translations.ca = s.name_ca;
        if (s.name_es && !translations.es) translations.es = s.name_es;
        return {
          temp_id: `ex-${s.id}`,
          id: s.id,
          name_ca: s.name_ca || '',
          name_es: s.name_es || '',
          sort_order: s.sort_order ?? 0,
          translations,
        };
      });
      setSections(mapped);
      setActiveSectionTempId(prev => prev ?? mapped[0]?.temp_id ?? null);
      setDefaultsLoaded(true);
    }
  }, [existingSections]);

  // Categories for the browse filter (same source as client)
  const { data: browseCategories = [] } = useQuery({
    queryKey: ['admin-birthlist-browse-cats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, slug, category_translations(language, name)')
        .eq('is_active', true)
        .order('sort_order');
      return data || [];
    },
  });

  // Browse products grid
  const { data: browseProducts = [], isFetching: browseLoading } = useQuery({
    queryKey: ['admin-birthlist-browse-products', browseCategory],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select(`id, base_price, slug, category_id, stock_quantity, has_variants, product_translations(language, name), product_images(image_url, is_primary, sort_order), product_variants(stock_quantity, is_active)`)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(60);
      if (browseCategory !== 'all') q = q.eq('category_id', browseCategory);
      const { data } = await q;
      return data || [];
    },
  });

  const getEffectiveStock = (product: any): number => {
    const variants = (product?.product_variants || []).filter((v: any) => v.is_active !== false);
    if (variants.length > 0) return variants.reduce((s: number, v: any) => s + (v.stock_quantity || 0), 0);
    return product?.stock_quantity || 0;
  };

  const filteredBrowse = useMemo(() => {
    const q = browseSearch.trim().toLowerCase();
    if (!q) return browseProducts;
    return browseProducts.filter((p: any) => {
      const tr = p.product_translations?.find((t: any) => t.language === lang)
        || p.product_translations?.[0];
      return (tr?.name || p.slug || '').toLowerCase().includes(q);
    });
  }, [browseProducts, browseSearch, lang]);

  // Load existing list
  const { data: existingList, isLoading } = useQuery({
    queryKey: ['admin-birth-list', id],
    enabled: !isNew && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('birth_lists')
        .select('id, list_code, status, baby_name, expected_date, template_id, notes, created_by, created_at, updated_at')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: existingOwners } = useQuery({
    queryKey: ['admin-birth-list-owners', id],
    enabled: !isNew && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_owners')
        .select('*')
        .eq('list_id', id!);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: existingItems } = useQuery({
    queryKey: ['admin-birth-list-items', id],
    enabled: !isNew && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_items')
        .select(`
          id, product_id, variant_id, section_id, quantity_desired, quantity_purchased, priority, sort_order,
          product:products(
            id, base_price,
            product_translations(language, name),
            product_images(image_url, is_primary, sort_order)
          )
        `)
        .eq('list_id', id!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (existingList && !isNew) {
      setForm(prev => ({
        ...prev,
        list_code: existingList.list_code,
        password: '', // don't show existing password
        baby_name: existingList.baby_name || '',
        expected_date: existingList.expected_date || '',
        status: existingList.status || 'draft',
        notes: existingList.notes || '',
      }));
    }
  }, [existingList, isNew]);

  useEffect(() => {
    if (existingOwners && existingOwners.length > 0) {
      setForm(prev => ({
        ...prev,
        owners: existingOwners.map(o => ({
          id: o.id,
          first_name: o.first_name,
          last_name: o.last_name,
          email: o.email,
          is_primary: o.is_primary ?? false,
        })),
      }));
    }
  }, [existingOwners]);

  useEffect(() => {
    if (existingItems && existingItems.length > 0) {
      setForm(prev => ({
        ...prev,
        items: existingItems.map((item: any) => {
          const tr = item.product?.product_translations?.find((t: any) => t.language === lang)
            || item.product?.product_translations?.[0];
          return {
            id: item.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity_desired: item.quantity_desired,
            priority: item.priority,
            sort_order: item.sort_order,
            productName: tr?.name || item.product_id,
            price: item.product?.base_price,
            image_url: pickProductImage(item.product),
            section_temp_id: item.section_id ? `ex-${item.section_id}` : null,
          };
        }),
      }));
    }
  }, [existingItems, lang]);

  // Product search
  const handleProductSearch = async (query: string) => {
    setProductSearch(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }

    const { data } = await supabase
      .from('products')
      .select(`id, base_price, slug, stock_quantity, has_variants, product_translations(language, name), product_variants(stock_quantity, is_active)`)
      .eq('is_active', true)
      .limit(10);

    const filtered = (data || []).filter(p => {
      const tr = (p as any).product_translations?.find((t: any) => t.language === lang)
        || (p as any).product_translations?.[0];
      return tr?.name?.toLowerCase().includes(query.toLowerCase());
    });

    setSearchResults(filtered);
  };

  const addProduct = (product: any, sectionTempId?: string | null) => {
    const targetSection = sectionTempId !== undefined ? sectionTempId : activeSectionTempId;
    const existingIdx = form.items.findIndex(i => i.product_id === product.id);
    if (existingIdx >= 0) {
      // Already added — reassign section to the target one.
      setForm(prev => ({
        ...prev,
        items: prev.items.map((it, i) => i === existingIdx ? { ...it, section_temp_id: targetSection } : it),
      }));
      notify.success(lang === 'es' ? 'Producto reasignado' : 'Producte reassignat');
      return;
    }

    if (getEffectiveStock(product) <= 0) {
      notify.error(lang === 'es'
        ? 'Este producto no tiene stock. Busca uno similar.'
        : 'Aquest producte no té estoc. Busca\'n un de similar.');
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
        section_temp_id: targetSection,
      }],
    }));
    setProductSearch('');
    setSearchResults([]);
  };

  /** Quick selector: toggle a product on/off and auto-create the family section. */
  const toggleProductFromFamily = (product: any, checked: boolean) => {
    if (!checked) {
      setForm(prev => ({ ...prev, items: prev.items.filter(it => it.product_id !== product.id) }));
      return;
    }
    if (form.items.some(i => i.product_id === product.id)) return;
    let targetTempId: string | null = null;
    if (product.default_section_id) {
      targetTempId = `def-${product.default_section_id}`;
      if (!sections.some(s => s.temp_id === targetTempId)) {
        const def = defaultSectionsData.find(d => d.id === product.default_section_id);
        const nameCa = def?.translations.find(tr => tr.language === 'ca')?.name || def?.slug || 'Família';
        const nameEs = def?.translations.find(tr => tr.language === 'es')?.name || nameCa;
        setSections(prev => [
          ...prev,
          { temp_id: targetTempId!, name_ca: nameCa, name_es: nameEs, sort_order: prev.length, translations: { ca: nameCa, es: nameEs } } as any,
        ]);
      }
    }
    addProduct(product, targetTempId);
  };

  const selectedProductIds = useMemo(
    () => new Set(form.items.map(i => i.product_id)),
    [form.items],
  );

  const addSection = () => {
    const ca = window.prompt(lang === 'es' ? 'Nombre de la familia (catalán)' : 'Nom de la família (català)')?.trim();
    if (!ca) return;
    const es = window.prompt(lang === 'es' ? 'Nombre de la familia (castellano)' : 'Nom de la família (castellà)')?.trim() || ca;
    setSections(prev => {
      const next: PendingSection[] = [...prev, {
        temp_id: `new-${Date.now()}-${prev.length}`,
        name_ca: ca, name_es: es, sort_order: prev.length,
        translations: { ca, es },
      }];
      if (!activeSectionTempId) setActiveSectionTempId(next[next.length - 1].temp_id);
      return next;
    });
  };

  const removeSection = (tempId: string) => {
    if (!confirm(lang === 'es' ? 'Eliminar esta familia? Los productos asignados quedarán sin familia.' : 'Eliminar aquesta família? Els productes assignats quedaran sense família.')) return;
    setSections(prev => prev.filter(s => s.temp_id !== tempId).map((x, i) => ({ ...x, sort_order: i })));
    setForm(prev => ({
      ...prev,
      items: prev.items.map(it => it.section_temp_id === tempId ? { ...it, section_temp_id: null } : it),
    }));
    setActiveSectionTempId(prev => prev === tempId ? null : prev);
  };

  const moveSection = (tempId: string, dir: 'up' | 'down') => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.temp_id === tempId);
      if (idx < 0) return prev;
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((x, i) => ({ ...x, sort_order: i }));
    });
  };

  const assignItemToSection = (idx: number, sectionTempId: string | null) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((it, i) => i === idx ? { ...it, section_temp_id: sectionTempId } : it),
    }));
  };

  const removeItem = (idx: number) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const addOwner = () => {
    if (form.owners.length >= 2) return;
    setForm(prev => ({
      ...prev,
      owners: [...prev.owners, { first_name: '', last_name: '', email: '', is_primary: false }],
    }));
  };

  const removeOwner = (idx: number) => {
    setForm(prev => ({ ...prev, owners: prev.owners.filter((_, i) => i !== idx) }));
  };

  const updateOwner = (idx: number, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      owners: prev.owners.map((o, i) => i === idx ? { ...o, [field]: value } : o),
    }));
  };

  const handleSave = async () => {
    if (!form.list_code.trim()) { notify.error('Codi de llista requerit'); return; }
    if (isNew && !form.password.trim()) { notify.error('Contrasenya requerida'); return; }
    if (form.owners.length === 0 || !form.owners[0].first_name.trim()) {
      notify.error('Mínim un propietari'); return;
    }

    // Validate every section has at least the default-language name filled
    // so the public list never renders a blank family header.
    const defaultCode = (enabledLanguages.find(l => l.is_default)?.code) || enabledLanguages[0]?.code || 'ca';
    const invalidSection = sections.find(s => {
      const value = s.translations?.[defaultCode]
        ?? (defaultCode === 'ca' ? s.name_ca : defaultCode === 'es' ? s.name_es : '');
      return !value || !value.trim();
    });
    if (invalidSection) {
      notify.error(
        lang === 'es'
          ? `Una familia no tiene nombre en el idioma principal (${defaultCode.toUpperCase()}). Edita sus traducciones antes de guardar.`
          : `Una família no té nom en l'idioma principal (${defaultCode.toUpperCase()}). Edita'n les traduccions abans de desar.`,
      );
      setTranslatingTempId(invalidSection.temp_id);
      return;
    }

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
      let listId = id;
      let passwordHash: string | undefined;

      // Hash password if provided
      if (form.password.trim()) {
        const { data: hashData, error: hashError } = await supabase.functions.invoke('hash-password-util', {
          body: { password: form.password },
        });
        if (hashError || !hashData?.hash) throw new Error('Error hashing password');
        passwordHash = hashData.hash;
      }

      if (isNew) {
        const { data, error } = await supabase
          .from('birth_lists')
          .insert({
            list_code: form.list_code.trim().toUpperCase(),
            password_hash: passwordHash!,
            baby_name: form.baby_name || null,
            expected_date: form.expected_date || null,
            status: form.status,
            notes: form.notes || null,
          })
          .select('id')
          .single();
        if (error) throw error;
        listId = data.id;
      } else {
        const updateData: any = {
          list_code: form.list_code.trim().toUpperCase(),
          baby_name: form.baby_name || null,
          expected_date: form.expected_date || null,
          status: form.status,
          notes: form.notes || null,
        };
        if (passwordHash) updateData.password_hash = passwordHash;

        const { error } = await supabase
          .from('birth_lists')
          .update(updateData)
          .eq('id', listId!);
        if (error) throw error;
      }

      // Upsert owners: delete existing + insert new
      await supabase.from('list_owners').delete().eq('list_id', listId!);
      if (form.owners.length > 0) {
        const ownersToInsert = form.owners
          .filter(o => o.first_name.trim())
          .map(o => ({
            list_id: listId!,
            first_name: o.first_name.trim(),
            last_name: o.last_name.trim(),
            email: o.email.trim(),
            is_primary: o.is_primary,
          }));
        if (ownersToInsert.length > 0) {
          const { error } = await supabase.from('list_owners').insert(ownersToInsert);
          if (error) throw error;
        }
      }

      // Sections: resync (delete all + insert with new ids; build temp_id->real id map)
      await supabase.from('list_items').delete().eq('list_id', listId!);
      await supabase.from('list_sections').delete().eq('list_id', listId!);

      const sectionIdMap = new Map<string, string>(); // temp_id -> real id
      if (sections.length > 0) {
        const toInsert = sections.map((s, i) => ({
          list_id: listId!,
          name_ca: (s.translations?.ca || s.name_ca || s.name_es || '').trim(),
          name_es: (s.translations?.es || s.name_es || s.name_ca || '').trim(),
          sort_order: i,
        }));
        const { data: insertedSecs, error: secErr } = await supabase
          .from('list_sections')
          .insert(toInsert)
          .select('id, sort_order');
        if (secErr) throw secErr;
        sections.forEach((s, i) => {
          const match = insertedSecs?.find((x: any) => x.sort_order === i);
          if (match) sectionIdMap.set(s.temp_id, match.id);
        });

        // Sync per-language translations
        const trRows: Array<{ section_id: string; language_code: string; name: string }> = [];
        sections.forEach((s) => {
          const realId = sectionIdMap.get(s.temp_id);
          if (!realId) return;
          Object.entries(s.translations || {}).forEach(([code, name]) => {
            const trimmed = (name || '').trim();
            if (trimmed) trRows.push({ section_id: realId, language_code: code, name: trimmed });
          });
          // Make sure legacy ca/es are also mirrored if not in translations
          if (!s.translations?.ca && s.name_ca?.trim()) {
            trRows.push({ section_id: realId, language_code: 'ca', name: s.name_ca.trim() });
          }
          if (!s.translations?.es && s.name_es?.trim()) {
            trRows.push({ section_id: realId, language_code: 'es', name: s.name_es.trim() });
          }
        });
        if (trRows.length > 0) {
          const { error: trErr } = await supabase
            .from('list_section_translations')
            .upsert(trRows, { onConflict: 'section_id,language_code' });
          if (trErr) throw trErr;
        }
      }

      if (form.items.length > 0) {
        const itemsToInsert = form.items.map((item, idx) => ({
          list_id: listId!,
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

      queryClient.invalidateQueries({ queryKey: ['admin-birth-lists'] });
      queryClient.invalidateQueries({ queryKey: ['admin-birth-list', listId] });
      notify.success(t('common.success'));
      navigate('/admin/llistes');
    } catch (err: any) {
      const detail = err?.message || err?.error_description || t('errors.generic');
      notify.error(
        lang === 'es'
          ? `No se ha podido guardar la lista: ${detail}`
          : `No s'ha pogut desar la llista: ${detail}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const [deleteStep, setDeleteStep] = useState<'idle' | 'first' | 'orders' | 'final'>('idle');
  const [ordersCount, setOrdersCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewCounts, setPreviewCounts] = useState<{
    orders: number;
    order_items: number;
    list_items: number;
    list_sections: number;
    list_owners: number;
  }>({ orders: 0, order_items: 0, list_items: 0, list_sections: 0, list_owners: 0 });
  const REQUIRED_PHRASE = 'ELIMINAR';
  const canConfirmDelete = confirmChecked && confirmPhrase.trim().toUpperCase() === REQUIRED_PHRASE;

  // Reset confirmation state whenever the final dialog opens/closes
  useEffect(() => {
    if (deleteStep !== 'final') {
      setConfirmChecked(false);
      setConfirmPhrase('');
    }
  }, [deleteStep]);

  const openDeleteDialog = async () => {
    if (isNew || !id) return;
    if (loadingPreview || deleting) return; // guard against double click
    setLoadingPreview(true);
    try {
      // Get orders + their ids (to count order_items)
      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select('id')
        .eq('list_id', id);
      if (ordersErr) throw ordersErr;
      const orderIds = (ordersData ?? []).map((o: any) => o.id);

      const headCount = async (table: any, col: string, val: any) => {
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq(col, val);
        if (error) throw error;
        return count ?? 0;
      };

      let orderItemsCount = 0;
      if (orderIds.length > 0) {
        const { count, error } = await supabase
          .from('order_items')
          .select('id', { count: 'exact', head: true })
          .in('order_id', orderIds);
        if (error) throw error;
        orderItemsCount = count ?? 0;
      }

      const [listItems, listSections, listOwners] = await Promise.all([
        headCount('list_items', 'list_id', id),
        headCount('list_sections', 'list_id', id),
        headCount('list_owners', 'list_id', id),
      ]);

      const counts = {
        orders: orderIds.length,
        order_items: orderItemsCount,
        list_items: listItems,
        list_sections: listSections,
        list_owners: listOwners,
      };
      setPreviewCounts(counts);
      setOrdersCount(counts.orders);
      setDeleteStep(counts.orders > 0 ? 'orders' : 'final');
    } catch (err: any) {
      notify.error(err?.message || t('errors.generic'));
    } finally {
      setLoadingPreview(false);
    }
  };

  const performDelete = async () => {
    if (isNew || !id) return;
    if (deleting) return; // guard against double click
    if (!canConfirmDelete) {
      notify.error(t('admin.deleteListConfirmRequired', 'Marca la casella i escriu ELIMINAR per confirmar.'));
      return;
    }
    setDeleting(true);
    try {
      // Cascading delete done client-side: admins have full RLS access on all
      // related tables. This surfaces precise errors per step (the previous
      // edge-function path returned opaque non-2xx failures).
      // 1) Orders + order_items
      const { data: ordersToDel, error: ordersFetchErr } = await supabase
        .from('orders').select('id').eq('list_id', id);
      if (ordersFetchErr) throw new Error(`Comandes: ${ordersFetchErr.message}`);

      const orderIds = (ordersToDel ?? []).map(o => o.id);
      if (orderIds.length > 0) {
        const { error: oiErr } = await supabase
          .from('order_items').delete().in('order_id', orderIds);
        if (oiErr) throw new Error(`Items de comanda: ${oiErr.message}`);

        const { error: oErr } = await supabase
          .from('orders').delete().in('id', orderIds);
        if (oErr) throw new Error(`Comandes: ${oErr.message}`);
      }

      // 2) List items, sections, owners
      const { error: liErr } = await supabase
        .from('list_items').delete().eq('list_id', id);
      if (liErr) throw new Error(`Articles de la llista: ${liErr.message}`);

      const { error: lsErr } = await supabase
        .from('list_sections').delete().eq('list_id', id);
      if (lsErr) throw new Error(`Seccions: ${lsErr.message}`);

      const { error: loErr } = await supabase
        .from('list_owners').delete().eq('list_id', id);
      if (loErr) throw new Error(`Propietaris: ${loErr.message}`);

      // 3) Birth list itself (verify a row was deleted)
      const { data: blDel, error: blErr } = await supabase
        .from('birth_lists').delete().eq('id', id).select('id');
      if (blErr) throw new Error(`Llista: ${blErr.message}`);
      if (!blDel || blDel.length === 0) {
        throw new Error('La llista no s\'ha pogut eliminar (no trobada o sense permisos).');
      }

      queryClient.invalidateQueries({ queryKey: ['admin-birth-lists'] });
      notify.success(t('common.success'));
      navigate('/admin/llistes');
    } catch (err: any) {
      console.error('[admin] delete birth list failed:', err);
      notify.error(err?.message || t('errors.generic'));
    } finally {
      setDeleting(false);
      setDeleteStep('idle');
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/llistes')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('common.back')}
        </Button>
        <h1 className="font-display text-2xl font-bold">
          {isNew ? t('admin.newList') : t('admin.editList')}
        </h1>
      </div>

      <div className="space-y-6">
        {/* Template loader — only when creating */}
        {isNew && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {lang === 'es' ? 'Cargar desde plantilla' : 'Carregar des de plantilla'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {lang === 'es'
                    ? 'No hay plantillas predefinidas disponibles. Puedes crearlas desde '
                    : 'No hi ha plantilles predefinides disponibles. Pots crear-les des de '}
                  <a href="/admin/plantilles" className="underline text-primary">/admin/plantilles</a>.
                </p>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">
                        {lang === 'es' ? 'Plantilla predefinida' : 'Plantilla predefinida'}
                      </Label>
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger>
                          <SelectValue placeholder={lang === 'es' ? 'Seleccionar plantilla…' : 'Seleccionar plantilla…'} />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((tpl: any) => (
                            <SelectItem key={tpl.id} value={tpl.id}>
                              {templateLabel(tpl)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        if (!selectedTemplateId) return;
                        if (sections.length > 0 || form.items.length > 0) {
                          if (!confirm(lang === 'es'
                            ? 'Esto reemplazará las familias y productos actuales. ¿Continuar?'
                            : 'Això substituirà les famílies i productes actuals. Continuar?')) return;
                        }
                        applyTemplate(selectedTemplateId);
                      }}
                      disabled={!selectedTemplateId || loadingTemplate}
                    >
                      {loadingTemplate
                        ? (lang === 'es' ? 'Cargando…' : 'Carregant…')
                        : (lang === 'es' ? 'Cargar plantilla' : 'Carregar plantilla')}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {lang === 'es'
                      ? 'Sustituye las familias y productos del formulario por los definidos en la plantilla.'
                      : 'Substitueix les famílies i productes del formulari pels definits a la plantilla.'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Basic info */}
        <Card>
          <CardHeader><CardTitle>{t('admin.listInfo')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('list.listCode')}</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.list_code}
                    onChange={e => setForm(p => ({ ...p, list_code: e.target.value.toUpperCase() }))}
                    className="font-mono uppercase"
                  />
                  <Button variant="ghost" size="icon" onClick={() => {
                    navigator.clipboard.writeText(form.list_code);
                    notify.success(t('list.copyCode'));
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('list.listPassword')} {!isNew && `(${t('admin.leaveBlank')})`}</Label>
                <div className="flex gap-2">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder={isNew ? '' : '••••••••'}
                  />
                  <Button variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('list.babyName')}</Label>
                <Input
                  value={form.baby_name}
                  onChange={e => setForm(p => ({ ...p, baby_name: e.target.value }))}
                />
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
                    <SelectItem value="archived">{t('admin.statusArchived')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('admin.notes')}</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Owners */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('admin.owners')}</CardTitle>
            {form.owners.length < 2 && (
              <Button variant="outline" size="sm" onClick={addOwner} className="gap-1">
                <Plus className="h-4 w-4" /> {t('list.owner2')}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {form.owners.map((owner, idx) => (
              <div key={idx} className="space-y-3">
                {idx > 0 && <Separator />}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {idx === 0 ? t('list.owner1') : t('list.owner2')}
                  </span>
                  {idx > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => removeOwner(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('list.firstName')}</Label>
                    <Input
                      value={owner.first_name}
                      onChange={e => updateOwner(idx, 'first_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('list.lastName')}</Label>
                    <Input
                      value={owner.last_name}
                      onChange={e => updateOwner(idx, 'last_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('auth.email')}</Label>
                    <Input
                      type="email"
                      value={owner.email}
                      onChange={e => updateOwner(idx, 'email', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Products + Sections */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('admin.listProducts')}</CardTitle>
            <Button variant="outline" size="sm" onClick={addSection} className="gap-1">
              <Plus className="h-4 w-4" /> {lang === 'es' ? 'Nueva familia' : 'Nova família'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Quick selector by family — same UX as customer view */}
            <div className="rounded-lg border bg-card p-3 sm:p-4">
              <div className="mb-3">
                <h3 className="font-display text-lg font-semibold">
                  {lang === 'es' ? 'Selección rápida por familias' : 'Selecció ràpida per famílies'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {lang === 'es'
                    ? 'Marca los productos a incluir. Se agruparán automáticamente por familia. Los productos sin stock no se pueden marcar; los "bajo pedido" sí.'
                    : 'Marca els productes a incloure. S\'agruparan automàticament per família. Els productes sense estoc no es poden marcar; els "sota comanda" sí.'}
                </p>
              </div>
              <FamilyProductSelector
                selectedIds={selectedProductIds}
                onToggle={toggleProductFromFamily}
              />
            </div>

            {/* Sections strip */}
            {sections.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">{lang === 'es' ? 'Familias' : 'Famílies'}</Label>
                <div className="flex flex-wrap gap-2">
                  {sections.map((s, idx) => {
                    const isActive = activeSectionTempId === s.temp_id;
                    const count = form.items.filter(it => it.section_temp_id === s.temp_id).length;
                    return (
                      <div
                        key={s.temp_id}
                        className={`group flex items-center gap-1 pl-2 pr-1 py-1 rounded-md border text-xs transition-colors ${
                          isActive ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:border-primary/40'
                        }`}
                      >
                        <button type="button" onClick={() => setActiveSectionTempId(s.temp_id)} className="flex items-center gap-1.5">
                          <FolderOpen className="h-3.5 w-3.5" />
                          <span className="font-medium">{(lang === 'es' ? s.name_es : s.name_ca) || s.name_ca || s.name_es}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">{count}</Badge>
                        </button>
                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0} onClick={() => moveSection(s.temp_id, 'up')}>
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5" disabled={idx === sections.length - 1} onClick={() => moveSection(s.temp_id, 'down')}>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5" title={lang === 'es' ? 'Traducciones' : 'Traduccions'} onClick={() => setTranslatingTempId(s.temp_id)}>
                          <Globe className="h-3 w-3" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeSection(s.temp_id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setActiveSectionTempId(null)}
                    className={`px-2 py-1 rounded-md border text-xs ${activeSectionTempId === null ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:border-primary/40'}`}
                  >
                    {lang === 'es' ? 'Sin familia' : 'Sense família'}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {lang === 'es'
                    ? 'Selecciona una familia y haz clic en un producto del catálogo para añadirlo a esa familia.'
                    : 'Selecciona una família i fes clic en un producte del catàleg per afegir-lo a aquesta família.'}
                </p>
              </div>
            )}

            {/* Browse catalog (grid like client view) */}
            <div className="space-y-3">
              <Label className="text-xs">{lang === 'es' ? 'Catálogo de productos' : 'Catàleg de productes'}</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={browseCategory} onValueChange={setBrowseCategory}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder={lang === 'es' ? 'Todas las categorías' : 'Totes les categories'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{lang === 'es' ? 'Todas las categorías' : 'Totes les categories'}</SelectItem>
                    {browseCategories.map((c: any) => {
                      const ctr = c.category_translations?.find((t: any) => t.language === lang)
                        || c.category_translations?.[0];
                      return (
                        <SelectItem key={c.id} value={c.id}>{ctr?.name || c.slug}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={lang === 'es' ? 'Buscar producto...' : 'Cercar producte...'}
                    value={browseSearch}
                    onChange={e => setBrowseSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {browseLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                    <div key={i} className="h-40 rounded-md border border-border bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : filteredBrowse.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {lang === 'es' ? 'No hay productos.' : 'No hi ha productes.'}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredBrowse.map((p: any) => {
                    const tr = p.product_translations?.find((t: any) => t.language === lang)
                      || p.product_translations?.[0];
                    const img = pickProductImage(p);
                    const inList = form.items.some(it => it.product_id === p.id);
                    const oos = getEffectiveStock(p) <= 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={oos}
                        onClick={() => addProduct(p)}
                        className={`group text-left flex flex-col rounded-md border bg-background overflow-hidden transition-all ${oos ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary hover:shadow-sm'} ${
                          inList ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border'
                        }`}
                      >
                        <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                          {img ? (
                            <img src={img} alt={tr?.name || p.slug} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <Package className="h-8 w-8 text-muted-foreground" />
                          )}
                          {oos && (
                            <span className="absolute bottom-1 left-1 right-1 text-center text-[10px] font-semibold bg-destructive text-destructive-foreground rounded px-1 py-0.5">
                              {lang === 'es' ? 'Sin stock' : 'Sense estoc'}
                            </span>
                          )}
                        </div>
                        <div className="p-2 space-y-0.5">
                          <p className="text-xs font-medium line-clamp-2">{tr?.name || p.slug}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] text-muted-foreground">{p.base_price?.toFixed(2)} €</p>
                            {inList && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 border-primary text-primary">✓</Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Items grouped by section */}
            {form.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('list.emptyList')}</p>
            ) : (
              <div className="space-y-4">
                {[
                  ...sections.map(s => ({ temp_id: s.temp_id, label: (lang === 'es' ? s.name_es : s.name_ca) || s.name_ca })),
                  { temp_id: '__none__', label: lang === 'es' ? 'Sin familia' : 'Sense família' },
                ].map((sec) => {
                  const sectionItems = form.items
                    .map((it, idx) => ({ it, idx }))
                    .filter(({ it }) => sec.temp_id === '__none__' ? !it.section_temp_id : it.section_temp_id === sec.temp_id);
                  if (sec.temp_id === '__none__' && sectionItems.length === 0) return null;
                  return (
                    <div key={sec.temp_id} className="space-y-2">
                      <div className="flex items-center gap-2 px-2 py-1.5 border-l-4 border-primary bg-muted/40 rounded">
                        <FolderOpen className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold flex-1 truncate">{sec.label}</span>
                        <Badge variant="outline" className="text-[10px]">{sectionItems.length}</Badge>
                      </div>
                      {sectionItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic pl-3">
                          {lang === 'es' ? 'Sin productos en esta familia.' : 'Sense productes en aquesta família.'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {sectionItems.map(({ it: item, idx }) => (
                            <div key={idx} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                              <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden bg-muted flex items-center justify-center border border-border">
                                {item.image_url ? (
                                  <img src={item.image_url} alt={item.productName} className="h-full w-full object-cover" loading="lazy" />
                                ) : (
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.productName}</p>
                                {item.price != null && (
                                  <p className="text-xs text-muted-foreground">{item.price.toFixed(2)} €</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Select
                                  value={item.section_temp_id || '__none__'}
                                  onValueChange={v => assignItemToSection(idx, v === '__none__' ? null : v)}
                                >
                                  <SelectTrigger className="w-32 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">{lang === 'es' ? 'Sin familia' : 'Sense família'}</SelectItem>
                                    {sections.map(s => (
                                      <SelectItem key={s.temp_id} value={s.temp_id}>
                                        {(lang === 'es' ? s.name_es : s.name_ca) || s.name_ca}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.quantity_desired}
                                  onChange={e => updateItem(idx, 'quantity_desired', parseInt(e.target.value) || 1)}
                                  className="w-14 h-8 text-center text-sm"
                                />
                                <Select
                                  value={item.priority}
                                  onValueChange={v => updateItem(idx, 'priority', v)}
                                >
                                  <SelectTrigger className="w-20 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="high">{t('list.priorityHigh')}</SelectItem>
                                    <SelectItem value="medium">{t('list.priorityMedium')}</SelectItem>
                                    <SelectItem value="low">{t('list.priorityLow')}</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>


        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            {!isNew && (
              <>
                <Button variant="destructive" size="sm" onClick={openDeleteDialog} disabled={deleting || loadingPreview}>
                  {loadingPreview ? t('common.loading') : t('common.delete')}
                </Button>

                {/* Step 1 (with orders): warn that orders will be deleted */}
                <AlertDialog open={deleteStep === 'orders'} onOpenChange={(o) => { if (!o && !deleting) setDeleteStep('idle'); }}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('admin.deleteListWithOrdersTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('admin.deleteListWithOrdersDesc', { count: ordersCount })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                      <div className="font-medium mb-1">{t('admin.deletePreviewTitle', { defaultValue: 'Se eliminarán los siguientes registros:' })}</div>
                      <div className="flex justify-between"><span>Orders</span><span className="font-mono">{previewCounts.orders}</span></div>
                      <div className="flex justify-between"><span>Order items</span><span className="font-mono">{previewCounts.order_items}</span></div>
                      <div className="flex justify-between"><span>List items</span><span className="font-mono">{previewCounts.list_items}</span></div>
                      <div className="flex justify-between"><span>List sections</span><span className="font-mono">{previewCounts.list_sections}</span></div>
                      <div className="flex justify-between"><span>List owners</span><span className="font-mono">{previewCounts.list_owners}</span></div>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => setDeleteStep('final')} disabled={deleting}>
                        {t('admin.deleteListWithOrdersConfirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Final step: double confirmation (checkbox + typed phrase) */}
                <AlertDialog open={deleteStep === 'final'} onOpenChange={(o) => { if (!o && !deleting) setDeleteStep('idle'); }}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('admin.deleteListFinalTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {ordersCount > 0
                          ? t('admin.deleteListFinalDesc', { count: ordersCount })
                          : t('admin.deleteListConfirm')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                      <div className="font-medium mb-1">{t('admin.deletePreviewTitle', { defaultValue: 'Se eliminarán los siguientes registros:' })}</div>
                      <div className="flex justify-between"><span>Orders</span><span className="font-mono">{previewCounts.orders}</span></div>
                      <div className="flex justify-between"><span>Order items</span><span className="font-mono">{previewCounts.order_items}</span></div>
                      <div className="flex justify-between"><span>List items</span><span className="font-mono">{previewCounts.list_items}</span></div>
                      <div className="flex justify-between"><span>List sections</span><span className="font-mono">{previewCounts.list_sections}</span></div>
                      <div className="flex justify-between"><span>List owners</span><span className="font-mono">{previewCounts.list_owners}</span></div>
                    </div>

                    <div className="space-y-4 py-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={confirmChecked}
                          onCheckedChange={(v) => setConfirmChecked(v === true)}
                          className="mt-0.5"
                        />
                        <span className="text-sm text-foreground">
                          {t('admin.deleteListAckCheckbox', {
                            defaultValue:
                              'Entiendo que esta acción es permanente y eliminará la lista, sus propietarios, sus regalos y todos los pedidos asociados.',
                          })}
                        </span>
                      </label>

                      <div className="space-y-2">
                        <Label htmlFor="confirm-phrase" className="text-sm">
                          {t('admin.deleteListTypePhrase', {
                            phrase: REQUIRED_PHRASE,
                            defaultValue: `Para confirmar, escribe "${REQUIRED_PHRASE}" a continuación:`,
                          })}
                        </Label>
                        <Input
                          id="confirm-phrase"
                          value={confirmPhrase}
                          onChange={(e) => setConfirmPhrase(e.target.value)}
                          placeholder={REQUIRED_PHRASE}
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={performDelete}
                        disabled={deleting || !canConfirmDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? t('common.loading') : t('common.delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/admin/llistes')}>{t('common.cancel')}</Button>
            <Button
              onClick={handleSave}
              disabled={saving || form.items.length === 0}
              title={form.items.length === 0 ? (lang === 'es' ? 'Selecciona al menos un producto' : 'Selecciona com a mínim un producte') : undefined}
            >
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!translatingTempId} onOpenChange={(v) => !v && setTranslatingTempId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === 'es' ? 'Traducciones de la familia' : 'Traduccions de la família'}</DialogTitle>
          </DialogHeader>
          {(() => {
            const sec = sections.find(s => s.temp_id === translatingTempId);
            if (!sec) return null;
            const setName = (code: string, value: string) => {
              setSections(prev => prev.map(x => {
                if (x.temp_id !== sec.temp_id) return x;
                const next: PendingSection = {
                  ...x,
                  translations: { ...x.translations, [code]: value },
                };
                if (code === 'ca') next.name_ca = value;
                if (code === 'es') next.name_es = value;
                return next;
              }));
            };
            const defaultCode = (enabledLanguages.find(l => l.is_default)?.code) || enabledLanguages[0]?.code || 'ca';
            const tryClose = () => {
              const defaultValue = (sec.translations[defaultCode] ?? (defaultCode === 'ca' ? sec.name_ca : defaultCode === 'es' ? sec.name_es : '') ?? '').trim();
              if (!defaultValue) {
                notify.error(
                  lang === 'es'
                    ? `El nombre en el idioma principal (${defaultCode.toUpperCase()}) no puede estar vacío`
                    : `El nom en l'idioma principal (${defaultCode.toUpperCase()}) no pot estar buit`,
                );
                return;
              }
              setTranslatingTempId(null);
            };
            return (
              <>
                <LanguageTabs>
                  {(code) => {
                    const fallback = code === 'ca' ? sec.name_ca : code === 'es' ? sec.name_es : '';
                    const value = sec.translations[code] ?? fallback ?? '';
                    const isDefault = code === defaultCode;
                    const isEmpty = !value.trim();
                    const tooLong = value.length > 120;
                    const showError = (isDefault && isEmpty) || tooLong;
                    return (
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1">
                          {lang === 'es' ? 'Nombre' : 'Nom'}
                          {isDefault && <span className="text-destructive">*</span>}
                          <span className="text-muted-foreground ml-auto text-[10px]">{value.length}/120</span>
                        </Label>
                        <Input
                          value={value}
                          maxLength={120}
                          aria-invalid={showError}
                          className={showError ? 'border-destructive focus-visible:ring-destructive' : ''}
                          onChange={e => setName(code, e.target.value)}
                        />
                        {showError ? (
                          <p className="text-[11px] text-destructive">
                            {tooLong
                              ? (lang === 'es' ? 'Máx. 120 caracteres' : 'Màx. 120 caràcters')
                              : (lang === 'es'
                                  ? 'Obligatorio en el idioma principal'
                                  : "Obligatori en l'idioma principal")}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            {lang === 'es'
                              ? 'Se mostrará en la vista pública cuando el visitante use este idioma.'
                              : 'Es mostrarà a la vista pública quan el visitant utilitzi aquest idioma.'}
                          </p>
                        )}
                      </div>
                    );
                  }}
                </LanguageTabs>
                <DialogFooter>
                  <Button onClick={tryClose}>{t('common.close', 'Tancar')}</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBirthListForm;
