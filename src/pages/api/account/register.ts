import type { APIRoute } from 'astro';
import { sameOrigin, redirectTo, privateHeaders } from '../../../lib/account';
import { consumeAttempt, commerceEnabled } from '../../../lib/commerce';
import { registerCustomer, dispatchAccountMail } from '../../../lib/customer';
export const POST: APIRoute = async ({request})=>{
  if(!sameOrigin(request)) return new Response('Origen no permitido',{status:403});
  if(!commerceEnabled()) return new Response('Registro no disponible',{status:503});
  try {
    const form=await request.formData();const email=String(form.get('email')||'').trim().toLowerCase().slice(0,160);
    if(!consumeAttempt(`register:${email}`,3,60*60*1000)||!consumeAttempt('register:global',50,60*60*1000)) return new Response('Intenta más tarde.',{status:429});
    await registerCustomer({name:String(form.get('name')||''),email,consent:form.get('consent')==='yes'});
    try{await dispatchAccountMail();}catch{/* Durable retry; don't claim delivery. */}
    return redirectTo(request,'/registrarse?sent=1');
  }catch{return new Response('Revisa tu nombre, correo y autorización para crear una cuenta. Si persiste, el registro puede no estar disponible.',{status:400,headers:privateHeaders});}
};
