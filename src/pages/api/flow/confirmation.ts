import type { APIRoute } from "astro";
import { getFlowPaymentStatus } from "../../../lib/flow";

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();
    const token = String(form.get("token") || "").trim();
    if (!token) return new Response("missing token", { status: 400 });

    const payment = await getFlowPaymentStatus(token);
    let orderData: any = {};
    if (payment?.optional) {
      try {
        orderData = typeof payment.optional === "string" ? JSON.parse(payment.optional) : payment.optional;
      } catch {
        orderData = {};
      }
    }

    // Flow define: 1 pendiente, 2 pagada, 3 rechazada, 4 anulada.
    // El detalle operativo queda asociado a la orden de Flow y además registrado
    // en logs del servidor. No se registran datos de tarjeta ni credenciales.
    console.info("[Flow confirmation]", {
      commerceOrder: payment?.commerceOrder,
      flowOrder: payment?.flowOrder,
      status: payment?.status,
      amount: payment?.amount,
      order: {
        items: orderData?.items,
        deliveryMethod: orderData?.deliveryMethod,
        courier: orderData?.courier,
        region: orderData?.region,
        commune: orderData?.commune,
        country: orderData?.country,
        city: orderData?.city,
        deliveryAddress: orderData?.deliveryAddress,
        branchName: orderData?.branchName,
        pickupAddress: orderData?.pickupAddress,
        shipping: orderData?.shipping,
        box: orderData?.box,
        subtotal: orderData?.subtotal,
        totalPaidNow: orderData?.totalPaidNow,
        customer: orderData?.customer,
      },
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[Flow confirmation]", error instanceof Error ? error.message : error);
    return new Response("verification error", { status: 500 });
  }
};