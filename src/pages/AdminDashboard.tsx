import React from 'react';
import { useTranslation } from 'react-i18next';

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="container py-8">
      <h1 className="font-display text-3xl font-bold mb-6">{t('admin.dashboard')}</h1>
      <p className="text-muted-foreground">Pròximament...</p>
    </div>
  );
};

export default AdminDashboard;
