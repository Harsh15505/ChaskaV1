import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const COUNTER_DOC = "meta/daily_counter";

/** Returns today's date as "YYYY-MM-DD" in local time */
function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Atomically increments the daily bill counter and returns the new number.
 * - If today is a new day, resets to 1.
 * - Safe to call concurrently from multiple devices (uses Firestore transaction).
 *
 * Returns a zero-padded string like "001", "012", "100".
 */
export async function getNextBillNumber(): Promise<string> {
  const today = todayString();
  const ref = doc(db, "meta", "daily_counter");

  const newCount = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists() || snap.data()?.date !== today) {
      // New day (or first ever) — reset to 1
      tx.set(ref, { date: today, count: 1, updatedAt: serverTimestamp() });
      return 1;
    } else {
      const next = (snap.data()?.count ?? 0) + 1;
      tx.update(ref, { count: next, updatedAt: serverTimestamp() });
      return next;
    }
  });

  // Zero-pad to 3 digits: 1 → "001", 42 → "042"
  return String(newCount).padStart(3, "0");
}
