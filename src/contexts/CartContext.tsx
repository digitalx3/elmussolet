import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  image?: string;
  price: number; // price with tax included (PVP)
  basePriceNoTax: number; // unit price before tax
  taxPercentage: number; // tax rate applied (e.g. 21)
  quantity: number;
  maxQuantity?: number;
  variantLabel?: string;
  listItemId?: string; // link back to list_items.id when bought as a gift from a registry
}

interface CartContextType {
  standardItems: CartItem[];
  listItems: CartItem[];
  activeListId: string | null;
  addStandardItem: (item: CartItem) => void;
  addListItem: (item: CartItem, listId: string) => void;
  removeStandardItem: (productId: string, variantId?: string) => void;
  removeListItem: (productId: string, variantId?: string) => void;
  updateStandardQuantity: (productId: string, quantity: number, variantId?: string) => void;
  updateListQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearStandard: () => void;
  clearList: () => void;
  standardTotal: number;
  listTotal: number;
  totalItemsCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const getKey = (productId: string, variantId?: string) => `${productId}:${variantId ?? ''}`;

const loadFromStorage = (key: string): CartItem[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [standardItems, setStandardItems] = useState<CartItem[]>(() => loadFromStorage('cart_standard'));
  const [listItems, setListItems] = useState<CartItem[]>(() => loadFromStorage('cart_list'));
  const [activeListId, setActiveListId] = useState<string | null>(() => localStorage.getItem('cart_list_id'));

  const persist = (key: string, items: CartItem[]) => localStorage.setItem(key, JSON.stringify(items));

  const addItem = (items: CartItem[], item: CartItem): CartItem[] => {
    const key = getKey(item.productId, item.variantId);
    const existing = items.find(i => getKey(i.productId, i.variantId) === key);
    if (existing) {
      return items.map(i => getKey(i.productId, i.variantId) === key
        ? { ...i, quantity: i.quantity + item.quantity } : i);
    }
    return [...items, item];
  };

  const addStandardItem = useCallback((item: CartItem) => {
    setStandardItems(prev => {
      const next = addItem(prev, item);
      persist('cart_standard', next);
      return next;
    });
  }, []);

  const addListItem = useCallback((item: CartItem, listId: string) => {
    setActiveListId(listId);
    localStorage.setItem('cart_list_id', listId);
    setListItems(prev => {
      const next = addItem(prev, item);
      persist('cart_list', next);
      return next;
    });
  }, []);

  const removeItem = (items: CartItem[], productId: string, variantId?: string) =>
    items.filter(i => getKey(i.productId, i.variantId) !== getKey(productId, variantId));

  const removeStandardItem = useCallback((productId: string, variantId?: string) => {
    setStandardItems(prev => {
      const next = removeItem(prev, productId, variantId);
      persist('cart_standard', next);
      return next;
    });
  }, []);

  const removeListItem = useCallback((productId: string, variantId?: string) => {
    setListItems(prev => {
      const next = removeItem(prev, productId, variantId);
      persist('cart_list', next);
      return next;
    });
  }, []);

  const updateQuantity = (items: CartItem[], productId: string, quantity: number, variantId?: string) => {
    const key = getKey(productId, variantId);
    return items.map(i => getKey(i.productId, i.variantId) === key ? { ...i, quantity } : i);
  };

  const updateStandardQuantity = useCallback((productId: string, quantity: number, variantId?: string) => {
    setStandardItems(prev => {
      const next = updateQuantity(prev, productId, quantity, variantId);
      persist('cart_standard', next);
      return next;
    });
  }, []);

  const updateListQuantity = useCallback((productId: string, quantity: number, variantId?: string) => {
    setListItems(prev => {
      const next = updateQuantity(prev, productId, quantity, variantId);
      persist('cart_list', next);
      return next;
    });
  }, []);

  const clearStandard = useCallback(() => {
    setStandardItems([]);
    localStorage.removeItem('cart_standard');
  }, []);

  const clearList = useCallback(() => {
    setListItems([]);
    setActiveListId(null);
    localStorage.removeItem('cart_list');
    localStorage.removeItem('cart_list_id');
  }, []);

  const sum = (items: CartItem[]) => items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      standardItems, listItems, activeListId,
      addStandardItem, addListItem,
      removeStandardItem, removeListItem,
      updateStandardQuantity, updateListQuantity,
      clearStandard, clearList,
      standardTotal: sum(standardItems),
      listTotal: sum(listItems),
      totalItemsCount: standardItems.reduce((s, i) => s + i.quantity, 0) + listItems.reduce((s, i) => s + i.quantity, 0),
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
