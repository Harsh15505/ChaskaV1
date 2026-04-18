"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Printer, Bluetooth, CheckCircle2 } from "lucide-react";
import { ReceiptData, buildUpiString } from "@/lib/receipt";
import { printReceipt, isAndroid } from "@/lib/printer";
import { getSavedPrinter } from "@/components/chaska/PrinterConnect";
import PrinterConnect from "@/components/chaska/PrinterConnect";
import { toast } from "sonner";

interface ReceiptPreviewProps {
  receiptData: ReceiptData;
  onClose: () => void;
  onClear?: () => void;
  clearing?: boolean;
  onRequestBillNumber?: () => Promise<string>;
  onKotPrinted?: () => void;
}

export default function ReceiptPreview({
  receiptData,
  onClose,
  onClear,
  clearing,
  onRequestBillNumber,
  onKotPrinted,
}: ReceiptPreviewProps) {
  const { tableNumber, items, totalAmount, time, upiString, billNumber } = receiptData;

  // ── Printer state ──────────────────────────────────────────────────────────
  const [printerAddress, setPrinterAddress] = useState<string | null>(null);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [isNative, setIsNative] = useState(false);

  // ── Payment modifiers ──────────────────────────────────────────────────────
  const [discount, setDiscount] = useState<number>(0);
  const [cashPaid, setCashPaid] = useState<number>(0);

  const finalTotal = Math.max(0, totalAmount - (discount || 0));
  const upiPending = Math.max(0, finalTotal - (cashPaid || 0));
  const dynamicUpiString = buildUpiString(upiPending);

  // Load saved printer from localStorage on mount and check platform
  useEffect(() => {
    setIsNative(isAndroid());
    const saved = getSavedPrinter();
    if (saved) {
      setPrinterAddress(saved.address);
      setPrinterName(saved.name);
    }
  }, []);

  const handlePrint = async () => {
    if (!printerAddress) {
      setShowConnect(true);
      return;
    }
    setPrinting(true);
    try {
      let printBillNumber = billNumber;
      if (printBillNumber === "PENDING" && onRequestBillNumber) {
        printBillNumber = await onRequestBillNumber();
      }
      
      const printData = { 
        ...receiptData, 
        billNumber: printBillNumber,
        discount: discount || 0,
        cashPaid: cashPaid || 0,
        upiString: dynamicUpiString
      };

      // Print first copy
      await printReceipt(printData, printerAddress);

      if (receiptData.isKot) {
        // KOT: give waiter 5 seconds to tear/cut, then print copy 2
        toast("Copy 1 done — tear now, copy 2 in 5s…", { duration: 5000 });
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await printReceipt(printData, printerAddress);
        toast.success("KOT printed! (2 copies)");
        // ⚠️  Must await — onKotPrinted calls markOrdersKotPrinted (Firestore write).
        // If not awaited and the write fails, the order stays kotPrinted:false
        // and the auto-print hook will immediately re-print it.
        if (onKotPrinted) await onKotPrinted();
      } else {
        toast.success("Receipt printed!");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Print failed";
      toast.error(msg);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <>
      {/* ── Printer selector overlay ─────────────────────────────────────── */}
      {showConnect && (
        <PrinterConnect
          selectedAddress={printerAddress}
          onSelect={(address, name) => {
            setPrinterAddress(address);
            setPrinterName(name);
          }}
          onClose={() => setShowConnect(false)}
        />
      )}

      {/* ── Modal backdrop ── */}
      <div className="fixed inset-0 z-40 bg-black/60 flex items-end justify-center">
        {/* ── Modal sheet — scrollable, capped at 90vh ── */}
        <div className="w-full max-w-sm bg-card rounded-t-3xl shadow-2xl border-t border-border flex flex-col max-h-[90vh]">

          {/* ── Header (sticky, never scrolls away) ── */}
          <div className="relative bg-primary px-6 pt-6 pb-4 text-primary-foreground text-center shrink-0 rounded-t-3xl">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-primary-foreground/20 active:scale-90 transition-transform"
              aria-label="Close receipt"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-xs font-bold tracking-[0.3em] uppercase opacity-70 mb-0.5">
              Chaska Chinese &amp; Punjabi
            </p>
            <p className="text-2xl font-extrabold">Table {tableNumber}</p>
            <p className="text-xs opacity-60 mt-1">{time}</p>
            {!receiptData.isKot && (
              <p className="text-xs font-bold opacity-80 mt-1 tracking-widest">
                Bill #{billNumber}
              </p>
            )}
          </div>

          {/* ── Scrollable body ── */}
          <div className="overflow-y-auto flex-1">

            {/* ── Item List ── */}
            <div className="px-5 py-4 space-y-2">
              <div className="flex text-[11px] font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border">
                <span className="flex-1">Item</span>
                <span className="w-10 text-center">Qty</span>
                <span className="w-16 text-right">Price</span>
              </div>

              {items.map((item) => (
                <div key={item.id} className="flex items-center text-sm">
                  <span className="flex-1 text-foreground font-medium leading-tight pr-2">
                    {item.name}
                  </span>
                  <span className="w-10 text-center text-muted-foreground font-bold">
                    {item.quantity}
                  </span>
                  <span className="w-16 text-right font-semibold text-foreground">
                    ₹{item.total}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Payment Options (hidden for KOT) ── */}
            {!receiptData.isKot && (
              <div className="mx-5 border-t-2 border-dashed border-border pt-4 pb-4 space-y-3">
                {/* Subtotal */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-semibold">Subtotal</span>
                  <span className="text-foreground font-extrabold">₹{totalAmount}</span>
                </div>

                {/* Discount Input */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground font-semibold text-sm shrink-0">Discount (₹)</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={discount || ""}
                    onChange={(e) => setDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-24 bg-muted border border-border rounded-xl px-3 py-2 text-right text-sm font-bold text-destructive outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Cash Paid Input */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground font-semibold text-sm shrink-0">Cash Paid (₹)</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={cashPaid || ""}
                    onChange={(e) => setCashPaid(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-24 bg-muted border border-border rounded-xl px-3 py-2 text-right text-sm font-bold text-emerald-600 outline-none focus:ring-2 focus:ring-secondary"
                  />
                </div>

                {/* Pending UPI */}
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-foreground font-bold text-sm">Pending UPI</span>
                  <span className="text-secondary font-extrabold text-2xl">₹{upiPending}</span>
                </div>
              </div>
            )}

            {/* ── QR Code (hidden for KOT or zero balance) ── */}
            {!receiptData.isKot && upiPending > 0 ? (
              <div className="flex flex-col items-center pb-4 gap-3">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  Scan to Pay via UPI
                </p>
                <div className="bg-white p-3 rounded-2xl shadow-md">
                  <QRCodeSVG
                    value={dynamicUpiString}
                    size={148}
                    bgColor="#ffffff"
                    fgColor="#1a1a1a"
                    level="M"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground font-bold">UPI Amount: ₹{upiPending}</p>
              </div>
            ) : !receiptData.isKot && upiPending === 0 ? (
              <div className="flex flex-col items-center pb-4">
                <div className="bg-emerald-100 text-emerald-800 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Account Settled
                </div>
              </div>
            ) : null}

          </div>{/* end scrollable body */}

          {/* ── Sticky footer: printer + action buttons ── */}
          <div className="shrink-0 border-t border-border bg-card px-5 pt-3 pb-6 space-y-2">
            {/* Printer connection status */}
            {isNative && (
              <button
                onClick={() => setShowConnect(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/50 active:scale-95 transition-transform"
              >
                <Bluetooth className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-foreground flex-1 text-left truncate">
                  {printerName ?? "No printer connected"}
                </span>
                {printerAddress && (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            )}

            {/* Print button — Android only */}
            {isNative && (
              <button
                onClick={handlePrint}
                disabled={printing}
                className="w-full py-3.5 bg-primary text-primary-foreground rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg disabled:opacity-60"
              >
                <Printer className="w-5 h-5" />
                {printing
                  ? "Printing…"
                  : printerAddress
                  ? (receiptData.isKot ? "Print KOT" : "Print Bill")
                  : "Connect & Print"}
              </button>
            )}

            {!receiptData.isKot && onClear && (
              <button
                onClick={onClear}
                disabled={clearing}
                className="w-full py-4 bg-secondary text-secondary-foreground rounded-2xl font-extrabold text-base active:scale-95 transition-transform shadow-lg disabled:opacity-60"
              >
                {clearing ? "Clearing table…" : `✓ Done — Clear Table ${tableNumber}`}
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full py-3 text-muted-foreground text-sm font-semibold active:opacity-60 transition-opacity"
            >
              Back to Edit
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

