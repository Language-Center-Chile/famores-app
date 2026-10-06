import type { APIRoute } from 'astro';
import { sameOrigin, redirectTo } from '../../../lib/account';
import { consumeAttempt } from '../../../lib/commerce';
import { requestPasswordReset, dispatchAccountMail } from '../../../lib/customer';
export const POST: APIRoute = async ({request})=>{
  if(!sameOrigin(request))return new Response('Origen no permitido',{status:403});
  try{const form=await request.formData();const email=String(form.get('email')||'').trim().toLowerCase().slice(0,160);
    if(!consumeAttempt(`recover:${email}`,3,60*60*1000)||!consumeAttempt('recover:global',50,60*60*1000))return new Response('Intenta más tarde.',{status:429});
    requestPasswordReset(email);try{await dispatchAccountMail();}catch{}return redirectTo(request,'/recuperar?sent=1');
  }catch{return new Response('Recuperación no disponible. Contacta a Famores.',{status:503});}
};
