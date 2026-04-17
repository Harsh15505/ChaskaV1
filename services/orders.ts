import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  writeBatch,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FirestoreOrder,
  OrderItem,
  OrderStatus,
  TableStatus,
} from "@/lib/chaska-data";
import { updateTableStatus } from "@/services/tables";
// Receipt helpers live in lib/receipt.ts — re-exported here for backward compatibility
export { generateReceipt, formatReceiptForPrint } from "@/lib/receipt";
export type { ReceiptData, ReceiptItem } from "@/lib/receipt";

const ORDERS_COLLECTION = "orders";

/** Convert a Firestore doc snapshot to FirestoreOrder */
function toOrder(id: string, data: Record<string, unknown>): FirestoreOrder {
  return {
    id,
    tableId: data.tableId as string,
    items: data.items as OrderItem[],
    status: data.status as OrderStatus,
    orderType: data.orderType as "takeaway" | undefined,
    kotPrinted: data.kotPrinted as boolean | undefined,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
  };
}

/**
 * Subscribe to all active orders (not billed).
 * Returns unsubscribe function.
 */
export function subscribeToActiveOrders(
  callback: (orders: FirestoreOrder[]) => void
): Unsubscribe {
  const q = query(
    collection(db, ORDERS_COLLECTION),
    where("status", "!=", "billed")
  );
  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map((d) =>
      toOrder(d.id, d.data() as Record<string, unknown>)
    );
    callback(orders);
  });
}

/**
 * Returns the start of the current "business day" — 12:00 PM today.
 * If it is currently before noon, the business day started at 12:00 PM yesterday.
 * This accounts for late-night service running past midnight.
 */
export function getBusinessDayStart(): Date {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(12, 0, 0, 0); // noon today
  if (now < cutoff) {
    // Before noon today → business day started at noon yesterday
    cutoff.setDate(cutoff.getDate() - 1);
  }
  return cutoff;
}

/**
 * Subscribes to today's billed orders (since last 12:00 PM cutoff).
 * Streams the total revenue as a number.
 * Only active on the billing screen.
 */
export function subscribeTodayRevenue(
  callback: (totalRevenue: number) => void
): Unsubscribe {
  const cutoff = getBusinessDayStart();

  const q = query(
    collection(db, ORDERS_COLLECTION),
    where("status", "==", "billed"),
    where("updatedAt", ">=", Timestamp.fromDate(cutoff))
  );

  return onSnapshot(q, (snap) => {
    let total = 0;
    snap.docs.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const items = (data.items as OrderItem[]) ?? [];
      items.forEach((item) => {
        total += (item.price ?? 0) * (item.quantity ?? 0);
      });
    });
    callback(total);
  });
}

/**
 * Subscribe to orders for a specific table.
 * Used on the order screen to load existing items.
 */
export function subscribeToTableOrder(
  tableId: string,
  callback: (order: FirestoreOrder | null) => void
): Unsubscribe {
  const q = query(
    collection(db, ORDERS_COLLECTION),
    where("tableId", "==", tableId),
    where("status", "!=", "billed")
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback(null);
    } else {
      callback(toOrder(snap.docs[0].id, snap.docs[0].data() as Record<string, unknown>));
    }
  });
}

/**
 * Create a brand new order for a table (a new round/ticket).
 * Also sets table status → "active".
 */
export async function createOrder(
  tableId: string,
  items: OrderItem[]
): Promise<string> {
  const ref = await addDoc(collection(db, ORDERS_COLLECTION), {
    tableId,
    items,
    status: "pending",
    kotPrinted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateTableStatus(tableId, "active");

  return ref.id;
}

/**
 * Create a takeaway order linked to the given table.
 * Visible in the kitchen with an orange "TAKEAWAY" badge.
 * Automatically merges into that table's bill.
 * Does NOT change the table's status.
 */
export async function createTakeawayOrder(
  tableId: string,
  items: OrderItem[]
): Promise<string> {
  const ref = await addDoc(collection(db, ORDERS_COLLECTION), {
    tableId,
    orderType: "takeaway",
    items,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Merge new/updated items into an existing order.
 * Pass resetKotPrinted=true when a waiter adds new items so the billing
 * device's auto-print hook detects the change and prints a fresh KOT.
 */
export async function updateOrderItems(
  orderId: string,
  newItems: OrderItem[],
  resetKotPrinted = false
): Promise<void> {
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    items: newItems,
    ...(resetKotPrinted ? { kotPrinted: false } : {}),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update an order's status.
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Marks one or more orders as having their KOT printed.
 */
export async function markOrdersKotPrinted(orderIds: string[]): Promise<void> {
  if (!orderIds.length) return;
  const batch = writeBatch(db);
  orderIds.forEach((id) => {
    batch.update(doc(db, ORDERS_COLLECTION, id), {
      kotPrinted: true,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

/**
 * Safely claims a KOT print job to prevent multiple billing devices from printing simultaneously.
 * Uses a strict Firestore transaction. A lock is valid for 20 seconds.
 * Returns true if claimed successfully, false if already printed or currently locked by another device.
 */
export async function claimKotPrintJob(orderIds: string[]): Promise<boolean> {
  if (!orderIds.length) return false;

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Read all documents first
      const docsToUpdate = [];
      for (const id of orderIds) {
        const ref = doc(db, ORDERS_COLLECTION, id);
        const orderDoc = await transaction.get(ref);
        if (!orderDoc.exists()) throw new Error("Order not found");

        const data = orderDoc.data();
        
        // If it's already fully printed, abort.
        if (data.kotPrinted === true) throw new Error("Already printed");

        // If it was locked less than 20 seconds ago, another device is handling it.
        if (data.kotPrintLockedAt) {
          const lockedAt = (data.kotPrintLockedAt as Timestamp).toMillis();
          if (Date.now() - lockedAt < 20000) {
            throw new Error("Currently locked by another device");
          }
        }

        docsToUpdate.push(ref);
      }

      // 2. Perform updates (claiming)
      for (const ref of docsToUpdate) {
        transaction.update(ref, {
          kotPrintLockedAt: serverTimestamp()
        });
      }
    });

    return true; // Successfully claimed
  } catch (err) {
    // Transaction aborted due to throwing an error (e.g. locked, printed, not found)
    return false;
  }
}

/**
 * Kitchen marks an order done (served).
 * Sets order → "served" and leaves table active for more rounds.
 */
export async function markOrderServed(
  orderId: string,
  tableId: string // kept to avoid changing other components' props
): Promise<void> {
  await updateOrderStatus(orderId, "served");
}

/**
 * Kitchen ticks a single item as done.
 * If ALL non-skipKitchen items in the order are done, auto-marks the whole order as served.
 */
export async function markOrderItemDone(
  orderId: string,
  itemId: string,
): Promise<void> {
  const ref = doc(db, ORDERS_COLLECTION, orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data() as Record<string, unknown>;
  const items = (data.items as OrderItem[]).map((i) =>
    i.id === itemId ? { ...i, markedDone: true } : i
  );

  // Auto-complete order when every kitchen-bound item is ticked
  const kitchenItems = items.filter((i) => !i.skipKitchen);
  const allDone =
    kitchenItems.length > 0 && kitchenItems.every((i) => i.markedDone);

  await updateDoc(ref, {
    items,
    ...(allDone ? { status: "served" } : {}),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Waiter requests the bill after all rounds are done.
 * Sets table → "billing".
 */
export async function requestBill(
  tableId: string
): Promise<void> {
  await updateTableStatus(tableId, "billing" as TableStatus);
}



/**
 * Billing clears a table after payment.
 * Completes all active orders for the table and frees the table.
 */
export async function clearTable(
  tableId: string
): Promise<void> {
  const q = query(
    collection(db, ORDERS_COLLECTION),
    where("tableId", "==", tableId),
    where("status", "!=", "billed")
  );
  const snap = await getDocs(q);
  
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { status: "billed", updatedAt: serverTimestamp() });
  });
  
  batch.update(doc(db, "tables", tableId), { status: "free" });
  await batch.commit();
}

// Receipt generation has moved to lib/receipt.ts
// Use: import { generateReceipt, formatReceiptForPrint } from "@/lib/receipt"
// or:  import { generateReceipt } from "@/services/orders"  (re-exported above)

export interface BillHistoryEntry {
  /** Unique key for this bill group (tableId + billing session approx. timestamp) */
  key: string;
  tableId: string;
  tableNumber: string | null; // null for takeaway-only
  billedAt: Date;
  orders: FirestoreOrder[];
  total: number;
  itemCount: number;
  isTableBill: boolean;
}

/**
 * Subscribes to all billed orders from the last 30 days.
 * Groups them into BillHistoryEntry objects (one per clear-table event).
 * Calls callback with the list sorted newest-first.
 *
 * NOTE: requires the composite Firestore index (status ASC, updatedAt ASC)
 * that already exists for subscribeTodayRevenue.
 */
export function subscribeBillHistory(
  callback: (entries: BillHistoryEntry[]) => void
): Unsubscribe {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const q = query(
    collection(db, ORDERS_COLLECTION),
    where("status", "==", "billed"),
    where("updatedAt", ">=", Timestamp.fromDate(cutoff))
  );

  return onSnapshot(q, (snap) => {
    const allOrders: FirestoreOrder[] = snap.docs.map((d) =>
      toOrder(d.id, d.data() as Record<string, unknown>)
    );

    // Group by tableId + approximate billing session window (30-minute bucket)
    // Two orders belong to the same bill if they share tableId and their
    // updatedAt timestamps are within 30 minutes of each other.
    const groups = new Map<string, FirestoreOrder[]>();

    allOrders.forEach((order) => {
      // Bucket timestamp to nearest 30-minute window
      const ts = order.updatedAt.getTime();
      const bucket = Math.floor(ts / (30 * 60 * 1000));
      const key = `${order.tableId}::${bucket}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(order);
    });

    const entries: BillHistoryEntry[] = Array.from(groups.entries()).map(
      ([key, orders]) => {
        const billedAt = new Date(
          Math.max(...orders.map((o) => o.updatedAt.getTime()))
        );
        const total = orders.reduce(
          (sum, o) =>
            sum + o.items.reduce((s, i) => s + i.price * i.quantity, 0),
          0
        );
        const itemCount = orders.reduce(
          (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
          0
        );
        // Try to derive table number from tableId (e.g. "table_h1" → "H1", "table_1" → "1")
        const tableId = orders[0].tableId;
        const match = tableId.match(/^table_(.+)$/i);
        const tableNumber = match ? match[1].toUpperCase() : null;
        const isTableBill = !orders.every((o) => o.orderType === "takeaway");
        return { key, tableId, tableNumber, billedAt, orders, total, itemCount, isTableBill };
      }
    );

    // Sort newest first
    entries.sort((a, b) => b.billedAt.getTime() - a.billedAt.getTime());
    callback(entries);
  });
}
