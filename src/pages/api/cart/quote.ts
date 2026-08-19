import type { APIRoute } from "astro";
import { calculateCartOrder } from "../../../lib/cart";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const result = calculateCartOrder({
      items: Array.isArray(body.items) ? body.items : [],
      courier: String(body.courier || "").trim(),
      region: String(body.region || "").trim(),
      commune: String(body.commune || "").trim(),
    });

    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible calcular el carrito.";
    return Response.json({ error: message }, { status: 400 });
  }
};
