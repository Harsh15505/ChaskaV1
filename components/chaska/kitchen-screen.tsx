"use client";

import { useState } from "react";
import { FirestoreOrder, OrderItem } from "@/lib/chaska-data";
import { markOrderItemDone } from "@/services/orders";
import { cn } from "@/lib/utils";
import { Clock, ChefHat, Check } from "lucide-react";
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

/** Minutes elapsed since date */
function minutesAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 60000);
}

export default function KitchenScreen({ orders, loading }: KitchenScreenProps) {
  // Track orders currently animating the "completed" green flash before removal
  const [completingOrders, setCompletingOrders] = useState<Set<string>>(new Set());
  // Track per-item ticking optimistically (orderId → Set of itemIds)
  const [pendingTicks, setPendingTicks] = useState<Record<string, Set<string>>>({});

  // ── Order Classification ────────────────────────────────────────────────
  // Tables that already have at least one served order = "second round" tables
  const servedTableIds = new Set(
    orders.filter((o) => o.status === "served").map((o) => o.tableId)
  );

  // Active orders only (pending or preparing), excluding hide-in-progress completions
  const activeOrders = orders.filter(
    (o) =>
      (o.status === "pending" || o.status === "preparing") &&
      !completingOrders.has(o.id)
  );

  // Filter out orders where ALL items are skipKitchen
  const visibleOrders = activeOrders.filter((o) => {
    const kitchenItems = o.items.filter((i) => !i.skipKitchen);
    return kitchenItems.length > 0;
  });

  // Sort: priority (second-round tables) first, then by createdAt ascending
  const sortedOrders = [...visibleOrders].sort((a, b) => {
    const aPriority = servedTableIds.has(a.tableId) ? 0 : 1;
    const bPriority = servedTableIds.has(b.tableId) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // ── Per-Item Tick Logic ─────────────────────────────────────────────────
  const isItemTicked = (orderId: string, itemId: string): boolean => {
    // Check local optimistic state first, then Firestore markedDone
    if (pendingTicks[orderId]?.has(itemId)) return true;
    const order = orders.find((o) => o.id === orderId);
    return order?.items.find((i) => i.id === itemId)?.markedDone ?? false;
  };

  const handleTickItem = async (order: FirestoreOrder, item: OrderItem) => {
    if (isItemTicked(order.id, item.id)) return; // already ticked

    // Optimistic update
    setPendingTicks((prev) => {
      const next = { ...prev };
      next[order.id] = new Set(prev[order.id] ?? []).add(item.id);
      return next;
    });

    // Compute kitchen-bound items for this order (excluding skipKitchen)
    const kitchenItems = order.items.filter((i) => !i.skipKitchen);
    const alreadyDone = kitchenItems.filter(
      (i) => i.id !== item.id && isItemTicked(order.id, i.id)
    );
    const allWillBeDone = alreadyDone.length === kitchenItems.length - 1;

    if (allWillBeDone) {
      // Trigger green flash first, then persist
      setCompletingOrders((prev) => new Set(prev).add(order.id));
      const label =
        order.orderType === "takeaway" || order.tableId === "TAKEAWAY"
          ? order.tableId === "TAKEAWAY"
            ? "Takeaway"
            : `Table ${order.tableId.replace("table_", "")} Takeaway`
          : `Table ${order.tableId.replace("table_", "")}`;
      toast.success(`${label} — All items done! ✅`);
    }

    try {
      await markOrderItemDone(order.id, item.id);
    } catch (err) {
      console.error(err);
      // Roll back optimistic tick on failure
      setPendingTicks((prev) => {
        const next = { ...prev };
        const set = new Set(prev[order.id] ?? []);
        set.delete(item.id);
        next[order.id] = set;
        return next;
      });
      setCompletingOrders((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
      toast.error("Failed to update item. Try again.");
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
          {sortedOrders.length > 0 && (
            <div className="ml-auto bg-status-billing/20 text-status-billing px-3 py-1 rounded-full text-sm font-bold">
              {sortedOrders.length} pending
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
        ) : sortedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <ChefHat className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-semibold text-lg">No active orders</p>
            <p className="text-muted-foreground text-sm">
              Orders will appear here when sent from tables
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedOrders.map((order) => {
              const isTakeaway =
                order.orderType === "takeaway" || order.tableId === "TAKEAWAY";
              const isPriority = servedTableIds.has(order.tableId);
              const tableNum =
                order.tableId === "TAKEAWAY"
                  ? null
                  : order.tableId.replace("table_", "");

              // Only show kitchen-bound items (filter skipKitchen)
              const kitchenItems = order.items.filter((i) => !i.skipKitchen);
              const doneCount = kitchenItems.filter((i) =>
                isItemTicked(order.id, i.id)
              ).length;
              const totalCount = kitchenItems.length;

              const orderTotal = order.items.reduce(
                (s, i) => s + i.price * i.quantity,
                0
              );
              const mins = minutesAgo(order.createdAt);
              const urgencyColor =
                mins >= 10
                  ? "text-red-600"
                  : mins >= 5
                  ? "text-amber-500"
                  : "text-green-600";

              return (
                <div
                  key={order.id}
                  className={cn(
                    "border-2 rounded-2xl overflow-hidden shadow-md transition-all duration-300",
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
                    <div className="flex items-center gap-2 flex-wrap">
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
                      {/* ⚡ Second-round priority badge */}
                      {isPriority && !isTakeaway && (
                        <span className="text-[10px] font-extrabold bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full tracking-wide">
                          ⚡ Priority
                        </span>
                      )}
                      {/* Progress badge */}
                      {doneCount > 0 && doneCount < totalCount && (
                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          {doneCount}/{totalCount} done
                        </span>
                      )}
                    </div>
                    {/* Urgency-colored time */}
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-semibold">{formatTime(order.createdAt)}</span>
                      <span className={cn("font-bold", urgencyColor)}>
                        • {timeAgo(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Items — each with individual ✓ button */}
                  <div className="px-4 py-3 space-y-2">
                    {kitchenItems.map((item) => {
                      const ticked = isItemTicked(order.id, item.id);
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-2 py-1 transition-all",
                            ticked ? "opacity-50" : ""
                          )}
                        >
                          <span
                            className={cn(
                              "w-8 h-8 flex items-center justify-center rounded-lg font-extrabold text-sm shrink-0",
                              ticked
                                ? "bg-green-500 text-white"
                                : "bg-primary text-primary-foreground"
                            )}
                          >
                            {ticked ? <Check className="w-4 h-4" /> : item.quantity}
                          </span>
                          <span
                            className={cn(
                              "text-foreground font-semibold text-base leading-tight flex-1",
                              ticked && "line-through text-muted-foreground"
                            )}
                          >
                            {item.name}
                          </span>
                          <span className="text-muted-foreground text-sm shrink-0">
                            ₹{item.price * item.quantity}
                          </span>
                          {/* Per-item ✓ button */}
                          {!ticked && (
                            <button
                              onClick={() => handleTickItem(order, item)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-100 text-green-700 active:scale-90 transition-transform shrink-0 border border-green-300"
                              aria-label={`Mark ${item.name} done`}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Total row */}
                  <div className="px-4 pb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-foreground font-extrabold text-lg">₹{orderTotal}</p>
                    </div>
                    {doneCount === totalCount && totalCount > 0 && (
                      <span className="text-green-600 font-extrabold text-sm bg-green-100 px-4 py-2 rounded-xl">
                        All Done ✅
                      </span>
                    )}
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
