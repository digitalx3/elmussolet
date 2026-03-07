import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const CartPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="container py-16 text-center">
      <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
      <h1 className="font-display text-3xl font-bold mb-3">{t('cart.title')}</h1>
      <p className="text-muted-foreground mb-6">{t('cart.empty')}</p>
      <Button asChild>
        <Link to="/cataleg">{t('cart.continueShopping')}</Link>
      </Button>
    </div>
  );
};

export default CartPage;
