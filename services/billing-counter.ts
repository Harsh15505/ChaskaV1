import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Atomically increments the global bill counter and returns the new number.
 * - Never resets — continues incrementing across days.
 * - Safe to call concurrently from multiple devices (uses Firestore transaction).
 *
 * Returns a zero-padded string like "001", "042", "1000".
 */
export async function getNextBillNumber(): Promise<string> {
  const ref = doc(db, "meta", "bill_counter");

  const newCount = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists()) {
      // First ever bill
      tx.set(ref, { count: 1, updatedAt: serverTimestamp() });
      return 1;
    } else {
      const next = (snap.data()?.count ?? 0) + 1;
      tx.update(ref, { count: next, updatedAt: serverTimestamp() });
      return next;
    }
  });

  // Zero-pad to 4 digits: 1 → "0001", 42 → "0042"
  return String(newCount).padStart(4, "0");
}

/**
 * Atomically increments the global KOT counter.
 */
export async function getNextKotNumber(): Promise<string> {
  const ref = doc(db, "meta", "kot_counter");

  const newCount = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists()) {
      tx.set(ref, { count: 1, updatedAt: serverTimestamp() });
      return 1;
    } else {
      const next = (snap.data()?.count ?? 0) + 1;
      tx.update(ref, { count: next, updatedAt: serverTimestamp() });
      return next;
    }
  });

  return String(newCount).padStart(4, "0");
}
