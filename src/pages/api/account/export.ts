import type { APIRoute } from 'astro';
import { sessionAccount, SESSION_COOKIE, privateHeaders } from '../../../lib/account';
import { customerData } from '../../../lib/customer';
export const GET: APIRoute = async ({cookies})=>{
  try{const account=sessionAccount(cookies.get(SESSION_COOKIE)?.value);if(account?.role!=='customer')return new Response('Sin permiso',{status:403});
    return Response.json(customerData(account),{headers:{...privateHeaders,'Content-Disposition':'attachment; filename="mis-datos-famores.json"'}});
  }catch{return new Response('No fue posible exportar los datos.',{status:503,headers:privateHeaders});}
};
