"use client";

import { useState } from "react";
import { CartItem, KitchenOrder, MENU_ITEMS, MenuItem } from "@/lib/chaska-data";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronRight, Minus, Plus, ShoppingBag } from "lucide-react";

interface OrderScreenProps {
  tableId: number;
  onBack: () => void;
  onSendToKitchen: (order: KitchenOrder) => void;
  existingCart?: CartItem[];
}

type Category = "chinese" | "punjabi";

const CATEGORY_TABS: { id: Category; label: string; icon: string }[] = [
  { id: "chinese", label: "Chinese", icon: "🍜" },
  { id: "punjabi", label: "Punjabi", icon: "🍛" },
];

export default function OrderScreen({
  tableId,
  onBack,
  onSendToKitchen,
  existingCart = [],
}: OrderScreenProps) {
  const [activeCategory, setActiveCategory] = useState<Category>("chinese");
  const [cart, setCart] = useState<CartItem[]>(existingCart);

  const filteredItems = MENU_ITEMS.filter(
    (item) => item.category === activeCategory
  );

  const getQuantity = (itemId: string) => {
    return cart.find((c) => c.item.id === itemId)?.quantity ?? 0;
  };

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
      if (existing.quantity === 1) return prev.filter((c) => c.item.id !== itemId);
      return prev.map((c) =>
        c.item.id === itemId ? { ...c, quantity: c.quantity - 1 } : c
      );
    });
  };

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const totalPrice = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);

  const handleSendToKitchen = () => {
    if (cart.length === 0) return;
    const order: KitchenOrder = {
      id: `order-${Date.now()}`,
      tableId,
      items: cart,
      timestamp: new Date(),
    };
    onSendToKitchen(order);
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
              Table {tableId}
            </h1>
          </div>
          {totalItems > 0 && (
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
      <div className="flex-1 px-4 py-3 pb-48">
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
                {qty === 0 ? (
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
      </div>

      {/* Bottom Cart Section */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 pt-3 pb-6 shadow-2xl">
          {/* Cart items summary */}
          <div className="mb-3 max-h-28 overflow-y-auto space-y-1.5">
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
          <div className="flex items-center justify-between mb-3">
            <span className="text-muted-foreground text-sm">Total</span>
            <span className="text-foreground font-extrabold text-xl">
              ₹{totalPrice}
            </span>
          </div>
          <button
            onClick={handleSendToKitchen}
            className="w-full py-4 bg-secondary text-secondary-foreground rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
          >
            Send to Kitchen
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
