import { describe, expect, it } from "vitest";
import { calculateCartOrder, normalizeCartItems } from "./cart";

describe("Famores flexible cart", () => {
  it("allows buying only a painted pet", () => {
    const result = calculateCartOrder({ items: [{ product: "Mascota Pintada", quantity: 1 }], courier: "retiro" });
    expect(result.subtotal).toBe(5355);
    expect(result.total).toBe(5355);
  });

  it("allows buying multiple sets and pets", () => {
    const result = calculateCartOrder({
      items: [
        { product: "Set Sin Pintar", quantity: 2 },
        { product: "Mascota Sin Pintar", quantity: 3 },
      ],
      courier: "retiro",
    });
    expect(result.subtotal).toBe(68925);
    expect(result.total).toBe(68925);
  });

  it("adds configured shipping and one box for a domestic courier", () => {
    const result = calculateCartOrder({
      items: [{ product: "Mascota Sin Pintar", quantity: 2 }],
      courier: "blue",
      region: "Metropolitana de Santiago",
      commune: "Peñalolén",
    });
    expect(result.subtotal).toBe(5950);
    expect(result.shippingPrice).toBe(3490);
    expect(result.boxPrice).toBe(1500);
    expect(result.total).toBe(10940);
  });

  it("keeps international shipping pending and charges only products plus box", () => {
    const result = calculateCartOrder({
      items: [{ product: "Mascota Pintada", quantity: 1 }],
      courier: "international",
    });
    expect(result.subtotal).toBe(5355);
    expect(result.shippingPrice).toBe(0);
    expect(result.boxPrice).toBe(1500);
    expect(result.total).toBe(6855);
    expect(result.shippingPending).toBe(true);
  });

  it("aggregates duplicate product lines", () => {
    const items = normalizeCartItems([
      { product: "Set Standard Pintado", quantity: 1 },
      { product: "Set Standard Pintado", quantity: 2 },
    ]);
    expect(items).toEqual([{ product: "Set Standard Pintado", quantity: 3, unitPrice: 48000, lineTotal: 144000 }]);
  });

  it("rejects empty carts", () => {
    expect(() => calculateCartOrder({ items: [], courier: "retiro" })).toThrow("Agrega al menos un producto");
  });
});
