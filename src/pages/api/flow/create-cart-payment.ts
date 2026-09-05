import type { APIRoute } from "astro";
import crypto from "node:crypto";
import { calculateCartOrder } from "../../../lib/cart";
import { flowPost } from "../../../lib/flow";

function clean(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const email = clean(body.email).toLowerCase();
    const name = clean(body.name, 120);
    const courier = clean(body.courier, 30);
    const region = clean(body.region);
    const commune = clean(body.commune);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Correo de pago no válido." }, { status: 400 });
    }

    const calculated = calculateCartOrder({
      items: Array.isArray(body.items) ? body.items : [],
      courier,
      region,
      commune,
    });

    const commerceOrder = `FAM-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const requestOrigin = new URL(request.url).origin;
    const publicBaseUrl = (process.env.PUBLIC_SITE_URL || requestOrigin).replace(/\/$/, "");
    const itemSummary = calculated.items.map((item) => `${item.quantity}x ${item.product}`).join(", ");

    const optional = JSON.stringify({
      items: calculated.items,
      courier: calculated.courierLabel,
      region: region || undefined,
      commune: commune || undefined,
      shipping: calculated.shippingPrice,
      box: calculated.boxPrice,
      subtotal: calculated.subtotal,
      total: calculated.total,
      customer: name || undefined,
    });

    const payment = await flowPost("/payment/create", {
      commerceOrder,
      subject: `Pedido Famores - ${itemSummary}`.slice(0, 255),
      currency: "CLP",
      amount: calculated.total,
      email,
      urlConfirmation: `${publicBaseUrl}/api/flow/confirmation`,
      urlReturn: `${publicBaseUrl}/api/flow/return`,
      optional,
    });

    if (!payment?.url || !payment?.token) {
      throw new Error("Flow no devolvió una URL de checkout válida.");
    }

    return Response.json({
      checkoutUrl: `${payment.url}?token=${encodeURIComponent(payment.token)}`,
      commerceOrder,
      flowOrder: payment.flowOrder,
      breakdown: calculated,
    });
  } catch (error) {
    console.error("[Flow create-cart-payment]", error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : "No fue posible crear el pago.";
    const status = /no válido|sin tarifa|Destino|Producto|Cantidad|Carrito|Agrega/.test(message) ? 400 : 502;
    return Response.json({ error: message }, { status });
  }
};
