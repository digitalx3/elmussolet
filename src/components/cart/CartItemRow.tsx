import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CartItem } from '@/contexts/CartContext';

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  onRemove: (productId: string, variantId?: string) => void;
}

const CartItemRow: React.FC<CartItemRowProps> = ({ item, onUpdateQuantity, onRemove }) => {
  const { t } = useTranslation();
  const lineTotal = item.price * item.quantity;

  return (
    <div className="flex gap-4 py-4 border-b border-border last:border-0">
      {/* Image */}
      <div className="w-20 h-20 rounded-md overflow-hidden flex-shrink-0 bg-muted">
        <img
          src={item.image || '/placeholder.svg'}
          alt={item.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm leading-tight line-clamp-2 text-foreground">
          {item.name}
        </h3>
        {item.variantLabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.variantLabel}</p>
        )}
        <p className="text-primary font-semibold text-sm mt-1">{item.price.toFixed(2)} €</p>
      </div>

      {/* Quantity controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onUpdateQuantity(item.productId, Math.max(1, item.quantity - 1), item.variantId)}
          disabled={item.quantity <= 1}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-8 text-center text-sm font-medium text-foreground">{item.quantity}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onUpdateQuantity(item.productId, item.quantity + 1, item.variantId)}
          disabled={item.maxQuantity !== undefined && item.maxQuantity !== -1 && item.quantity >= item.maxQuantity}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Line total & remove */}
      <div className="flex flex-col items-end justify-between">
        <span className="font-semibold text-sm text-foreground">{lineTotal.toFixed(2)} €</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(item.productId, item.variantId)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default CartItemRow;
