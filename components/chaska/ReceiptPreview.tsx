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
  onClear: () => void;
  clearing: boolean;
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
      await printReceipt(printData, printerAddress);
      toast.success(receiptData.isKot ? "KOT printed!" : "Receipt printed!");

      if (receiptData.isKot && onKotPrinted) {
        onKotPrinted();
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

      <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card rounded-3xl shadow-2xl border border-border overflow-hidden">

          {/* ── Header ── */}
          <div className="relative bg-primary px-6 pt-6 pb-4 text-primary-foreground text-center">
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
            <p className="text-xs font-bold opacity-80 mt-1 tracking-widest">
              Bill #{billNumber}
            </p>
          </div>

          {/* ── Item List ── */}
          <div className="px-5 py-4 space-y-2 max-h-52 overflow-y-auto">
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
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-semibold text-sm">Discount (₹)</span>
                <input
                  type="number"
                  placeholder="0"
                  value={discount || ""}
                  onChange={(e) => setDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 bg-muted border border-border rounded-lg px-2 py-1 text-right text-sm font-bold text-destructive outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Cash Paid Input */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-semibold text-sm">Cash Paid (₹)</span>
                <input
                  type="number"
                  placeholder="0"
                  value={cashPaid || ""}
                  onChange={(e) => setCashPaid(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 bg-muted border border-border rounded-lg px-2 py-1 text-right text-sm font-bold text-emerald-600 outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>

              {/* Final Totals */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-foreground font-bold text-sm">Pending UPI</span>
                <span className="text-secondary font-extrabold text-2xl">₹{upiPending}</span>
              </div>
            </div>
          )}

          {/* ── QR Code (hidden for KOT or zero balance) ── */}
          {!receiptData.isKot && upiPending > 0 ? (
            <div className="flex flex-col items-center pb-4 gap-2">
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
            <div className="flex flex-col items-center pb-4 gap-2">
               <div className="bg-emerald-100 text-emerald-800 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
                 <CheckCircle2 className="w-5 h-5" /> Account Settled
               </div>
            </div>
          ) : null}

          {/* ── Printer connection status ── */}
          {isNative && (
            <button
              onClick={() => setShowConnect(true)}
              className="mx-5 mb-2 w-auto flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/50 active:scale-95 transition-transform"
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

          {/* ── Actions ── */}
          <div className="px-5 pb-6 space-y-2">
            {/* Print bill — only shown on Android */}
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

            {!receiptData.isKot && (
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
