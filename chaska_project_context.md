# Chaska POS — Full Project Context

## What Is This?

**Chaska** is a restaurant Point-of-Sale (POS) system for **Chaska Chinese & Punjabi** restaurant. It was built as a Capacitor-wrapped Next.js app that runs as a native Android APK on tablets and phones. The backend is Firebase Firestore (real-time, no custom server required). The app is fully offline-capable for UI navigation; only order data sync requires internet.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | Next.js 16 (App Router, Static Export) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Firebase Firestore (Spark free plan) |
| Native App | Capacitor v6 |
| Bluetooth Printing | DantSu ESC/POS Android Library |
| Package Manager | pnpm |
| Git Branch Workflow | `main` is production; `feature/next-updates` is active |

---

## Project Location

```
d:\Chaska\Order-UI\
```

Git remote: `https://github.com/Harsh15505/ChaskaV1.git`

Active branch: `feature/next-updates`

---

## Architecture Overview

```
┌───────────────────────────────────┐
│         Android APK               │
│  (Next.js static export           │
│   wrapped via Capacitor)          │
│                                   │
│  ┌──────────┐  ┌───────────────┐  │
│  │ Waiter   │  │ Billing       │  │
│  │ Phone(s) │  │ Tablet        │  │
│  │          │  │ (near printer)│  │
│  └────┬─────┘  └──────┬────────┘  │
│       │               │           │
└───────┼───────────────┼───────────┘
        │   Firestore   │
        └──────┬────────┘
               │ (WiFi/4G)
        ┌──────▼──────────┐
        │  Firebase        │
        │  Firestore       │  ← Real-time listeners
        └─────────────────┘
               │
        ┌──────▼──────────┐
        │  Bluetooth       │  ← Billing tablet only
        │  Printer         │
        │  (Niyama BT-58   │
        │  58mm Thermal)   │
        └─────────────────┘
```

---

## Roles

The app has two distinct user roles, selected at launch and stored in `localStorage` for 12 hours.

| Role | Access |
|---|---|
| `waiter` | Table dashboard, order entry per table |
| `billing` | Billing screen, generate bills, handle takeaways |

Role selection requires a **4-digit PIN** for the Billing role (`NEXT_PUBLIC_BILLING_PIN=1234` in `.env.local`).

---

## Key Files

```
Order-UI/
├── app/
│   └── page.tsx                  ← Root app, role gating, Android back button, useKotAutoPrint mount
├── components/chaska/
│   ├── order-screen.tsx          ← Waiter order entry UI per table
│   ├── billing-screen.tsx        ← Billing dashboard, generate bill, today's revenue
│   ├── table-dashboard.tsx       ← Grid of all restaurant tables
│   ├── bottom-nav.tsx            ← Navigation between views
│   ├── ReceiptPreview.tsx        ← Bill/KOT preview modal + print button
│   ├── PrinterConnect.tsx        ← Bluetooth device picker (saves to localStorage)
│   └── role-select.tsx           ← Login screen for role selection
├── hooks/
│   ├── useTables.ts              ← Firestore tables real-time listener
│   ├── useOrders.ts              ← Firestore active orders real-time listener
│   └── useKotAutoPrint.ts        ← AUTO-PRINT HOOK (billing device only, see below)
├── services/
│   ├── orders.ts                 ← All Firestore order CRUD + claimKotPrintJob
│   ├── tables.ts                 ← Table status management
│   └── billing-counter.ts        ← Daily sequential bill/KOT number generator
├── lib/
│   ├── firebase.ts               ← Firebase app init
│   ├── receipt.ts                ← Receipt data types + generateReceipt + generateKotData
│   ├── printer.ts                ← printReceipt(), getPairedDevices() calls into native Java
│   └── chaska-data.ts            ← All TypeScript types + full MENU_ITEMS static array
├── android/app/src/main/java/com/chaska/pos/
│   └── PrinterPlugin.java        ← Native Capacitor plugin for Bluetooth ESC/POS printing
├── firestore.indexes.json        ← Composite index definition for status+updatedAt query
└── scripts/
    └── clear-orders.mjs          ← Dev utility to wipe all test orders from Firestore
```

---

## Database Schema (Firestore)

### Collection: `orders`

```typescript
interface FirestoreOrder {
  id: string;               // Firestore auto-ID
  tableId: string;          // e.g. "table_1"
  items: OrderItem[];
  status: "pending" | "preparing" | "served" | "billed";
  kotPrinted?: boolean;     // false = auto-print pending on billing device
  kotPrintLockedAt?: Timestamp; // 20-second distributed lock for multi-device print claiming
  orderType?: "takeaway";   // only on takeaway orders
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  skipKitchen?: boolean;    // true = waiter serves directly, not sent to kitchen
  markedDone?: boolean;     // kitchen marked this item done
  note?: string;            // waiter instruction (e.g. "less spicy")
  servedAmt?: number;
}
```

### Collection: `tables`

```typescript
interface FirestoreTable {
  id: string;               // e.g. "table_1"
  tableNumber: number;      // 1-8
  status: "free" | "active" | "billing";
  currentOrderId: string | null;
}
```

---

## Printer — Native Android (PrinterPlugin.java)

**Printer Model:** Niyama BT-58 (standard 58mm thermal)
**Library:** `com.dantsu.escposprinter`
**Connection:** Bluetooth SPP (Serial Port Profile)

**Printer config used:**
```java
new EscPosPrinter(
  new BluetoothConnection(device),
  203,   // DPI
  48f,   // print width mm
  32     // chars per line
);
```

**Required Android Permissions:**
- `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`

**Key behaviour:**
- Printer must be **paired via Android OS settings** before the app can use it
- Billing phone stores chosen printer MAC address in `localStorage` via `PrinterConnect.tsx`
- Key: `chaska_printer_address` / `chaska_printer_name`

**KOT prints 2 copies with 5-second delay between them** (so the paper can be torn).

---

## Auto-KOT Print System (`hooks/useKotAutoPrint.ts`)

This is the most complex feature. When a waiter taps **"Send to Kitchen"**, the KOT is automatically printed on the billing tablet **without blocking the waiter's screen**.

### Flow:
1. Waiter taps "Send to Kitchen" → `createOrder()` saves to Firestore with `kotPrinted: false`
2. For round 2+ items: `updateOrderItems(..., resetKotPrinted: true)` also sets `kotPrinted: false`
3. The billing tablet runs `useKotAutoPrint` hook (only when `role === "billing"`)
4. A `setInterval` loop runs every **2 seconds**, checking the in-memory queue for unprinted KOTs
5. Before printing, `claimKotPrintJob()` runs a **Firestore transaction** to claim exclusive lock (20-second expiry) — prevents duplicate prints if 2 billing devices are active
6. Prints copy 1 → waits 5 seconds → prints copy 2 → marks `kotPrinted: true` in Firestore
7. On failure (Bluetooth out of range, printer off): lock is released, retried after 2 seconds

### Guards:
- `isPrintingRef` (local lock) → prevents two async print loops overlapping on same device
- `inFlightRef` (Set of order IDs) → prevents same order being queued twice locally
- `claimKotPrintJob()` (Firestore transaction) → prevents two *devices* printing the same KOT

---

## Today's Revenue Feature

Billing screen header shows live revenue for the current **business day** (resets at 12:00 PM, not midnight — accounts for late-night service).

- Implemented via `subscribeTodayRevenue()` in `services/orders.ts`
- Queries: `status == "billed"` AND `updatedAt >= businessDayStart`
- Requires a **Firestore composite index** on (`status` ASC, `updatedAt` ASC) — defined in `firestore.indexes.json`

---

## Android Hardware Back Button

Implemented in `app/page.tsx` using `@capacitor/app`:
- Inside table order → returns to table dashboard
- On billing view → returns to tables view
- At root → exits app

---

## Firebase Config (`.env.local`)

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyD26NixeC2ss9dxbL9iP8j9okd9mgrEvaU
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=chaska-a748b.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=chaska-a748b
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=chaska-a748b.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=351975395237
NEXT_PUBLIC_FIREBASE_APP_ID=1:351975395237:web:afa440f1a75daf74d6624c
NEXT_PUBLIC_UPI_ID=9327104440@okbizaxis
NEXT_PUBLIC_UPI_NAME=Chaska
NEXT_PUBLIC_BILLING_PIN=1234
NEXT_PUBLIC_BUSINESS_NAME=Chaska Chinese and Punjabi
NEXT_PUBLIC_RECEIPT_FOOTER=Thank you for dining with us!
```

---

## Firebase Cost Profile (Spark Free Plan)

Estimated usage for a busy day (~80 orders):
- Reads: ~300-400/day (well under 50,000 free limit)
- Writes: ~200/day (well under 20,000 free limit)
- Data transfer: under 30MB/month total
- Bluetooth printing: 0 internet usage

---

## Build & Sync Commands

```bash
# Development server
pnpm run dev

# Build for Android
pnpm build
npx cap sync android
# Then open Android Studio and Run to build APK

# Git workflow
git checkout feature/next-updates
git add .
git commit -m "feat: description"
git push origin feature/next-updates

# Merge to main when ready
git checkout main
git merge feature/next-updates
git push origin main
```

---

## Known Firestore Index Required

The today's revenue query requires a composite index. It is defined in `firestore.indexes.json` and must be created once in the Firebase Console.

Fields: `orders` collection → `status` (ASC) + `updatedAt` (ASC)

---

## Menu

Static array in `lib/chaska-data.ts` — `MENU_ITEMS`. Categories:
`soup`, `chinese`, `paneer`, `veg`, `signature`, `tandoor`, `dal`, `accompaniments`, `combos`

Some items have `variants` (Half/Full pricing). Some have `skipKitchen: true` (e.g. water, butter milk — waiter serves directly).

---

## What's In Progress / Next Steps

The project is on branch `feature/next-updates`. The following features were recently added and need to be merged to `main` and a new APK built in Android Studio:
1. ✅ Auto-KOT print system (Send to Kitchen triggers print automatically)
2. ✅ Distributed print locking (prevents duplicate prints across multiple billing devices)
3. ✅ Android hardware back button support
4. ✅ Today's Revenue in billing header
5. ✅ Cart item list is now collapsible on order screen
6. ✅ Big TABLE NUMBER at bottom of KOT (not on final bill)
