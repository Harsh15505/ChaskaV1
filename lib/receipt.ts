/**
 * lib/receipt.ts
 *
 * Central receipt logic for Chaska.
 * Keeps all receipt-related code in one place so it's easy to find and change.
 */

import { FirestoreOrder } from "@/lib/chaska-data";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  /** price × quantity */
  total: number;
}

export interface ReceiptData {
  tableId: string;
  tableNumber: number;
  items: ReceiptItem[];
  totalAmount: number;
  /** Formatted time string, e.g. "10:42 PM" */
  time: string;
  /** UPI deep-link string for QR code */
  upiString: string;
}

// ─── UPI Config ───────────────────────────────────────────────────────────────

/** Read from .env.local — falls back to placeholder if not set */
const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID ?? "chaska@upi";
const UPI_NAME = process.env.NEXT_PUBLIC_UPI_NAME ?? "Chaska";

/** Build the UPI deep-link that gets encoded into the QR code */
function buildUpiString(amount: number): string {
  return `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR`;
}

// ─── generateReceipt ──────────────────────────────────────────────────────────

/**
 * Takes multiple order rounds for a table + optional takeaway items and
 * produces a single merged receipt.
 *
 * @param orders       - Firestore order documents (one per round)
 * @param tableNumber  - Human-readable table number
 * @param extraItems   - Optional takeaway items added by billing (local state only)
 */
export function generateReceipt(
  orders: FirestoreOrder[],
  tableNumber: number,
  extraItems: Array<{ id: string; name: string; price: number; quantity: number }> = []
): ReceiptData {
  // Merge items across all rounds. If the same item appears in multiple
  // rounds, add their quantities together.
  const itemMap = new Map<string, ReceiptItem>();

  orders.forEach((order) => {
    order.items.forEach((i) => {
      if (itemMap.has(i.id)) {
        const existing = itemMap.get(i.id)!;
        existing.quantity += i.quantity;
        existing.total = existing.price * existing.quantity;
      } else {
        itemMap.set(i.id, {
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          total: i.price * i.quantity,
        });
      }
    });
  });

  // Merge in takeaway items (if any)
  extraItems.forEach((i) => {
    if (itemMap.has(i.id)) {
      const existing = itemMap.get(i.id)!;
      existing.quantity += i.quantity;
      existing.total = existing.price * existing.quantity;
    } else {
      itemMap.set(i.id, {
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        total: i.price * i.quantity,
      });
    }
  });

  const items = Array.from(itemMap.values());
  const totalAmount = items.reduce((sum, i) => sum + i.total, 0);

  // Format current time like "10:42 PM"
  const time = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return {
    tableId: orders[0]?.tableId ?? "unknown",
    tableNumber,
    items,
    totalAmount,
    time,
    upiString: buildUpiString(totalAmount),
  };
}

// ─── formatReceiptForPrint ────────────────────────────────────────────────────

/**
 * Converts receipt data into a plain text string formatted for a thermal
 * printer (ESC/POS style).
 *
 * Does NOT do any printing — just returns the formatted string.
 * Pass this string to your printer library when ready.
 *
 * Example output:
 *   CHASKA
 *   Table: 3
 *   ──────────────────
 *   2 x Noodles         ₹140
 *   1 x Cold Coffee      ₹80
 *   ──────────────────
 *   Total:              ₹220
 *   Time: 10:42 PM
 */
export function formatReceiptForPrint(receipt: ReceiptData): string {
  const DIVIDER = "──────────────────────────";

  const header = [`CHASKA`, `Table: ${receipt.tableNumber}`, DIVIDER].join(
    "\n"
  );

  const itemLines = receipt.items
    .map((item) => {
      // Align name and price on same line
      const label = `${item.quantity} x ${item.name}`;
      const price = `₹${item.total}`;
      // Pad to a fixed width so columns align on monospace printers
      return label.padEnd(22) + price.padStart(6);
    })
    .join("\n");

  const footer = [
    DIVIDER,
    `Total:`.padEnd(22) + `₹${receipt.totalAmount}`.padStart(6),
    `Time: ${receipt.time}`,
    `Pay via UPI: ${receipt.upiString}`,
  ].join("\n");

  return [header, itemLines, footer].join("\n");
}
