"use client";

import { useState } from "react";
import { FirestoreOrder, FirestoreTable, MenuCategory, MENU_ITEMS, MenuItem } from "@/lib/chaska-data";
import { clearTable, updateOrderItems, createTakeawayOrder, markOrdersKotPrinted } from "@/services/orders";
import { getNextBillNumber } from "@/services/billing-counter";
import { generateReceipt, generateKotData } from "@/lib/receipt";
import type { ReceiptData } from "@/lib/receipt";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Receipt,
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Search,
  Printer,
  X,
} from "lucide-react";
import { toast } from "sonner";
import ReceiptPreview from "@/components/chaska/ReceiptPreview";

interface BillingScreenProps {
  tables: FirestoreTable[];
  orders: FirestoreOrder[];
  loading: boolean;
  onBack: () => void;
}

interface TakeawayItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
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

export default function BillingScreen({
  tables,
  orders,
  loading,
  onBack,
}: BillingScreenProps) {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [clearing, setClearing] = useState(false);
  const [sendingToKitchen, setSendingToKitchen] = useState(false);
  // Bill number is assigned once per table session — reused if Generate Bill is tapped again
  const [billNumberForTable, setBillNumberForTable] = useState<string | null>(null);

  // ── Takeaway state ───────────────────────────────────────────────────────
  const [takeawayOpen, setTakeawayOpen] = useState(false);
  const [takeawayCart, setTakeawayCart] = useState<TakeawayItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<MenuCategory | "all">("all");
  const [takeawaySearch, setTakeawaySearch] = useState("");
  // Variant picker for takeaway
  const [takeawayVariantItem, setTakeawayVariantItem] = useState<MenuItem | null>(null);

  const activeTables = tables.filter(
    (t) => t.status === "active" || t.status === "billing"
  );

  // All order rounds for the selected table
  const selectedOrders = selectedTableId
    ? orders.filter((o) => o.tableId === selectedTableId)
    : [];

  const selectedTable = selectedTableId
    ? tables.find((t) => t.id === selectedTableId) ?? null
    : null;

  // Merge firestore items across all rounds for the editable bill view
  const mergedItemsMap = new Map<
    string,
    { id: string; name: string; price: number; quantity: number }
  >();
  selectedOrders.forEach((o) => {
    o.items.forEach((i) => {
      if (mergedItemsMap.has(i.id)) {
        mergedItemsMap.get(i.id)!.quantity += i.quantity;
      } else {
        mergedItemsMap.set(i.id, { ...i });
      }
    });
  });
  const mergedItems = Array.from(mergedItemsMap.values());

  // Combine table + takeaway for total display
  const tableTotal = mergedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const takeawayTotal = takeawayCart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const grandTotal = tableTotal + takeawayTotal;

  // ── Takeaway cart helpers ────────────────────────────────────────────────

  const getTakeawayQty = (itemId: string) =>
    takeawayCart.find((c) => c.id === itemId)?.quantity ?? 0;

  const addTakeaway = (item: MenuItem) => {
    setTakeawayCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { id: item.id, name: item.name, price: item.price!, quantity: 1 }];
    });
  };

  /** Add a specific variant of an item to takeaway cart */
  const addTakeawayVariant = (base: MenuItem, label: string, price: number) => {
    const variantId = `${base.id}_${label}`;
    const variantName = `${base.name} (${label})`;
    setTakeawayCart((prev) => {
      const existing = prev.find((c) => c.id === variantId);
      if (existing) {
        return prev.map((c) =>
          c.id === variantId ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { id: variantId, name: variantName, price, quantity: 1 }];
    });
    setTakeawayVariantItem(null);
  };

  const getTakeawayVariantQty = (baseId: string, variantLabel: string) =>
    takeawayCart.find((c) => c.id === `${baseId}_${variantLabel}`)?.quantity ?? 0;

  const removeTakeaway = (itemId: string) => {
    setTakeawayCart((prev) => {
      const existing = prev.find((c) => c.id === itemId);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter((c) => c.id !== itemId);
      return prev.map((c) =>
        c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c
      );
    });
  };

  const filteredMenu = takeawaySearch.trim()
    ? MENU_ITEMS.filter((i) =>
        i.name.toLowerCase().includes(takeawaySearch.toLowerCase())
      )
    : activeCategory === "all"
    ? MENU_ITEMS
    : MENU_ITEMS.filter((i) => i.category === activeCategory);

  // ── Edit table order items ───────────────────────────────────────────────

  const handleChangeQty = async (itemId: string, delta: number) => {
    const orderToUpdate = selectedOrders.find((o) =>
      o.items.some((i) => i.id === itemId)
    );
    if (!orderToUpdate) return;

    const updated = orderToUpdate.items
      .map((i) =>
        i.id === itemId ? { ...i, quantity: i.quantity + delta } : i
      )
      .filter((i) => i.quantity > 0);

    try {
      await updateOrderItems(orderToUpdate.id, updated);
    } catch {
      toast.error("Failed to update item. Try again.");
    }
  };

  // ── Generate bill ────────────────────────────────────────────────────────

  const handleGenerateBill = async () => {
    if (selectedOrders.length === 0 && takeawayCart.length === 0) return;
    if (!selectedTable) return;
    try {
      // Fetch a bill number on first call; reuse it on subsequent opens for same table
      const billNum = billNumberForTable ?? await getNextBillNumber();
      if (!billNumberForTable) setBillNumberForTable(billNum);
      setReceipt(
        generateReceipt(selectedOrders, selectedTable.tableNumber, takeawayCart, billNum)
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate bill. Try again.");
    }
  };

  // ── Send takeaway to kitchen ─────────────────────────────────────────────

  const handleSendTakeawayToKitchen = async () => {
    if (takeawayCart.length === 0 || sendingToKitchen || !selectedTableId) return;
    setSendingToKitchen(true);
    try {
      const items = takeawayCart.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      }));
      await createTakeawayOrder(selectedTableId, items);
      // Clear local cart — items now live in Firestore linked to this table
      setTakeawayCart([]);
      setTakeawayOpen(false);
      toast.success("Takeaway order sent to kitchen!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send to kitchen. Try again.");
    } finally {
      setSendingToKitchen(false);
    }
  };

  // ── Print KOT ────────────────────────────────────────────────────────────

  const handlePrintKot = () => {
    if (!selectedTable) return;
    const kotData = generateKotData(selectedOrders, selectedTable.tableNumber);
    if (!kotData) {
      toast.info("No unprinted items to send to kitchen.");
      return;
    }
    setReceipt(kotData);
  };

  // ── Clear table ──────────────────────────────────────────────────────────

  const handleClearTable = async () => {
    if (!selectedTableId || clearing) return;
    setClearing(true);
    try {
      await clearTable(selectedTableId);
      toast.success(`Table ${selectedTable?.tableNumber} cleared!`);
      setSelectedTableId(null);
      setReceipt(null);
      setTakeawayCart([]);
      setTakeawayOpen(false);
      setBillNumberForTable(null); // reset for next billing session
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear table. Try again.");
    } finally {
      setClearing(false);
    }
  };

  const canGenerateBill =
    selectedTable && (mergedItems.length > 0 || takeawayCart.length > 0);

  return (
    <>
      {/* ── Takeaway Variant Picker ────────────────────────────────────────── */}
      {takeawayVariantItem && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setTakeawayVariantItem(null)}
          />
          <div className="relative w-full bg-card rounded-t-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-foreground">
                  {takeawayVariantItem.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">Choose size</p>
              </div>
              <button
                onClick={() => setTakeawayVariantItem(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-muted"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {takeawayVariantItem.variants!.map((v) => (
                <button
                  key={v.label}
                  onClick={() => addTakeawayVariant(takeawayVariantItem, v.label, v.price)}
                  className="py-5 bg-secondary text-secondary-foreground rounded-2xl font-bold flex flex-col items-center gap-1 active:scale-95 transition-transform shadow-md"
                >
                  <span className="text-lg">{v.label}</span>
                  <span className="text-sm opacity-90">₹{v.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* ── Receipt overlay ─────────────────────────────────────────────── */}
      {receipt && (
        <ReceiptPreview
          receiptData={receipt}
          onClose={() => setReceipt(null)}
          onClear={handleClearTable}
          clearing={clearing}
          onRequestBillNumber={async () => {
            if (billNumberForTable) return billNumberForTable;
            try {
              const billNum = await getNextBillNumber();
              setBillNumberForTable(billNum);
              // Update the receipt state so the preview updates too
              setReceipt(
                generateReceipt(selectedOrders, selectedTable!.tableNumber, takeawayCart, billNum)
              );
              return billNum;
            } catch (err) {
              console.error(err);
              toast.error("Failed to assign bill number.");
              throw err;
            }
          }}
          onKotPrinted={async () => {
             // Mark the orders as printed
             const unprintedOrderIds = selectedOrders.filter(o => !o.kotPrinted).map(o => o.id);
             if (unprintedOrderIds.length > 0) {
               await markOrdersKotPrinted(unprintedOrderIds);
             }
             setReceipt(null);
          }}
        />
      )}

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
                Chaska Chinese &amp; Punjabi
              </p>
              <h1 className="text-xl font-extrabold text-foreground leading-tight">
                Billing
              </h1>
            </div>
            {/* Takeaway badge */}
            {takeawayCart.length > 0 && (
              <div className="flex items-center gap-1.5 bg-secondary/20 text-secondary px-3 py-1.5 rounded-full">
                <ShoppingBag className="w-4 h-4" />
                <span className="text-sm font-bold">
                  +{takeawayCart.reduce((s, i) => s + i.quantity, 0)} takeaway
                </span>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 space-y-4 pb-8">
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
                      setBillNumberForTable(null); // reset bill number when switching tables
                    }}
                    className={cn(
                      "py-4 rounded-xl font-extrabold text-lg transition-all active:scale-90",
                      selectedTableId === table.id
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : table.status === "billing"
                        ? "bg-status-billing/20 border-2 border-status-billing text-status-billing"
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

          {/* Table Bill Details */}
          {selectedOrders.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-md">
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
                  No items ordered
                </div>
              ) : (
                <div className="px-4 py-3 space-y-3">
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

                  <div className="border-t border-border pt-2 flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">
                      Table ({selectedOrders.length}{" "}
                      {selectedOrders.length === 1 ? "round" : "rounds"})
                    </span>
                    <span className="text-foreground font-bold text-base">
                      ₹{tableTotal}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No order */}
          {selectedTableId && selectedOrders.length === 0 && !loading && (
            <div className="text-center text-muted-foreground text-sm py-2">
              No active order for this table yet.
            </div>
          )}

          {/* ── Takeaway Section ────────────────────────────────────────────── */}
          {selectedTable && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-md">
              {/* Collapsible header */}
              <button
                onClick={() => setTakeawayOpen((p) => !p)}
                className="w-full flex items-center gap-2 px-4 py-3 active:bg-muted transition-colors"
              >
                <ShoppingBag className="w-4 h-4 text-secondary" />
                <span className="font-extrabold text-foreground flex-1 text-left">
                  Add Takeaway Items
                </span>
                {takeawayCart.length > 0 && (
                  <span className="text-xs font-bold text-secondary bg-secondary/15 px-2 py-0.5 rounded-full">
                    {takeawayCart.reduce((s, i) => s + i.quantity, 0)} items · ₹{takeawayTotal}
                  </span>
                )}
                {takeawayOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {takeawayOpen && (
                <div className="border-t border-border">
                  {/* Search bar */}
                  <div className="px-3 pt-3 pb-1">
                    <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
                      <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        value={takeawaySearch}
                        onChange={(e) => setTakeawaySearch(e.target.value)}
                        placeholder="Search menu..."
                        className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none font-medium"
                      />
                      {takeawaySearch && (
                        <button onClick={() => setTakeawaySearch("")}>
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Category Tabs — horizontal scroll */}
                  {!takeawaySearch && (
                    <div className="px-3 pt-3 pb-2 overflow-x-auto">
                      <div className="flex gap-2 w-max">
                        {CATEGORY_TABS.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveCategory(tab.id)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap",
                              "text-xs font-bold transition-all",
                              activeCategory === tab.id
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Send takeaway to kitchen */}
                  {takeawayCart.length > 0 && (
                    <div className="px-3 pb-3">
                      <button
                        onClick={handleSendTakeawayToKitchen}
                        disabled={sendingToKitchen}
                        className="w-full py-3 bg-orange-500 text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
                      >
                        {sendingToKitchen ? "Sending…" : `🍳 Send ${takeawayCart.reduce((s, i) => s + i.quantity, 0)} item(s) to Kitchen`}
                      </button>
                    </div>
                  )}

                  {/* Menu grid */}
                  <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                    {filteredMenu.map((item) => {
                      const isVariant = !!item.variants;
                      const qty = isVariant ? 0 : getTakeawayQty(item.id);
                      const hasVariantInCart = isVariant
                        ? item.variants!.some((v) => getTakeawayVariantQty(item.id, v.label) > 0)
                        : false;
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "bg-background border-2 rounded-xl p-3 flex flex-col gap-2",
                            (qty > 0 || hasVariantInCart)
                              ? "border-secondary/60"
                              : "border-border"
                          )}
                        >
                          <div>
                            <p className="font-bold text-foreground text-xs leading-tight">
                              {item.name}
                            </p>
                            {/* Category badge in search or All tab */}
                            {(takeawaySearch || activeCategory === "all") && (
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">
                                {CATEGORY_LABELS[item.category]}
                              </p>
                            )}
                            {/* Waiter-serves badge */}
                            {item.skipKitchen && (
                              <span className="inline-block mt-0.5 text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded">
                                👋 Waiter
                              </span>
                            )}
                            {isVariant ? (
                              <p className="text-secondary font-extrabold text-xs mt-0.5">
                                ₹{item.variants![0].price}–₹{item.variants![item.variants!.length - 1].price}
                              </p>
                            ) : (
                              <p className="text-secondary font-extrabold text-sm mt-0.5">
                                ₹{item.price}
                              </p>
                            )}
                          </div>
                          {isVariant ? (
                            <div className="space-y-1">
                              {(() => {
                                const anyInCart = item.variants!.some(
                                  (v) => getTakeawayVariantQty(item.id, v.label) > 0
                                );
                                if (!anyInCart) {
                                  return (
                                    <button
                                      onClick={() => setTakeawayVariantItem(item)}
                                      className="w-full py-1.5 bg-secondary text-secondary-foreground rounded-lg font-bold text-xs active:scale-95 transition-transform"
                                    >
                                      Choose Size
                                    </button>
                                  );
                                }
                                return item.variants!.map((v) => {
                                  const vQty = getTakeawayVariantQty(item.id, v.label);
                                  const vId = `${item.id}_${v.label}`;
                                  if (vQty > 0) {
                                    return (
                                      <div key={v.label} className="flex items-center justify-between bg-secondary/10 rounded-lg px-1 py-0.5">
                                        <span className="text-[10px] font-bold text-secondary">{v.label}</span>
                                        <div className="flex items-center gap-1.5">
                                          <button onClick={() => removeTakeaway(vId)} className="w-6 h-6 flex items-center justify-center rounded text-secondary active:scale-90">
                                            <Minus className="w-3 h-3" />
                                          </button>
                                          <span className="text-secondary font-extrabold text-sm w-3 text-center">{vQty}</span>
                                          <button onClick={() => addTakeawayVariant(item, v.label, v.price)} className="w-6 h-6 flex items-center justify-center rounded text-secondary active:scale-90">
                                            <Plus className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <button
                                        key={v.label}
                                        onClick={() => addTakeawayVariant(item, v.label, v.price)}
                                        className="w-full py-1 border border-secondary/40 text-secondary rounded-lg font-bold text-[10px] active:scale-95 transition-transform"
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
                              onClick={() => addTakeaway(item)}
                              className="w-full py-1.5 bg-secondary text-secondary-foreground rounded-lg font-bold text-xs active:scale-95 transition-transform"
                            >
                              Add
                            </button>
                          ) : (
                            <div className="flex items-center justify-between bg-secondary/10 rounded-lg px-1 py-0.5">
                              <button
                                onClick={() => removeTakeaway(item.id)}
                                className="w-7 h-7 flex items-center justify-center text-secondary active:scale-90"
                              >
                                {qty === 1 ? (
                                  <Trash2 className="w-3.5 h-3.5" />
                                ) : (
                                  <Minus className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <span className="font-extrabold text-secondary text-sm">
                                {qty}
                              </span>
                              <button
                                onClick={() => addTakeaway(item)}
                                className="w-7 h-7 flex items-center justify-center text-secondary active:scale-90"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grand Total + Generate Bill */}
          {canGenerateBill && (
            <div className="space-y-3">
              {/* Grand total row */}
              <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">
                    Grand Total
                    {takeawayCart.length > 0 && " (table + takeaway)"}
                  </p>
                </div>
                <span className="text-foreground font-extrabold text-2xl">
                  ₹{grandTotal}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePrintKot}
                  className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-extrabold text-base active:scale-95 transition-transform shadow-lg flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" /> Print KOT
                </button>
                <button
                  onClick={handleGenerateBill}
                  className="flex-1 py-4 bg-primary text-primary-foreground rounded-2xl font-extrabold text-base active:scale-95 transition-transform shadow-lg"
                >
                  Generate Bill
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
