"use client";

import { AppRole } from "@/lib/chaska-data";
import { ChefHat, Receipt, UtensilsCrossed } from "lucide-react";

interface RoleSelectProps {
  onSelectRole: (role: AppRole) => void;
}

const ROLES: {
  id: AppRole;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    id: "waiter",
    label: "Waiter",
    description: "Take orders at tables",
    icon: <UtensilsCrossed className="w-8 h-8" />,
    color: "bg-primary/10 text-primary border-primary/30 hover:border-primary",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    description: "View & manage live orders",
    icon: <ChefHat className="w-8 h-8" />,
    color: "bg-status-active/10 text-status-active border-status-active/30 hover:border-status-active",
  },
  {
    id: "billing",
    label: "Billing",
    description: "Generate bills & clear tables",
    icon: <Receipt className="w-8 h-8" />,
    color: "bg-status-billing/10 text-status-billing border-status-billing/30 hover:border-status-billing",
  },
];

export default function RoleSelect({ onSelectRole }: RoleSelectProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-xs font-bold tracking-[0.3em] text-primary uppercase">
            CHASKA
          </p>
          <h1 className="text-3xl font-extrabold text-foreground">
            Select Your Role
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose how you&apos;ll use this device
          </p>
        </div>

        {/* Role Cards */}
        <div className="space-y-3">
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => onSelectRole(role.id)}
              className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-150 active:scale-95 shadow-md ${role.color}`}
              aria-label={`Select ${role.label} role`}
            >
              <div className="shrink-0">{role.icon}</div>
              <div className="text-left">
                <p className="font-extrabold text-lg leading-tight">
                  {role.label}
                </p>
                <p className="text-sm opacity-70">{role.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
