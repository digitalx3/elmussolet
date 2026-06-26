import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Store, Truck, CreditCard, Landmark, CheckCircle2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { notify } from '@/lib/notify';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useShippingCost } from '@/hooks/useShippingCost';

const shippingSchema = z.object({
  fullName: z.string().trim().min(1, 'Required').max(100),
  phone: z.string().trim().min(6, 'Required').max(20),
  addressLine1: z.string().trim().min(1, 'Required').max(200),
  addressLine2: z.string().max(200).optional().default(''),
  city: z.string().trim().min(1, 'Required').max(100),
  postalCode: z.string().trim().min(4, 'Required').max(10),
  province: z.string().trim().min(1, 'Required').max(100),
});

type ShippingForm = z.infer<typeof shippingSchema>;

type Step = 'delivery' | 'payment' | 'confirmation';

const CheckoutPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const {
    standardItems, listItems, activeListId,
    standardTotal, listTotal, totalItemsCount,
    clearStandard, clearList,
  } = useCart();

  const [step, setStep] = useState<Step>('delivery');
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'shipping'>('shipping');
  const [paymentMethod, setPaymentMethod] = useState<'bizum' | 'transfer'>('bizum');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [finalTotal, setFinalTotal] = useState<number>(0);
  const [paymentSettings, setPaymentSettings] = useState<Record<string, string>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (value: string, field: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      notify.success(t('checkout.copied'));
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  // Fetch payment settings from site_settings
  useEffect(() => {
    supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['payment_bizum_phone', 'payment_transfer_iban', 'payment_transfer_beneficiary'])
      .then(({ data }) => {
        const map: Record<string, string> = {};
        data?.forEach(row => { map[row.key] = row.value; });
        setPaymentSettings(map);
      });
  }, []);

  const subtotal = standardTotal + listTotal;
  const isEmpty = standardItems.length === 0 && listItems.length === 0;

  const form = useForm<ShippingForm>({
    resolver: zodResolver(shippingSchema),
    defaultValues: {
      fullName: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
      addressLine1: profile?.address_line1 ?? '',
      addressLine2: profile?.address_line2 ?? '',
      city: profile?.city ?? '',
      postalCode: profile?.postal_code ?? '',
      province: profile?.province ?? '',
    },
  });

  const shippingData = form.watch();
  const allItems = [...standardItems, ...listItems];
  const postalCode = shippingData.postalCode ?? '';
  const shipping = useShippingCost(postalCode, allItems, deliveryMethod, subtotal);
  const shippingCost = shipping.cost ?? 0;

  // Calculate tax breakdown by rate across all items
  const taxBreakdown = useMemo(() => {
    const map = new Map<number, { base: number; tax: number }>();
    allItems.forEach(item => {
      const pct = item.taxPercentage ?? 0;
      const baseTotal = (item.basePriceNoTax ?? item.price) * item.quantity;
      const taxTotal = baseTotal * (pct / 100);
      const existing = map.get(pct) ?? { base: 0, tax: 0 };
      map.set(pct, { base: existing.base + baseTotal, tax: existing.tax + taxTotal });
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([pct, vals]) => ({ percentage: pct, base: vals.base, tax: vals.tax }));
  }, [standardItems, listItems]);

  const totalProductTax = taxBreakdown.reduce((s, t) => s + t.tax, 0);
  const shippingTaxRate = 21; // Shipping IVA in Spain
  const shippingTaxAmount = shippingCost * (shippingTaxRate / (100 + shippingTaxRate));
  const grandTotal = subtotal + shippingCost;

  // Require login
  if (!user) {
    return (
      <div className="container py-16 text-center max-w-lg mx-auto">
        <h1 className="font-display text-2xl font-bold mb-4">{t('checkout.title')}</h1>
        <p className="text-muted-foreground mb-6">{t('errors.loginRequired')}</p>
        <Button asChild>
          <Link to="/login">{t('auth.login')}</Link>
        </Button>
      </div>
    );
  }

  if (isEmpty && !orderNumber) {
    navigate('/cistella');
    return null;
  }

  const handleDeliveryNext = async () => {
    if (deliveryMethod === 'shipping') {
      const valid = await form.trigger();
      if (!valid) return;
    }
    setStep('payment');
  };

  const generateOrderNumber = () => {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `MUS-${y}${m}${d}-${rand}`;
  };

  const handleConfirmOrder = async () => {
    if (!termsAccepted) {
      notify.error(t('checkout.termsAccept'));
      return;
    }
    setSubmitting(true);

    try {
      const orderItems = [...standardItems, ...listItems];
      const total = subtotal + shippingCost;
      const num = generateOrderNumber();

      const shippingAddress = deliveryMethod === 'shipping' ? {
        full_name: shippingData.fullName,
        phone: shippingData.phone,
        address_line1: shippingData.addressLine1,
        address_line2: shippingData.addressLine2,
        city: shippingData.city,
        postal_code: shippingData.postalCode,
        province: shippingData.province,
      } : null;

      // Upsert customer record (linked to auth user)
      let customerId: string | null = null;
      {
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (existing) {
          customerId = existing.id;
          if (deliveryMethod === 'shipping' && shippingAddress) {
            await supabase
              .from('customers')
              .update({
                full_name: shippingAddress.full_name,
                phone: shippingAddress.phone,
                address_line1: shippingAddress.address_line1,
                address_line2: shippingAddress.address_line2,
                city: shippingAddress.city,
                postal_code: shippingAddress.postal_code,
                province: shippingAddress.province,
              })
              .eq('id', existing.id);
          }
        } else {
          const { data: created, error: custErr } = await supabase
            .from('customers')
            .insert({
              auth_user_id: user.id,
              email: user.email ?? `${user.id}@unknown.local`,
              full_name: shippingAddress?.full_name ?? profile?.full_name ?? '',
              phone: shippingAddress?.phone ?? null,
              address_line1: shippingAddress?.address_line1 ?? null,
              address_line2: shippingAddress?.address_line2 ?? null,
              city: shippingAddress?.city ?? null,
              postal_code: shippingAddress?.postal_code ?? null,
              province: shippingAddress?.province ?? null,
            })
            .select('id')
            .single();
          if (custErr) throw custErr;
          customerId = created.id;
        }
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: num,
          customer_id: customerId!,
          list_id: activeListId,
          delivery_method: deliveryMethod === 'shipping' ? 'shipping_buyer' : 'pickup',
          payment_method: paymentMethod === 'bizum' ? 'bizum' : 'bank_transfer',
          shipping_address: shippingAddress,
          shipping_cost: shippingCost,
          tax_amount: totalProductTax + shippingTaxAmount,
          subtotal,
          total,
          notes: notes.trim() || null,
          status: 'pending',
          payment_status: 'pending',
        } as any)
        .select('id')
        .single();

      if (orderError) throw orderError;

      // Create order items
      // Fallback: if buying from a list, auto-link any item missing its list_item_id
      // by matching on product + variant against the active list_items.
      let listItemMap: Map<string, string> | null = null;
      if (activeListId) {
        const { data: liRows } = await supabase
          .from('list_items')
          .select('id, product_id, variant_id, quantity_desired, quantity_purchased')
          .eq('list_id', activeListId);
        if (liRows && liRows.length > 0) {
          listItemMap = new Map();
          for (const li of liRows) {
            const remaining = (li.quantity_desired ?? 0) - (li.quantity_purchased ?? 0);
            if (remaining <= 0) continue;
            const key = `${li.product_id}:${li.variant_id ?? ''}`;
            if (!listItemMap.has(key)) listItemMap.set(key, li.id);
          }
        }
      }

      const dbItems = orderItems.map(item => {
        const baseUnit = item.basePriceNoTax ?? item.price;
        const taxPct = item.taxPercentage ?? 0;
        const lineTax = baseUnit * (taxPct / 100) * item.quantity;
        let resolvedListItemId = item.listItemId || null;
        if (!resolvedListItemId && listItemMap) {
          const key = `${item.productId}:${item.variantId ?? ''}`;
          resolvedListItemId = listItemMap.get(key) || null;
        }
        return {
          order_id: order.id,
          product_id: item.productId,
          variant_id: item.variantId || null,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          base_unit_price: baseUnit,
          tax_percentage: taxPct,
          tax_amount: lineTax,
          list_item_id: resolvedListItemId,
        };
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(dbItems);

      if (itemsError) {
        // Roll back the just-created order so it doesn't linger as an empty pending row.
        await supabase.from('orders').delete().eq('id', order.id);
        const msg = String(itemsError.message || '');
        if (msg.includes('STOCK_INSUFFICIENT')) {
          notify.error(
            t('checkout.stockInsufficient') ||
            'Algun producte s\'ha esgotat mentre completaves la compra. Revisa la cistella.'
          );
          navigate('/cistella');
          return;
        }
        throw itemsError;
      }

      // Clear cart
      // Capture total BEFORE clearing the cart so confirmation step shows correct amount
      setFinalTotal(total);
      clearStandard();
      clearList();
      setOrderNumber(num);
      setStep('confirmation');

      // Fire-and-forget: notify admin & list owners if any product is now out of stock
      supabase.functions.invoke('notify-list-stock-depleted', {
        body: { order_id: order.id },
      }).catch(err => console.warn('notify-list-stock-depleted failed', err));
    } catch (err) {
      console.error('Order creation failed:', err);
      notify.error(t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const steps: { key: Step; label: string }[] = [
    { key: 'delivery', label: t('checkout.step2') },
    { key: 'payment', label: t('checkout.step3') },
    { key: 'confirmation', label: t('checkout.step4') },
  ];

  return (
    <div className="container py-8 max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className={`flex items-center gap-1.5 text-sm font-medium ${
              step === s.key ? 'text-primary' : steps.indexOf(steps.find(x => x.key === step)!) > i ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>{i + 1}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className="w-8 h-px bg-border" />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Delivery */}
        {step === 'delivery' && (
          <motion.div key="delivery" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h2 className="font-display text-2xl font-bold mb-6">{t('checkout.step2')}</h2>

            <RadioGroup value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as 'pickup' | 'shipping')} className="mb-6 space-y-3">
              <div className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors">
                <RadioGroupItem value="pickup" id="pickup" />
                <Label htmlFor="pickup" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Store className="h-5 w-5 text-primary" />
                  {t('checkout.pickup')}
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors">
                <RadioGroupItem value="shipping" id="shipping" />
                <Label htmlFor="shipping" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Truck className="h-5 w-5 text-primary" />
                  {t('checkout.shippingBuyer')}
                </Label>
              </div>
            </RadioGroup>

            {deliveryMethod === 'shipping' && (
              <Form {...form}>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="fullName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.fullName')}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('account.phone')}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="addressLine1" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('account.addressLine1')}</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="addressLine2" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('account.addressLine2')}</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('account.city')}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="postalCode" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('account.postalCode')}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="province" render={({ field }) => (
                      <FormItem className="col-span-2 sm:col-span-1">
                        <FormLabel>{t('account.province')}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </Form>
            )}

            {/* Shipping cost preview */}
            {deliveryMethod === 'shipping' && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                {shipping.isFreeShipping ? (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('cart.shipping')}</span>
                    <span className="font-semibold text-green-700">{t('checkout.freeShipping')} 🎉</span>
                  </div>
                ) : shipping.cost !== null ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('cart.shipping')} {shipping.zoneName && <span className="text-xs">({shipping.zoneName})</span>}</span>
                    <span className="font-semibold text-foreground">{shipping.cost.toFixed(2)} €</span>
                  </div>
                ) : shipping.error === 'no_zone' && postalCode.length >= 5 ? (
                  <p className="text-destructive">{t('checkout.noShippingZone')}</p>
                ) : null}
                {shipping.freeShippingThreshold > 0 && !shipping.isFreeShipping && (
                  <p className="text-xs text-muted-foreground">
                    {t('checkout.freeShippingHint', { amount: shipping.freeShippingThreshold.toFixed(2) })}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4">
              <Label htmlFor="notes" className="text-sm">{t('admin.notes')}</Label>
              <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" maxLength={500} placeholder="..." />
            </div>

            <div className="flex gap-3 mt-8">
              <Button variant="outline" className="flex-1" asChild>
                <Link to="/cistella"><ArrowLeft className="h-4 w-4 mr-1" />{t('common.back')}</Link>
              </Button>
              <Button className="flex-1" onClick={handleDeliveryNext}>{t('common.next')}</Button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Payment */}
        {step === 'payment' && (
          <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h2 className="font-display text-2xl font-bold mb-6">{t('checkout.step3')}</h2>

            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'bizum' | 'transfer')} className="mb-6 space-y-3">
              <div className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors">
                <RadioGroupItem value="bizum" id="bizum" />
                <Label htmlFor="bizum" className="flex items-center gap-2 cursor-pointer flex-1">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Bizum
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:border-primary cursor-pointer transition-colors">
                <RadioGroupItem value="transfer" id="transfer" />
                <Label htmlFor="transfer" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Landmark className="h-5 w-5 text-primary" />
                  {t('checkout.bankTransfer')}
                </Label>
              </div>
            </RadioGroup>

            {/* Payment details for selected method */}
            {paymentMethod === 'bizum' && paymentSettings.payment_bizum_phone && (
              <div className="bg-muted/50 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium mb-1">{t('checkout.bizum')}</p>
                <p className="text-sm text-muted-foreground">{t('admin.bizumPhone')}: <span className="font-mono font-semibold text-foreground">{paymentSettings.payment_bizum_phone}</span></p>
                <p className="text-xs text-muted-foreground mt-1">{t('checkout.paymentAfterConfirm')}</p>
              </div>
            )}
            {paymentMethod === 'transfer' && paymentSettings.payment_transfer_iban && (
              <div className="bg-muted/50 rounded-lg p-4 mb-6">
                <p className="text-sm font-medium mb-1">{t('checkout.bankTransfer')}</p>
                <p className="text-sm text-muted-foreground">IBAN: <span className="font-mono font-semibold text-foreground">{paymentSettings.payment_transfer_iban}</span></p>
                {paymentSettings.payment_transfer_beneficiary && (
                  <p className="text-sm text-muted-foreground">{t('admin.transferBeneficiary')}: <span className="font-semibold text-foreground">{paymentSettings.payment_transfer_beneficiary}</span></p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{t('checkout.paymentAfterConfirm')}</p>
              </div>
            )}

            {/* Order summary */}
            <div className="bg-card rounded-lg p-5 shadow-soft mb-6">
              <h3 className="font-display text-lg font-semibold mb-3">{t('checkout.step1')}</h3>
              {listItems.length > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{t('cart.listCart')} ({listItems.reduce((s, i) => s + i.quantity, 0)})</span>
                  <span>{listTotal.toFixed(2)} €</span>
                </div>
              )}
              {standardItems.length > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{t('cart.standardCart')} ({standardItems.reduce((s, i) => s + i.quantity, 0)})</span>
                  <span>{standardTotal.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{t('cart.shipping')} {shipping.zoneName && <span className="text-xs">({shipping.zoneName})</span>}</span>
                <span>{deliveryMethod === 'pickup' ? '0.00 €' : shipping.cost !== null ? `${shipping.cost.toFixed(2)} €` : '—'}</span>
              </div>
              <Separator className="my-3" />
              <p className="text-xs font-medium text-muted-foreground mb-1">Desglossament IVA</p>
              {taxBreakdown.map(tb => (
                <div key={tb.percentage} className="flex justify-between text-xs text-muted-foreground mb-0.5">
                  <span>Base {tb.percentage}%: {tb.base.toFixed(2)} €</span>
                  <span>IVA: {tb.tax.toFixed(2)} €</span>
                </div>
              ))}
              {deliveryMethod === 'shipping' && shippingCost > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                  <span>Enviament (base {(shippingCost - shippingTaxAmount).toFixed(2)} €, {shippingTaxRate}%)</span>
                  <span>IVA: {shippingTaxAmount.toFixed(2)} €</span>
                </div>
              )}
              <Separator className="my-3" />
              <div className="flex justify-between text-lg font-bold">
                <span>{t('cart.total')} <span className="text-xs font-normal text-muted-foreground">(IVA inclòs)</span></span>
                <span className="text-primary">{grandTotal.toFixed(2)} €</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 mb-6">
              <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(v === true)} />
              <Label htmlFor="terms" className="text-sm cursor-pointer">{t('checkout.termsAccept')}</Label>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep('delivery')}>
                <ArrowLeft className="h-4 w-4 mr-1" />{t('common.back')}
              </Button>
              <Button className="flex-1" onClick={handleConfirmOrder} disabled={submitting || !termsAccepted}>
                {submitting ? t('common.loading') : t('checkout.confirmOrder')}
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Confirmation */}
        {step === 'confirmation' && orderNumber && (
          <motion.div key="confirmation" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-4">
            <div className="text-center mb-8">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">{t('checkout.orderConfirmed')}</h2>
              <p className="text-muted-foreground mb-1">{t('checkout.orderNumber')}</p>
              <p className="text-xl font-mono font-bold text-foreground">{orderNumber}</p>
            </div>

            {/* Payment instructions */}
            <div className="bg-card rounded-lg p-5 shadow-soft mb-6 border border-border">
              <h3 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
                {paymentMethod === 'bizum' ? <CreditCard className="h-5 w-5 text-primary" /> : <Landmark className="h-5 w-5 text-primary" />}
                {t('checkout.paymentInstructions')}
              </h3>

              <p className="text-sm text-muted-foreground mb-4">
                {paymentMethod === 'bizum' ? t('checkout.bizumInstructions') : t('checkout.transferInstructions')}
              </p>

              <div className="space-y-3">
                {paymentMethod === 'bizum' ? (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t('admin.bizumPhone')}</p>
                      <p className="font-mono font-semibold text-foreground truncate">{paymentSettings.payment_bizum_phone || '—'}</p>
                    </div>
                    {paymentSettings.payment_bizum_phone && (
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(paymentSettings.payment_bizum_phone, 'bizum')}>
                        {copiedField === 'bizum' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">IBAN</p>
                        <p className="font-mono font-semibold text-foreground truncate">{paymentSettings.payment_transfer_iban || '—'}</p>
                      </div>
                      {paymentSettings.payment_transfer_iban && (
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(paymentSettings.payment_transfer_iban, 'iban')}>
                          {copiedField === 'iban' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                    {paymentSettings.payment_transfer_beneficiary && (
                      <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">{t('admin.transferBeneficiary')}</p>
                        <p className="font-semibold text-foreground">{paymentSettings.payment_transfer_beneficiary}</p>
                      </div>
                    )}
                  </>
                )}

                <div className="flex items-center justify-between gap-2 p-3 rounded-md bg-primary/10 border border-primary/20">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{t('checkout.paymentConcept')}</p>
                    <p className="font-mono font-semibold text-foreground truncate">{orderNumber}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(orderNumber, 'concept')}>
                    {copiedField === 'concept' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2 p-3 rounded-md bg-primary text-primary-foreground">
                  <p className="text-sm font-medium">{t('checkout.amountToPay')}</p>
                  <p className="text-lg font-bold">{finalTotal.toFixed(2)} €</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                ⓘ {t('checkout.useThisConcept')}
              </p>
            </div>

            <p className="text-sm text-muted-foreground text-center mb-6">
              {t('checkout.thanksMessage')}
            </p>

            <div className="text-center">
              <Button asChild>
                <Link to="/">{t('checkout.backToStore')}</Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CheckoutPage;
