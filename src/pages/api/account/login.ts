import type { APIRoute } from 'astro';
import { redirectTo, authenticate, createSession, deleteSession, sameOrigin, SESSION_COOKIE, privateHeaders } from '../../../lib/account';
import { commerceEnabled, consumeAttempt } from '../../../lib/commerce';
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!sameOrigin(request)) return new Response('Origen no permitido', {status:403});
  if (!commerceEnabled()) return new Response('Panel no configurado', {status:503});
  try {
    const form = await request.formData();
    const email = String(form.get('email') || '').slice(0,160);
    const password = String(form.get('password') || '');
    if (password.length > 256 || !consumeAttempt(`login:${email.toLowerCase().trim()}`,10,15*60*1000) || !consumeAttempt('login:global',200,15*60*1000)) return new Response('Demasiados intentos. Intenta más tarde.',{status:429,headers:privateHeaders});
    const account = await authenticate(email,password);
    if (!account) return redirectTo(request,'/ingresar?error=1');
    deleteSession(cookies.get(SESSION_COOKIE)?.value);
    cookies.set(SESSION_COOKIE,createSession(account),{httpOnly:true,secure:new URL(process.env.PUBLIC_SITE_URL || request.url).protocol==='https:',sameSite:'strict',path:'/',maxAge:8*60*60});
    return redirectTo(request,'/panel');
  } catch { return new Response('No fue posible iniciar sesión.',{status:503,headers:privateHeaders}); }
};
