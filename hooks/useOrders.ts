"use client";

import { useEffect, useState } from "react";
import { FirestoreOrder } from "@/lib/chaska-data";
import { subscribeToActiveOrders, subscribeToTableOrder } from "@/services/orders";

// ─── Hook: all active orders (kitchen / billing view) ────────────────────────

interface UseOrdersResult {
  orders: FirestoreOrder[];
  loading: boolean;
  error: string | null;
}

export function useOrders(): UseOrdersResult {
  const [orders, setOrders] = useState<FirestoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToActiveOrders((data) => {
      setOrders(data);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, []);

  return { orders, loading, error };
}

// ─── Hook: single table's active order (order screen) ────────────────────────

interface UseTableOrderResult {
  order: FirestoreOrder | null;
  loading: boolean;
  error: string | null;
}

export function useTableOrder(tableId: string): UseTableOrderResult {
  const [order, setOrder] = useState<FirestoreOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tableId) return;

    const unsubscribe = subscribeToTableOrder(tableId, (data) => {
      setOrder(data);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [tableId]);

  return { order, loading, error };
}
