"use client";

import { useState, useEffect } from "react";
import { subscribeBillHistory, BillHistoryEntry } from "@/services/orders";
import { ArrowLeft, Search, X, ChevronDown, ChevronUp, ShoppingBag, Table2, Clock, IndianRupee, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateReceipt, ReceiptData } from "@/lib/receipt";
import ReceiptPreview from "@/components/chaska/ReceiptPreview";

interface BillHistoryViewProps {
  onBack: () => void;
}

function formatDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

/** Groups entries by calendar day label */
function groupByDay(entries: BillHistoryEntry[]): { label: string; entries: BillHistoryEntry[] }[] {
  const map = new Map<string, BillHistoryEntry[]>();
  entries.forEach((e) => {
    const label = formatDate(e.billedAt);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(e);
  });
  return Array.from(map.entries()).map(([label, entries]) => ({ label, entries }));
}

function BillCard({ entry, onReprint }: { entry: BillHistoryEntry; onReprint: () => void }) {
  const [expanded, setExpanded] = useState(false);

  // Merge all items across rounds for this bill
  const itemMap = new Map<string, { name: string; price: number; quantity: number }>();
  entry.orders.forEach((o) =>
    o.items.forEach((i) => {
      if (itemMap.has(i.id)) {
        itemMap.get(i.id)!.quantity += i.quantity;
      } else {
        itemMap.set(i.id, { name: i.name, price: i.price, quantity: i.quantity });
      }
    })
  );
  const items = Array.from(itemMap.values());

  const rounds = entry.orders.length;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Card Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-muted/60 transition-colors text-left"
      >
        {/* Icon */}
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            entry.isTableBill ? "bg-primary/15" : "bg-secondary/15"
          )}
        >
          {entry.isTableBill ? (
            <Table2 className="w-4 h-4 text-primary" />
          ) : (
            <ShoppingBag className="w-4 h-4 text-secondary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-foreground text-sm leading-tight">
            {entry.isTableBill
              ? `Table ${entry.tableNumber}`
              : "Takeaway"}
            {rounds > 1 && (
              <span className="ml-1.5 text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                {rounds} rounds
              </span>
            )}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium">
              {formatTime(entry.billedAt)}
            </span>
            <span className="text-muted-foreground/40 text-[11px]">·</span>
            <span className="text-[11px] text-muted-foreground font-medium">
              {entry.itemCount} items
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-base font-extrabold text-foreground">
            ₹{entry.total.toLocaleString("en-IN")}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded items */}
      {expanded && (
        <div className="border-t border-border px-4 pb-3 pt-2 space-y-1.5">
          {items.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <span className="text-foreground flex-1 pr-2 leading-snug">{item.name}</span>
              <span className="text-muted-foreground font-medium w-8 text-center">×{item.quantity}</span>
              <span className="text-foreground font-semibold w-14 text-right">
                ₹{(item.price * item.quantity).toLocaleString("en-IN")}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</span>
            <span className="font-extrabold text-primary">₹{entry.total.toLocaleString("en-IN")}</span>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReprint();
            }}
            className="mt-3 w-full py-2.5 bg-primary/10 text-primary font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Printer className="w-4 h-4" />
            Reprint Bill
          </button>
        </div>
      )}
    </div>
  );
}

export default function BillHistoryView({ onBack }: BillHistoryViewProps) {
  const [entries, setEntries] = useState<BillHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [reprintReceipt, setReprintReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    const unsub = subscribeBillHistory((data) => {
      setEntries(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleReprint = (entry: BillHistoryEntry) => {
    const receipt = generateReceipt(
      entry.orders,
      entry.tableNumber ?? "Takeaway",
      [],
      "COPY"
    );
    // Explicitly use the time the bill was technically cleared, not the current time
    receipt.time = entry.billedAt.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    setReprintReceipt(receipt);
  };

  // Filter by table number or search query
  const filtered = search.trim()
    ? entries.filter((e) => {
        const q = search.toLowerCase();
        const tableLabel = e.isTableBill ? `table ${e.tableNumber}` : "takeaway";
        return tableLabel.includes(q);
      })
    : entries;

  const groups = groupByDay(filtered);

  // Summary stats
  const totalRevenue = filtered.reduce((s, e) => s + e.total, 0);
  const totalBills = filtered.length;

  return (
    <>
      {/* ── Reprint modal overlay ── */}
      {reprintReceipt && (
        <ReceiptPreview
          receiptData={reprintReceipt}
          onClose={() => setReprintReceipt(null)}
          // onClear is omitted because this is a reprint — the table is already cleared
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
              Last 30 Days
            </p>
            <h1 className="text-xl font-extrabold text-foreground leading-tight">
              Bill History
            </h1>
          </div>
          {/* Revenue summary */}
          {!loading && (
            <div className="flex flex-col items-end">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">
                Revenue
              </p>
              <p className="text-base font-extrabold text-primary leading-none">
                ₹{totalRevenue.toLocaleString("en-IN")}
              </p>
            </div>
          )}
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5 mt-3">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by table or takeaway…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-medium"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 pb-24 space-y-5">
        {/* Summary chips */}
        {!loading && filtered.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold">
              <IndianRupee className="w-3 h-3" />
              ₹{totalRevenue.toLocaleString("en-IN")} total
            </div>
            <div className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-1.5 rounded-full text-xs font-bold">
              {totalBills} {totalBills === 1 ? "bill" : "bills"}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl h-16 animate-pulse" />
            ))}
          </div>
        )}

        {/* No results */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-2">
              <IndianRupee className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-foreground font-bold text-base">No bills found</p>
            <p className="text-muted-foreground text-sm">
              {search ? "Try a different search term." : "No bills have been generated in the last 30 days."}
            </p>
          </div>
        )}

        {/* Groups by day */}
        {!loading &&
          groups.map(({ label, entries: dayEntries }) => (
            <section key={label}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
                  {label}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] font-bold text-muted-foreground">
                  ₹{dayEntries.reduce((s, e) => s + e.total, 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="space-y-2.5">
                {dayEntries.map((entry) => (
                  <BillCard
                    key={entry.key}
                    entry={entry}
                    onReprint={() => handleReprint(entry)}
                  />
                ))}
              </div>
            </section>
          ))}
      </main>
    </div>
    </>
  );
}
