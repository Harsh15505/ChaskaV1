"use client";

import { useEffect, useRef } from "react";
import { FirestoreOrder, FirestoreTable } from "@/lib/chaska-data";
import { printReceipt } from "@/lib/printer";
import { generateKotData } from "@/lib/receipt";
import { markOrdersKotPrinted } from "@/services/orders";
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

  useEffect(() => {
    // ONLY run on the billing device
    if (role !== "billing") return;

    // Filter down to active orders that need a KOT
    const unprintedOrders = orders.filter(
      (o) => o.status !== "billed" && o.kotPrinted === false
    );

    if (unprintedOrders.length === 0) return;

    const intervalId = setInterval(async () => {
      // Re-evaluate unprinted orders using the latest closure scope
      // Actually, since interval captures closure, we should just process the ones
      // we had at the time the effect fired. 
      // Because this effect re-runs when `orders` changes anyway.
      const savedPrinter = getSavedPrinter();
      if (!savedPrinter) {
        // Can't print without a printer configured on the billing tablet yet.
        return;
      }

      // We'll process one table's unprinted orders at a time to generate a single KOT for them
      const tableOrderGroups = new Map<string, FirestoreOrder[]>();
      
      for (const order of unprintedOrders) {
        if (!inFlightRef.current.has(order.id)) {
          const group = tableOrderGroups.get(order.tableId) || [];
          group.push(order);
          tableOrderGroups.set(order.tableId, group);
        }
      }

      // If nothing new to print, just return
      if (tableOrderGroups.size === 0) return;

      for (const [tableId, tableOrders] of Array.from(tableOrderGroups.entries())) {
        // Mark these orders as in-flight
        const orderIds = tableOrders.map(o => o.id);
        orderIds.forEach(id => inFlightRef.current.add(id));

        try {
          const table = tables.find(t => t.id === tableId);
          if (!table) throw new Error("Table not found for order");

          const kotNum = await getNextKotNumber();
          const kotData = generateKotData(tableOrders, table.tableNumber, kotNum);
          
          if (kotData) {
            // Print copy 1
            await printReceipt(kotData, savedPrinter.address);
            
            // Wait 5 seconds to tear
            await new Promise((res) => setTimeout(res, 5000));
            
            // Print copy 2
            await printReceipt(kotData, savedPrinter.address);
          }

          // Mark as printed in Firestore so they stop showing up as kotPrinted === false
          await markOrdersKotPrinted(orderIds);
          
          // DO NOT remove from inFlightRef here! 
          // Re-rendering with new orders array will naturally clear them from `unprintedOrders`.
          // If we remove them before the snapshot updates, they might double-print.

        } catch (err) {
          console.error("Auto KOT print failed. Will retry.", err);
          // Print failed. Remove from in-flight so it can be retried on the next tick layer.
          orderIds.forEach(id => inFlightRef.current.delete(id));
        }
      }
    }, 4000); // Poll every 4 seconds

    return () => clearInterval(intervalId);
  }, [role, orders, tables]);
}
