import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { loginAccounts, db, type Account } from './commerce';
const derive = promisify(crypto.scrypt);
export const SESSION_COOKIE = 'famores_session';
const digest = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
export async function passwordHash(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const key = await derive(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function authenticate(email: string, password: string) {
  const account = loginAccounts().find(a => a.email.toLowerCase() === email.trim().toLowerCase());
  const stored = account?.passwordHash || `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
  const [,salt,expected] = stored.split(':');
  const key = await derive(password, salt, 64) as Buffer;
  return crypto.timingSafeEqual(key,Buffer.from(expected,'hex')) && account ? account : null;
}
export function createSession(account: Account) {
  const token = crypto.randomBytes(32).toString('hex');
  db().prepare('DELETE FROM sessions WHERE expiresAt < ?').run(Date.now());
  db().prepare('INSERT INTO sessions(tokenHash,accountId,credentialHash,expiresAt) VALUES(?,?,?,?)').run(digest(token),account.id,digest(account.passwordHash),Date.now()+8*60*60*1000);
  return token;
}
export function sessionAccount(token?: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = db().prepare('SELECT accountId,credentialHash FROM sessions WHERE tokenHash=? AND expiresAt>?').get(digest(token),Date.now()) as any;
  return session ? loginAccounts().find(a => a.id === session.accountId && digest(a.passwordHash) === session.credentialHash) || null : null;
}
export function deleteSession(token?: string) { if (token) db().prepare('DELETE FROM sessions WHERE tokenHash=?').run(digest(token)); }
export function sameOrigin(request: Request) {
  const expected = new URL(process.env.PUBLIC_SITE_URL || request.url).origin;
  return request.headers.get('origin') === expected;
}
export const privateHeaders = { 'Cache-Control':'no-store', 'X-Robots-Tag':'noindex, nofollow' };

// Response.redirect has immutable headers; Astro must append session cookies.
export function redirectTo(request: Request, path: string) {
  return new Response(null, { status:303, headers:{...privateHeaders,Location:new URL(path,request.url).href} });
}
