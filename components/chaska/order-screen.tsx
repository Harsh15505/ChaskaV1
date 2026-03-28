"use client";

import { useEffect, useState } from "react";
import { CartItem, MENU_ITEMS, MenuItem, OrderItem, TableStatus } from "@/lib/chaska-data";
import { useTableOrder } from "@/hooks/useOrders";
import { createOrder, updateOrderItems, requestBill } from "@/services/orders";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronRight, Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

interface OrderScreenProps {
  tableId: string;         // Firestore doc id, e.g. "table_1"
  tableNumber: number;
  tableStatus: TableStatus;
  existingOrderId: string | null;
  onBack: () => void;
}

type Category = "chinese" | "punjabi";

const CATEGORY_TABS: { id: Category; label: string; icon: string }[] = [
  { id: "chinese", label: "Chinese", icon: "🍜" },
  { id: "punjabi", label: "Punjabi", icon: "🍛" },
];

/** Convert CartItem[] to OrderItem[] for Firestore */
function cartToOrderItems(cart: CartItem[]): OrderItem[] {
  return cart.map((c) => ({
    id: c.item.id,
    name: c.item.name,
    price: c.item.price,
    quantity: c.quantity,
  }));
}

/** Convert OrderItem[] from Firestore back to CartItem[] for local state */
function orderItemsToCart(items: OrderItem[]): CartItem[] {
  return items.map((oi) => {
    const menuItem: MenuItem = {
      id: oi.id,
      name: oi.name,
      price: oi.price,
      category:
        MENU_ITEMS.find((m) => m.id === oi.id)?.category ?? "chinese",
    };
    return { item: menuItem, quantity: oi.quantity };
  });
}

export default function OrderScreen({
  tableId,
  tableNumber,
  tableStatus,
  existingOrderId,
  onBack,
}: OrderScreenProps) {
  const [activeCategory, setActiveCategory] = useState<Category>("chinese");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sending, setSending] = useState(false);

  // Listen to the current order for this table in real time
  const { order, loading: orderLoading } = useTableOrder(tableId);

  // Sync cart with Firestore order when it loads
  useEffect(() => {
    if (!orderLoading && order) {
      setCart(orderItemsToCart(order.items));
    }
  }, [orderLoading, order]);

  const filteredItems = MENU_ITEMS.filter(
    (item) => item.category === activeCategory
  );

  const getQuantity = (itemId: string) =>
    cart.find((c) => c.item.id === itemId)?.quantity ?? 0;

  const addItem = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeItem = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === itemId);
      if (!existing) return prev;
      if (existing.quantity === 1)
        return prev.filter((c) => c.item.id !== itemId);
      return prev.map((c) =>
        c.item.id === itemId ? { ...c, quantity: c.quantity - 1 } : c
      );
    });
  };

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const totalPrice = cart.reduce(
    (sum, c) => sum + c.item.price * c.quantity,
    0
  );

  // Can the waiter still edit? Locked once table moves to 'billing' state
  const isLocked = tableStatus === "billing";

  const handleSendToKitchen = async () => {
    if (cart.length === 0 || sending) return;
    setSending(true);
    try {
      const items = cartToOrderItems(cart);
      if (order) {
        // Existing order — update items
        await updateOrderItems(order.id, items);
      } else {
        // New order — create in Firestore
        await createOrder(tableId, items);
      }
      toast.success("Order sent to kitchen!");
      onBack();
    } catch (err) {
      console.error(err);
      toast.error("Failed to send order. Check your connection.");
    } finally {
      setSending(false);
    }
  };

  const handleRequestBill = async () => {
    if (sending) return;
    setSending(true);
    try {
      await requestBill(tableId);
      toast.success("Bill requested!");
      onBack();
    } catch (err) {
      console.error(err);
      toast.error("Failed to request bill. Check your connection.");
    } finally {
      setSending(false);
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
          <div className="flex-1">
            <p className="text-xs font-bold tracking-[0.25em] text-primary uppercase">
              CHASKA
            </p>
            <h1 className="text-xl font-extrabold text-foreground leading-tight">
              Table {tableNumber}
            </h1>
          </div>
          {isLocked && (
            <span className="text-xs font-bold bg-status-billing/20 text-status-billing px-3 py-1 rounded-full">
              Bill Requested
            </span>
          )}
          {totalItems > 0 && !isLocked && (
            <div className="flex items-center gap-1.5 bg-primary/20 text-primary px-3 py-1.5 rounded-full">
              <ShoppingBag className="w-4 h-4" />
              <span className="text-sm font-bold">{totalItems}</span>
            </div>
          )}
        </div>
      </header>

      {/* Category Tabs */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-2 bg-muted p-1 rounded-xl">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg",
                "text-sm font-bold transition-all duration-150",
                activeCategory === tab.id
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground active:bg-card"
              )}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="flex-1 px-4 py-3 pb-56">
        {orderLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted animate-pulse rounded-2xl h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item) => {
              const qty = getQuantity(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "bg-card border-2 rounded-2xl p-4 flex flex-col gap-3 shadow-md transition-all",
                    qty > 0 ? "border-primary/50" : "border-border"
                  )}
                >
                  <div className="flex-1">
                    <p className="font-bold text-foreground text-sm leading-tight text-balance">
                      {item.name}
                    </p>
                    <p className="text-primary font-extrabold text-base mt-1">
                      ₹{item.price}
                    </p>
                  </div>
                  {isLocked ? (
                    <div className="py-2 text-center text-xs text-muted-foreground font-semibold">
                      {qty > 0 ? `${qty} ordered` : "—"}
                    </div>
                  ) : qty === 0 ? (
                    <button
                      onClick={() => addItem(item)}
                      className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm active:scale-95 transition-transform"
                    >
                      Add
                    </button>
                  ) : (
                    <div className="flex items-center justify-between bg-primary/10 rounded-xl px-2 py-1">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-primary active:scale-90 transition-transform"
                        aria-label={`Remove one ${item.name}`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-primary font-extrabold text-lg">
                        {qty}
                      </span>
                      <button
                        onClick={() => addItem(item)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-primary active:scale-90 transition-transform"
                        aria-label={`Add one more ${item.name}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Cart Section */}
      {(!isLocked && (cart.length > 0 || order)) && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 pt-3 pb-6 shadow-2xl space-y-3">
          {/* Cart items summary only if cart has items */}
          {cart.length > 0 && (
            <>
              <div className="max-h-24 overflow-y-auto space-y-1.5">
                {cart.map((c) => (
                  <div key={c.item.id} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      <span className="text-primary font-bold">{c.quantity}x</span>{" "}
                      {c.item.name}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      ₹{c.item.price * c.quantity}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Total</span>
                <span className="text-foreground font-extrabold text-xl">
                  ₹{totalPrice}
                </span>
              </div>
            </>
          )}

          <div className="flex gap-3">
            {order && (
              <button
                onClick={handleRequestBill}
                disabled={sending}
                className="flex-[1] py-4 bg-status-billing border-2 border-status-billing text-status-billing-foreground rounded-2xl font-extrabold text-base flex items-center justify-center active:scale-95 transition-transform shadow-lg disabled:opacity-60"
                style={{ color: "white" }}
              >
                Request Bill
              </button>
            )}
            {cart.length > 0 && (
              <button
                onClick={handleSendToKitchen}
                disabled={sending}
                className={cn(
                  "py-4 bg-secondary text-secondary-foreground rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg disabled:opacity-60",
                  order ? "flex-[1.5]" : "flex-1"
                )}
              >
                {sending ? "Sending…" : "Send to Kitchen"}
                {!sending && <ChevronRight className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
