import type { APIRoute } from 'astro';
import { sameOrigin, sessionAccount, SESSION_COOKIE, redirectTo, privateHeaders } from '../../../lib/account';
import { saveCustomerProfile } from '../../../lib/customer';
export const POST: APIRoute = async ({request,cookies})=>{
  if(!sameOrigin(request))return new Response('Origen no permitido',{status:403});
  try{const account=sessionAccount(cookies.get(SESSION_COOKIE)?.value);if(account?.role!=='customer')return new Response('Sin permiso',{status:403});
    const form=await request.formData();saveCustomerProfile(account,Object.fromEntries(form.entries()),form.get('saveDetails')==='yes');return redirectTo(request,'/mi-cuenta?ok=1');
  }catch{return new Response('No fue posible guardar tus preferencias.',{status:400,headers:privateHeaders});}
};
