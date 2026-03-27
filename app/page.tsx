"use client";

import { useState, useCallback } from "react";
import {
  CartItem,
  INITIAL_TABLES,
  KitchenOrder,
  TableData,
  TableStatus,
} from "@/lib/chaska-data";
import TableDashboard from "@/components/chaska/table-dashboard";
import OrderScreen from "@/components/chaska/order-screen";
import KitchenScreen from "@/components/chaska/kitchen-screen";
import BillingScreen from "@/components/chaska/billing-screen";
import BottomNav, { AppView } from "@/components/chaska/bottom-nav";

const DUMMY_KITCHEN_ORDERS: KitchenOrder[] = [
  {
    id: "demo-1",
    tableId: 2,
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
    items: [
      {
        item: { id: "c1", name: "Manchurian Dry", price: 130, category: "chinese" },
        quantity: 2,
      },
      {
        item: { id: "p1", name: "Paneer Butter Masala", price: 170, category: "punjabi" },
        quantity: 1,
      },
    ],
  },
  {
    id: "demo-2",
    tableId: 7,
    timestamp: new Date(Date.now() - 3 * 60 * 1000),
    items: [
      {
        item: { id: "c3", name: "Hakka Noodles", price: 120, category: "chinese" },
        quantity: 1,
      },
      {
        item: { id: "c4", name: "Veg Fried Rice", price: 120, category: "chinese" },
        quantity: 2,
      },
    ],
  },
];

export default function Page() {
  const [tables, setTables] = useState<TableData[]>(INITIAL_TABLES);
  const [activeView, setActiveView] = useState<AppView>("tables");
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [kitchenOrders, setKitchenOrders] =
    useState<KitchenOrder[]>(DUMMY_KITCHEN_ORDERS);
  const [tableOrders, setTableOrders] = useState<Record<number, CartItem[]>>({});

  const handleSelectTable = useCallback((tableId: number) => {
    setSelectedTable(tableId);
  }, []);

  const handleBackFromOrder = useCallback(() => {
    setSelectedTable(null);
  }, []);

  const handleSendToKitchen = useCallback((order: KitchenOrder) => {
    setKitchenOrders((prev) => [...prev, order]);
    setTables((prev) =>
      prev.map((t) =>
        t.id === order.tableId ? { ...t, status: "active" as TableStatus } : t
      )
    );
    setTableOrders((prev) => ({
      ...prev,
      [order.tableId]: order.items,
    }));
    setSelectedTable(null);
  }, []);

  const handleMarkKitchenDone = useCallback((orderId: string) => {
    setKitchenOrders((prev) => {
      const order = prev.find((o) => o.id === orderId);
      if (order) {
        setTables((t) =>
          t.map((tbl) =>
            tbl.id === order.tableId
              ? { ...tbl, status: "billing" as TableStatus }
              : tbl
          )
        );
      }
      return prev.filter((o) => o.id !== orderId);
    });
  }, []);

  const handleClearTable = useCallback((tableId: number) => {
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId ? { ...t, status: "free" as TableStatus } : t
      )
    );
    setTableOrders((prev) => {
      const updated = { ...prev };
      delete updated[tableId];
      return updated;
    });
  }, []);

  if (selectedTable !== null && activeView === "tables") {
    return (
      <OrderScreen
        tableId={selectedTable}
        onBack={handleBackFromOrder}
        onSendToKitchen={handleSendToKitchen}
        existingCart={tableOrders[selectedTable] ?? []}
      />
    );
  }

  return (
    <div className="pb-16">
      {activeView === "tables" && (
        <TableDashboard tables={tables} onSelectTable={handleSelectTable} />
      )}
      {activeView === "kitchen" && (
        <KitchenScreen
          orders={kitchenOrders}
          onMarkDone={handleMarkKitchenDone}
        />
      )}
      {activeView === "billing" && (
        <BillingScreen
          tables={tables}
          orders={kitchenOrders}
          tableOrders={tableOrders}
          onBack={() => setActiveView("tables")}
          onClearTable={handleClearTable}
        />
      )}
      <BottomNav
        activeView={activeView}
        onNavigate={setActiveView}
        kitchenOrderCount={kitchenOrders.length}
      />
    </div>
  );
}
