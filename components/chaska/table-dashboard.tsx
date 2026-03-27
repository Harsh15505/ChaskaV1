"use client";

import { TableData, TableStatus } from "@/lib/chaska-data";
import { cn } from "@/lib/utils";

interface TableDashboardProps {
  tables: TableData[];
  onSelectTable: (tableId: number) => void;
}

const STATUS_CONFIG: Record<
  TableStatus,
  { label: string; dot: string; card: string; text: string }
> = {
  free: {
    label: "Free",
    dot: "bg-status-free",
    card: "border-status-free/30 hover:border-status-free",
    text: "text-status-free",
  },
  active: {
    label: "Active",
    dot: "bg-status-active",
    card: "border-status-active/30 hover:border-status-active",
    text: "text-status-active",
  },
  billing: {
    label: "Bill Pending",
    dot: "bg-status-billing",
    card: "border-status-billing/30 hover:border-status-billing",
    text: "text-status-billing",
  },
};

export default function TableDashboard({
  tables,
  onSelectTable,
}: TableDashboardProps) {
  const freeTables = tables.filter((t) => t.status === "free").length;
  const activeTables = tables.filter((t) => t.status === "active").length;
  const billingTables = tables.filter((t) => t.status === "billing").length;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-primary uppercase">
              CHASKA
            </p>
            <h1 className="text-xl font-extrabold text-foreground leading-tight">
              Order Panel
            </h1>
          </div>
          <div className="flex gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-status-free inline-block" />
              <span className="text-muted-foreground">{freeTables} Free</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-status-active inline-block" />
              <span className="text-muted-foreground">{activeTables} Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-status-billing inline-block" />
              <span className="text-muted-foreground">{billingTables} Bill</span>
            </div>
          </div>
        </div>
      </header>

      {/* Table Grid */}
      <main className="flex-1 p-4">
        <div className="grid grid-cols-3 gap-3">
          {tables.map((table) => {
            const config = STATUS_CONFIG[table.status];
            return (
              <button
                key={table.id}
                onClick={() => onSelectTable(table.id)}
                className={cn(
                  "relative flex flex-col items-center justify-center",
                  "bg-card border-2 rounded-2xl py-6 gap-2",
                  "active:scale-95 transition-all duration-150",
                  "shadow-md",
                  config.card
                )}
                aria-label={`Table ${table.id} — ${config.label}`}
              >
                <span className="text-3xl font-extrabold text-foreground">
                  {table.id}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider",
                    config.text
                  )}
                >
                  {config.label}
                </span>
                <span
                  className={cn(
                    "absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full",
                    config.dot
                  )}
                />
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
