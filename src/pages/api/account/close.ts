import type { APIRoute } from 'astro';
import { sameOrigin, sessionAccount, authenticate, SESSION_COOKIE, redirectTo } from '../../../lib/account';
import { closeCustomerAccount } from '../../../lib/customer';
import { consumeAttempt } from '../../../lib/commerce';
export const POST: APIRoute = async ({request,cookies})=>{
  if(!sameOrigin(request))return new Response('Origen no permitido',{status:403});
  try{const account=sessionAccount(cookies.get(SESSION_COOKIE)?.value);if(account?.role!=='customer')return new Response('Sin permiso',{status:403});
    if(!consumeAttempt(`close:${account.id}`,5,15*60*1000))return new Response('Intenta más tarde.',{status:429});
    const form=await request.formData();const password=String(form.get('password')||'');
    if(password.length>256||form.get('confirm')!=='yes'||!(await authenticate(account.email,password)))return new Response('Confirma el cierre con tu contraseña.',{status:400});
    closeCustomerAccount(account);cookies.delete(SESSION_COOKIE,{path:'/'});return redirectTo(request,'/ingresar?closed=1');
  }catch{return new Response('No fue posible cerrar la cuenta.',{status:503});}
};
