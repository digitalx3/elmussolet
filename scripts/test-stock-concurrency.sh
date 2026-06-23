#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Stock concurrency test
#
# Verifies that two simultaneous order_items inserts that consume the same
# product unit cannot both succeed. The slower transaction must fail with
# the "STOCK_INSUFFICIENT" exception raised by apply_order_item_stock_delta.
#
# Requirements: psql in PATH and the standard PG* env vars pointing at the
# Lovable Cloud / Supabase database (the dev sandbox sets these automatically).
#
# Usage:  bash scripts/test-stock-concurrency.sh
# ----------------------------------------------------------------------------
set -euo pipefail

if [ -z "${PGHOST:-}" ]; then
  echo "PGHOST not set — cannot reach the database." >&2
  exit 2
fi

TS=$(date +%s)
TMP=$(mktemp -d)
echo "Scratch dir: $TMP"

cleanup() {
  psql -v ON_ERROR_STOP=0 -q <<SQL >/dev/null 2>&1 || true
    DELETE FROM public.order_items WHERE order_id IN (
      SELECT id FROM public.orders WHERE order_number LIKE 'TEST-STK-${TS}-%'
    );
    DELETE FROM public.orders WHERE order_number LIKE 'TEST-STK-${TS}-%';
    DELETE FROM public.products WHERE sku = 'TEST-STK-${TS}';
SQL
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "== 1. Seeding test product with stock = 1 =="
PRODUCT_ID=$(psql -tA <<SQL
  INSERT INTO public.products (sku, slug, base_price, stock_quantity, stock_status, is_active)
  VALUES ('TEST-STK-${TS}', 'test-stk-${TS}', 1.00, 1, 'in_stock', true)
  RETURNING id;
SQL
)
echo "product_id=$PRODUCT_ID"

echo "== 2. Creating two pending orders =="
# Pick any existing user (service-defined data) — required by orders.user_id FK
USER_ID=$(psql -tA -c "SELECT id FROM auth.users ORDER BY created_at LIMIT 1;")
if [ -z "$USER_ID" ]; then
  echo "No auth.users found — create at least one user first." >&2
  exit 2
fi

ORDER_A=$(psql -tA <<SQL
  INSERT INTO public.orders (order_number, user_id, subtotal, total, status, payment_status)
  VALUES ('TEST-STK-${TS}-A', '${USER_ID}', 1, 1, 'pending', 'pending') RETURNING id;
SQL
)
ORDER_B=$(psql -tA <<SQL
  INSERT INTO public.orders (order_number, user_id, subtotal, total, status, payment_status)
  VALUES ('TEST-STK-${TS}-B', '${USER_ID}', 1, 1, 'pending', 'pending') RETURNING id;
SQL
)
echo "order_a=$ORDER_A"
echo "order_b=$ORDER_B"

echo "== 3. Firing two parallel order_items inserts =="
cat > "$TMP/tx_a.sql" <<SQL
BEGIN;
SELECT pg_advisory_xact_lock(42);   -- sync point: both wait until both started
INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
VALUES ('${ORDER_A}', '${PRODUCT_ID}', 1, 1, 1);
COMMIT;
SQL

cat > "$TMP/tx_b.sql" <<SQL
BEGIN;
SELECT pg_advisory_xact_lock(42);
INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
VALUES ('${ORDER_B}', '${PRODUCT_ID}', 1, 1, 1);
COMMIT;
SQL

# Note: pg_advisory_xact_lock is mutually exclusive on the same key, so both
# transactions queue on it; the row-level FOR UPDATE inside the trigger then
# enforces stock integrity for whichever runs second.

( psql -v ON_ERROR_STOP=1 -f "$TMP/tx_a.sql" > "$TMP/a.out" 2>&1 ; echo "EXIT_A=$?" >> "$TMP/a.out" ) &
PID_A=$!
( psql -v ON_ERROR_STOP=1 -f "$TMP/tx_b.sql" > "$TMP/b.out" 2>&1 ; echo "EXIT_B=$?" >> "$TMP/b.out" ) &
PID_B=$!

wait $PID_A || true
wait $PID_B || true

echo "----- TX A output -----"; cat "$TMP/a.out"
echo "----- TX B output -----"; cat "$TMP/b.out"

OK_COUNT=$(grep -lc "INSERT 0 1" "$TMP/a.out" "$TMP/b.out" 2>/dev/null | awk '{s+=$1} END{print s+0}')
FAIL_COUNT=$(grep -lc "STOCK_INSUFFICIENT" "$TMP/a.out" "$TMP/b.out" 2>/dev/null | awk '{s+=$1} END{print s+0}')

echo
echo "Successful inserts: $OK_COUNT"
echo "STOCK_INSUFFICIENT errors: $FAIL_COUNT"

REMAINING=$(psql -tA -c "SELECT stock_quantity FROM public.products WHERE id = '$PRODUCT_ID';")
echo "Remaining stock: $REMAINING (expected: 0)"

MOVEMENTS=$(psql -tA -c "SELECT count(*) FROM public.stock_movements WHERE product_id = '$PRODUCT_ID';")
echo "stock_movements rows for this product: $MOVEMENTS (expected: 1)"

if [ "$OK_COUNT" = "1" ] && [ "$FAIL_COUNT" = "1" ] && [ "$REMAINING" = "0" ] && [ "$MOVEMENTS" = "1" ]; then
  echo "✅ Concurrency test PASSED"
  exit 0
else
  echo "❌ Concurrency test FAILED"
  exit 1
fi
