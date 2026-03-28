"use client";

import { AppRole } from "@/lib/chaska-data";
import { cn } from "@/lib/utils";
import { LayoutGrid, ChefHat, Receipt, RefreshCcw } from "lucide-react";

export type AppView = "tables" | "kitchen" | "billing";

interface BottomNavProps {
  activeView: AppView;
  role: AppRole;
  onNavigate: (view: AppView) => void;
  onChangeRole: () => void;
  kitchenOrderCount: number;
}

const ALL_NAV_ITEMS: {
  id: AppView;
  label: string;
  Icon: React.ElementType;
  roles: AppRole[]; // which roles can see this tab
}[] = [
  { id: "tables",  label: "Tables",  Icon: LayoutGrid, roles: ["waiter", "billing"] },
  { id: "kitchen", label: "Kitchen", Icon: ChefHat,    roles: ["kitchen"] },
  { id: "billing", label: "Billing", Icon: Receipt,    roles: ["billing"] },
];

export default function BottomNav({
  activeView,
  role,
  onNavigate,
  onChangeRole,
  kitchenOrderCount,
}: BottomNavProps) {
  const visibleItems = ALL_NAV_ITEMS.filter((item) =>
    item.roles.includes(role)
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 bg-card border-t border-border shadow-2xl"
      aria-label="Main navigation"
    >
      <div className="flex">
        {/* Role change button — always on the left */}
        <button
          onClick={onChangeRole}
          className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-muted-foreground active:scale-95 transition-all duration-150"
          aria-label="Change role"
          title="Change role"
        >
          <RefreshCcw className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wide capitalize">
            {role}
          </span>
        </button>

        {/* Divider */}
        <div className="w-px bg-border my-2" />

        {/* Visible tabs */}
        {visibleItems.map(({ id, label, Icon }) => {
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
