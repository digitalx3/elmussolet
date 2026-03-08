import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface BrandRow {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean | null;
}

interface FormData {
  name: string;
  is_active: boolean;
  logo_url: string | null;
}

const emptyForm: FormData = { name: '', is_active: true, logo_url: null };

const AdminBrands: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as BrandRow[];
    },
  });

  const uploadLogo = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('brand-logos')
      .upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage
      .from('brand-logos')
      .getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const deleteLogo = async (url: string) => {
    try {
      const parts = url.split('/brand-logos/');
      if (parts.length > 1) {
        await supabase.storage.from('brand-logos').remove([parts[1]]);
      }
    } catch (err) {
      console.warn('Failed to delete old logo, continuing:', err);
    }
  };

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setPreviewFile(null);
    setDialogOpen(true);
  };

  const openEdit = (b: BrandRow) => {
    setEditId(b.id);
    setForm({ name: b.name, is_active: b.is_active ?? true, logo_url: b.logo_url });
    setPreviewFile(null);
    setDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPreviewFile(file);
  };

  const removeLogo = () => {
    setPreviewFile(null);
    setForm(f => ({ ...f, logo_url: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let logoUrl = form.logo_url;

      // Upload new file if selected
      if (previewFile) {
        // Delete old logo if replacing
        if (logoUrl) await deleteLogo(logoUrl);
        logoUrl = await uploadLogo(previewFile);
      }
      // If logo was removed (no file, no url) and editing, delete old
      if (!previewFile && !logoUrl && editId) {
        const old = brands.find(b => b.id === editId);
        if (old?.logo_url) await deleteLogo(old.logo_url);
      }

      if (editId) {
        const { error } = await supabase.from('brands').update({
          name: form.name,
          is_active: form.is_active,
          logo_url: logoUrl,
        }).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('brands').insert({
          name: form.name,
          is_active: form.is_active,
          logo_url: logoUrl,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-brands'] });
      qc.invalidateQueries({ queryKey: ['brands'] });
      setDialogOpen(false);
      setUploading(false);
      toast.success(editId ? t('admin.brandUpdated') : t('admin.brandCreated'));
    },
    onError: (e: any) => {
      setUploading(false);
      toast.error(e.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const brand = brands.find(b => b.id === id);
      if (brand?.logo_url) await deleteLogo(brand.logo_url);
      const { error } = await supabase.from('brands').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-brands'] });
      qc.invalidateQueries({ queryKey: ['brands'] });
      setDeleteId(null);
      toast.success(t('admin.brandDeleted'));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const logoPreviewUrl = previewFile
    ? URL.createObjectURL(previewFile)
    : form.logo_url;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">{t('admin.brands')}</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {t('admin.addBrand')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Logo</TableHead>
              <TableHead>{t('admin.brandName')}</TableHead>
              <TableHead>{t('admin.status')}</TableHead>
              <TableHead className="text-right">{t('admin.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map(b => (
              <TableRow key={b.id}>
                <TableCell>
                  {b.logo_url ? (
                    <img src={b.logo_url} alt={b.name} className="h-10 w-10 rounded object-contain bg-muted p-0.5" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>
                  <Badge variant={b.is_active ? 'default' : 'secondary'}>
                    {b.is_active ? t('admin.active') : t('admin.inactive')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(b.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {brands.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {t('admin.noBrands')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? t('admin.editBrand') : t('admin.addBrand')}</DialogTitle>
            <DialogDescription>
              {editId ? t('admin.editBrandDesc') : t('admin.addBrandDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>{t('admin.brandName')} *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              {logoPreviewUrl ? (
                <div className="relative inline-block">
                  <img src={logoPreviewUrl} alt="Logo preview" className="h-20 w-20 rounded-lg object-contain bg-muted p-1 border" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={removeLogo}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">{t('admin.uploadLogo')}</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {logoPreviewUrl && (
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} type="button">
                  {t('admin.changeLogo')}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>{t('admin.active')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('admin.cancel')}</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || saveMutation.isPending || uploading}
            >
              {saveMutation.isPending || uploading ? '...' : (editId ? t('admin.save') : t('admin.create'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.confirmDelete')}</DialogTitle>
            <DialogDescription>{t('admin.confirmDeleteBrandDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t('admin.cancel')}</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? '...' : t('admin.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBrands;
