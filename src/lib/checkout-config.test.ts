import { describe, it, expect } from "vitest";
import { calculateOrder, getShippingRate, BOX_PRICE, PRODUCTS } from "./checkout-config";

describe("getShippingRate", () => {
  it("returns the RM rate for a known commune/courier combination", () => {
    expect(
      getShippingRate("blue", "Metropolitana de Santiago", "Providencia"),
    ).toBe(4490);
  });

  it("returns the regional flat rate for centro-sur regions", () => {
    expect(getShippingRate("starken", "Biobío", "Concepción")).toBe(7990);
  });

  it("returns null for an unconfigured commune", () => {
    expect(
      getShippingRate("blue", "Metropolitana de Santiago", "Comuna Inexistente"),
    ).toBeNull();
  });

  it("returns null for an unsupported courier", () => {
    expect(getShippingRate("uber", "Biobío", "Concepción")).toBeNull();
  });

  it("returns null for an unmapped region", () => {
    expect(getShippingRate("blue", "Región Inexistente", "Comuna")).toBeNull();
  });
});

describe("calculateOrder", () => {
  it("charges only the product price for in-person pickup, ignoring box/shipping", () => {
    const result = calculateOrder({
      product: "Set Sin Pintar",
      courier: "retiro",
    });
    expect(result.total).toBe(PRODUCTS["Set Sin Pintar"]);
    expect(result.shippingPrice).toBe(0);
    expect(result.boxPrice).toBe(0);
  });

  it("adds product + pet + shipping + box for a domestic courier", () => {
    const result = calculateOrder({
      product: "Set Standard Pintado",
      pet: "Mascota Pintada",
      courier: "chilexpress",
      region: "Metropolitana de Santiago",
      commune: "Ñuñoa",
    });
    const expectedShipping = getShippingRate(
      "chilexpress",
      "Metropolitana de Santiago",
      "Ñuñoa",
    );
    expect(expectedShipping).not.toBeNull();
    expect(result.total).toBe(
      PRODUCTS["Set Standard Pintado"] + 4500 + (expectedShipping ?? 0) + BOX_PRICE,
    );
  });

  it("throws for an unknown product instead of silently charging 0", () => {
    expect(() =>
      calculateOrder({ product: "Set Inventado", courier: "retiro" }),
    ).toThrow("Producto no válido.");
  });

  it("throws for an unknown pet instead of silently charging 0", () => {
    expect(() =>
      calculateOrder({
        product: "Set Sin Pintar",
        pet: "Mascota Inventada",
        courier: "retiro",
      }),
    ).toThrow("Mascota no válida.");
  });

  it("throws when the destination has no configured shipping rate", () => {
    expect(() =>
      calculateOrder({
        product: "Set Sin Pintar",
        courier: "blue",
        region: "Metropolitana de Santiago",
        commune: "Comuna Inexistente",
      }),
    ).toThrow("Destino o courier sin tarifa configurada.");
  });
});
