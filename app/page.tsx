"use client";

import { useState, useEffect } from "react";
import { AppRole } from "@/lib/chaska-data";
import { useTables } from "@/hooks/useTables";
import { useOrders } from "@/hooks/useOrders";
import RoleSelect from "@/components/chaska/role-select";
import TableDashboard from "@/components/chaska/table-dashboard";
import OrderScreen from "@/components/chaska/order-screen";
import KitchenScreen from "@/components/chaska/kitchen-screen";
import BillingScreen from "@/components/chaska/billing-screen";
import BottomNav, { AppView } from "@/components/chaska/bottom-nav";
import { seedTablesIfEmpty } from "@/services/tables";

const ROLE_KEY = "chaska_role";

export default function Page() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("tables");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const { tables, loading: tablesLoading } = useTables();
  const { orders, loading: ordersLoading } = useOrders();

  // ── On mount: restore role from localStorage ────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(ROLE_KEY) as AppRole | null;
    if (saved) setRole(saved);
    setRoleLoaded(true);
  }, []);

  // ── On first load with tables present: seed if empty ───────────────────────
  useEffect(() => {
    if (!tablesLoading && tables.length === 0) {
      seedTablesIfEmpty(8).catch(console.error);
    }
  }, [tablesLoading, tables.length]);

  // ── Handle role selection ───────────────────────────────────────────────────
  const handleSelectRole = (selectedRole: AppRole) => {
    setRole(selectedRole);
    localStorage.setItem(ROLE_KEY, selectedRole);

    // Jump to the correct default view per role
    if (selectedRole === "kitchen") setActiveView("kitchen");
    else if (selectedRole === "billing") setActiveView("billing");
    else setActiveView("tables");
  };

  // ── Loading: wait for localStorage read before rendering ───────────────────
  if (!roleLoaded) return null;

  // ── Role selection screen ───────────────────────────────────────────────────
  if (!role) {
    return <RoleSelect onSelectRole={handleSelectRole} />;
  }

  // ── Order screen overlay (waiter taps a table) ─────────────────────────────
  if (selectedTableId && activeView === "tables") {
    const table = tables.find((t) => t.id === selectedTableId);
    return (
      <OrderScreen
        tableId={selectedTableId}
        tableNumber={table?.tableNumber ?? 0}
        existingOrderId={table?.currentOrderId ?? null}
        onBack={() => setSelectedTableId(null)}
      />
    );
  }

  const activeOrderCount = orders.filter(
    (o) => o.status === "pending" || o.status === "preparing"
  ).length;

  return (
    <div className="pb-16">
      {activeView === "tables" && (
        <TableDashboard
          tables={tables}
          loading={tablesLoading}
          onSelectTable={(id) => setSelectedTableId(id)}
        />
      )}

      {activeView === "kitchen" && (
        <KitchenScreen orders={orders} loading={ordersLoading} />
      )}

      {activeView === "billing" && (
        <BillingScreen
          tables={tables}
          orders={orders}
          loading={tablesLoading || ordersLoading}
          onBack={() => setActiveView("tables")}
        />
      )}

      <BottomNav
        activeView={activeView}
        onNavigate={setActiveView}
        role={role}
        onChangeRole={() => {
          setRole(null);
          localStorage.removeItem(ROLE_KEY);
        }}
        kitchenOrderCount={activeOrderCount}
      />
    </div>
  );
}
