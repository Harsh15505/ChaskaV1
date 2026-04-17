/**
 * Migration Script: Update Firestore tables from numeric to string table numbers.
 *
 * OLD schema: { tableNumber: 1..8 } with doc IDs table_1..table_8
 * NEW schema: { tableNumber: "H1".."H6" | "1".."6", sortOrder: 1..12 }
 *             Doc IDs: table_h1..table_h6, table_1..table_6
 *
 * Run with: node scripts/migrate-tables.mjs
 *
 * IMPORTANT: Run ONCE. Delete old table_1..table_8 docs manually if needed
 * after verifying the migration succeeded.
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD26NixeC2ss9dxbL9iP8j9okd9mgrEvaU",
  authDomain: "chaska-a748b.firebaseapp.com",
  projectId: "chaska-a748b",
  storageBucket: "chaska-a748b.firebasestorage.app",
  messagingSenderId: "351975395237",
  appId: "1:351975395237:web:afa440f1a75daf74d6624c",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// The target table layout
const TABLE_DEFINITIONS = [
  { id: "table_h1", tableNumber: "H1", sortOrder: 1 },
  { id: "table_h2", tableNumber: "H2", sortOrder: 2 },
  { id: "table_h3", tableNumber: "H3", sortOrder: 3 },
  { id: "table_h4", tableNumber: "H4", sortOrder: 4 },
  { id: "table_h5", tableNumber: "H5", sortOrder: 5 },
  { id: "table_h6", tableNumber: "H6", sortOrder: 6 },
  { id: "table_1",  tableNumber: "1",  sortOrder: 7 },
  { id: "table_2",  tableNumber: "2",  sortOrder: 8 },
  { id: "table_3",  tableNumber: "3",  sortOrder: 9 },
  { id: "table_4",  tableNumber: "4",  sortOrder: 10 },
  { id: "table_5",  tableNumber: "5",  sortOrder: 11 },
  { id: "table_6",  tableNumber: "6",  sortOrder: 12 },
];

async function migrate() {
  console.log("📋 Fetching existing tables...");
  const snap = await getDocs(collection(db, "tables"));
  const existing = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`   Found ${existing.length} existing table(s).`);

  // 1. Write all new table definitions (preserves status if doc already exists with same id)
  console.log("\n📝 Writing new table definitions...");
  for (const table of TABLE_DEFINITIONS) {
    // Check if this exact doc already exists and is already in new format
    const existingDoc = existing.find((e) => e.id === table.id);
    const alreadyMigrated = existingDoc && typeof existingDoc.tableNumber === "string";

    if (alreadyMigrated) {
      console.log(`   ✓ ${table.id} already migrated (${existingDoc.tableNumber}), skipping.`);
      continue;
    }

    await setDoc(doc(db, "tables", table.id), {
      tableNumber: table.tableNumber,
      sortOrder: table.sortOrder,
      status: existingDoc?.status ?? "free",
      currentOrderId: existingDoc?.currentOrderId ?? null,
    });
    console.log(`   ✅ Created ${table.id} — tableNumber: "${table.tableNumber}", sortOrder: ${table.sortOrder}`);
  }

  // 2. Delete old numeric-only docs that are no longer needed (table_7, table_8)
  const newIds = new Set(TABLE_DEFINITIONS.map((t) => t.id));
  const toDelete = existing.filter((e) => !newIds.has(e.id));

  if (toDelete.length > 0) {
    console.log(`\n🗑️  Removing ${toDelete.length} obsolete table doc(s)...`);
    for (const old of toDelete) {
      await deleteDoc(doc(db, "tables", old.id));
      console.log(`   🗑️  Deleted ${old.id}`);
    }
  }

  console.log("\n🎉 Migration complete! Tables are now:");
  TABLE_DEFINITIONS.forEach((t) =>
    console.log(`   ${t.id.padEnd(12)} → tableNumber: "${t.tableNumber}", sortOrder: ${t.sortOrder}`)
  );
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
