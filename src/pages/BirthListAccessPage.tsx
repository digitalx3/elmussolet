import React from 'react';
import { useTranslation } from 'react-i18next';

const BirthListAccessPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="container py-16 max-w-md mx-auto text-center">
      <h1 className="font-display text-3xl font-bold mb-3">{t('list.accessTitle')}</h1>
      <p className="text-muted-foreground mb-8">{t('list.accessDesc')}</p>
      <p className="text-sm text-muted-foreground italic">Pròximament...</p>
    </div>
  );
};

export default BirthListAccessPage;
