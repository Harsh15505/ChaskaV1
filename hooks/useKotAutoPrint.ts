"use client";

import { useEffect, useRef } from "react";
import { FirestoreOrder, FirestoreTable } from "@/lib/chaska-data";
import { printReceipt, isAndroid, KeepaliveBridge } from "@/lib/printer";
import { generateKotData } from "@/lib/receipt";
import { markOrdersKotPrinted, claimKotPrintJob } from "@/services/orders";
import { getNextKotNumber } from "@/services/billing-counter";
import { getSavedPrinter } from "@/components/chaska/PrinterConnect";

/**
 * useKotAutoPrint
 * 
 * Runs exclusively on the billing tablet.
 * Watches for orders where `kotPrinted === false`.
 * Plucks them into an in-memory queue, and every few seconds
 * attempts to print a KOT for them.
 * 
 * This prevents the waiter's phone from blocking while waiting
 * for Bluetooth connections, and ensures robust retry logic.
 */
export function useKotAutoPrint(
  role: string | null,
  orders: FirestoreOrder[],
  tables: FirestoreTable[]
) {
  // Store the IDs of orders currently in the process of being printed to avoid overlap
  const inFlightRef = useRef<Set<string>>(new Set());
  // Global lock to ensure only one synchronous printing block runs at a time (preventing BT collision)
  const isPrintingRef = useRef(false);

  useEffect(() => {
    // ONLY run on the billing device
    if (role !== "billing") return;

    // Filter down to active orders that need a KOT
    const unprintedOrders = orders.filter(
      (o) => o.status !== "billed" && o.kotPrinted === false
    );

    if (unprintedOrders.length === 0) return;

    // ── Core print tick logic ────────────────────────────────────────────────
    // Extracted into a named function so it can be called from BOTH:
    //   1. JS setInterval (when screen is ON — every 2s)
    //   2. Native kotTick listener (when screen is OFF — every 3s from Java Timer)
    const runTick = async () => {
      // Abort if the previous print loop is still sleeping during the 5-second cut delay
      if (isPrintingRef.current) return;

      const savedPrinter = getSavedPrinter();
      if (!savedPrinter) {
        // Can't print without a printer configured on the billing tablet yet.
        return;
      }

      // Group by table — one KOT per table per tick
      const tableOrderGroups = new Map<string, FirestoreOrder[]>();
      
      for (const order of unprintedOrders) {
        if (!inFlightRef.current.has(order.id)) {
          const group = tableOrderGroups.get(order.tableId) || [];
          group.push(order);
          tableOrderGroups.set(order.tableId, group);
        }
      }

      if (tableOrderGroups.size === 0) return;

      isPrintingRef.current = true;

      for (const [tableId, tableOrders] of Array.from(tableOrderGroups.entries())) {
        const orderIds = tableOrders.map(o => o.id);
        orderIds.forEach(id => inFlightRef.current.add(id));

        try {
          // ── Distributed Lock Claim ──
          const claimed = await claimKotPrintJob(orderIds);
          if (!claimed) {
            orderIds.forEach(id => inFlightRef.current.delete(id));
            continue;
          }

          const table = tables.find(t => t.id === tableId);
          if (!table) throw new Error("Table not found for order");

          const kotNum = await getNextKotNumber();
          const kotData = generateKotData(tableOrders, table.tableNumber, kotNum);
          
          if (kotData) {
            // Print copy 1
            await printReceipt(kotData, savedPrinter.address);
            
            // Wait 5 seconds for paper tear
            await new Promise((res) => setTimeout(res, 5000));
            
            // Print copy 2
            await printReceipt(kotData, savedPrinter.address);
          }

          await markOrdersKotPrinted(orderIds);

        } catch (err) {
          console.error("Auto KOT print failed. Will retry.", err);
          orderIds.forEach(id => inFlightRef.current.delete(id));
        }
      }

      isPrintingRef.current = false;
    };

    // ── Trigger 1: JS interval (screen ON) ──────────────────────────────────
    // polls every 2 seconds when the WebView is active
    const intervalId = setInterval(runTick, 2000);

    // ── Trigger 2: Native kotTick (screen OFF) ───────────────────────────────
    // KotKeepaliveService.java fires a broadcast every 3s.
    // KotKeepalivePlugin.java relays it here as "kotTick".
    // This bypasses WebView JS timer suspension — works with screen off.
    //
    // ⚠️  Race guard: if cleanup runs before the addListener Promise resolves,
    // the handle arrives after unmount. We must remove it immediately in that case.
    let cancelled = false;
    let nativeListener: { remove: () => void } | null = null;
    if (isAndroid()) {
      KeepaliveBridge.addListener("kotTick", runTick).then((handle) => {
        if (cancelled) {
          handle.remove(); // effect already cleaned up — remove immediately
        } else {
          nativeListener = handle;
        }
      });
    }

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      nativeListener?.remove();
    };
  }, [role, orders, tables]);
}
