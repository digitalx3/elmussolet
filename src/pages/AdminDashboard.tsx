import React from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminProductList from '@/pages/admin/AdminProductList';
import AdminProductForm from '@/pages/admin/AdminProductForm';
import AdminVariantTypes from '@/pages/admin/AdminVariantTypes';
import AdminBirthListList from '@/pages/admin/AdminBirthListList';
import AdminBirthListForm from '@/pages/admin/AdminBirthListForm';
import AdminShipping from '@/pages/admin/AdminShipping';
import AdminTaxRates from '@/pages/admin/AdminTaxRates';
import AdminCategories from '@/pages/admin/AdminCategories';
import AdminBrands from '@/pages/admin/AdminBrands';
import AdminOrders from '@/pages/admin/AdminOrders';
import AdminOrderStatuses from '@/pages/admin/AdminOrderStatuses';
import AdminTemplates from '@/pages/admin/AdminTemplates';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminDefaultHeroForm from '@/pages/admin/AdminDefaultHeroForm';
import AdminPages from '@/pages/admin/AdminPages';
import AdminHomeContent from '@/pages/admin/AdminHomeContent';
import AdminAppearance from '@/pages/admin/AdminAppearance';
import AdminContactSettings from '@/pages/admin/AdminContactSettings';
import AdminContactMessages from '@/pages/admin/AdminContactMessages';
import AdminSmtpSettings from '@/pages/admin/AdminSmtpSettings';
import AdminBackups from '@/pages/admin/AdminBackups';
import AdminMaintenance from '@/pages/admin/AdminMaintenance';
import AdminLanguages from '@/pages/admin/AdminLanguages';

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
        <Route path="comandes" element={<AdminOrders />} />
        <Route path="plantilles" element={<AdminTemplates />} />
        <Route path="usuaris" element={<AdminUsers />} />
        <Route path="enviaments" element={<AdminShipping />} />
        <Route path="configuracio" element={<AdminTaxRates />} />
        <Route path="configuracio/general" element={<AdminSettings />} />
        <Route path="configuracio/estats" element={<AdminOrderStatuses />} />
        <Route path="heros" element={<AdminDefaultHeroForm />} />
        <Route path="heros/portada-defecte" element={<AdminDefaultHeroForm />} />
        <Route path="pagines" element={<AdminPages />} />
        <Route path="home" element={<AdminHomeContent />} />
        <Route path="aparenca" element={<AdminAppearance />} />
        <Route path="peu-contacte" element={<AdminContactSettings />} />
        <Route path="missatges" element={<AdminContactMessages />} />
        <Route path="smtp" element={<AdminSmtpSettings />} />
        <Route path="backups" element={<AdminBackups />} />
        <Route path="manteniment" element={<AdminMaintenance />} />
        <Route path="idiomes" element={<AdminLanguages />} />
      </Routes>
    </AdminLayout>
  );
};

export default AdminDashboard;
