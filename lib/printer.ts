/**
 * lib/printer.ts
 *
 * JavaScript bridge to the native Android PrinterPlugin via Capacitor.
 *
 * On Android: calls the native Bluetooth plugin.
 * On web/browser: shows a browser alert explaining printing is Android-only.
 */

import { registerPlugin, Capacitor } from "@capacitor/core";
import type { ReceiptData } from "@/lib/receipt";

// ── Type definitions matching PrinterPlugin.java ──────────────────────────────

export interface BluetoothDevice {
  name: string;
  /** MAC address, e.g. "XX:XX:XX:XX:XX:XX" */
  address: string;
}

interface NativePrinterPlugin {
  getPairedDevices(): Promise<{ devices: BluetoothDevice[] }>;
  printReceipt(options: { address: string; data: PrintReceiptPayload }): Promise<void>;
}

/** Shape of data sent to the Android plugin */
export interface PrintReceiptPayload {
  tableNumber: number;
  time: string;
  items: Array<{ name: string; quantity: number; total: number }>;
  totalAmount: number;
  upiString: string;
}

// ── Plugin registration ───────────────────────────────────────────────────────

// Capacitor reads the name string "Printer" and matches it to
// the @CapacitorPlugin(name = "Printer") annotation in PrinterPlugin.java
const NativePrinter = registerPlugin<NativePrinterPlugin>("Printer");

// ── isAndroid ─────────────────────────────────────────────────────────────────

/** True when running inside the Capacitor Android APK */
export function isAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

// ── getPairedDevices ──────────────────────────────────────────────────────────

/**
 * Returns a list of Bluetooth devices already paired with the Android phone.
 * The user must pair the printer first via Android Settings → Bluetooth.
 *
 * @throws Error if Bluetooth is off or permission denied
 */
export async function getPairedDevices(): Promise<BluetoothDevice[]> {
  if (!isAndroid()) {
    // On web/dev browser, return an empty list so UI can show a message
    return [];
  }

  const { devices } = await NativePrinter.getPairedDevices();
  return devices;
}

// ── printReceipt ──────────────────────────────────────────────────────────────

/**
 * Sends the receipt to the Bluetooth thermal printer.
 *
 * @param receiptData - The receipt object from lib/receipt.ts
 * @param printerAddress - MAC address of the selected printer
 *
 * @throws Error with a human-readable message on failure
 */
export async function printReceipt(
  receiptData: ReceiptData,
  printerAddress: string
): Promise<void> {
  if (!isAndroid()) {
    // On browser: just open the browser print dialog as fallback
    window.print();
    return;
  }

  if (!printerAddress) {
    throw new Error("No printer selected. Please connect a printer first.");
  }

  // Map from ReceiptData to the shape the Java plugin expects
  const payload: PrintReceiptPayload = {
    tableNumber: receiptData.tableNumber,
    time: receiptData.time,
    items: receiptData.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      total: i.total,
    })),
    totalAmount: receiptData.totalAmount,
    upiString: receiptData.upiString,
  };

  await NativePrinter.printReceipt({ address: printerAddress, data: payload });
}
