"use client";

import { useState } from "react";
import { CartItem, KitchenOrder, TableData } from "@/lib/chaska-data";
import { cn } from "@/lib/utils";
import { ArrowLeft, Receipt, CheckCircle2 } from "lucide-react";

interface BillingScreenProps {
  tables: TableData[];
  orders: KitchenOrder[];
  tableOrders: Record<number, CartItem[]>;
  onBack: () => void;
  onClearTable: (tableId: number) => void;
}

export default function BillingScreen({
  tables,
  orders,
  tableOrders,
  onBack,
  onClearTable,
}: BillingScreenProps) {
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [generated, setGenerated] = useState(false);

  const activeTables = tables.filter(
    (t) => t.status === "active" || t.status === "billing"
  );

  const selectedItems: CartItem[] = selectedTable
    ? tableOrders[selectedTable] ?? []
    : [];

  const selectedKitchenOrders = selectedTable
    ? orders.filter((o) => o.tableId === selectedTable)
    : [];

  const allItems: CartItem[] = [...selectedItems];
  selectedKitchenOrders.forEach((ko) => {
    ko.items.forEach((ki) => {
      const existing = allItems.find((a) => a.item.id === ki.item.id);
      if (existing) {
        existing.quantity += ki.quantity;
      } else {
        allItems.push({ ...ki });
      }
    });
  });

  const total = allItems.reduce(
    (sum, c) => sum + c.item.price * c.quantity,
    0
  );

  const handleGenerateBill = () => {
    setGenerated(true);
  };

  const handleClearTable = () => {
    if (!selectedTable) return;
    onClearTable(selectedTable);
    setSelectedTable(null);
    setGenerated(false);
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
          <div className="grid grid-cols-4 gap-2">
            {activeTables.map((table) => (
              <button
                key={table.id}
                onClick={() => {
                  setSelectedTable(table.id);
                  setGenerated(false);
                }}
                className={cn(
                  "py-4 rounded-xl font-extrabold text-lg transition-all active:scale-90",
                  selectedTable === table.id
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-card border border-border text-foreground"
                )}
                aria-label={`Select table ${table.id}`}
              >
                {table.id}
              </button>
            ))}
            {activeTables.length === 0 && (
              <div className="col-span-4 py-6 text-center text-muted-foreground text-sm">
                No active tables
              </div>
            )}
          </div>
        </div>

        {/* Bill Details */}
        {selectedTable && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-md">
            {/* Bill header */}
            <div className="bg-primary/10 px-4 py-3 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              <span className="font-extrabold text-foreground">
                Table {selectedTable} — Bill
              </span>
            </div>

            {allItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                No items ordered for this table
              </div>
            ) : (
              <div className="px-4 py-3 space-y-2">
                {/* Column headers */}
                <div className="flex items-center text-xs text-muted-foreground font-semibold pb-1 border-b border-border">
                  <span className="flex-1">Item</span>
                  <span className="w-10 text-center">Qty</span>
                  <span className="w-16 text-right">Price</span>
                  <span className="w-16 text-right">Amount</span>
                </div>
                {allItems.map((c) => (
                  <div
                    key={c.item.id}
                    className="flex items-center text-sm"
                  >
                    <span className="flex-1 text-foreground leading-tight pr-2">
                      {c.item.name}
                    </span>
                    <span className="w-10 text-center text-muted-foreground">
                      {c.quantity}
                    </span>
                    <span className="w-16 text-right text-muted-foreground">
                      ₹{c.item.price}
                    </span>
                    <span className="w-16 text-right font-semibold text-foreground">
                      ₹{c.item.price * c.quantity}
                    </span>
                  </div>
                ))}

                {/* Divider + Total */}
                <div className="border-t border-border pt-3 flex items-center justify-between">
                  <span className="text-muted-foreground text-sm font-semibold">
                    Total
                  </span>
                  <span className="text-foreground font-extrabold text-2xl">
                    ₹{total}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generate Bill / Clear Table */}
        {selectedTable && (
          <div className="space-y-3">
            {allItems.length > 0 && !generated && (
              <button
                onClick={handleGenerateBill}
                className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-extrabold text-base active:scale-95 transition-transform shadow-lg"
              >
                Generate Bill
              </button>
            )}
            {(generated || allItems.length === 0) && (
              <div className="space-y-3">
                {generated && allItems.length > 0 && (
                  <div className="flex items-center gap-3 bg-secondary/20 border border-secondary/30 rounded-2xl px-4 py-4">
                    <CheckCircle2 className="w-6 h-6 text-secondary shrink-0" />
                    <div>
                      <p className="font-bold text-foreground">Bill Generated</p>
                      <p className="text-sm text-muted-foreground">
                        Total: ₹{total} for Table {selectedTable}
                      </p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleClearTable}
                  className="w-full py-4 bg-secondary text-secondary-foreground rounded-2xl font-extrabold text-base active:scale-95 transition-transform shadow-lg"
                >
                  Clear Table {selectedTable}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
