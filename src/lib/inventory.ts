// Local-only inventory store (manual entry, not linked to products/orders yet).
export type InventoryItem = {
  id: string;
  name: string;
  sku?: string;
  unit: string; // kg, g, L, pcs, etc.
  quantity: number;
  unitCost: number; // cost per unit (CAD)
  reorderLevel?: number;
  supplier?: string;
  updatedAt: string;
};

const KEY = "fg_inventory_v1";

export function loadInventory(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as InventoryItem[];
  } catch {
    return [];
  }
}

export function saveInventory(items: InventoryItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function upsertItem(item: InventoryItem) {
  const items = loadInventory();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) items[idx] = item;
  else items.push(item);
  saveInventory(items);
}

export function deleteItem(id: string) {
  saveInventory(loadInventory().filter((i) => i.id !== id));
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}
