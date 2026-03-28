"use client";

import { useState } from "react";
import { FirestoreOrder, FirestoreTable } from "@/lib/chaska-data";
import { clearTable, generateReceipt, ReceiptData } from "@/services/orders";
import { cn } from "@/lib/utils";
import { ArrowLeft, Receipt, CheckCircle2, Minus, Plus, Trash2 } from "lucide-react";
import { updateOrderItems } from "@/services/orders";
import { toast } from "sonner";

interface BillingScreenProps {
  tables: FirestoreTable[];
  orders: FirestoreOrder[];
  loading: boolean;
  onBack: () => void;
}

export default function BillingScreen({
  tables,
  orders,
  loading,
  onBack,
}: BillingScreenProps) {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [clearing, setClearing] = useState(false);

  const activeTables = tables.filter(
    (t) => t.status === "active" || t.status === "billing"
  );

  // Active orders for the selected table (could be multiple rounds)
  const selectedKitchenOrders = selectedTableId
    ? orders.filter((o) => o.tableId === selectedTableId)
    : [];

  const selectedTable = selectedTableId
    ? tables.find((t) => t.id === selectedTableId) ?? null
    : null;

  // Merge items across all rounds for display
  const mergedItemsMap = new Map<string, { id: string; name: string; price: number; quantity: number }>();
  selectedKitchenOrders.forEach((o) => {
    o.items.forEach((i) => {
      if (mergedItemsMap.has(i.id)) {
        mergedItemsMap.get(i.id)!.quantity += i.quantity;
      } else {
        mergedItemsMap.set(i.id, { ...i });
      }
    });
  });
  const mergedItems = Array.from(mergedItemsMap.values());
  const total = mergedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // ── Edit items directly on the billing screen ─────────────────────────────

  const handleChangeQty = async (itemId: string, delta: number) => {
    // Find the first order round that contains this item so we can modify it
    const orderToUpdate = selectedKitchenOrders.find((o) =>
      o.items.some((i) => i.id === itemId)
    );
    if (!orderToUpdate) return;

    const updated = orderToUpdate.items
      .map((i) =>
        i.id === itemId ? { ...i, quantity: i.quantity + delta } : i
      )
      .filter((i) => i.quantity > 0); // remove if qty reaches 0

    try {
      await updateOrderItems(orderToUpdate.id, updated);
    } catch {
      toast.error("Failed to update item. Try again.");
    }
  };

  // ── Generate bill ─────────────────────────────────────────────────────────

  const handleGenerateBill = () => {
    if (selectedKitchenOrders.length === 0 || !selectedTable) return;
    const data = generateReceipt(selectedKitchenOrders, selectedTable.tableNumber);
    setReceipt(data);
  };

  // ── Clear table (mark billed) ─────────────────────────────────────────────

  const handleClearTable = async () => {
    if (selectedKitchenOrders.length === 0 || !selectedTableId || clearing) return;
    setClearing(true);
    try {
      await clearTable(selectedTableId);
      toast.success(`Table ${selectedTable?.tableNumber} cleared!`);
      setSelectedTableId(null);
      setReceipt(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear table. Try again.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-4 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted active:scale-90 transition-transform"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-primary uppercase">
              CHASKA
            </p>
            <h1 className="text-xl font-extrabold text-foreground leading-tight">
              Billing
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4">
        {/* Table Selector */}
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
            Select Table
          </p>
          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-muted animate-pulse rounded-xl h-16" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {activeTables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => {
                    setSelectedTableId(table.id);
                    setReceipt(null);
                  }}
                  className={cn(
                    "py-4 rounded-xl font-extrabold text-lg transition-all active:scale-90",
                    selectedTableId === table.id
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "bg-card border border-border text-foreground"
                  )}
                  aria-label={`Select table ${table.tableNumber}`}
                >
                  {table.tableNumber}
                </button>
              ))}
              {activeTables.length === 0 && (
                <div className="col-span-4 py-6 text-center text-muted-foreground text-sm">
                  No active tables
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bill Details */}
        {selectedKitchenOrders.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-md">
            {/* Bill header */}
            <div className="bg-primary/10 px-4 py-3 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              <span className="font-extrabold text-foreground">
                Table {selectedTable?.tableNumber} — Bill
              </span>
              <span className="ml-auto text-xs font-semibold text-muted-foreground">
                Tap − / + to edit
              </span>
            </div>

            {mergedItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                No items ordered for this table
              </div>
            ) : (
              <div className="px-4 py-3 space-y-3">
                {/* Column headers */}
                <div className="flex items-center text-xs text-muted-foreground font-semibold pb-1 border-b border-border">
                  <span className="flex-1">Item</span>
                  <span className="w-24 text-center">Qty</span>
                  <span className="w-16 text-right">Amount</span>
                </div>

                {mergedItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <span className="flex-1 text-foreground text-sm leading-tight pr-1">
                      {item.name}
                    </span>
                    {/* Inline quantity editor */}
                    <div className="flex items-center gap-1 bg-muted rounded-lg px-1 py-0.5">
                      <button
                        onClick={() => handleChangeQty(item.id, -1)}
                        className="w-7 h-7 flex items-center justify-center text-primary active:scale-90 transition-transform"
                        aria-label={`Remove one ${item.name}`}
                      >
                        {item.quantity === 1 ? (
                          <Trash2 className="w-3.5 h-3.5" />
                        ) : (
                          <Minus className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="w-5 text-center font-extrabold text-sm text-foreground">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleChangeQty(item.id, 1)}
                        className="w-7 h-7 flex items-center justify-center text-primary active:scale-90 transition-transform"
                        aria-label={`Add one more ${item.name}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="w-16 text-right font-semibold text-foreground text-sm">
                      ₹{item.price * item.quantity}
                    </span>
                  </div>
                ))}

                {/* Total */}
                <div className="border-t border-border pt-3 flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-semibold">
                    Total ({selectedKitchenOrders.length} {selectedKitchenOrders.length === 1 ? 'round' : 'rounds'})
                  </span>
                  <span className="text-foreground font-extrabold text-2xl">
                    ₹{total}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No order yet for selected table */}
        {selectedTableId && selectedKitchenOrders.length === 0 && !loading && (
          <div className="text-center text-muted-foreground text-sm py-4">
            No active order for this table yet.
          </div>
        )}

        {/* Receipt */}
        {receipt && (
          <div className="bg-secondary/10 border border-secondary/30 rounded-2xl px-4 py-4 space-y-2">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-secondary shrink-0" />
              <div>
                <p className="font-bold text-foreground">Bill Ready</p>
                <p className="text-sm text-muted-foreground">
                  Table {receipt.tableNumber} — Total ₹{receipt.total}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {selectedKitchenOrders.length > 0 && (
          <div className="space-y-3 pb-4">
            {!receipt && mergedItems.length > 0 && (
              <button
                onClick={handleGenerateBill}
                className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-extrabold text-base active:scale-95 transition-transform shadow-lg"
              >
                Generate Bill
              </button>
            )}
            {(receipt || mergedItems.length === 0) && (
              <button
                onClick={handleClearTable}
                disabled={clearing}
                className="w-full py-4 bg-secondary text-secondary-foreground rounded-2xl font-extrabold text-base active:scale-95 transition-transform shadow-lg disabled:opacity-60"
              >
                {clearing
                  ? "Clearing…"
                  : `Clear Table ${selectedTable?.tableNumber}`}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
