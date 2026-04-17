"use client";

import { useState, useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { AppRole } from "@/lib/chaska-data";
import { useTables } from "@/hooks/useTables";
import { useOrders } from "@/hooks/useOrders";
import RoleSelect from "@/components/chaska/role-select";
import TableDashboard from "@/components/chaska/table-dashboard";
import OrderScreen from "@/components/chaska/order-screen";
import BillingScreen from "@/components/chaska/billing-screen";
import BillHistoryView from "@/components/chaska/BillHistoryView";
import BottomNav, { AppView } from "@/components/chaska/bottom-nav";
import { ensureTablesExist } from "@/services/tables";
import { useKotAutoPrint } from "@/hooks/useKotAutoPrint";

const ROLE_KEY = "chaska_role";
const ROLE_TS_KEY = "chaska_role_ts";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

export default function Page() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("tables");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const { tables, loading: tablesLoading } = useTables();
  const { orders, loading: ordersLoading } = useOrders();

  // ── Auto-KOT Background Printer ─────────────────────────────────────────────
  useKotAutoPrint(role, orders, tables);

  // ── On mount: restore role from localStorage (with expiry check) ────────────
  useEffect(() => {
    const saved = localStorage.getItem(ROLE_KEY) as AppRole | null;
    const savedAt = Number(localStorage.getItem(ROLE_TS_KEY) ?? 0);
    const isExpired = Date.now() - savedAt > SESSION_DURATION_MS;

    if (saved && !isExpired) {
      setRole(saved);
    } else {
      // Clear stale session
      localStorage.removeItem(ROLE_KEY);
      localStorage.removeItem(ROLE_TS_KEY);
    }
    setRoleLoaded(true);
  }, []);

  // ── On first load: ensure all 12 tables exist (never overwrites existing docs) ───
  // IMPORTANT: We use ensureTablesExist (not seedTablesIfEmpty) because it only
  // creates MISSING tables. seedTablesIfEmpty uses setDoc which overwrites existing
  // documents if it ever sees an empty list — causing catastrophic data loss on
  // WebView restarts when Firestore cache hasn't warmed up yet.
  useEffect(() => {
    ensureTablesExist().catch(console.error);
  }, []); // Run once on mount only — stable, no dependency on tables.length

  // ── Native Android Back Button Handler ──────────────────────────────────────
  useEffect(() => {
    const listener = CapacitorApp.addListener("backButton", () => {
      if (selectedTableId) {
        // Return to table dashboard from inside a table order
        setSelectedTableId(null);
      } else if (activeView !== "tables" && role !== "billing") {
        // Return to tables view if we are on billing (but not if our role is exclusively billing)
        setActiveView("tables");
      } else {
        // At root level, exit the app
        CapacitorApp.exitApp();
      }
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [selectedTableId, activeView, role]);

  // ── Handle role selection ───────────────────────────────────────────────────
  const handleSelectRole = (selectedRole: AppRole) => {
    setRole(selectedRole);
    localStorage.setItem(ROLE_KEY, selectedRole);
    localStorage.setItem(ROLE_TS_KEY, String(Date.now()));

    // Jump to the correct default view per role
    if (selectedRole === "billing") setActiveView("billing");
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
        tableNumber={table?.tableNumber ?? ""}
        tableStatus={table?.status ?? "free"}
        existingOrderId={table?.currentOrderId ?? null}
        orders={orders}
        onBack={() => setSelectedTableId(null)}
      />
    );
  }

  return (
    <div className="pb-16">
      {activeView === "tables" && (
        <TableDashboard
          tables={tables}
          loading={tablesLoading}
          onSelectTable={(id) => setSelectedTableId(id)}
        />
      )}

      {activeView === "billing" && (
        <BillingScreen
          tables={tables}
          orders={orders}
          loading={tablesLoading || ordersLoading}
          onBack={() => setActiveView("tables")}
          onViewHistory={() => setActiveView("history")}
        />
      )}

      {activeView === "history" && (
        <BillHistoryView onBack={() => setActiveView("billing")} />
      )}

      <BottomNav
        activeView={activeView}
        onNavigate={setActiveView}
        role={role}
        onChangeRole={() => {
          setRole(null);
          localStorage.removeItem(ROLE_KEY);
          localStorage.removeItem(ROLE_TS_KEY);
        }}
      />
    </div>
  );
}
