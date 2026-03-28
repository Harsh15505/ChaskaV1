import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FirestoreOrder,
  OrderItem,
  OrderStatus,
  TableStatus,
} from "@/lib/chaska-data";
import { updateTableStatus, setTableCurrentOrder } from "@/services/tables";

const ORDERS_COLLECTION = "orders";

/** Convert a Firestore doc snapshot to FirestoreOrder */
function toOrder(id: string, data: Record<string, unknown>): FirestoreOrder {
  return {
    id,
    tableId: data.tableId as string,
    items: data.items as OrderItem[],
    status: data.status as OrderStatus,
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
 * Create a brand new order for a table.
 * Also sets table status → "active" and links the order ID.
 */
export async function createOrder(
  tableId: string,
  items: OrderItem[]
): Promise<string> {
  const ref = await addDoc(collection(db, ORDERS_COLLECTION), {
    tableId,
    items,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Link order to table and mark it active
  await setTableCurrentOrder(tableId, ref.id);
  await updateTableStatus(tableId, "active");

  return ref.id;
}

/**
 * Merge new/updated items into an existing order.
 * If an item already exists, its quantity is updated.
 * If new, it is appended.
 */
export async function updateOrderItems(
  orderId: string,
  newItems: OrderItem[]
): Promise<void> {
  // We directly overwrite with the full item list (caller owns the merge logic)
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    items: newItems,
    status: "pending", // reset to pending so kitchen sees the update
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update an order's status.
 * e.g. kitchen marks "served", billing marks "billed"
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
 * Sets order → "billed", table → "free", unlinks current order.
 */
export async function clearTable(
  orderId: string,
  tableId: string
): Promise<void> {
  await updateOrderStatus(orderId, "billed");
  await setTableCurrentOrder(tableId, null);
  await updateTableStatus(tableId, "free" as TableStatus);
}

// ─── Receipt Generation ───────────────────────────────────────────────────────

export interface ReceiptData {
  orderId: string;
  tableId: string;
  tableNumber: number;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    lineTotal: number;
  }>;
  subtotal: number;
  tax: number;         // 0 for now — plug in GST logic when needed
  total: number;
  generatedAt: Date;
}

/**
 * Generate structured receipt data from a FirestoreOrder.
 * Designed to be printer-ready — plug in ESC/POS logic separately.
 *
 * @param order - The FirestoreOrder document
 * @param tableNumber - Human-readable table number (e.g. 3)
 */
export function generateReceipt(
  order: FirestoreOrder,
  tableNumber: number
): ReceiptData {
  const items = order.items.map((item) => ({
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    lineTotal: item.price * item.quantity,
  }));

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const tax = 0; // Add GST/VAT calculation here when needed

  return {
    orderId: order.id,
    tableId: order.tableId,
    tableNumber,
    items,
    subtotal,
    tax,
    total: subtotal + tax,
    generatedAt: new Date(),
  };
}
