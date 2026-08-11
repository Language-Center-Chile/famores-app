import type { APIRoute } from "astro";
import {
  BOX_PRICE,
  COURIER_LABELS,
  PRODUCTS,
  PETS,
  RM_COMMUNE_ZONES,
  SHIPPING_RATES,
} from "../../lib/checkout-config";

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      boxPrice: BOX_PRICE,
      products: PRODUCTS,
      pets: PETS,
      courierLabels: COURIER_LABELS,
      rmCommuneZones: RM_COMMUNE_ZONES,
      shippingRates: SHIPPING_RATES,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
};
