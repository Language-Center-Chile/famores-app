import type { APIRoute } from "astro";
import crypto from "node:crypto";
import { quote, reserveOrder, commerceEnabled, db, consumeAttempt } from "../../../lib/commerce";
import { sessionAccount, SESSION_COOKIE, sameOrigin } from "../../../lib/account";
import { saveCustomerProfile } from "../../../lib/customer";
import { flowPost } from "../../../lib/flow";

function clean(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const email = clean(body.email).toLowerCase();
    const account = commerceEnabled() ? sessionAccount(cookies?.get(SESSION_COOKIE)?.value) : null;
    const buyer = account?.role === 'customer' ? account : null;
    if (buyer && !sameOrigin(request)) return Response.json({error:'Origen no permitido.'},{status:403});
    if (buyer && email !== buyer.email) return Response.json({error:'Usa el correo de tu cuenta o cierra sesión para comprar como invitado.'},{status:400});
    if (body.saveDetails === true && !buyer) return Response.json({error:'Inicia sesión como comprador para guardar tus datos.'},{status:400});
    const name = clean(body.name, 120);
    const lastName = clean(body.lastName, 120);
    const customerId = clean(body.customerId, 40);
    const courier = clean(body.courier, 30);
    const region = clean(body.region);
    const commune = clean(body.commune);
    const country = clean(body.country, 120);
    const city = clean(body.city, 120);
    const deliveryAddress = clean(body.deliveryAddress, 220);
    const branchName = clean(body.branchName, 220);

    if (!name) return Response.json({ error: "Nombre no válido." }, { status: 400 });
    if (!lastName) return Response.json({ error: "Apellido no válido." }, { status: 400 });
    if (!customerId) return Response.json({ error: "RUT/DNI no válido." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Correo de pago no válido." }, { status: 400 });
    }
    if (courier === "blue" && !deliveryAddress) {
      return Response.json({ error: "Debes ingresar la dirección de entrega." }, { status: 400 });
    }
    if ((courier === "chilexpress" || courier === "starken") && !branchName) {
      return Response.json({ error: "Debes indicar la sucursal de destino." }, { status: 400 });
    }
    if (courier === "international" && (!country || !city || !deliveryAddress)) {
      return Response.json({ error: "Debes ingresar país, ciudad y dirección para cotizar el envío internacional." }, { status: 400 });
    }

    if (commerceEnabled() && (!consumeAttempt(`checkout:${email}`, 10, 15*60*1000) || !consumeAttempt('checkout:global', 200, 15*60*1000))) {
      return Response.json({ error: 'Demasiados intentos de pago. Intenta más tarde.' }, { status: 429 });
    }
    const selection = {
      items: Array.isArray(body.items) ? body.items : [],
      courier,
      region,
      commune,
    };

    const commerceOrder = `FAM-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const customer = { name, lastName, customerId, email, phone: clean(body.phone, 60), courier, region, commune, country, city, deliveryAddress, branchName };
    const calculated = commerceEnabled()
      ? reserveOrder(commerceOrder, selection, body.couponCode, customer, buyer?.id || null)
      : quote(selection, body.couponCode);
    if (buyer && body.saveDetails === true) saveCustomerProfile(buyer, customer, true);
    const requestOrigin = new URL(request.url).origin;
    const publicBaseUrl = (process.env.PUBLIC_SITE_URL || requestOrigin).replace(/\/$/, "");
    const itemSummary = calculated.items.map((item) => `${item.quantity}x ${item.product}`).join(", ");

    const payment = await flowPost("/payment/create", {
      commerceOrder,
      subject: `Pedido Famores - ${itemSummary}`.slice(0, 255),
      currency: "CLP",
      amount: calculated.total,
      email,
      urlConfirmation: `${publicBaseUrl}/api/flow/confirmation`,
      urlReturn: `${publicBaseUrl}/api/flow/return`,
    });

    if (!payment?.url || !payment?.token) {
      throw new Error("Flow no devolvió una URL de checkout válida.");
    }

    if (commerceEnabled()) db().prepare('UPDATE orders SET flowOrder=? WHERE id=?').run(String(payment.flowOrder), commerceOrder);
    return Response.json({
      checkoutUrl: `${payment.url}?token=${encodeURIComponent(payment.token)}`,
      commerceOrder,
      flowOrder: payment.flowOrder,
      breakdown: calculated,
    });
  } catch (error) {
    console.error("[Flow create-cart-payment]", error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : "No fue posible crear el pago.";
    const status = /no válido|sin tarifa|Destino|Producto|Cantidad|Carrito|Agrega|dirección|sucursal|Nombre|Apellido|RUT\/DNI|Cupón|país|ciudad|internacional/i.test(message) ? 400 : 502;
    return Response.json({ error: message }, { status });
  }
};
