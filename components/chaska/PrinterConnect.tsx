"use client";

/**
 * components/chaska/PrinterConnect.tsx
 *
 * A small sheet that lets the billing user pick which Bluetooth device to
 * use as the printer. The selected device's MAC address is stored in
 * localStorage so they don't have to reconnect every session.
 */

import { useEffect, useState } from "react";
import { Bluetooth, CheckCircle2, RefreshCw, X } from "lucide-react";
import { getPairedDevices, isAndroid } from "@/lib/printer";
import type { BluetoothDevice } from "@/lib/printer";
import { cn } from "@/lib/utils";

interface PrinterConnectProps {
  /** Currently selected printer MAC address */
  selectedAddress: string | null;
  onSelect: (address: string, name: string) => void;
  onClose: () => void;
}

const STORAGE_KEY = "chaska_printer_address";
const STORAGE_NAME_KEY = "chaska_printer_name";

/** Read stored printer from localStorage */
export function getSavedPrinter(): { address: string; name: string } | null {
  if (typeof window === "undefined") return null;
  const address = localStorage.getItem(STORAGE_KEY);
  const name = localStorage.getItem(STORAGE_NAME_KEY);
  if (address && name) return { address, name };
  return null;
}

/** Save selected printer to localStorage */
export function savePrinter(address: string, name: string) {
  localStorage.setItem(STORAGE_KEY, address);
  localStorage.setItem(STORAGE_NAME_KEY, name);
}

export default function PrinterConnect({
  selectedAddress,
  onSelect,
  onClose,
}: PrinterConnectProps) {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getPairedDevices();
      setDevices(list);
      if (list.length === 0) {
        if (!isAndroid()) {
          setError("Running in browser — Bluetooth printing only works on the Android APK.");
        } else {
          setError("No paired devices found. Pair the printer via Android Settings → Bluetooth first, then come back.");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to get devices";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center p-4">
      <div className="w-full max-w-sm bg-card rounded-3xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Bluetooth className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <p className="font-extrabold text-foreground">Select Printer</p>
            <p className="text-xs text-muted-foreground">Paired Bluetooth devices</p>
          </div>
          <button
            onClick={loadDevices}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground active:scale-90 transition-transform"
            aria-label="Refresh devices"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground active:scale-90 transition-transform"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Device list */}
        <div className="px-4 py-3 space-y-2 max-h-64 overflow-y-auto">
          {loading && (
            <div className="py-6 text-center text-muted-foreground text-sm">
              Scanning…
            </div>
          )}

          {!loading && error && (
            <div className="py-4 text-center text-sm text-muted-foreground px-2">
              {error}
            </div>
          )}

          {!loading && !error && devices.map((device) => {
            const isSelected = device.address === selectedAddress;
            return (
              <button
                key={device.address}
                onClick={() => {
                  onSelect(device.address, device.name);
                  savePrinter(device.address, device.name);
                  onClose();
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all active:scale-95",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background"
                )}
              >
                <Bluetooth className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 text-left">
                  <p className="font-bold text-foreground text-sm">{device.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{device.address}</p>
                </div>
                {isSelected && (
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tip */}
        <div className="px-5 pb-5 pt-2">
          <p className="text-xs text-muted-foreground text-center">
            Don&apos;t see the printer? Pair it in{" "}
            <span className="font-semibold">Android Settings → Bluetooth</span>{" "}
            first, then tap refresh ↻
          </p>
        </div>
      </div>
    </div>
  );
}
