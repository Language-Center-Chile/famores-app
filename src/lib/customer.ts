import crypto from 'node:crypto';
import { db, transaction, accounts, type Account } from './commerce';
import { passwordHash } from './account';
import { PRIVACY_VERSION, privacySettings } from './privacy';
const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const day = 24*60*60*1000;
function accountSiteUrl() {
  const url = new URL(process.env.PUBLIC_SITE_URL || '');
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Dominio de cuentas no configurado.');
  return url;
}
export function customerRegistrationEnabled() {
  try {
    accountSiteUrl();
    return privacySettings().ready && /^[a-f0-9]{64}$/.test(process.env.FAMORES_MAIL_ENCRYPTION_KEY || '') && new URL(process.env.FAMORES_ACCOUNT_MAIL_WEBHOOK || '').protocol==='https:' && Boolean(process.env.FAMORES_ACCOUNT_MAIL_TOKEN);
  } catch { return false; }
}
function mailKey() {
  if (!/^[a-f0-9]{64}$/.test(process.env.FAMORES_MAIL_ENCRYPTION_KEY || '')) throw new Error('Correo de cuentas no configurado.');
  return Buffer.from(process.env.FAMORES_MAIL_ENCRYPTION_KEY!, 'hex');
}
export function encryptMail(payload: unknown) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm',mailKey(),iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
  return [iv.toString('hex'),cipher.getAuthTag().toString('hex'),encrypted.toString('hex')].join(':');
}
export function decryptMail(value: string) {
  const [iv,tag,data] = value.split(':'); const cipher = crypto.createDecipheriv('aes-256-gcm',mailKey(),Buffer.from(iv,'hex')); cipher.setAuthTag(Buffer.from(tag,'hex'));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data,'hex')),cipher.final()]).toString('utf8'));
}
function queueToken(id: string, email: string, purpose: 'verify' | 'reset') {
  const token=crypto.randomBytes(32).toString('hex');
  const publicUrl=accountSiteUrl();
  db().prepare('DELETE FROM emailTokens WHERE customerId=? AND purpose=?').run(id,purpose);
  db().prepare('DELETE FROM accountMail WHERE customerId=? AND purpose=?').run(id,purpose);
  db().prepare('INSERT INTO emailTokens(tokenHash,customerId,purpose,expiresAt) VALUES(?,?,?,?)').run(digest(token),id,purpose,Date.now()+(purpose==='verify'?day:60*60*1000));
  // Fragment keeps the secret out of request/access logs and Referer headers.
  const url=new URL(purpose==='verify'?'/verificar-correo':'/restablecer',publicUrl);url.hash=token;
  db().prepare('INSERT INTO accountMail(id,customerId,purpose,createdAt,payload) VALUES(?,?,?,?,?)').run(crypto.randomUUID(),id,purpose,Date.now(),encryptMail({type:purpose==='verify'?'verify_customer_email':'reset_customer_password',recipient:email,url:url.href}));
}
export async function registerCustomer(input: {name:string;email:string;consent:boolean}) {
  if (!customerRegistrationEnabled()) throw new Error('Registro no disponible.');
  const name=input.name.trim().slice(0,120); const email=input.email.trim().toLowerCase();
  if (!name || email.length>160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !input.consent) throw new Error('Datos de registro no válidos.');
  const hash=await passwordHash(crypto.randomBytes(32).toString('hex'));
  transaction(()=>{
    if (accounts().some(a=>a.email.toLowerCase()===email)) return;
    const existing=db().prepare('SELECT id,verifiedAt FROM customers WHERE email=?').get(email) as any;
    if(existing){ if(!existing.verifiedAt) queueToken(existing.id,email,'verify');return; }
    const id='buyer-'+crypto.randomUUID();
    db().prepare('INSERT INTO customers(id,email,name,passwordHash,createdAt) VALUES(?,?,?,?,?)').run(id,email,name,hash,Date.now());
    db().prepare('INSERT INTO consents(id,customerId,purpose,granted,version,createdAt) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),id,'customer_account',1,PRIVACY_VERSION,Date.now());
    queueToken(id,email,'verify');
  });
}
export async function verifyCustomer(token: string, password: string) {
  if (!/^[a-f0-9]{64}$/.test(token) || password.length<12 || password.length>256) return false;
  if (!db().prepare('SELECT customerId FROM emailTokens WHERE tokenHash=? AND purpose=? AND expiresAt>?').get(digest(token),'verify',Date.now())) return false;
  const hash=await passwordHash(password);
  return transaction(()=>{
    const row=db().prepare('SELECT customerId FROM emailTokens WHERE tokenHash=? AND purpose=? AND expiresAt>?').get(digest(token),'verify',Date.now()) as any;
    if (!row) return false;
    // Password is chosen only after proof of mailbox possession: prevents pre-account takeover.
    db().prepare('UPDATE customers SET verifiedAt=?,passwordHash=? WHERE id=? AND verifiedAt IS NULL').run(Date.now(),hash,row.customerId);
    db().prepare('DELETE FROM emailTokens WHERE tokenHash=?').run(digest(token));
    db().prepare('DELETE FROM accountMail WHERE customerId=? AND purpose=?').run(row.customerId,'verify'); return true;
  });
}
export function requestPasswordReset(email: string) {
  if (!customerRegistrationEnabled()) throw new Error('Recuperación no disponible.');
  const row=db().prepare('SELECT id,email FROM customers WHERE email=? AND verifiedAt IS NOT NULL').get(email.trim().toLowerCase()) as any;
  if (row) transaction(()=>queueToken(row.id,row.email,'reset'));
}
export async function resetCustomerPassword(token: string, password: string) {
  if (!/^[a-f0-9]{64}$/.test(token) || password.length<12 || password.length>256) return false;
  if (!db().prepare('SELECT customerId FROM emailTokens WHERE tokenHash=? AND purpose=? AND expiresAt>?').get(digest(token),'reset',Date.now())) return false;
  const hash=await passwordHash(password);
  return transaction(()=>{
    const row=db().prepare('SELECT customerId FROM emailTokens WHERE tokenHash=? AND purpose=? AND expiresAt>?').get(digest(token),'reset',Date.now()) as any;
    if (!row) return false;
    db().prepare('UPDATE customers SET passwordHash=? WHERE id=?').run(hash,row.customerId);
    db().prepare('DELETE FROM sessions WHERE accountId=?').run(row.customerId);
    db().prepare('DELETE FROM emailTokens WHERE customerId=? AND purpose=?').run(row.customerId,'reset');
    db().prepare('DELETE FROM accountMail WHERE customerId=? AND purpose=?').run(row.customerId,'reset'); return true;
  });
}
export function customerData(account: Account) {
  if (account.role !== 'customer') throw new Error('Acceso de comprador requerido.');
  const row=db().prepare('SELECT id,name,email,createdAt,verifiedAt,profile FROM customers WHERE id=?').get(account.id) as any;
  if (!row) throw new Error('Cuenta no disponible.');
  const orders=db().prepare('SELECT id,couponCode,discount,total,status,createdAt,details FROM orders WHERE buyerId=? ORDER BY createdAt DESC').all(account.id) as Record<string,any>[];
  const consents=db().prepare('SELECT purpose,granted,version,createdAt FROM consents WHERE customerId=? ORDER BY createdAt DESC').all(account.id);
  return {account:{...row,profile:JSON.parse(row.profile)},orders:orders.map(o=>({id:String(o.id),couponCode:o.couponCode,discount:Number(o.discount),total:Number(o.total),status:Number(o.status),createdAt:Number(o.createdAt),details:JSON.parse(String(o.details))})),consents};
}
export function saveCustomerProfile(account: Account, input: Record<string,unknown>, granted: boolean) {
  if (account.role!=='customer') throw new Error('Acceso de comprador requerido.');
  const profile=granted ? Object.fromEntries(['name','lastName','phone','region','commune','country','city','deliveryAddress','branchName'].map(key=>[key,typeof input[key]==='string'?(input[key] as string).trim().slice(0,220):''])) : {};
  transaction(()=>{
    db().prepare('UPDATE customers SET profile=? WHERE id=?').run(JSON.stringify(profile),account.id);
    db().prepare('INSERT INTO consents(id,customerId,purpose,granted,version,createdAt) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),account.id,'saved_checkout_details',granted?1:0,PRIVACY_VERSION,Date.now());
  });
}
export function closeCustomerAccount(account: Account) {
  if(account.role!=='customer') throw new Error('Acceso de comprador requerido.');
  transaction(()=>{
    // Operational/tax order records remain restricted; no universal erasure promise.
    db().prepare('UPDATE orders SET buyerId=NULL WHERE buyerId=?').run(account.id);
    db().prepare('DELETE FROM sessions WHERE accountId=?').run(account.id);
    db().prepare('DELETE FROM emailTokens WHERE customerId=?').run(account.id);
    db().prepare('DELETE FROM customers WHERE id=?').run(account.id);
    db().prepare('INSERT INTO consents(id,customerId,purpose,granted,version,createdAt) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),account.id,'customer_account',0,PRIVACY_VERSION,Date.now());
    db().prepare('DELETE FROM accountMail WHERE customerId=?').run(account.id);
  });
}
export async function dispatchAccountMail() {
  const target=process.env.FAMORES_ACCOUNT_MAIL_WEBHOOK;
  const secret=process.env.FAMORES_ACCOUNT_MAIL_TOKEN;
  if (!target || !secret || new URL(target).protocol!=='https:') throw new Error('Correo de cuentas no configurado.');
  db().prepare('DELETE FROM accountMail WHERE NOT EXISTS(SELECT 1 FROM emailTokens t WHERE t.customerId=accountMail.customerId AND t.purpose=accountMail.purpose AND t.expiresAt>?)').run(Date.now());
  for(const row of db().prepare('SELECT * FROM accountMail WHERE deliveredAt IS NULL ORDER BY createdAt LIMIT 10').all()) {
    const response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify({eventId:row.id,...decryptMail(String(row.payload))}),signal:AbortSignal.timeout(5000),redirect:'error'});
    if(!response.ok) throw new Error('Entrega de correo pendiente.');
    // Delete encrypted secrets after delivery; webhook deduplicates eventId.
    db().prepare('DELETE FROM accountMail WHERE id=?').run(String(row.id));
  }
}
