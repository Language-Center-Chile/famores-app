import type { APIRoute } from 'astro';
import { sameOrigin, redirectTo } from '../../../lib/account';
import { consumeAttempt } from '../../../lib/commerce';
import { resetCustomerPassword } from '../../../lib/customer';
export const POST: APIRoute = async ({request})=>{
  if(!sameOrigin(request))return new Response('Origen no permitido',{status:403});
  try{if(!consumeAttempt('reset:global',200,60*60*1000))return new Response('Intenta más tarde.',{status:429});const form=await request.formData();if(!await resetCustomerPassword(String(form.get('token')||''),String(form.get('password')||'')))return new Response('Enlace vencido, no válido o contraseña demasiado corta.',{status:400});return redirectTo(request,'/ingresar?reset=1');}catch{return new Response('No fue posible restablecer el acceso.',{status:503});}
};
