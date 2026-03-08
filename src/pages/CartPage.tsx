import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Gift, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/contexts/CartContext';
import CartItemRow from '@/components/cart/CartItemRow';

const CartPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    standardItems, listItems,
    removeStandardItem, removeListItem,
    updateStandardQuantity, updateListQuantity,
    clearStandard, clearList,
    standardTotal, listTotal, totalItemsCount,
  } = useCart();

  const hasStandard = standardItems.length > 0;
  const hasList = listItems.length > 0;
  const isEmpty = !hasStandard && !hasList;
  const grandTotal = standardTotal + listTotal;

  if (isEmpty) {
    return (
      <div className="container py-16 text-center max-w-lg mx-auto">
        <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="font-display text-3xl font-bold mb-3">{t('cart.title')}</h1>
        <p className="text-muted-foreground mb-6">{t('cart.empty')}</p>
        <p className="text-sm text-muted-foreground mb-8">{t('cart.emptyDesc')}</p>
        <Button asChild>
          <Link to="/cataleg">{t('cart.continueShopping')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold mb-6">{t('cart.title')}</h1>

        {/* List gifts section */}
        {hasList && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">{t('cart.listCart')}</h2>
            </div>
            <div className="bg-card rounded-lg p-4 shadow-soft">
              {listItems.map(item => (
                <CartItemRow
                  key={`${item.productId}:${item.variantId ?? ''}`}
                  item={item}
                  onUpdateQuantity={updateListQuantity}
                  onRemove={removeListItem}
                />
              ))}
              <div className="flex justify-between items-center pt-4">
                <Button variant="ghost" size="sm" onClick={clearList} className="text-muted-foreground text-xs">
                  {t('cart.remove')} {t('common.all').toLowerCase()}
                </Button>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">{t('cart.subtotal')}: </span>
                  <span className="font-semibold text-foreground">{listTotal.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Standard items section */}
        {hasStandard && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-semibold">{t('cart.standardCart')}</h2>
            </div>
            <div className="bg-card rounded-lg p-4 shadow-soft">
              {standardItems.map(item => (
                <CartItemRow
                  key={`${item.productId}:${item.variantId ?? ''}`}
                  item={item}
                  onUpdateQuantity={updateStandardQuantity}
                  onRemove={removeStandardItem}
                />
              ))}
              <div className="flex justify-between items-center pt-4">
                <Button variant="ghost" size="sm" onClick={clearStandard} className="text-muted-foreground text-xs">
                  {t('cart.remove')} {t('common.all').toLowerCase()}
                </Button>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">{t('cart.subtotal')}: </span>
                  <span className="font-semibold text-foreground">{standardTotal.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Order summary */}
        <div className="bg-card rounded-lg p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold mb-4">{t('checkout.step1')}</h2>

          {hasList && (
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">{t('cart.listCart')}</span>
              <span className="text-foreground">{listTotal.toFixed(2)} €</span>
            </div>
          )}
          {hasStandard && (
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">{t('cart.standardCart')}</span>
              <span className="text-foreground">{standardTotal.toFixed(2)} €</span>
            </div>
          )}

          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">{t('cart.shipping')}</span>
            <span className="text-muted-foreground italic">{t('cart.shippingCalc')}</span>
          </div>

          <Separator className="my-3" />

          <div className="flex justify-between text-lg font-bold">
            <span>{t('cart.total')}</span>
            <span className="text-primary">{grandTotal.toFixed(2)} €</span>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 gap-2" asChild>
              <Link to="/cataleg">
                <ArrowLeft className="h-4 w-4" />
                {t('cart.continueShopping')}
              </Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link to="/checkout">{t('cart.checkout')}</Link>
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CartPage;
