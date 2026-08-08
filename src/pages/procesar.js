// Endpoint legacy deshabilitado. El checkout vigente de Famores envía los
// pedidos directamente a Google Apps Script + WhatsApp (ver src/pages/index.astro);
// este endpoint ya no procesa pedidos ni debe volver a hacerlo.
export const prerender = false;

export async function POST() {
    return new Response(
        JSON.stringify({
            success: false,
            error: "Este endpoint de pedidos está deshabilitado. Utiliza el checkout vigente de Famores.",
        }),
        {
            status: 410,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store",
            },
        },
    );
}
