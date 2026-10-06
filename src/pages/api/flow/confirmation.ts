import type { APIRoute } from "astro";
import { getFlowPaymentStatus } from "../../../lib/flow";
import { commerceEnabled, confirmOrder } from "../../../lib/commerce";
import { dispatchNotifications } from "../../../lib/notifications";
export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();
    const token = String(form.get("token") || "").trim();
    if (!token || token.length > 256) return new Response("missing token", { status: 400 });
    const payment = await getFlowPaymentStatus(token);
    if (commerceEnabled()) {
      confirmOrder(payment);
      try { await dispatchNotifications(); } catch { console.error("[Notifications] Delivery pending; saved in outbox."); }
    }
    console.info("[Flow confirmation]", { commerceOrder:payment?.commerceOrder, status:payment?.status });
    return new Response("OK", { status: 200 });
  } catch {
    console.error("[Flow confirmation] Verification or persistence failed.");
    return new Response("verification error", { status: 500 });
  }
};
