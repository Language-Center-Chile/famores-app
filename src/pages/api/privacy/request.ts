import crypto from 'node:crypto';
import type { APIRoute } from 'astro';
import { sameOrigin, redirectTo } from '../../../lib/account';
import { commerceEnabled, consumeAttempt, db, transaction } from '../../../lib/commerce';
import { PRIVACY_VERSION } from '../../../lib/privacy';
export const POST: APIRoute = async ({request})=>{
  if(!sameOrigin(request))return new Response('Origen no permitido',{status:403});
  if(!commerceEnabled())return new Response('Contacta al correo de privacidad indicado en la política.',{status:503});
  try{const form=await request.formData();const email=String(form.get('email')||'').trim().toLowerCase().slice(0,160);const kind=String(form.get('kind')||'');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['acceso','rectificacion','supresion','oposicion','portabilidad','bloqueo','revocacion'].includes(kind))return new Response('Datos no válidos.',{status:400});
    if(!consumeAttempt(`privacy:${email}`,5,24*60*60*1000)||!consumeAttempt('privacy:global',100,60*60*1000))return new Response('Intenta más tarde o escribe al correo de privacidad.',{status:429});
    const id=crypto.randomUUID();transaction(()=>{
      db().prepare('INSERT INTO privacyRequests(id,createdAt,details) VALUES(?,?,?)').run(id,Date.now(),JSON.stringify({email,kind,message:String(form.get('message')||'').trim().slice(0,1000),version:PRIVACY_VERSION}));
      db().prepare('INSERT INTO notifications(id,type,createdAt,payload) VALUES(?,?,?,?)').run(`privacy:${id}`,'privacy_request',Date.now(),JSON.stringify({requestId:id}));
    });return redirectTo(request,'/privacidad?received=1');
  }catch{return new Response('No pudimos guardar la solicitud. Usa el correo de privacidad.',{status:503});}
};
