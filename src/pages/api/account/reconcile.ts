import type { APIRoute } from 'astro';
import { redirectTo, sameOrigin, sessionAccount, SESSION_COOKIE, privateHeaders } from '../../../lib/account';
import { db, confirmOrder } from '../../../lib/commerce';
import { flowGet } from '../../../lib/flow';
import { dispatchNotifications } from '../../../lib/notifications';
export const POST: APIRoute = async ({request,cookies}) => {
  if (!sameOrigin(request)) return new Response('Origen no permitido',{status:403});
  try {
    if (sessionAccount(cookies.get(SESSION_COOKIE)?.value)?.role !== 'admin') return new Response('Sin permiso',{status:403});
    const form = await request.formData();
    const id = String(form.get('orderId') || '');
    if (!db().prepare('SELECT id FROM orders WHERE id=?').get(id)) return new Response('Pedido no encontrado',{status:404});
    const payment = await flowGet('/payment/getStatusByCommerceId',{ commerceId:id });
    if (payment.commerceOrder !== id) throw new Error('Orden no coincide.');
    confirmOrder(payment);
    try { await dispatchNotifications(); } catch { /* Durable retry. */ }
    return redirectTo(request,'/panel');
  } catch { return new Response('No fue posible verificar el pedido en Flow. Se conserva su estado anterior.',{status:502,headers:privateHeaders}); }
};
