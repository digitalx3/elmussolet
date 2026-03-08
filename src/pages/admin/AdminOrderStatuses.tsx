import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, GripVertical, Mail } from 'lucide-react';
import { toast } from 'sonner';

const LANGUAGES = ['ca', 'es'];

interface StatusRow {
  id: string;
  slug: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  order_status_translations: { id: string; language: string; name: string }[];
  order_status_email_templates: { id: string; language: string; subject: string; body_html: string }[];
}

const AdminOrderStatuses: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editStatus, setEditStatus] = useState<StatusRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [slug, setSlug] = useState('');
  const [color, setColor] = useState('#6b7280');
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [emailSubjects, setEmailSubjects] = useState<Record<string, string>>({});
  const [emailBodies, setEmailBodies] = useState<Record<string, string>>({});

  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ['admin-order-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_statuses')
        .select('*, order_status_translations(*), order_status_email_templates(*)')
        .order('sort_order');
      if (error) throw error;
      return data as unknown as StatusRow[];
    },
  });

  const openNew = () => {
    setIsNew(true);
    setSlug('');
    setColor('#6b7280');
    setSortOrder(statuses.length);
    setIsActive(true);
    setTranslations({});
    setEmailSubjects({});
    setEmailBodies({});
    setEditStatus({} as StatusRow);
  };

  const openEdit = (s: StatusRow) => {
    setIsNew(false);
    setSlug(s.slug);
    setColor(s.color);
    setSortOrder(s.sort_order);
    setIsActive(s.is_active);
    const tr: Record<string, string> = {};
    const subj: Record<string, string> = {};
    const body: Record<string, string> = {};
    s.order_status_translations.forEach(t => { tr[t.language] = t.name; });
    s.order_status_email_templates.forEach(e => {
      subj[e.language] = e.subject;
      body[e.language] = e.body_html;
    });
    setTranslations(tr);
    setEmailSubjects(subj);
    setEmailBodies(body);
    setEditStatus(s);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let statusId: string;

      if (isNew) {
        const { data, error } = await supabase
          .from('order_statuses')
          .insert({ slug, color, sort_order: sortOrder, is_active: isActive })
          .select('id')
          .single();
        if (error) throw error;
        statusId = data.id;
      } else {
        statusId = editStatus!.id;
        const { error } = await supabase
          .from('order_statuses')
          .update({ slug, color, sort_order: sortOrder, is_active: isActive })
          .eq('id', statusId);
        if (error) throw error;
      }

      // Upsert translations
      for (const lang of LANGUAGES) {
        if (translations[lang]) {
          const existing = !isNew && editStatus!.order_status_translations?.find(t => t.language === lang);
          if (existing) {
            await supabase.from('order_status_translations')
              .update({ name: translations[lang] })
              .eq('id', existing.id);
          } else {
            await supabase.from('order_status_translations')
              .insert({ status_id: statusId, language: lang, name: translations[lang] });
          }
        }
      }

      // Upsert email templates
      for (const lang of LANGUAGES) {
        const subject = emailSubjects[lang] || '';
        const body_html = emailBodies[lang] || '';
        const existing = !isNew && editStatus!.order_status_email_templates?.find(e => e.language === lang);
        if (existing) {
          await supabase.from('order_status_email_templates')
            .update({ subject, body_html })
            .eq('id', existing.id);
        } else {
          await supabase.from('order_status_email_templates')
            .insert({ status_id: statusId, language: lang, subject, body_html });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order-statuses'] });
      qc.invalidateQueries({ queryKey: ['order-statuses'] });
      toast.success(isNew ? t('admin.statusCreated') : t('admin.statusUpdated'));
      setEditStatus(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('order_statuses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order-statuses'] });
      qc.invalidateQueries({ queryKey: ['order-statuses'] });
      toast.success(t('admin.statusDeleted'));
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getName = (s: StatusRow, lang: string) =>
    s.order_status_translations.find(t => t.language === lang)?.name || '—';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Config sub-navigation */}
      <div className="flex gap-2 flex-wrap">
        <Link to="/admin/configuracio/general">
          <Button variant="outline" size="sm">{t('admin.settingsGeneral')}</Button>
        </Link>
        <Link to="/admin/configuracio">
          <Button variant="outline" size="sm">{t('admin.settingsTaxes')}</Button>
        </Link>
        <Link to="/admin/configuracio/estats">
          <Button variant="secondary" size="sm">{t('admin.orderStatuses')}</Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{t('admin.orderStatuses')}</h1>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {t('admin.addStatus')}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{t('admin.orderStatusesDesc')}</p>

      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>CA</TableHead>
              <TableHead>ES</TableHead>
              <TableHead>{t('admin.status')}</TableHead>
              <TableHead><Mail className="h-4 w-4" /></TableHead>
              <TableHead className="text-right">{t('admin.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statuses.map(s => (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground">{s.sort_order}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    <code className="text-xs">{s.slug}</code>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{getName(s, 'ca')}</TableCell>
                <TableCell className="text-sm">{getName(s, 'es')}</TableCell>
                <TableCell>
                  <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-xs">
                    {s.is_active ? t('common.active') : t('common.inactive')}
                  </Badge>
                </TableCell>
                <TableCell>
                  {s.order_status_email_templates.length > 0 ? (
                    <Mail className="h-4 w-4 text-green-600" />
                  ) : (
                    <Mail className="h-4 w-4 text-muted-foreground/30" />
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={!!editStatus} onOpenChange={() => setEditStatus(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? t('admin.addStatus') : t('admin.editStatus')}</DialogTitle>
            <DialogDescription>
              {isNew ? t('admin.addStatusDesc') : t('admin.editStatusDesc')}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general">
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">{t('admin.general')}</TabsTrigger>
              <TabsTrigger value="emails" className="flex-1">{t('admin.emailTemplates')}</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Slug</Label>
                  <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="e.g. preparing" />
                </div>
                <div>
                  <Label>{t('admin.sortOrder')}</Label>
                  <Input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('admin.color')}</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                    <Input value={color} onChange={e => setColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label>{t('common.active')}</Label>
                </div>
              </div>

              <Separator />

              {LANGUAGES.map(lang => (
                <div key={lang}>
                  <Label>{t('admin.statusName')} ({lang.toUpperCase()})</Label>
                  <Input
                    value={translations[lang] || ''}
                    onChange={e => setTranslations(prev => ({ ...prev, [lang]: e.target.value }))}
                    placeholder={`Nom en ${lang}`}
                  />
                </div>
              ))}
            </TabsContent>

            <TabsContent value="emails" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">{t('admin.emailTemplatesDesc')}</p>
              <p className="text-xs text-muted-foreground">
                {t('admin.emailVars')}: {'{{order_number}}, {{customer_name}}, {{status_name}}, {{total}}'}
              </p>

              {LANGUAGES.map(lang => (
                <div key={lang} className="space-y-2 border rounded-lg p-4">
                  <p className="text-sm font-semibold">{lang.toUpperCase()}</p>
                  <div>
                    <Label>{t('admin.emailSubject')}</Label>
                    <Input
                      value={emailSubjects[lang] || ''}
                      onChange={e => setEmailSubjects(prev => ({ ...prev, [lang]: e.target.value }))}
                      placeholder={`Assumpte en ${lang}`}
                    />
                  </div>
                  <div>
                    <Label>{t('admin.emailBody')} (HTML)</Label>
                    <Textarea
                      value={emailBodies[lang] || ''}
                      onChange={e => setEmailBodies(prev => ({ ...prev, [lang]: e.target.value }))}
                      placeholder="<p>Hola {{customer_name}}...</p>"
                      rows={6}
                    />
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setEditStatus(null)}>{t('admin.cancel')}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !slug}>
              {isNew ? t('admin.create') : t('admin.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.confirmDeleteStatusDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              {t('admin.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminOrderStatuses;
