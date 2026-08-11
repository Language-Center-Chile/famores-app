import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const token = String(form.get("token") || "").trim();

  if (!token) return redirect("/pago/resultado?error=missing-token", 303);
  return redirect(`/pago/resultado?token=${encodeURIComponent(token)}`, 303);
};
