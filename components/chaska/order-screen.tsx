"use client";

import { useState } from "react";
import {
  CartItem,
  MenuCategory,
  MENU_ITEMS,
  MenuItem,
  OrderItem,
  TableStatus,
  FirestoreOrder,
} from "@/lib/chaska-data";
import { createOrder, requestBill, updateOrderItems } from "@/services/orders";
import { cancelBillRequest } from "@/services/tables";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronRight, ChevronUp, ChevronDown, Minus, Plus, ShoppingBag, X, Search } from "lucide-react";
import { toast } from "sonner";

interface OrderScreenProps {
  tableId: string;
  tableNumber: string;
  tableStatus: TableStatus;
  existingOrderId: string | null;
  orders: FirestoreOrder[];
  onBack: () => void;
}

const CATEGORY_TABS: { id: MenuCategory | "all"; label: string; icon: string }[] = [
  { id: "all",            label: "All",       icon: "🍽️" },
  { id: "soup",           label: "Soup",      icon: "🍲" },
  { id: "chinese",        label: "Chinese",   icon: "🍜" },
  { id: "paneer",         label: "Paneer",    icon: "🧀" },
  { id: "veg",            label: "Veg",       icon: "🥘" },
  { id: "signature",      label: "Signature", icon: "⭐" },
  { id: "tandoor",        label: "Tandoor",   icon: "🫓" },
  { id: "dal",            label: "Dal & Rice",icon: "🍚" },
  { id: "accompaniments", label: "Extras",    icon: "🥤" },
  { id: "combos",         label: "Combos",    icon: "🎁" },
];

const CATEGORY_LABELS: Record<MenuCategory, string> = {
  soup: "Soup",
  chinese: "Chinese",
  paneer: "Paneer",
  veg: "Veg. Main",
  signature: "Signature",
  tandoor: "Tandoor",
  dal: "Dal & Rice",
  accompaniments: "Extras",
  combos: "Combos",
};

/** Convert CartItem[] to OrderItem[] for Firestore — propagates skipKitchen */
function cartToOrderItems(cart: CartItem[]): OrderItem[] {
  return cart.map((c) => ({
    id: c.item.id,
    name: c.item.name,
    price: c.item.price!,
    quantity: c.quantity,
    ...(c.item.skipKitchen ? { skipKitchen: true } : {}),
    ...(c.note?.trim() ? { note: c.note.trim() } : {}),
  }));
}

export default function OrderScreen({
  tableId,
  tableNumber,
  tableStatus,
  orders,
  onBack,
}: OrderScreenProps) {
  const [activeCategory, setActiveCategory] = useState<MenuCategory | "all">("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editSentModalOpen, setEditSentModalOpen] = useState(false);
  const [spicePickerItemId, setSpicePickerItemId] = useState<string | null>(null);
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  // Variant picker: holds the base MenuItem whose variants should be displayed
  const [variantPickerItem, setVariantPickerItem] = useState<MenuItem | null>(null);

  // When searching: show all matches across all categories
  // When not searching + "all": show every item in category order
  // When not searching + specific category: filter
  const filteredItems = searchQuery.trim()
    ? MENU_ITEMS.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeCategory === "all"
    ? MENU_ITEMS
    : MENU_ITEMS.filter((item) => item.category === activeCategory);

  /** For regular items — look up by exact id */
  const getQuantity = (itemId: string) =>
    cart.find((c) => c.item.id === itemId)?.quantity ?? 0;

  /** Per-variant quantity helper */
  const getVariantQty = (baseId: string, variantLabel: string) =>
    cart.find((c) => c.item.id === `${baseId}_${variantLabel}`)?.quantity ?? 0;

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

  const updateNote = (itemId: string, note: string) => {
    setCart((prev) =>
      prev.map((c) =>
        c.item.id === itemId ? { ...c, note } : c
      )
    );
  };

  /** Called when user picks a variant from the bottom sheet */
  const addVariant = (base: MenuItem, label: string, price: number) => {
    const variantItem: MenuItem = {
      id: `${base.id}_${label}`,
      name: `${base.name} (${label})`,
      price,
      category: base.category,
    };
    addItem(variantItem);
    setVariantPickerItem(null);
  };

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const totalPrice = cart.reduce((sum, c) => sum + c.item.price! * c.quantity, 0);

  const isLocked = tableStatus === "billing";
  const tableHasActiveOrders = tableStatus === "active";

  // ── Sent Orders Editor Logic ───────────────────────────────────────────────
  const activeOrders = orders.filter(
    (o) =>
      o.tableId === tableId &&
      (o.status === "pending" || o.status === "preparing")
  );

  const mergedSentItems = activeOrders.reduce((acc, order) => {
    order.items.forEach((item) => {
        const existing = acc.find((i) => i.id === item.id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          acc.push({ ...item });
        }
      });
    return acc;
  }, [] as OrderItem[]);

  const totalSentQty = mergedSentItems.reduce((sum, i) => sum + i.quantity, 0);

  const handleEditSentQty = async (itemId: string, delta: number) => {
    // Find an active order containing this item
    const orderToUpdate = activeOrders.find((o) =>
      o.items.some((i) => i.id === itemId)
    );
    if (!orderToUpdate) return;

    const updated = orderToUpdate.items
      .map((i) =>
        i.id === itemId ? { ...i, quantity: i.quantity + delta } : i
      )
      .filter((i) => i.quantity > 0);

    try {
      // Only trigger a fresh KOT if waiter is ADDING quantity.
      // Reductions don't need a re-print — the kitchen already has the original KOT.
      // Passing resetKotPrinted=true for a removal would re-print all items (including
      // ones already being cooked), confusing the kitchen.
      await updateOrderItems(orderToUpdate.id, updated, delta > 0);
      // Auto-close modal if last item deleted
      if (updated.length === 0 && mergedSentItems.length === 1) {
        setEditSentModalOpen(false);
      }
    } catch {
      toast.error("Failed to update item. Try again.");
    }
  };

  const handleSendToKitchen = async () => {
    if (cart.length === 0 || sending) return;
    setSending(true);
    try {
      const items = cartToOrderItems(cart);
      await createOrder(tableId, items);
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

  const handleCancelBill = async () => {
    if (sending) return;
    setSending(true);
    try {
      await cancelBillRequest(tableId);
      toast.success("Bill request cancelled!");
    } catch (err) {
      console.error(err);
      toast.error("Could not cancel. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ── Spice Level Picker Bottom Sheet ─────────────────────────────────── */}
      {spicePickerItemId && (() => {
        const cartItem = cart.find((c) => c.item.id === spicePickerItemId);
        if (!cartItem) return null;
        const SPICE_OPTIONS = [
          { label: "Very Spicy", color: "text-red-600 bg-red-50 border-red-200" },
          { label: "Spicy",      color: "text-orange-600 bg-orange-50 border-orange-200" },
          { label: "Medium",     color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
          { label: "Mild",       color: "text-blue-600 bg-blue-50 border-blue-200" },
        ] as const;
        return (
          <div className="fixed inset-0 z-50 flex items-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setSpicePickerItemId(null)}
            />
            {/* Sheet */}
            <div className="relative w-full bg-card rounded-t-3xl shadow-2xl px-5 pt-4 pb-8 z-10">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
              <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-1">Spice Level</p>
              <p className="text-base font-extrabold text-foreground mb-4">{cartItem.item.name}</p>
              <div className="grid grid-cols-2 gap-2">
                {SPICE_OPTIONS.map(({ label, color }) => (
                  <button
                    key={label}
                    onClick={() => {
                      updateNote(spicePickerItemId, cartItem.note === label ? "" : label);
                      setSpicePickerItemId(null);
                    }}
                    className={cn(
                      "py-3 rounded-xl border font-bold text-sm transition-all active:scale-95",
                      cartItem.note === label
                        ? color
                        : "bg-muted text-muted-foreground border-transparent"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSpicePickerItemId(null)}
                className="mt-3 w-full py-2.5 text-muted-foreground text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}
      {/* ── Variant Picker Bottom Sheet ─────────────────────────────────── */}
      {variantPickerItem && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setVariantPickerItem(null)}
          />
          {/* Sheet */}
          <div className="relative w-full bg-card rounded-t-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-foreground">
                  {variantPickerItem.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Choose size
                </p>
              </div>
              <button
                onClick={() => setVariantPickerItem(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-muted"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {variantPickerItem.variants!.map((v) => (
                <button
                  key={v.label}
                  onClick={() =>
                    addVariant(variantPickerItem, v.label, v.price)
                  }
                  className="py-5 bg-primary text-primary-foreground rounded-2xl font-bold flex flex-col items-center gap-1 active:scale-95 transition-transform shadow-md"
                >
                  <span className="text-lg">{v.label}</span>
                  <span className="text-sm opacity-90">₹{v.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Sent Orders Modal ─────────────────────────────────────── */}
      {editSentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setEditSentModalOpen(false)}
          />
          {/* Sheet */}
          <div className="relative w-full bg-card rounded-t-3xl p-6 shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0 border-b border-border pb-4">
              <div>
                <h2 className="text-xl font-extrabold text-foreground">
                  Active Orders
                </h2>
                <p className="text-sm text-status-billing mt-0.5 font-bold">
                  Editing these items adjusts the main order directly
                </p>
              </div>
              <button
                onClick={() => setEditSentModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-muted"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pb-8">
              {mergedSentItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-muted rounded-xl p-3 flex items-center justify-between"
                >
                  <div className="flex-1 pr-4">
                    <p className="font-bold text-foreground text-sm uppercase leading-snug">
                      {item.name}
                    </p>
                    <p className="text-secondary font-extrabold text-sm mt-0.5">
                      ₹{item.price}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 bg-background px-3 py-2 rounded-xl shadow-sm">
                    <button
                      onClick={() => handleEditSentQty(item.id, -1)}
                      className="w-8 h-8 flex flex-col items-center justify-center rounded-lg text-primary bg-primary/10 active:scale-90 transition-transform"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-primary font-extrabold text-lg w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleEditSentQty(item.id, 1)}
                      className="w-8 h-8 flex items-center justify-center flex-col rounded-lg text-primary bg-primary/10 active:scale-90 transition-transform"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {mergedSentItems.length === 0 && (
                <p className="text-muted-foreground font-semibold text-center italic py-4">
                  No pending items found.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
              Chaska Chinese &amp; Punjabi
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
          {tableHasActiveOrders && !isLocked && totalSentQty > 0 && (
            <button
              onClick={() => setEditSentModalOpen(true)}
              className="flex items-center gap-1.5 bg-orange-100 text-orange-700 font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform shadow-sm"
            >
              <span className="text-sm font-extrabold tracking-wide">{totalSentQty} sent</span>
              <span className="text-[10px] uppercase font-extrabold ml-1 bg-orange-200 px-1.5 rounded text-orange-800">Edit</span>
            </button>
          )}
          {totalItems > 0 && !isLocked && (
            <div className="flex items-center gap-1.5 bg-primary/20 text-primary px-3 py-1.5 rounded-full">
              <ShoppingBag className="w-4 h-4" />
              <span className="text-sm font-bold">{totalItems}</span>
            </div>
          )}
        </div>
      </header>

      {/* Category Tabs — horizontal scroll (hidden when searching) */}
      {!searchQuery && (
        <div className="px-4 pt-4 pb-2 overflow-x-auto">
          <div className="flex gap-2 w-max">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 rounded-xl whitespace-nowrap",
                  "text-sm font-bold transition-all duration-150",
                  activeCategory === tab.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground active:bg-card"
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="px-4 pb-2 pt-2">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-medium"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="flex-1 px-4 py-3 pb-56">
        <div className="grid grid-cols-2 gap-3">
          {filteredItems.map((item) => {
            const isVariant = !!item.variants;
            const qty = isVariant ? 0 : getQuantity(item.id);
            const hasVariantInCart = isVariant
              ? item.variants!.some((v) => getVariantQty(item.id, v.label) > 0)
              : false;

            return (
              <div
                key={item.id}
                className={cn(
                  "bg-card border-2 rounded-2xl p-4 flex flex-col gap-3 shadow-md transition-all",
                  (qty > 0 || hasVariantInCart)
                    ? "border-primary/50"
                    : "border-border"
                )}
              >
                <div className="flex-1">
                  <p className="font-bold text-foreground text-sm leading-tight text-balance">
                    {item.name}
                  </p>
                  {/* Category badge: shown in search results or All tab */}
                  {(searchQuery || activeCategory === "all") && (
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">
                      {CATEGORY_LABELS[item.category]}
                    </p>
                  )}
                  {/* Waiter-serves badge for skip-kitchen items */}
                  {item.skipKitchen && (
                    <span className="inline-block mt-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      👋 Waiter serves
                    </span>
                  )}
                  {isVariant ? (
                    <p className="text-muted-foreground text-xs font-semibold mt-1">
                      ₹{item.variants![0].price}–₹
                      {item.variants![item.variants!.length - 1].price}
                    </p>
                  ) : (
                    <p className="text-primary font-extrabold text-base mt-1">
                      ₹{item.price}
                    </p>
                  )}
                </div>

                {isLocked ? (
                  <div className="py-2 text-center text-xs text-muted-foreground font-semibold">
                    {qty > 0 ? `${qty} ordered` : "—"}
                  </div>
                ) : isVariant ? (
                  // Variant item: inline +/- per variant, picker only for first add
                  <div className="space-y-1.5">
                    {(() => {
                      const anyInCart = item.variants!.some(
                        (v) => getVariantQty(item.id, v.label) > 0
                      );
                      if (!anyInCart) {
                        return (
                          <button
                            onClick={() => setVariantPickerItem(item)}
                            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm active:scale-95 transition-transform"
                          >
                            Choose Size
                          </button>
                        );
                      }
                      return item.variants!.map((v) => {
                        const vQty = getVariantQty(item.id, v.label);
                        const vId = `${item.id}_${v.label}`;
                        if (vQty > 0) {
                          return (
                            <div key={v.label} className="flex items-center justify-between bg-primary/10 rounded-xl px-2 py-1">
                              <span className="text-xs font-bold text-primary">{v.label}</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => removeItem(vId)} className="w-7 h-7 flex items-center justify-center rounded-lg text-primary active:scale-90">
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-primary font-extrabold text-base w-4 text-center">{vQty}</span>
                                <button onClick={() => addVariant(item, v.label, v.price)} className="w-7 h-7 flex items-center justify-center rounded-lg text-primary active:scale-90">
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <button
                              key={v.label}
                              onClick={() => addVariant(item, v.label, v.price)}
                              className="w-full py-1.5 border border-primary/40 text-primary rounded-xl font-bold text-xs active:scale-95 transition-transform"
                            >
                              + {v.label} ₹{v.price}
                            </button>
                          );
                        }
                      });
                    })()}
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
                    <span className="text-primary font-extrabold text-lg">{qty}</span>
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

      {/* Undo Bill Request bar — shown when table is locked (billing status) */}
      {isLocked && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-status-billing px-4 pt-3 shadow-2xl"
             style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-extrabold text-status-billing">Bill Requested</p>
              <p className="text-xs text-muted-foreground">Waiter tapped this by mistake?</p>
            </div>
          </div>
          <button
            onClick={handleCancelBill}
            disabled={sending}
            className="w-full py-4 bg-muted border-2 border-status-billing text-status-billing rounded-2xl font-extrabold text-base active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          >
            ↩ Undo Bill Request
          </button>
        </div>
      )}

      {/* Bottom Cart Section */}
      {(!isLocked && (cart.length > 0 || tableHasActiveOrders)) && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 pt-3 shadow-2xl space-y-3"
             style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
          {cart.length > 0 && (
            <>
              {isCartExpanded && (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pb-2 border-b border-border/50">
                  {cart.map((c) => (
                    <div key={c.item.id} className="flex items-center justify-between pb-1.5 last:pb-0">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm text-foreground font-medium truncate">
                          <span className="text-primary font-bold">{c.quantity}×</span>{" "}
                          {c.item.name}
                        </span>
                        {c.note && (
                          <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                            {c.note}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setSpicePickerItemId(c.item.id)}
                          className={cn(
                            "text-[11px] font-bold px-2 py-0.5 rounded border transition-all active:scale-95",
                            c.note
                              ? "text-orange-700 bg-orange-50 border-orange-200"
                              : "text-muted-foreground bg-muted border-border"
                          )}
                        >
                          {c.note ?? "Spice"}
                        </button>
                        <span className="text-sm font-semibold text-foreground">₹{c.item.price! * c.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button 
                onClick={() => setIsCartExpanded(!isCartExpanded)}
                className="w-full flex items-center justify-between active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-sm font-semibold">Total</span>
                  {isCartExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <span className="text-foreground font-extrabold text-xl">
                  ₹{totalPrice}
                </span>
              </button>
            </>
          )}

          <div className="flex gap-3">
            {tableHasActiveOrders && (
              <button
                onClick={handleRequestBill}
                disabled={sending}
                className="flex-[1] py-4 bg-status-billing border-2 border-status-billing text-white rounded-2xl font-extrabold text-base flex items-center justify-center active:scale-95 transition-transform shadow-lg disabled:opacity-60"
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
                  tableHasActiveOrders ? "flex-[1.5]" : "flex-1"
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
