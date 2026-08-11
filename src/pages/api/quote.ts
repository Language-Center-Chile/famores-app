import type { APIRoute } from "astro";
import { calculateOrder } from "../../lib/checkout-config";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const result = calculateOrder({
      product: String(body.product || "").trim(),
      pet: body.pet ? String(body.pet).trim() : null,
      courier: String(body.courier || "").trim(),
      region: String(body.region || "").trim(),
      commune: String(body.commune || "").trim(),
    });

    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible calcular el pedido.";
    return Response.json({ error: message }, { status: 400 });
  }
};
