"use client";

import { cn } from "@/lib/utils";
import { LayoutGrid, ChefHat, Receipt } from "lucide-react";

export type AppView = "tables" | "kitchen" | "billing";

interface BottomNavProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  kitchenOrderCount: number;
}

const NAV_ITEMS: {
  id: AppView;
  label: string;
  Icon: React.ElementType;
}[] = [
  { id: "tables", label: "Tables", Icon: LayoutGrid },
  { id: "kitchen", label: "Kitchen", Icon: ChefHat },
  { id: "billing", label: "Billing", Icon: Receipt },
];

export default function BottomNav({
  activeView,
  onNavigate,
  kitchenOrderCount,
}: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 bg-card border-t border-border shadow-2xl"
      aria-label="Main navigation"
    >
      <div className="flex">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-3 relative",
                "active:scale-95 transition-all duration-150",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {id === "kitchen" && kitchenOrderCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-status-billing text-foreground text-[10px] font-extrabold rounded-full flex items-center justify-center">
                    {kitchenOrderCount}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
