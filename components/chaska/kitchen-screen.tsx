"use client";

import { KitchenOrder } from "@/lib/chaska-data";
import { Clock, ChefHat } from "lucide-react";

interface KitchenScreenProps {
  orders: KitchenOrder[];
  onMarkDone: (orderId: string) => void;
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

export default function KitchenScreen({
  orders,
  onMarkDone,
}: KitchenScreenProps) {
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
              CHASKA
            </p>
            <h1 className="text-xl font-extrabold text-foreground leading-tight">
              Kitchen View
            </h1>
          </div>
          {orders.length > 0 && (
            <div className="ml-auto bg-status-billing/20 text-status-billing px-3 py-1 rounded-full text-sm font-bold">
              {orders.length} pending
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 p-4">
        {orders.length === 0 ? (
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
            {orders.map((order, idx) => (
              <div
                key={order.id}
                className="bg-card border-2 border-primary/20 rounded-2xl overflow-hidden shadow-md"
              >
                {/* Order header */}
                <div className="flex items-center justify-between bg-primary/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-extrabold text-primary">
                      T{order.tableId}
                    </span>
                    <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                      Table {order.tableId}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-semibold">
                      {formatTime(order.timestamp)}
                    </span>
                    <span className="text-status-billing font-bold">
                      • {timeAgo(order.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="px-4 py-3 space-y-2">
                  {order.items.map((cartItem) => (
                    <div
                      key={cartItem.item.id}
                      className="flex items-center gap-3"
                    >
                      <span className="w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded-lg font-extrabold text-sm shrink-0">
                        {cartItem.quantity}
                      </span>
                      <span className="text-foreground font-semibold text-base leading-tight">
                        {cartItem.item.name}
                      </span>
                      <span className="ml-auto text-muted-foreground text-sm shrink-0">
                        ₹{cartItem.item.price * cartItem.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total + Done button */}
                <div className="px-4 pb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-foreground font-extrabold text-lg">
                      ₹
                      {order.items.reduce(
                        (s, c) => s + c.item.price * c.quantity,
                        0
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => onMarkDone(order.id)}
                    className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl font-extrabold text-sm active:scale-95 transition-transform"
                  >
                    Mark Done
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
