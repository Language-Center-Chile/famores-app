import type { APIRoute } from 'astro';
import { redirectTo, sameOrigin, sessionAccount, SESSION_COOKIE, privateHeaders } from '../../../lib/account';
import { dispatchNotifications } from '../../../lib/notifications';
export const POST: APIRoute = async ({request,cookies}) => {
  if (!sameOrigin(request)) return new Response('Origen no permitido',{status:403});
  try {
    if (sessionAccount(cookies.get(SESSION_COOKIE)?.value)?.role !== 'admin') return new Response('Sin permiso',{status:403});
    await dispatchNotifications();
    return redirectTo(request,'/panel');
  } catch { return new Response('Entrega pendiente; puedes reintentar desde el panel.',{status:503,headers:privateHeaders}); }
};
