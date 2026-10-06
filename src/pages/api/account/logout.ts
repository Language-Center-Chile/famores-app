import type { APIRoute } from 'astro';
import { redirectTo, deleteSession, sameOrigin, SESSION_COOKIE } from '../../../lib/account';
export const POST: APIRoute = async ({ request,cookies }) => {
  if (!sameOrigin(request)) return new Response('Origen no permitido',{status:403});
  deleteSession(cookies.get(SESSION_COOKIE)?.value); cookies.delete(SESSION_COOKIE,{path:'/'});
  return redirectTo(request,'/ingresar');
};
