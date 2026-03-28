// Shared data and types for the Chaska app

// ─── UI / Menu types ────────────────────────────────────────────────────────

export type TableStatus = "free" | "active" | "billing";
export type OrderStatus = "pending" | "preparing" | "served" | "billed";
export type AppRole = "waiter" | "kitchen" | "billing";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: "chinese" | "punjabi";
}

/** Flat item stored inside a Firestore order document */
export interface OrderItem {
  id: string;       // same as MenuItem.id
  name: string;
  price: number;
  quantity: number;
}

/** CartItem used locally in the order screen before sending to Firestore */
export interface CartItem {
  item: MenuItem;
  quantity: number;
}

// ─── Firestore document shapes ───────────────────────────────────────────────

export interface FirestoreTable {
  id: string;               // Firestore doc id, e.g. "table_1"
  tableNumber: number;
  status: TableStatus;
  currentOrderId: string | null;
}

export interface FirestoreOrder {
  id: string;               // Firestore doc id (auto-generated)
  tableId: string;          // e.g. "table_1"
  items: OrderItem[];
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Static menu data (owner-managed, not in Firestore) ──────────────────────

export const MENU_ITEMS: MenuItem[] = [
  // Chinese
  { id: "c1", name: "Manchurian Dry",      price: 130, category: "chinese" },
  { id: "c2", name: "Paneer Chilli",        price: 180, category: "chinese" },
  { id: "c3", name: "Hakka Noodles",        price: 120, category: "chinese" },
  { id: "c4", name: "Veg Fried Rice",       price: 120, category: "chinese" },
  { id: "c5", name: "Manchurian Noodles",   price: 130, category: "chinese" },
  // Punjabi
  { id: "p1", name: "Paneer Butter Masala", price: 170, category: "punjabi" },
  { id: "p2", name: "Paneer Tikka Masala",  price: 180, category: "punjabi" },
  { id: "p3", name: "Paneer Handi",         price: 170, category: "punjabi" },
  { id: "p4", name: "Veg Kolhapuri",        price: 130, category: "punjabi" },
  { id: "p5", name: "Dal Khichdi",          price: 150, category: "punjabi" },
];

