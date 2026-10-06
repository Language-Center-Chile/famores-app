import type { APIRoute } from 'astro';
import { redirectTo, sameOrigin, sessionAccount, SESSION_COOKIE, privateHeaders } from '../../../lib/account';
import { db, saveCoupon, chileExpiry } from '../../../lib/commerce';
export const POST: APIRoute = async ({request,cookies}) => {
  if (!sameOrigin(request)) return new Response('Origen no permitido',{status:403});
  try {
    const account = sessionAccount(cookies.get(SESSION_COOKIE)?.value);
    if (account?.role !== 'admin') return new Response('Sin permiso',{status:403});
    const form = await request.formData();
    if (form.get('action') === 'disable') db().prepare('UPDATE coupons SET active=0 WHERE code=?').run(String(form.get('code')));
    else saveCoupon({ code:form.get('code'),sellerId:form.get('sellerId'),kind:form.get('kind'),value:form.get('value'),maxUses:form.get('maxUses'),expiresAt:chileExpiry(String(form.get('expiry'))) });
    return redirectTo(request,'/panel?ok=1');
  } catch { return new Response('No fue posible guardar el cupón. Revisa sus condiciones o si el código ya existe.',{status:400,headers:privateHeaders}); }
};
