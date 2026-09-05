import { BOX_PRICE, getShippingRate, COURIER_LABELS, type DomesticCourier } from "./checkout-config";

export const CART_PRODUCTS = {
  "Set Standard Pintado": 39990,
  "Set Standard con Expresiones": 42990,
  "Set Sin Pintar": 25000,
  "Set Personalizado": 45000,
  "Mascota Pintada": 4500,
  "Mascota Sin Pintar": 2500,
} as const;

export type CartProductName = keyof typeof CART_PRODUCTS;

export type CartItemInput = {
  product: string;
  quantity: number;
};

export type CartSelection = {
  items: CartItemInput[];
  courier: string;
  region?: string;
  commune?: string;
};

const MAX_QUANTITY_PER_PRODUCT = 20;

export function normalizeCartItems(items: CartItemInput[]) {
  if (!Array.isArray(items)) throw new Error("Carrito no válido.");
  const aggregated = new Map<CartProductName, number>();
  for (const raw of items) {
    const product = String(raw?.product || "").trim() as CartProductName;
    const quantity = Number(raw?.quantity);
    if (!(product in CART_PRODUCTS)) throw new Error("Producto no válido.");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_PRODUCT) {
      throw new Error(`Cantidad no válida para ${product}.`);
    }
    const next = (aggregated.get(product) || 0) + quantity;
    if (next > MAX_QUANTITY_PER_PRODUCT) throw new Error(`Cantidad máxima excedida para ${product}.`);
    aggregated.set(product, next);
  }
  if (aggregated.size === 0) throw new Error("Agrega al menos un producto al carrito.");
  return Array.from(aggregated.entries()).map(([product, quantity]) => {
    const unitPrice = CART_PRODUCTS[product];
    return { product, quantity, unitPrice, lineTotal: unitPrice * quantity };
  });
}

export function calculateCartOrder(selection: CartSelection) {
  const items = normalizeCartItems(selection.items);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  if (selection.courier === "retiro") {
    return { items, subtotal, shippingPrice: 0, boxPrice: 0, total: subtotal, courierLabel: "Retiro presencial", shippingPending: false };
  }

  if (selection.courier === "international") {
    return {
      items,
      subtotal,
      shippingPrice: 0,
      boxPrice: BOX_PRICE,
      total: subtotal + BOX_PRICE,
      courierLabel: "Envío internacional — por cotizar",
      shippingPending: true,
    };
  }

  const shippingPrice = getShippingRate(selection.courier, selection.region || "", selection.commune || "");
  if (shippingPrice === null) throw new Error("Destino o courier sin tarifa configurada.");
  const courier = selection.courier as DomesticCourier;
  return {
    items,
    subtotal,
    shippingPrice,
    boxPrice: BOX_PRICE,
    total: subtotal + shippingPrice + BOX_PRICE,
    courierLabel: COURIER_LABELS[courier],
    shippingPending: false,
  };
}
