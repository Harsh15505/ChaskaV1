"use client";

/**
 * components/chaska/ReceiptPreview.tsx
 *
 * A full-screen receipt card that shows:
 *  - Store name, time, table number
 *  - All items with quantity and price
 *  - Grand total
 *  - UPI QR code for payment
 *  - Clear Table button
 */

import { QRCodeSVG } from "qrcode.react";
import { X } from "lucide-react";
import { ReceiptData } from "@/lib/receipt";

interface ReceiptPreviewProps {
  receiptData: ReceiptData;
  /** Close the receipt view WITHOUT clearing the table */
  onClose: () => void;
  /** Clear the table and mark all orders as billed */
  onClear: () => void;
  clearing: boolean;
}

export default function ReceiptPreview({
  receiptData,
  onClose,
  onClear,
  clearing,
}: ReceiptPreviewProps) {
  const { tableNumber, items, totalAmount, time, upiString } = receiptData;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
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
            CHASKA
          </p>
          <p className="text-2xl font-extrabold">Table {tableNumber}</p>
          <p className="text-xs opacity-60 mt-1">{time}</p>
        </div>

        {/* ── Item List ── */}
        <div className="px-5 py-4 space-y-2 max-h-52 overflow-y-auto">
          {/* Column headers */}
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

        {/* ── Total ── */}
        <div className="mx-5 border-t-2 border-dashed border-border pt-3 pb-3 flex items-center justify-between">
          <span className="text-muted-foreground font-semibold text-sm">
            Grand Total
          </span>
          <span className="text-foreground font-extrabold text-2xl">
            ₹{totalAmount}
          </span>
        </div>

        {/* ── QR Code ── */}
        <div className="flex flex-col items-center pb-4 gap-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Scan to Pay via UPI
          </p>
          <div className="bg-white p-3 rounded-2xl shadow-md">
            <QRCodeSVG
              value={upiString}
              size={148}
              bgColor="#ffffff"
              fgColor="#1a1a1a"
              level="M"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Amount: ₹{totalAmount}
          </p>
        </div>

        {/* ── Actions ── */}
        <div className="px-5 pb-6 space-y-2">
          <button
            onClick={onClear}
            disabled={clearing}
            className="w-full py-4 bg-secondary text-secondary-foreground rounded-2xl font-extrabold text-base active:scale-95 transition-transform shadow-lg disabled:opacity-60"
          >
            {clearing ? "Clearing table…" : `✓ Done — Clear Table ${tableNumber}`}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 text-muted-foreground text-sm font-semibold active:opacity-60 transition-opacity"
          >
            Back to Edit
          </button>
        </div>
      </div>
    </div>
  );
}
