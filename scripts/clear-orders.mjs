/**
 * One-time cleanup script — deletes all orders and resets all tables to "free".
 * Run with: node scripts/clear-orders.mjs
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";

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

async function clearAll() {
  // 1. Delete all orders
  const ordersSnap = await getDocs(collection(db, "orders"));
  if (ordersSnap.empty) {
    console.log("No orders found.");
  } else {
    const batch = writeBatch(db);
    ordersSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log(`✅ Deleted ${ordersSnap.docs.length} order(s).`);
  }

  // 2. Reset all tables to "free" with no active order
  const tablesSnap = await getDocs(collection(db, "tables"));
  if (!tablesSnap.empty) {
    const batch2 = writeBatch(db);
    tablesSnap.docs.forEach((d) =>
      batch2.update(d.ref, { status: "free", currentOrderId: null })
    );
    await batch2.commit();
    console.log(`✅ Reset ${tablesSnap.docs.length} table(s) to free.`);
  }

  console.log("🎉 Done! All orders cleared and tables reset.");
  process.exit(0);
}

clearAll().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
