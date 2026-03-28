"use client";

import { useEffect, useState } from "react";
import { FirestoreTable } from "@/lib/chaska-data";
import { subscribeToTables } from "@/services/tables";

interface UseTablesResult {
  tables: FirestoreTable[];
  loading: boolean;
  error: string | null;
}

export function useTables(): UseTablesResult {
  const [tables, setTables] = useState<FirestoreTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToTables(
      (data) => {
        setTables(data);
        setLoading(false);
        setError(null);
      }
    );

    // Firestore SDK doesn't expose onSnapshot errors via the callback,
    // so we catch init errors here
    return () => unsubscribe();
  }, []);

  return { tables, loading, error };
}
