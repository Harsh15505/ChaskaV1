"use client";

import { useState } from "react";
import { FirestoreOrder } from "@/lib/chaska-data";
import { markOrderServed } from "@/services/orders";
import { cn } from "@/lib/utils";
import { Clock, ChefHat } from "lucide-react";
import { toast } from "sonner";

interface KitchenScreenProps {
  orders: FirestoreOrder[];
  loading: boolean;
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Show only pending/preparing orders to kitchen
function visibleOrders(orders: FirestoreOrder[]): FirestoreOrder[] {
  return orders.filter(
    (o) => o.status === "pending" || o.status === "preparing"
  );
}

export default function KitchenScreen({ orders, loading }: KitchenScreenProps) {
  const [marking, setMarking] = useState<string | null>(null);
  const active = visibleOrders(orders);

  const handleMarkDone = async (order: FirestoreOrder) => {
    if (marking) return;
    setMarking(order.id);
    try {
      await markOrderServed(order.id, order.tableId);
      const label =
        order.tableId === "TAKEAWAY" || order.orderType === "takeaway"
          ? order.tableId === "TAKEAWAY"
            ? "Takeaway"
            : `Table ${order.tableId.replace("table_", "")} Takeaway`
          : `Table ${order.tableId.replace("table_", "")}`;
      toast.success(`${label} marked done!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update order. Try again.");
    } finally {
      setMarking(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/20">
            <ChefHat className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-primary uppercase">
              Chaska Chinese &amp; Punjabi
            </p>
            <h1 className="text-xl font-extrabold text-foreground leading-tight">
              Kitchen View
            </h1>
          </div>
          {active.length > 0 && (
            <div className="ml-auto bg-status-billing/20 text-status-billing px-3 py-1 rounded-full text-sm font-bold">
              {active.length} pending
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 p-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-muted animate-pulse rounded-2xl h-36" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <ChefHat className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-semibold text-lg">
              No active orders
            </p>
            <p className="text-muted-foreground text-sm">
              Orders will appear here when sent from tables
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {active.map((order) => {
              const isTakeaway =
                order.orderType === "takeaway" || order.tableId === "TAKEAWAY";
              const tableNum = order.tableId === "TAKEAWAY"
                ? null
                : order.tableId.replace("table_", "");
              const orderTotal = order.items.reduce(
                (s, i) => s + i.price * i.quantity,
                0
              );
              return (
                <div
                  key={order.id}
                  className={cn(
                    "border-2 rounded-2xl overflow-hidden shadow-md",
                    isTakeaway
                      ? "bg-orange-50 border-orange-400"
                      : "bg-card border-primary/20"
                  )}
                >
                  {/* Order header */}
                  <div
                    className={cn(
                      "flex items-center justify-between px-4 py-3",
                      isTakeaway ? "bg-orange-100" : "bg-primary/10"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-2xl font-extrabold",
                          isTakeaway ? "text-orange-600" : "text-primary"
                        )}
                      >
                        {isTakeaway ? "🛍️" : `T${tableNum}`}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded-full",
                          isTakeaway
                            ? "bg-orange-200 text-orange-700"
                            : "bg-primary/20 text-primary"
                        )}
                      >
                        {isTakeaway
                          ? tableNum
                            ? `Table ${tableNum} — Takeaway`
                            : "Takeaway"
                          : `Table ${tableNum}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-semibold">
                        {formatTime(order.updatedAt)}
                      </span>
                      <span className="text-status-billing font-bold">
                        • {timeAgo(order.updatedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="px-4 py-3 space-y-2">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3"
                      >
                        <span className="w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded-lg font-extrabold text-sm shrink-0">
                          {item.quantity}
                        </span>
                        <span className="text-foreground font-semibold text-base leading-tight">
                          {item.name}
                        </span>
                        <span className="ml-auto text-muted-foreground text-sm shrink-0">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total + Done button */}
                  <div className="px-4 pb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-foreground font-extrabold text-lg">
                        ₹{orderTotal}
                      </p>
                    </div>
                    <button
                      onClick={() => handleMarkDone(order)}
                      disabled={marking === order.id}
                      className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl font-extrabold text-sm active:scale-95 transition-transform disabled:opacity-60"
                    >
                      {marking === order.id ? "Updating…" : "Mark Done ✓"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
