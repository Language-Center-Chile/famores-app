import type { APIRoute } from 'astro';
import { redirectTo, sameOrigin } from '../../../lib/account';
import { commerceEnabled, consumeAttempt, submitApplication } from '../../../lib/commerce';
import { dispatchNotifications } from '../../../lib/notifications';
export const POST: APIRoute = async ({request}) => {
  if (!sameOrigin(request)) return new Response('Origen no permitido',{status:403});
  if (!commerceEnabled()) return new Response('Formulario no configurado',{status:503});
  try {
    const form = await request.formData();
    if (form.get('website')) return redirectTo(request,'/alianzas?ok=1');
    const details = Object.fromEntries(['name','email','phone','city','business','social','mode','quantity'].map(key=>[key,String(form.get(key)||'').trim().slice(0,300)]));
    if (!details.name || !details.phone || !details.city || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email) || !['mayorista','consignacion','comision'].includes(details.mode) || form.get('consent') !== 'yes') return new Response('Completa los datos obligatorios y autoriza el contacto.',{status:400});
    if (!consumeAttempt(`apply:${details.email.toLowerCase()}`,3,24*60*60*1000) || !consumeAttempt('apply:global',100,60*60*1000)) return new Response('Demasiadas solicitudes. Intenta más tarde.',{status:429});
    submitApplication(details);
    try { await dispatchNotifications(); } catch { /* Persisted for retry. */ }
    return redirectTo(request,'/alianzas?ok=1');
  } catch { return new Response('No pudimos registrar la solicitud. Intenta más tarde.',{status:503}); }
};
