import React, { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, X } from 'lucide-react';
import { notify } from '@/lib/notify';
import { optimizeImage } from '@/lib/optimizeImage';

interface Props {
  value: string;
  onChange: (url: string) => void;
  pathPrefix?: string;
  label?: string;
  previewClassName?: string;
  background?: 'light' | 'dark';
}

const ImageUploader: React.FC<Props> = ({
  value,
  onChange,
  pathPrefix = 'branding',
  label = 'Imatge',
  previewClassName = 'h-16',
  background = 'light',
}) => {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (rawFile: File) => {
    if (!rawFile) return;
    if (rawFile.size > 10 * 1024 * 1024) {
      notify.error('Màxim 10 MB');
      return;
    }
    setUploading(true);
    try {
      // Don't re-encode SVGs (vector); optimize raster images.
      const file = rawFile.type === 'image/svg+xml'
        ? rawFile
        : await optimizeImage(rawFile, { maxDimension: 1200, quality: 0.85 });
      const ext = file.name.split('.').pop() || 'webp';
      const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('site-assets')
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('site-assets').getPublicUrl(path);
      onChange(data.publicUrl);
      notify.success('Pujat correctament');
    } catch (e: any) {
      notify.error(e.message || 'Error pujant l\'arxiu');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value && (
        <div className={`inline-flex items-center justify-center rounded-md border border-border p-3 ${background === 'dark' ? 'bg-foreground/90' : 'bg-muted/40'}`}>
          <img src={value} alt={label} className={`${previewClassName} w-auto object-contain`} />
        </div>
      )}
      <div className="flex gap-2 items-center">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()} className="gap-1">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {value ? 'Substituir' : 'Pujar imatge'}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} className="text-destructive gap-1">
            <X className="h-4 w-4" /> Treure
          </Button>
        )}
      </div>
      <Input
        placeholder="O enganxa una URL"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs"
      />
    </div>
  );
};

export default ImageUploader;
