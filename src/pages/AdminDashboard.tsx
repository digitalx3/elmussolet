import React from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminProductList from '@/pages/admin/AdminProductList';
import AdminProductForm from '@/pages/admin/AdminProductForm';
import AdminVariantTypes from '@/pages/admin/AdminVariantTypes';
import AdminBirthListList from '@/pages/admin/AdminBirthListList';
import AdminBirthListForm from '@/pages/admin/AdminBirthListForm';
import AdminShipping from '@/pages/admin/AdminShipping';
import AdminTaxRates from '@/pages/admin/AdminTaxRates';
import AdminCategories from '@/pages/admin/AdminCategories';
import AdminBrands from '@/pages/admin/AdminBrands';

const AdminOverview: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">{t('admin.dashboard')}</h1>
      <p className="text-muted-foreground">Pròximament: estadístiques i resum.</p>
    </div>
  );
};

const AdminPlaceholder: React.FC<{ titleKey: string }> = ({ titleKey }) => {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">{t(`admin.${titleKey}`)}</h1>
      <p className="text-muted-foreground">Pròximament...</p>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<AdminOverview />} />
        <Route path="productes" element={<AdminProductList />} />
        <Route path="productes/nou" element={<AdminProductForm />} />
        <Route path="productes/:id" element={<AdminProductForm />} />
        <Route path="atributs" element={<AdminVariantTypes />} />
        <Route path="llistes" element={<AdminBirthListList />} />
        <Route path="llistes/nova" element={<AdminBirthListForm />} />
        <Route path="llistes/:id" element={<AdminBirthListForm />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="marques" element={<AdminBrands />} />
        <Route path="comandes" element={<AdminPlaceholder titleKey="orders" />} />
        <Route path="plantilles" element={<AdminPlaceholder titleKey="templates" />} />
        <Route path="usuaris" element={<AdminPlaceholder titleKey="users" />} />
        <Route path="enviaments" element={<AdminShipping />} />
        <Route path="configuracio" element={<AdminTaxRates />} />
      </Routes>
    </AdminLayout>
  );
};

export default AdminDashboard;
