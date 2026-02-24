# Database Fill Tracking Issue & Recommendations

**Date:** February 24, 2026  
**Issue:** Position 2 chaos - Database couldn't track fills, resulting in Meridian placing 4 orders (102, 9✅, 113, 8) instead of stopping after the first fill.

## Problem Analysis

The issue reported by Aman suggests that the database is not properly tracking **partial fills** and **order status updates** from the broker. This causes the system to:

1. **Not recognize** when an order is partially filled
2. **Continue placing orders** thinking the position is not yet entered
3. **Create duplicate positions** leading to over-exposure

## Root Cause

The core issue is likely in the **Python backend execution system** (atlas-brain repo / meridian_executor.py / meridian_db.py), which this Next.js frontend cannot directly fix.

However, based on the database schema analysis:

### Missing Tables/Fields

The current schema has:
- ✅ `users` table
- ✅ `accounts` table  
- ✅ `trades` table (for closed positions)
- ✅ `pending_signals` table (referenced but not in schema)
- ❌ **No `orders` table** to track individual order placement
- ❌ **No `fills` table** to track partial fills
- ❌ **No order status tracking** (pending, partially_filled, filled, cancelled)

## Recommended Solution

### 1. Create Orders Table (Backend)

```sql
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_id INTEGER, -- Links to pending_signals if applicable
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    
    -- Order details
    broker_order_id VARCHAR(100) UNIQUE, -- Broker's order ID
    symbol VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL, -- 'BUY', 'SELL', 'BUY_TO_OPEN', 'SELL_TO_CLOSE'
    asset_type VARCHAR(20) DEFAULT 'option',
    strike DECIMAL(10, 2),
    expiry DATE,
    
    -- Quantity tracking
    quantity_requested INTEGER NOT NULL,
    quantity_filled INTEGER DEFAULT 0,
    quantity_remaining INTEGER,
    
    -- Pricing
    limit_price DECIMAL(12, 4),
    average_fill_price DECIMAL(12, 4),
    
    -- Status tracking (CRITICAL)
    status VARCHAR(30) DEFAULT 'pending', 
    -- Values: pending, open, partially_filled, filled, cancelled, rejected
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP, -- When sent to broker
    first_fill_at TIMESTAMP, -- When first fill received
    completed_at TIMESTAMP, -- When fully filled or cancelled
    last_status_check TIMESTAMP,
    
    -- Metadata
    broker_response TEXT, -- Raw broker response for debugging
    error_message TEXT,
    notes TEXT,
    
    CONSTRAINT check_quantity_valid CHECK (quantity_filled <= quantity_requested)
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_broker_order_id ON orders(broker_order_id);
CREATE INDEX idx_orders_signal_id ON orders(signal_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

### 2. Create Fills Table (Backend)

```sql
CREATE TABLE IF NOT EXISTS order_fills (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Fill details
    fill_quantity INTEGER NOT NULL,
    fill_price DECIMAL(12, 4) NOT NULL,
    fill_time TIMESTAMP NOT NULL,
    
    -- Broker data
    broker_fill_id VARCHAR(100),
    execution_id VARCHAR(100),
    
    -- Metadata
    commission DECIMAL(12, 4),
    fees DECIMAL(12, 4),
    broker_response TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fills_order_id ON order_fills(order_id);
CREATE INDEX idx_fills_fill_time ON order_fills(fill_time DESC);
```

### 3. Update Execution Logic (Backend - Python)

**Before placing an order:**

```python
def check_existing_position(user_id, signal_id, symbol):
    """
    Check if we already have an open order or position for this signal.
    CRITICAL: Prevents duplicate orders.
    """
    # Check for existing orders in non-terminal states
    existing_orders = db.query("""
        SELECT id, status, quantity_requested, quantity_filled
        FROM orders
        WHERE user_id = %s
          AND signal_id = %s
          AND symbol = %s
          AND status IN ('pending', 'open', 'partially_filled')
    """, (user_id, signal_id, symbol))
    
    if existing_orders:
        total_filled = sum(order['quantity_filled'] for order in existing_orders)
        if total_filled > 0:
            logger.warning(f"Already have {total_filled} filled for signal {signal_id}")
            return True  # Don't place another order
    
    return False
```

**When placing an order:**

```python
def place_order(user_id, signal_id, symbol, quantity, limit_price):
    """
    Place order and record in database IMMEDIATELY.
    """
    # Check for duplicates
    if check_existing_position(user_id, signal_id, symbol):
        logger.error("Duplicate order prevented")
        return None
    
    # Place order with broker
    broker_response = broker_api.place_order(
        symbol=symbol,
        quantity=quantity,
        limit_price=limit_price
    )
    
    # IMMEDIATELY record in database (before webhook)
    order_id = db.insert("""
        INSERT INTO orders (
            user_id, signal_id, symbol, direction,
            quantity_requested, quantity_remaining,
            limit_price, status, broker_order_id,
            submitted_at, broker_response
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'open', %s, NOW(), %s)
        RETURNING id
    """, (
        user_id, signal_id, symbol, 'BUY_TO_OPEN',
        quantity, quantity,
        limit_price, broker_response['order_id'], json.dumps(broker_response)
    ))
    
    logger.info(f"Order {order_id} placed, broker_id: {broker_response['order_id']}")
    return order_id
```

**When receiving fills (webhook or polling):**

```python
def process_fill(broker_order_id, fill_data):
    """
    Process fill notification from broker.
    Updates order status and records fill.
    """
    # Find order in database
    order = db.query_one("""
        SELECT id, quantity_requested, quantity_filled, status
        FROM orders
        WHERE broker_order_id = %s
    """, (broker_order_id,))
    
    if not order:
        logger.error(f"Order {broker_order_id} not found in database")
        return
    
    # Record fill
    db.insert("""
        INSERT INTO order_fills (
            order_id, fill_quantity, fill_price, fill_time,
            broker_fill_id, broker_response
        ) VALUES (%s, %s, %s, %s, %s, %s)
    """, (
        order['id'],
        fill_data['quantity'],
        fill_data['price'],
        fill_data['timestamp'],
        fill_data['fill_id'],
        json.dumps(fill_data)
    ))
    
    # Update order status
    new_filled = order['quantity_filled'] + fill_data['quantity']
    new_remaining = order['quantity_requested'] - new_filled
    
    if new_remaining == 0:
        new_status = 'filled'
    elif new_filled > 0:
        new_status = 'partially_filled'
    else:
        new_status = order['status']
    
    db.execute("""
        UPDATE orders
        SET quantity_filled = %s,
            quantity_remaining = %s,
            status = %s,
            first_fill_at = COALESCE(first_fill_at, NOW()),
            completed_at = CASE WHEN %s = 'filled' THEN NOW() ELSE completed_at END,
            last_status_check = NOW()
        WHERE id = %s
    """, (new_filled, new_remaining, new_status, new_status, order['id']))
    
    logger.info(f"Order {order['id']} updated: {new_filled}/{order['quantity_requested']} filled, status: {new_status}")
```

### 4. Webhook Handler (Backend)

Ensure your webhook endpoint processes fills immediately:

```python
@app.route('/webhooks/tradier/fills', methods=['POST'])
def tradier_fill_webhook():
    """
    Receives real-time fill notifications from Tradier.
    """
    data = request.json
    
    logger.info(f"Fill webhook received: {data}")
    
    try:
        process_fill(
            broker_order_id=data['order']['id'],
            fill_data={
                'quantity': data['order']['last_fill_quantity'],
                'price': data['order']['last_fill_price'],
                'timestamp': data['order']['transaction_date'],
                'fill_id': data['order']['exec_id'],
            }
        )
        return {'status': 'ok'}, 200
    except Exception as e:
        logger.error(f"Fill webhook processing failed: {e}")
        return {'error': str(e)}, 500
```

## Frontend Integration

Once the backend is fixed, the Next.js dashboard can display order status:

### Add Orders API Route

```typescript
// app/api/user/orders/route.ts
export async function GET(request: Request) {
  const authResult = await requireUserId();
  if (!authResult.ok) return authResult.response;

  const result = await pool.query(
    `SELECT 
      o.id, o.symbol, o.direction, o.status,
      o.quantity_requested, o.quantity_filled, o.quantity_remaining,
      o.limit_price, o.average_fill_price,
      o.created_at, o.submitted_at, o.completed_at,
      o.broker_order_id, o.error_message
    FROM orders o
    WHERE o.user_id = $1
    ORDER BY o.created_at DESC
    LIMIT 100`,
    [authResult.userId]
  );

  return NextResponse.json({ orders: result.rows });
}
```

### Display Order Status in Dashboard

Show users:
- ✅ Order placed at 10:30:15
- ⏳ Partially filled: 5/10 contracts at $2.50
- ✅ Fully filled: 10/10 contracts at avg $2.48
- ❌ Cancelled: 0/10 filled

## Testing Checklist

After implementing the fix:

1. ✅ Place order → verify immediately in `orders` table
2. ✅ Receive partial fill → verify status = 'partially_filled'
3. ✅ Check duplicate prevention → should reject 2nd order for same signal
4. ✅ Receive remaining fill → verify status = 'filled'
5. ✅ Check total quantities → filled + remaining = requested
6. ✅ Verify fill history in `order_fills` table

## Current Status

**What was fixed in this PR:**
- ✅ CSRF frontend integration
- ✅ Request deduplication in Next.js API routes
- ✅ Enhanced error logging with timestamps and context
- ✅ Buying power / settled cash display in Tradier verification
- ✅ Better console logs for debugging credential saves

**What still needs fixing (Python backend):**
- ❌ Orders table creation
- ❌ Fills table creation
- ❌ Execution logic to check existing orders before placing new ones
- ❌ Fill processing logic to update order status
- ❌ Webhook handler to receive real-time fills

## Next Steps

1. **Locate Python backend repo** (atlas-brain / meridian_executor.py)
2. **Create database migrations** for orders and fills tables
3. **Update order placement logic** to check for duplicates
4. **Implement fill processing** from broker webhooks
5. **Test thoroughly** with small quantities
6. **Add monitoring** for order placement and fill rates

## Contact

If the Python backend is in a different repo or service, this document should be shared with the backend team to implement the database schema and execution logic changes.
