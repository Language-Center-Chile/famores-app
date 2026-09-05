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
    const lastName = clean(body.lastName, 120);
    const courier = clean(body.courier, 30);
    const region = clean(body.region);
    const commune = clean(body.commune);
    const deliveryAddress = clean(body.deliveryAddress, 220);
    const branchName = clean(body.branchName, 220);

    if (!name) {
      return Response.json({ error: "Nombre no válido." }, { status: 400 });
    }
    if (!lastName) {
      return Response.json({ error: "Apellido no válido." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Correo de pago no válido." }, { status: 400 });
    }
    if (courier === "blue" && !deliveryAddress) {
      return Response.json({ error: "Debes ingresar la dirección de entrega." }, { status: 400 });
    }
    if ((courier === "chilexpress" || courier === "starken") && !branchName) {
      return Response.json({ error: "Debes indicar la sucursal de destino." }, { status: 400 });
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

    const deliveryMethod = courier === "retiro"
      ? "Retiro presencial en local"
      : courier === "blue"
        ? "Envío a domicilio"
        : courier === "chilexpress"
          ? "Envío a sucursal Chilexpress"
          : "Envío a sucursal Starken";

    const optional = JSON.stringify({
      items: calculated.items,
      deliveryMethod,
      courier: calculated.courierLabel,
      region: region || undefined,
      commune: commune || undefined,
      deliveryAddress: deliveryAddress || undefined,
      branchName: branchName || undefined,
      pickupAddress: courier === "retiro"
        ? "Avenida Egaña 1638 B, Peñalolén, Santiago (a media cuadra del Metro Grecia)"
        : undefined,
      shipping: calculated.shippingPrice,
      box: calculated.boxPrice,
      subtotal: calculated.subtotal,
      total: calculated.total,
      customer: {
        firstName: name,
        lastName,
        fullName: `${name} ${lastName}`.trim(),
        email,
      },
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
    const status = /no válido|sin tarifa|Destino|Producto|Cantidad|Carrito|Agrega|dirección|sucursal|Nombre|Apellido/.test(message) ? 400 : 502;
    return Response.json({ error: message }, { status });
  }
};
