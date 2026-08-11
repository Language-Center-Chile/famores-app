import type { APIRoute } from "astro";
import { getFlowPaymentStatus } from "../../../lib/flow";

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();
    const token = String(form.get("token") || "").trim();
    if (!token) return new Response("missing token", { status: 400 });

    const payment = await getFlowPaymentStatus(token);

    // Flow define: 1 pendiente, 2 pagada, 3 rechazada, 4 anulada.
    // No persistimos secretos ni datos de tarjeta; dejamos una traza mínima
    // para observabilidad hasta conectar un almacenamiento de órdenes.
    console.info("[Flow confirmation]", {
      commerceOrder: payment?.commerceOrder,
      flowOrder: payment?.flowOrder,
      status: payment?.status,
      amount: payment?.amount,
    });

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[Flow confirmation]", error instanceof Error ? error.message : error);
    return new Response("verification error", { status: 500 });
  }
};
