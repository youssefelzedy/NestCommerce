# Inventory Management Service - Implementation Roadmap

## Overview

The Inventory Management Service will enhance your existing product stock tracking by adding real-time monitoring, reservations, alerts, and audit trails. Currently, your app has basic stock updates during orders—this service will add enterprise-grade inventory control.

## 🎯 Current State Analysis

**What You Already Have:**
- ✅ Product entity with `stock` field
- ✅ Stock updates when orders are created
- ✅ Stock restoration when orders are cancelled
- ✅ Stock validation in cart operations

**What We Need to Add:**
- 🔲 Stock reservation system (hold stock during checkout)
- 🔲 Inventory transaction audit trail
- 🔲 Low stock alerts and monitoring
- 🔲 Stock adjustment capabilities (returns, damages, corrections)
- 🔲 Bulk stock operations
- 🔲 Stock availability checking with reservations

## 📋 Implementation Steps (Organized by Priority)

### **Phase 1: Core Infrastructure (Week 1)**

#### Step 1.1: Create Module Structure
```
src/inventory/
├── inventory.module.ts
├── inventory.controller.ts
├── inventory.service.ts
├── dto/
│   ├── reserve-stock.dto.ts
│   ├── adjust-stock.dto.ts
│   ├── bulk-update-stock.dto.ts
│   └── stock-query.dto.ts
├── entities/
│   ├── inventory-transaction.entity.ts
│   ├── stock-reservation.entity.ts
│   └── stock-alert.entity.ts
└── events/
    └── inventory.events.ts
```

#### Step 1.2: Database Schema Design

**Table 1: `inventory_transactions`** (Audit Trail)
```sql
- id: PK
- product_id: FK -> products
- transaction_type: ENUM(IN, OUT, ADJUSTMENT, RETURN, DAMAGE)
- quantity: INT (can be negative)
- previous_stock: INT
- new_stock: INT
- reference_type: VARCHAR (Order, Return, Manual)
- reference_id: INT
- reason: TEXT
- created_by: INT
- created_at: TIMESTAMP
```

**Table 2: `stock_reservations`** (Temporary holds)
```sql
- id: PK
- product_id: FK -> products
- customer_id: FK -> customers
- reserved_quantity: INT
- status: ENUM(ACTIVE, COMPLETED, CANCELLED, EXPIRED)
- expires_at: TIMESTAMP
- cart_id: FK -> carts (optional)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

**Table 3: `stock_alerts`** (Low stock notifications)
```sql
- id: PK
- product_id: FK -> products
- alert_threshold: INT
- current_stock: INT
- alert_status: ENUM(PENDING, NOTIFIED, RESOLVED)
- notified_at: TIMESTAMP
- created_at: TIMESTAMP
```

#### Step 1.3: Create TypeORM Entities
Create the three entities above with proper relationships to Product, Customer, and Cart entities.

---

### **Phase 2: Stock Reservation System (Week 1-2)**

#### Step 2.1: Implement Stock Reservation Logic
**Purpose:** Hold stock when customers add to cart, release if not purchased within timeout

**Key Methods:**
- `reserveStock(productId, quantity, customerId)` - Create reservation when adding to cart
- `releaseReservation(reservationId)` - Release when removing from cart or timeout
- `confirmReservation(reservationId)` - Convert to sale when order created
- `cleanupExpiredReservations()` - Scheduled job to clear old reservations

#### Step 2.2: Update Cart Service Integration
**Modify cart operations to:**
1. Create reservation when adding item to cart
2. Update reservation when changing quantity
3. Release reservation when removing from cart
4. Auto-expire reservations after 30 minutes

#### Step 2.3: Update Order Service Integration
**When order is created:**
1. Confirm all cart item reservations
2. Create inventory transactions for audit
3. Update actual product stock

---

### **Phase 3: Inventory Transactions (Week 2)**

#### Step 3.1: Transaction Recording
**Every stock change creates a transaction record:**
- Order creation → OUT transaction
- Order cancellation → IN transaction
- Manual adjustment → ADJUSTMENT transaction
- Return/refund → RETURN transaction
- Damaged goods → DAMAGE transaction

#### Step 3.2: Create Inventory Service Methods
```typescript
- recordTransaction(type, productId, quantity, reference)
- getTransactionHistory(productId, filters)
- getCurrentAvailableStock(productId) // Physical - Reserved
- getReservedStock(productId)
- getPhysicalStock(productId)
```

---

### **Phase 4: Stock Monitoring & Alerts (Week 2-3)**

#### Step 4.1: Low Stock Detection
**Implement:**
- Automatic threshold monitoring
- Alert generation when stock < threshold
- Admin notification system
- Dashboard display of low stock items

#### Step 4.2: Stock Availability Checking
**Enhanced availability check:**
```typescript
checkAvailability(productId, requestedQty) {
  physicalStock = product.stock
  reservedStock = sum(active_reservations)
  availableStock = physicalStock - reservedStock
  return availableStock >= requestedQty
}
```

#### Step 4.3: Real-time Monitoring Endpoints
- `GET /inventory/low-stock` - Products below threshold
- `GET /inventory/out-of-stock` - Products with 0 available
- `GET /inventory/:productId/status` - Detailed stock status

---

### **Phase 5: Stock Adjustments (Week 3)**

#### Step 5.1: Manual Adjustment Operations
**Create endpoints for:**
- Adding stock (receiving inventory)
- Removing stock (damage, loss, theft)
- Correcting stock (inventory counts)
- Returns processing

#### Step 5.2: Validation & Authorization
- Admin-only access for adjustments
- Mandatory reason/notes for adjustments
- Approval workflow for large adjustments

#### Step 5.3: Adjustment Service Methods
```typescript
- adjustStock(productId, quantity, reason, adjustmentType)
- processReturn(orderId, items, reason)
- recordDamage(productId, quantity, reason)
- correctStock(productId, actualCount, reason)
```

---

### **Phase 6: Bulk Operations (Week 3-4)**

#### Step 6.1: Bulk Stock Updates
**Features:**
- Upload CSV with product SKUs and quantities
- Validate all products exist
- Preview changes before applying
- Apply all updates in a transaction

#### Step 6.2: Bulk Export
- Export current inventory to CSV/Excel
- Include: SKU, name, physical stock, reserved, available
- Filter by category, status, stock level

---

## 🔧 Technical Implementation Guide

### **Step-by-Step Coding Process:**

#### **1. Create Entities (Day 1)**
Start with the three core entities. Use existing patterns from Order entities.

```typescript
// inventory-transaction.entity.ts
@Entity('inventory_transactions')
export class InventoryTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'product_id' })
  productId: number;

  @Column({
    type: 'enum',
    enum: TransactionType
  })
  transactionType: TransactionType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'previous_stock', type: 'int' })
  previousStock: number;

  @Column({ name: 'new_stock', type: 'int' })
  newStock: number;

  // ... additional fields
}
```

#### **2. Create DTOs (Day 1)**
Define all data transfer objects for validation.

#### **3. Build Core Service (Day 2-3)**
Start with essential methods:
- Stock reservation
- Transaction recording
- Availability checking

#### **4. Create Controller (Day 3)**
Expose HTTP endpoints with proper guards.

#### **5. Integrate with Existing Services (Day 4-5)**

**Update Orders Service:**
```typescript
// Before creating order
const reservations = await this.inventoryService.createReservations(cartItems);

// After order created
await this.inventoryService.confirmReservations(reservations);
await this.inventoryService.recordTransaction({
  type: 'OUT',
  productId,
  quantity,
  referenceType: 'ORDER',
  referenceId: order.id
});
```

**Update Cart Service:**
```typescript
// When adding to cart
await this.inventoryService.reserveStock(productId, quantity, customerId);

// When removing from cart
await this.inventoryService.releaseReservation(reservationId);
```

#### **6. Add Event Listeners (Day 5)**
```typescript
@OnEvent('order.created')
handleOrderCreated(payload: OrderCreatedEventPayload) {
  // Record transactions
  // Update reservations
}

@OnEvent('order.cancelled')
handleOrderCancelled(payload: OrderCancelledEventPayload) {
  // Create return transactions
  // Restore stock
}
```

#### **7. Implement Scheduled Jobs (Day 6)**
```typescript
@Cron('*/15 * * * *') // Every 15 minutes
cleanupExpiredReservations() {
  // Find reservations older than 30 minutes
  // Release them
  // Log the cleanup
}

@Cron('0 9 * * *') // Daily at 9 AM
checkLowStockAlerts() {
  // Find products below threshold
  // Create/update alerts
  // Send notifications
}
```

---

## 🔄 Integration Flow Diagram

```
Customer adds to cart
    ↓
Check available stock (physical - reserved)
    ↓
Create stock reservation (30 min expiry)
    ↓
Customer proceeds to checkout
    ↓
Create order
    ↓
Confirm reservations → Update physical stock
    ↓
Record inventory transaction (audit)
    ↓
Check if stock < threshold → Create alert
```

---

## 📊 API Endpoints Overview

```typescript
// Reservation Management
POST   /inventory/reserve              // Reserve stock
DELETE /inventory/reserve/:id          // Release reservation
POST   /inventory/reserve/:id/confirm  // Confirm reservation

// Stock Monitoring
GET    /inventory/products/:id/status  // Get detailed stock status
GET    /inventory/low-stock            // Get low stock items
GET    /inventory/availability/:id     // Check product availability

// Stock Adjustments
POST   /inventory/adjust                // Manual stock adjustment
POST   /inventory/return                // Process return
POST   /inventory/damage                // Record damaged goods

// Transactions & History
GET    /inventory/transactions          // Get all transactions (admin)
GET    /inventory/transactions/:productId // Product transaction history

// Bulk Operations
POST   /inventory/bulk-update           // Bulk stock update
GET    /inventory/export                // Export inventory data
```

---

## ✅ Testing Checklist

- [ ] Reservation creation and expiry
- [ ] Available stock calculation (physical - reserved)
- [ ] Concurrent reservation handling (race conditions)
- [ ] Transaction recording for all stock changes
- [ ] Low stock alert generation
- [ ] Order integration with reservations
- [ ] Cart integration with reservations
- [ ] Bulk operations validation
- [ ] Scheduled job execution
- [ ] Admin authorization

---

## 🚀 Quick Start Commands

```bash
# 1. Create module structure
mkdir -p src/inventory/{dto,entities,events}

# 2. Install any additional dependencies (if needed)
npm install @nestjs/schedule @nestjs/cron

# 3. Generate files (or create manually)
# Start with entities, then DTOs, then service, then controller

# 4. Add to AppModule
# Import InventoryModule and ScheduleModule

# 5. Test endpoints
# Use Postman or similar to test each endpoint
```

---

## 💡 Best Practices

1. **Always use transactions** for stock updates
2. **Record every change** in inventory_transactions
3. **Set reasonable reservation timeouts** (15-30 minutes)
4. **Implement idempotency** for reservation operations
5. **Add comprehensive logging** for debugging
6. **Use database locks** for concurrent updates
7. **Schedule cleanup jobs** outside peak hours

Would you like me to start implementing the inventory service following these steps?