"use client";

import { useMemo, useState, useEffect } from "react";
import { FirestoreOrder, FirestoreTable, OrderItem } from "@/lib/chaska-data";
import { updateOrderItems } from "@/services/orders";
import { CheckCircle2, Clock, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PendingServicesProps {
  orders: FirestoreOrder[];
  tables: FirestoreTable[];
}

interface PendingItem {
  orderId: string;
  tableId: string;
  tableNumber: string;
  item: OrderItem;
  pendingQty: number;
  createdAt: Date;
}

export default function PendingServices({ orders, tables }: PendingServicesProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Force re-render every minute to update elapsed time accurately
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Derive flat list of pending items
  const pendingItems = useMemo(() => {
    const list: PendingItem[] = [];

    // Filter relevant orders (not billed, not takeaway)
    const activeOrders = orders.filter(
      (o) => o.status !== "billed" && o.orderType !== "takeaway"
    );

    for (const order of activeOrders) {
      // Find the table
      const table = tables.find((t) => t.id === order.tableId);
      if (!table) continue;

      for (const item of order.items) {
        const served = item.servedAmt ?? 0;
        const pendingQty = item.quantity - served;
        
        if (pendingQty > 0) {
          list.push({
            orderId: order.id,
            tableId: table.id,
            tableNumber: table.tableNumber,
            item,
            pendingQty,
            // Dates from Firestore can occasionally be strings if not parsed properly, ensure Date:
            createdAt: typeof order.createdAt?.getTime === 'function' ? order.createdAt : new Date(order.createdAt),
          });
        }
      }
    }

    // Sort oldest first
    return list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tables, tick]); 

  const handleServe = async (pending: PendingItem, serveQty: number) => {
    if (updating) return;

    // Find the original order to update
    const orderToUpdate = orders.find((o) => o.id === pending.orderId);
    if (!orderToUpdate) return;

    setUpdating(`${pending.orderId}_${pending.item.id}`);

    try {
      const newItems = orderToUpdate.items.map((i) => {
        if (i.id === pending.item.id) {
          const currentServed = i.servedAmt ?? 0;
          return { ...i, servedAmt: Math.min(i.quantity, currentServed + serveQty) };
        }
        return i;
      });

      await updateOrderItems(orderToUpdate.id, newItems);
      toast.success(`Marked ${serveQty}x ${pending.item.name} as served`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status. Check connection.");
    } finally {
      setUpdating(null);
    }
  };

  const getElapsedTime = (date: Date) => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      return `${hours}h ${mins % 60}m ago`;
    }
    return `${mins}m ago`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
             <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">
              Waiter Checklist
            </p>
            <h1 className="text-xl font-extrabold text-foreground leading-tight">
              Pending Serves
            </h1>
          </div>
          <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold">
            {pendingItems.length} items
          </div>
        </div>
      </header>

      {/* List */}
      <main className="flex-1 p-4 pb-24 space-y-3">
        {pendingItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 opacity-20" />
            <p className="font-semibold text-lg text-emerald-600/80">All caught up!</p>
            <p className="text-sm">No pending dishes to serve.</p>
          </div>
        ) : (
          pendingItems.map((pi) => {
            const isUpdating = updating === `${pi.orderId}_${pi.item.id}`;
            const timeMins = Math.floor((Date.now() - pi.createdAt.getTime()) / 60000);
            const isLate = timeMins > 15;

            return (
              <div
                key={`${pi.orderId}_${pi.item.id}`}
                className={cn(
                  "bg-card rounded-xl border p-3 flex flex-col shadow-sm transition-all",
                  isLate ? "border-orange-300 bg-orange-50/50" : "border-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">
                      <MapPin className="w-3 h-3 text-primary" />
                      Table {pi.tableNumber}
                    </div>
                    <div className="text-base font-extrabold text-foreground leading-tight">
                      {pi.item.name}
                    </div>
                    {pi.item.note && (
                      <p className="text-[10px] text-orange-800 font-bold bg-orange-200 px-1.5 py-0.5 rounded inline-block mt-1">
                        Note: {pi.item.note}
                      </p>
                    )}
                  </div>
                  
                  {/* Actions & Badges Compacted on the right */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1">
                      <div className="bg-primary/10 text-primary font-extrabold text-sm px-2.5 py-1 rounded-lg">
                        x{pi.pendingQty}
                      </div>
                      <div className={cn(
                        "text-[10px] font-bold whitespace-nowrap",
                        isLate ? "text-orange-600" : "text-muted-foreground"
                      )}>
                        {getElapsedTime(pi.createdAt)}
                      </div>
                    </div>
                    
                    <div className="flex gap-1.5">
                      {pi.pendingQty > 1 && (
                        <button
                          onClick={() => handleServe(pi, 1)}
                          disabled={!!updating}
                          className="px-2 py-1.5 bg-secondary text-secondary-foreground font-bold text-xs rounded-lg active:scale-95 transition-transform disabled:opacity-50"
                        >
                          +1
                        </button>
                      )}
                      <button
                        onClick={() => handleServe(pi, pi.pendingQty)}
                        disabled={!!updating}
                        className="px-3 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-lg active:scale-95 transition-transform disabled:opacity-50"
                      >
                        {isUpdating ? "..." : "Serve"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
