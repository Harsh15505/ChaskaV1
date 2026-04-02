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
  /** Optional instructions for kitchen */
  note?: string;
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
  /** Daily sequential bill number, e.g. "007" */
  billNumber: string;
  /** Whether this is specifically a KOT */
  isKot?: boolean;
  discount?: number;
  cashPaid?: number;
}

// ─── Brand Config (all from .env.local) ─────────────────────────────────────

const UPI_ID      = process.env.NEXT_PUBLIC_UPI_ID       ?? "chaska@upi";
const UPI_NAME    = process.env.NEXT_PUBLIC_UPI_NAME     ?? "Chaska";
export const BUSINESS_NAME   = process.env.NEXT_PUBLIC_BUSINESS_NAME  ?? "Chaska";
export const RECEIPT_FOOTER  = process.env.NEXT_PUBLIC_RECEIPT_FOOTER ?? "Thank you for dining with us!";
export const GST_NUMBER      = process.env.NEXT_PUBLIC_GST_NUMBER     ?? "";

/** Build the UPI deep-link that gets encoded into the QR code */
export function buildUpiString(amount: number): string {
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
  extraItems: Array<{ id: string; name: string; price: number; quantity: number }> = [],
  billNumber: string = "000"
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
    billNumber,
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

  const headerLines = [
    BUSINESS_NAME.toUpperCase(),
    ...(GST_NUMBER ? [`GST: ${GST_NUMBER}`] : []),
    `Bill No: #${receipt.billNumber}  |  Table: ${receipt.tableNumber}`,
    DIVIDER,
  ];

  const itemLines = receipt.items
    .map((item) => {
      const label = `${item.quantity} x ${item.name}`;
      const price = `₹${item.total}`;
      return label.padEnd(22) + price.padStart(6);
    })
    .join("\n");

  const footerLines = [
    DIVIDER,
    `Total:`.padEnd(22) + `₹${receipt.totalAmount}`.padStart(6),
    `Time: ${receipt.time}`,
    `Pay via UPI: ${receipt.upiString}`,
    "",
    RECEIPT_FOOTER,
  ];

  return [headerLines.join("\n"), itemLines, footerLines.join("\n")].join("\n");
}

// ─── KOT Print Formatting ───────────────────────────────────────────────────

/**
 * Generates data for a Kitchen Order Ticket containing only unprinted items.
 */
export function generateKotData(orders: FirestoreOrder[], tableNumber: number, kotNumber: string): ReceiptData | null {
  const itemMap = new Map<string, ReceiptItem>();

  // Only consider orders that haven't been printed yet
  const unprintedOrders = orders.filter(o => !o.kotPrinted);
  if (unprintedOrders.length === 0) return null;

  unprintedOrders.forEach((order) => {
    order.items.forEach((i) => {
      // Don't print items that the kitchen doesn't prepare (e.g. bottled water)
      if (i.skipKitchen) return;

      const key = `${i.id}_${i.note || ''}`;

      if (itemMap.has(key)) {
        itemMap.get(key)!.quantity += i.quantity;
      } else {
        itemMap.set(key, {
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          total: 0, // Not needed for KOT
          note: i.note
        });
      }
    });
  });

  const items = Array.from(itemMap.values());
  if (items.length === 0) return null; // e.g. if the only unprinted item was skipKitchen

  const time = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return {
    tableId: unprintedOrders[0]?.tableId ?? "unknown",
    tableNumber,
    items,
    totalAmount: 0,
    time,
    billNumber: kotNumber,
    upiString: "",
    isKot: true,
  };
}

/**
 * Formats a KOT for the thermal printer.
 * Only includes Table, Time, Items, and Quantities.
 */
export function formatKotForPrint(kotData: ReceiptData): string {
  const DIVIDER = "──────────────────────────";

  const headerLines = [
    "** KITCHEN ORDER TICKET **",
    `Table: ${kotData.tableNumber}`,
    `Time: ${kotData.time}`,
    DIVIDER,
  ];

  const itemLines = kotData.items
    .map((item) => `${item.quantity} x ${item.name}`)
    .join("\n");

  const footerLines = [
    DIVIDER,
    "********** END ***********",
    "",
    "",
  ];

  return [headerLines.join("\n"), itemLines, footerLines.join("\n")].join("\n");
}
