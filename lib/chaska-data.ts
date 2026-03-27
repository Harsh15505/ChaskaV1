// Shared data and types for the Chaska app

export type TableStatus = "free" | "active" | "billing";

export interface TableData {
  id: number;
  status: TableStatus;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: "chinese" | "punjabi";
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
}

export interface KitchenOrder {
  tableId: number;
  items: CartItem[];
  timestamp: Date;
  id: string;
}

export const MENU_ITEMS: MenuItem[] = [
  // Chinese
  { id: "c1", name: "Manchurian Dry", price: 130, category: "chinese" },
  { id: "c2", name: "Paneer Chilli", price: 180, category: "chinese" },
  { id: "c3", name: "Hakka Noodles", price: 120, category: "chinese" },
  { id: "c4", name: "Veg Fried Rice", price: 120, category: "chinese" },
  { id: "c5", name: "Manchurian Noodles", price: 130, category: "chinese" },
  // Punjabi
  { id: "p1", name: "Paneer Butter Masala", price: 170, category: "punjabi" },
  { id: "p2", name: "Paneer Tikka Masala", price: 180, category: "punjabi" },
  { id: "p3", name: "Paneer Handi", price: 170, category: "punjabi" },
  { id: "p4", name: "Veg Kolhapuri", price: 130, category: "punjabi" },
  { id: "p5", name: "Dal Khichdi", price: 150, category: "punjabi" },
];

export const INITIAL_TABLES: TableData[] = Array.from(
  { length: 12 },
  (_, i) => ({
    id: i + 1,
    status: (["free", "active", "active", "billing", "free", "free", "active", "free", "billing", "free", "active", "free"] as TableStatus[])[i],
  })
);
