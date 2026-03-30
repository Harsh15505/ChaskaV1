import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  setDoc,
  query,
  orderBy,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FirestoreTable, TableStatus } from "@/lib/chaska-data";

const TABLES_COLLECTION = "tables";

/** Convert a Firestore doc snapshot to FirestoreTable */
function toTable(id: string, data: Record<string, unknown>): FirestoreTable {
  return {
    id,
    tableNumber: data.tableNumber as number,
    status: data.status as TableStatus,
    currentOrderId: (data.currentOrderId as string | null) ?? null,
  };
}

/** One-time fetch of all tables (used for initial seed check) */
export async function getTables(): Promise<FirestoreTable[]> {
  const snap = await getDocs(collection(db, TABLES_COLLECTION));
  return snap.docs.map((d) => toTable(d.id, d.data() as Record<string, unknown>));
}

/**
 * Subscribe to real-time table updates.
 * Returns the unsubscribe function — call it on component unmount.
 */
export function subscribeToTables(
  callback: (tables: FirestoreTable[]) => void
): Unsubscribe {
  const q = query(collection(db, TABLES_COLLECTION), orderBy("tableNumber", "asc"));
  return onSnapshot(q, (snap) => {
    const tables = snap.docs.map((d) =>
      toTable(d.id, d.data() as Record<string, unknown>)
    );
    callback(tables);
  });
}

/** Update a table's status */
export async function updateTableStatus(
  tableId: string,
  status: TableStatus
): Promise<void> {
  await updateDoc(doc(db, TABLES_COLLECTION, tableId), { status });
}

/** Cancel a bill request — sets table back to "active" */
export async function cancelBillRequest(tableId: string): Promise<void> {
  await updateDoc(doc(db, TABLES_COLLECTION, tableId), { status: "active" });
}

/** Link an order ID to a table (or null to clear) */
export async function setTableCurrentOrder(
  tableId: string,
  orderId: string | null
): Promise<void> {
  await updateDoc(doc(db, TABLES_COLLECTION, tableId), { currentOrderId: orderId });
}

/**
 * Seed the tables collection on first run.
 * Only writes if the collection is empty.
 * Call this once from an admin page or manually.
 */
export async function seedTablesIfEmpty(count: number = 8): Promise<void> {
  const existing = await getTables();
  if (existing.length > 0) return;

  const batch = Array.from({ length: count }, (_, i) => ({
    id: `table_${i + 1}`,
    tableNumber: i + 1,
    status: "free" as TableStatus,
    currentOrderId: null,
  }));

  for (const table of batch) {
    await setDoc(doc(db, TABLES_COLLECTION, table.id), {
      tableNumber: table.tableNumber,
      status: table.status,
      currentOrderId: table.currentOrderId,
    });
  }
}

/**
 * Ensure at least `targetCount` tables exist in Firestore.
 * Adds only the missing ones — safe to call on every app start.
 */
export async function ensureTablesCount(targetCount: number = 12): Promise<void> {
  const existing = await getTables();
  const existingNumbers = new Set(existing.map((t) => t.tableNumber));

  for (let i = 1; i <= targetCount; i++) {
    if (!existingNumbers.has(i)) {
      await setDoc(doc(db, TABLES_COLLECTION, `table_${i}`), {
        tableNumber: i,
        status: "free" as TableStatus,
        currentOrderId: null,
      });
    }
  }
}
