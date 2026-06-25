import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/contexts/CartContext';
import { useRelatedProducts } from '@/hooks/useTranslatedProducts';
import { formatPriceEUR } from '@/lib/pricing';
import { toast } from 'sonner';

const UpsellDialog: React.FC = () => {
  const { upsellTrigger, clearUpsell, addStandardItem } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string | undefined>(undefined);

  const { data: related = [], isLoading } = useRelatedProducts(productId);

  useEffect(() => {
    if (!upsellTrigger) return;
    setProductId(upsellTrigger.productId);
    setOpen(true);
  }, [upsellTrigger]);

  useEffect(() => {
    // Auto-close if there are no related products with stock
    if (open && !isLoading && productId === upsellTrigger?.productId) {
      const usable = related.filter(p => p.stockStatus !== 'out_of_stock');
      if (usable.length === 0) {
        handleClose();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isLoading, related, productId]);

  const handleClose = () => {
    setOpen(false);
    clearUpsell();
  };

  const handleAdd = (p: typeof related[number]) => {
    addStandardItem({
      productId: p.id,
      name: p.name,
      image: p.primaryImage ?? undefined,
      price: p.finalPriceWithTax,
      basePriceNoTax: p.basePrice,
      taxPercentage: p.taxPercentage ?? 0,
      quantity: 1,
    });
    toast.success(`${p.name} afegit a la cistella`);
    // Close after adding to avoid recursion
    handleClose();
  };

  const usable = related.filter(p => p.stockStatus !== 'out_of_stock');

  return (
    <Dialog open={open && usable.length > 0} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>També et podria interessar</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Els nostres clients sovint combinen aquest producte amb:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
          {usable.slice(0, 6).map(p => (
            <div key={p.id} className="border rounded-lg overflow-hidden flex flex-col bg-card">
              <Link to={`/producte/${p.slug}`} onClick={handleClose} className="block">
                <div className="aspect-square bg-muted overflow-hidden">
                  {p.primaryImage ? (
                    <img src={p.primaryImage} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-2 flex-1 flex flex-col gap-1">
                <Link to={`/producte/${p.slug}`} onClick={handleClose} className="text-xs font-semibold line-clamp-2 hover:text-primary">
                  {p.name}
                </Link>
                <div className="flex items-center gap-1 mt-auto">
                  {p.onSale ? (
                    <>
                      <span className="text-[10px] text-muted-foreground line-through">{formatPriceEUR(p.priceWithTax)}</span>
                      <span className="text-xs font-bold text-primary">{formatPriceEUR(p.finalPriceWithTax)}</span>
                    </>
                  ) : (
                    <span className="text-xs font-bold">{formatPriceEUR(p.finalPriceWithTax)}</span>
                  )}
                  {p.onSale && (
                    <Badge variant="destructive" className="ml-auto text-[9px] h-4 px-1">-{p.discountPct}%</Badge>
                  )}
                </div>
                <Button size="sm" className="h-7 text-xs gap-1 mt-1" onClick={() => handleAdd(p)} disabled={p.hasVariants}>
                  <ShoppingBag className="h-3 w-3" />
                  {p.hasVariants ? 'Tria opcions' : 'Afegir'}
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-2">
          <Button variant="ghost" onClick={handleClose}>
            <X className="h-4 w-4 mr-1" /> No, gràcies
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpsellDialog;
