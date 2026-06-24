import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import AdminDefaultListSections from '@/pages/admin/AdminDefaultListSections';

const AdminTranslations: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Globe className="h-6 w-6" /> {t('admin.translationsTitle', 'Traduccions')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t(
            'admin.translationsDesc',
            'Edita les traduccions de les famílies per defecte. Les traduccions dels productes es gestionen des de la fitxa de cada producte.',
          )}
        </p>
      </div>

      <AdminDefaultListSections />
    </div>
  );
};

export default AdminTranslations;
