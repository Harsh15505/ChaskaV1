// Shared data and types for the Chaska app

// ─── UI / Menu types ────────────────────────────────────────────────────────

export type TableStatus = "free" | "active" | "billing";
export type OrderStatus = "pending" | "preparing" | "served" | "billed";
export type AppRole = "waiter" | "kitchen" | "billing";

export type MenuCategory =
  | "soup"
  | "chinese"
  | "paneer"
  | "veg"
  | "signature"
  | "tandoor"
  | "dal"
  | "accompaniments"
  | "combos";

export interface MenuItemVariant {
  label: string;   // e.g. "Half" | "Full"
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price?: number;              // undefined when item has variants
  category: MenuCategory;
  variants?: MenuItemVariant[]; // present for Half/Full items
}

/** Flat item stored inside a Firestore order document */
export interface OrderItem {
  id: string;       // same as MenuItem.id (or `${id}_${variantLabel}` for variant items)
  name: string;     // includes "(Half)" / "(Full)" suffix for variant items
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
  orderType?: "takeaway";   // present on takeaway orders sent from billing
  createdAt: Date;
  updatedAt: Date;
}

// ─── Static menu data ────────────────────────────────────────────────────────

export const MENU_ITEMS: MenuItem[] = [
  // ── SOUP ──────────────────────────────────────────────────────────────────
  { id: "s1", name: "Hot & Sour Soup",          price: 90,  category: "soup" },

  // ── CHINESE ───────────────────────────────────────────────────────────────
  // items with Half/Full use `variants` — no `price` at top level
  {
    id: "c1", name: "Manchurian Dry", category: "chinese",
    variants: [{ label: "Half", price: 80 }, { label: "Full", price: 130 }],
  },
  { id: "c2", name: "Paneer Chilly Dry",        price: 180, category: "chinese" },
  { id: "c3", name: "Hakka Noodles",            price: 130, category: "chinese" },
  {
    id: "c4", name: "Veg. Fried Rice", category: "chinese",
    variants: [{ label: "Half", price: 80 }, { label: "Full", price: 120 }],
  },
  {
    id: "c5", name: "Manchurian Fried Rice", category: "chinese",
    variants: [{ label: "Half", price: 80 }, { label: "Full", price: 120 }],
  },
  {
    id: "c6", name: "Manchurian Noodles", category: "chinese",
    variants: [{ label: "Half", price: 80 }, { label: "Full", price: 120 }],
  },
  { id: "c7", name: "Schezwan Fried Rice",      price: 130, category: "chinese" },
  { id: "c8", name: "Chinese Bhel",             price: 150, category: "chinese" },

  // ── PANEER MAIN COURSE ────────────────────────────────────────────────────
  { id: "p1", name: "Paneer Butter Masala",     price: 170, category: "paneer" },
  { id: "p2", name: "Paneer Tikka Masala",      price: 180, category: "paneer" },
  { id: "p3", name: "Paneer Handi Masala",      price: 170, category: "paneer" },
  { id: "p4", name: "Paneer Tufani",            price: 170, category: "paneer" },
  { id: "p5", name: "Paneer Bhurji",            price: 180, category: "paneer" },
  { id: "p6", name: "Shahi Paneer",             price: 170, category: "paneer" },
  { id: "p7", name: "Paneer Patiyala",          price: 160, category: "paneer" },
  { id: "p8", name: "Paneer Lasaniya",          price: 190, category: "paneer" },

  // ── VEG. MAIN COURSE ──────────────────────────────────────────────────────
  { id: "v1", name: "Veg. Jaipuri",             price: 150, category: "veg" },
  { id: "v2", name: "Veg. Ahmedabadi",          price: 160, category: "veg" },
  { id: "v3", name: "Veg. Angara",              price: 160, category: "veg" },

  // ── SIGNATURE DISH ────────────────────────────────────────────────────────
  { id: "sg1", name: "Cheese Anguri",           price: 220, category: "signature" },
  { id: "sg2", name: "Paneer Laziz",            price: 190, category: "signature" },
  { id: "sg3", name: "Cheese Paneer Gotado",    price: 230, category: "signature" },
  { id: "sg4", name: "Dal - Khichdi",           price: 160, category: "signature" },

  // ── TANDOOR (per piece) ───────────────────────────────────────────────────
  { id: "t1", name: "Butter Roti",              price: 16,  category: "tandoor" },
  { id: "t2", name: "Plain Roti",               price: 12,  category: "tandoor" },
  { id: "t3", name: "Butter Naan",              price: 25,  category: "tandoor" },
  { id: "t4", name: "Plain Naan",               price: 20,  category: "tandoor" },

  // ── DAL & RICE ────────────────────────────────────────────────────────────
  { id: "d1", name: "Dal Fry",                  price: 110, category: "dal" },
  { id: "d2", name: "Dal Tadka",                price: 130, category: "dal" },
  { id: "d3", name: "Jeera Rice",               price: 90,  category: "dal" },
  { id: "d4", name: "Plain Rice",               price: 80,  category: "dal" },
  { id: "d5", name: "Veg. Pulav",               price: 110, category: "dal" },
  { id: "d6", name: "Veg. Biriyani",            price: 150, category: "dal" },
  { id: "d7", name: "Cheese Pulav",             price: 150, category: "dal" },
  { id: "d8", name: "Paneer Pulav",             price: 130, category: "dal" },

  // ── ACCOMPANIMENTS ────────────────────────────────────────────────────────
  { id: "a1", name: "Mineral Water (Small)",    price: 10,  category: "accompaniments" },
  { id: "a2", name: "Mineral Water (Large)",    price: 20,  category: "accompaniments" },
  { id: "a3", name: "Butter Milk",              price: 20,  category: "accompaniments" },
  { id: "a4", name: "Roasted Papad",            price: 15,  category: "accompaniments" },
  { id: "a5", name: "Fry Papad",                price: 20,  category: "accompaniments" },

  // ── COMBOS ────────────────────────────────────────────────────────────────
  { id: "co1", name: "Paneer Butter Masala + 2 Butter Roti", price: 140, category: "combos" },
  { id: "co2", name: "Cheese Anguri + Butter Naan (2 Pcs.)",  price: 180, category: "combos" },
];
