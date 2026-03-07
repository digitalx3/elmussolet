import React from 'react';
import { useTranslation } from 'react-i18next';

const CatalogPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="container py-8">
      <h1 className="font-display text-3xl font-bold mb-6">{t('products.catalog')}</h1>
      <p className="text-muted-foreground">{t('products.noResults')}</p>
    </div>
  );
};

export default CatalogPage;
