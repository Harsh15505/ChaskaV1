import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  setDoc,
  query,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FirestoreTable, TableStatus } from "@/lib/chaska-data";

const TABLES_COLLECTION = "tables";

/** The full ordered list of tables for this restaurant */
export const TABLE_DEFINITIONS: Array<{
  id: string;
  tableNumber: string;
  sortOrder: number;
}> = [
  // ── Hall tables ──
  { id: "table_h1", tableNumber: "H1", sortOrder: 1 },
  { id: "table_h2", tableNumber: "H2", sortOrder: 2 },
  { id: "table_h3", tableNumber: "H3", sortOrder: 3 },
  { id: "table_h4", tableNumber: "H4", sortOrder: 4 },
  { id: "table_h5", tableNumber: "H5", sortOrder: 5 },
  { id: "table_h6", tableNumber: "H6", sortOrder: 6 },
  // ── Regular tables ──
  { id: "table_1", tableNumber: "1", sortOrder: 7 },
  { id: "table_2", tableNumber: "2", sortOrder: 8 },
  { id: "table_3", tableNumber: "3", sortOrder: 9 },
  { id: "table_4", tableNumber: "4", sortOrder: 10 },
  { id: "table_5", tableNumber: "5", sortOrder: 11 },
  { id: "table_6", tableNumber: "6", sortOrder: 12 },
];

/** Convert a Firestore doc snapshot to FirestoreTable */
function toTable(id: string, data: Record<string, unknown>): FirestoreTable {
  return {
    id,
    tableNumber: data.tableNumber as string,
    sortOrder: (data.sortOrder as number) ?? 99,
    status: data.status as TableStatus,
    currentOrderId: (data.currentOrderId as string | null) ?? null,
  };
}

/** One-time fetch of all tables */
export async function getTables(): Promise<FirestoreTable[]> {
  const snap = await getDocs(collection(db, TABLES_COLLECTION));
  return snap.docs.map((d) => toTable(d.id, d.data() as Record<string, unknown>));
}

/**
 * Subscribe to real-time table updates, ordered by sortOrder.
 * H1-H6 appear first, then regular tables 1-6.
 */
export function subscribeToTables(
  callback: (tables: FirestoreTable[]) => void
): Unsubscribe {
  const q = query(collection(db, TABLES_COLLECTION));
  return onSnapshot(q, (snap) => {
    const tables = snap.docs.map((d) =>
      toTable(d.id, d.data() as Record<string, unknown>)
    );
    // Sort client-side so we never accidentally filter out documents missing the sortOrder field
    tables.sort((a, b) => a.sortOrder - b.sortOrder);
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
 * Creates H1-H6 (hall) + 1-6 (regular) = 12 tables.
 *
 * ⚠️  SAFETY: Uses { merge: true } so even if called incorrectly on an app
 * with existing live tables, it will NEVER overwrite status or currentOrderId.
 */
export async function seedTablesIfEmpty(): Promise<void> {
  const existing = await getTables();
  if (existing.length > 0) return;

  for (const table of TABLE_DEFINITIONS) {
    await setDoc(
      doc(db, TABLES_COLLECTION, table.id),
      {
        tableNumber: table.tableNumber,
        sortOrder: table.sortOrder,
        status: "free" as TableStatus,
        currentOrderId: null,
      },
      { merge: true } // NEVER overwrite fields that already exist
    );
  }
}

/**
 * Ensure all expected tables exist in Firestore.
 * Safe to call on every app start — only adds missing ones.
 */
export async function ensureTablesExist(): Promise<void> {
  const existing = await getTables();
  const existingIds = new Set(existing.map((t) => t.id));

  for (const table of TABLE_DEFINITIONS) {
    if (!existingIds.has(table.id)) {
      await setDoc(doc(db, TABLES_COLLECTION, table.id), {
        tableNumber: table.tableNumber,
        sortOrder: table.sortOrder,
        status: "free" as TableStatus,
        currentOrderId: null,
      });
    }
  }
}
