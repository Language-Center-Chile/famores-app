import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import crypto from 'node:crypto';
import { calculateCartOrder, type CartSelection } from './cart';

export type Account = { id: string; name: string; email: string; role: 'admin' | 'seller' | 'customer'; passwordHash: string };
export type Coupon = { code: string; sellerId: string | null; kind: 'percent' | 'fixed'; value: number; expiresAt: number; maxUses: number; active: number };
let currentDb: DatabaseSync | undefined;
let currentPath = '';
export const commerceEnabled = () => Boolean(process.env.FAMORES_DB_PATH);
export function db() {
  const path = process.env.FAMORES_DB_PATH;
  if (!path || (!isAbsolute(path) && path !== ':memory:')) throw new Error('Panel de alianzas no configurado.');
  if (currentDb && currentPath === path) return currentDb;
  currentDb?.close();
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  currentDb = new DatabaseSync(path);
  currentPath = path;
  if (path !== ':memory:') chmodSync(path, 0o600);
  currentDb.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS coupons(code TEXT PRIMARY KEY, sellerId TEXT, kind TEXT NOT NULL, value INTEGER NOT NULL, expiresAt INTEGER NOT NULL, maxUses INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, sellerId TEXT, couponCode TEXT, discount INTEGER NOT NULL, total INTEGER NOT NULL, status INTEGER NOT NULL DEFAULT 1, createdAt INTEGER NOT NULL, details TEXT NOT NULL, flowOrder TEXT);
    CREATE TABLE IF NOT EXISTS sessions(tokenHash TEXT PRIMARY KEY, accountId TEXT NOT NULL, credentialHash TEXT NOT NULL, expiresAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY, count INTEGER NOT NULL, resetAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY, createdAt INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', details TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, type TEXT NOT NULL, createdAt INTEGER NOT NULL, payload TEXT NOT NULL, deliveredAt INTEGER);
    CREATE TABLE IF NOT EXISTS privacyRequests(id TEXT PRIMARY KEY,createdAt INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',details TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,passwordHash TEXT NOT NULL,verifiedAt INTEGER,createdAt INTEGER NOT NULL,profile TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS consents(id TEXT PRIMARY KEY,customerId TEXT NOT NULL,purpose TEXT NOT NULL,granted INTEGER NOT NULL,version TEXT NOT NULL,createdAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS emailTokens(tokenHash TEXT PRIMARY KEY,customerId TEXT NOT NULL,purpose TEXT NOT NULL,expiresAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS accountMail(id TEXT PRIMARY KEY,customerId TEXT NOT NULL,purpose TEXT NOT NULL,createdAt INTEGER NOT NULL,payload TEXT NOT NULL,deliveredAt INTEGER);
  `);
  const columns = currentDb.prepare('PRAGMA table_info(orders)').all();
  if (!columns.some(c=>c.name==='buyerId')) currentDb.exec('ALTER TABLE orders ADD COLUMN buyerId TEXT');
  return currentDb;
}
export function transaction<T>(fn: () => T): T {
  const database = db(); database.exec('BEGIN IMMEDIATE');
  try { const result = fn(); database.exec('COMMIT'); return result; }
  catch (error) { database.exec('ROLLBACK'); throw error; }
}
export function accounts(): Account[] {
  const values = JSON.parse(process.env.FAMORES_ACCOUNTS_JSON || '[]');
  if (!Array.isArray(values)) throw new Error('Configuración de cuentas no válida.');
  const ids = new Set<string>(); const emails = new Set<string>();
  for (const value of values) {
    if (typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !value.name || typeof value.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || !['admin', 'seller'].includes(value.role) || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(value.passwordHash) || ids.has(value.id) || emails.has(value.email.toLowerCase())) throw new Error('Configuración de cuentas no válida.');
    ids.add(value.id); emails.add(value.email.toLowerCase());
  }
  return values;
}
export function loginAccounts(): Account[] {
  return [...accounts(), ...db().prepare('SELECT id,name,email,passwordHash FROM customers WHERE verifiedAt IS NOT NULL').all().map(row=>({ id:String(row.id), name:String(row.name), email:String(row.email), passwordHash:String(row.passwordHash), role:'customer' as const }))];
}
export function normalizeCode(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{3,32}$/.test(value.trim())) throw new Error('Cupón no válido.');
  return value.trim().toUpperCase();
}
export function chileExpiry(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Fecha no válida.');
  const noon = new Date(date+'T12:00:00Z');
  if (!Number.isFinite(noon.getTime()) || noon.toISOString().slice(0,10)!==date) throw new Error('Fecha no válida.');
  const zone = new Intl.DateTimeFormat('en-US',{timeZone:'America/Santiago',timeZoneName:'longOffset'}).formatToParts(noon).find(p=>p.type==='timeZoneName')?.value || '';
  const offset = /^GMT([+-])(\d{2}):(\d{2})$/.exec(zone);
  if (!offset) throw new Error('Zona horaria no disponible.');
  const minutes = (Number(offset[2])*60+Number(offset[3]))*(offset[1]==='+'?1:-1);
  return Date.parse(date+'T00:00:00Z')+24*60*60*1000-minutes*60*1000-1;
}
export function saveCoupon(input: Record<string, unknown>) {
  const coupon: Coupon = {
    code: normalizeCode(input.code), sellerId: typeof input.sellerId === 'string' && input.sellerId ? input.sellerId : null,
    kind: input.kind as Coupon['kind'], value: Number(input.value), expiresAt: Number(input.expiresAt), maxUses: Number(input.maxUses), active: input.active === false ? 0 : 1,
  };
  if (!['percent','fixed'].includes(coupon.kind) || !Number.isSafeInteger(coupon.value) || coupon.value < 1 || (coupon.kind === 'percent' && coupon.value > 99) || !Number.isSafeInteger(coupon.expiresAt) || coupon.expiresAt <= Date.now() || !Number.isSafeInteger(coupon.maxUses) || coupon.maxUses < 1 || (coupon.sellerId && !accounts().some(a => a.id === coupon.sellerId && a.role === 'seller'))) throw new Error('Condiciones del cupón no válidas.');
  // Issued codes are immutable so old sales retain their attribution and terms.
  db().prepare('INSERT INTO coupons(code,sellerId,kind,value,expiresAt,maxUses,active) VALUES(?,?,?,?,?,?,?)').run(coupon.code,coupon.sellerId,coupon.kind,coupon.value,coupon.expiresAt,coupon.maxUses,coupon.active);
  return coupon;
}
export function quote(selection: CartSelection, code?: unknown) {
  const base = calculateCartOrder(selection);
  if (!code) return { ...base, discount: 0, couponCode: null, sellerId: null };
  const normalized = normalizeCode(code);
  const coupon = db().prepare('SELECT * FROM coupons WHERE code=?').get(normalized) as Coupon | undefined;
  if (!coupon || !coupon.active || coupon.expiresAt <= Date.now()) throw new Error('Cupón no válido o vencido.');
  if (coupon.sellerId && !accounts().some(a => a.id === coupon.sellerId && a.role === 'seller')) throw new Error('Cupón no disponible.');
  // Pending payments consume capacity too: do not sell more uses than available.
  const usage = db().prepare('SELECT COUNT(*) AS count FROM orders WHERE couponCode=? AND status IN (1,2)').get(normalized) as { count: number };
  if (usage.count >= coupon.maxUses) throw new Error('Cupón agotado.');
  const discount = Math.min(base.subtotal - 1, coupon.kind === 'percent' ? Math.floor(base.subtotal * coupon.value / 100) : coupon.value);
  return { ...base, discount, couponCode: normalized, sellerId: coupon.sellerId, total: base.total - discount };
}
export function reserveOrder(id: string, selection: CartSelection, code: unknown, details: unknown, buyerId: string | null = null) {
  return transaction(() => {
    const calculated = quote(selection, code);
    db().prepare('INSERT INTO orders(id,sellerId,couponCode,discount,total,createdAt,details,buyerId) VALUES(?,?,?,?,?,?,?,?)').run(id,calculated.sellerId,calculated.couponCode,calculated.discount,calculated.total,Date.now(),JSON.stringify({ breakdown: calculated, customer: details }),buyerId);
    return calculated;
  });
}
export function confirmOrder(payment: { commerceOrder?: string; flowOrder?: number; status?: number; amount?: number; currency?: string }) {
  return transaction(() => {
    const order = db().prepare('SELECT * FROM orders WHERE id=?').get(payment.commerceOrder || '') as any;
    if (!order) return false; // Legacy payments have no local order.
    if (Number(payment.amount) !== order.total || payment.currency !== 'CLP' || ![1,2,3,4].includes(Number(payment.status))) throw new Error('Pago no coincide con el pedido.');
    if (order.flowOrder && String(payment.flowOrder) !== order.flowOrder) throw new Error('Orden Flow no coincide.');
    if (order.status === 2 || (order.status !== 1 && payment.status === 1)) return false; // Duplicate/delayed callbacks cannot double-count a sale.
    db().prepare('UPDATE orders SET status=?, flowOrder=? WHERE id=?').run(Number(payment.status),String(payment.flowOrder),order.id);
    if (payment.status === 2) {
      db().prepare('INSERT OR IGNORE INTO notifications(id,type,createdAt,payload) VALUES(?,?,?,?)').run(`paid:${order.id}`,'sale_paid',Date.now(),JSON.stringify({ orderId:order.id, sellerId:order.sellerId, couponCode:order.couponCode, discount:order.discount, total:order.total }));
      return true;
    }
    return false;
  });
}
export function dashboard(account: Account) {
  if (account.role === 'customer') throw new Error('Usa tu panel de comprador.');
  const admin = account.role === 'admin';
  const orders = db().prepare(`SELECT id,sellerId,couponCode,discount,total,status,createdAt FROM orders ${admin ? '' : 'WHERE sellerId=?'} ORDER BY createdAt DESC LIMIT 500`).all(...(admin ? [] : [account.id]));
  const coupons = db().prepare(`SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.couponCode=c.code AND o.status=2) AS paidUses FROM coupons c ${admin ? '' : 'WHERE sellerId=?'} ORDER BY code`).all(...(admin ? [] : [account.id]));
  const totals = db().prepare(`SELECT COUNT(*) AS paidOrders, COALESCE(SUM(total),0) AS paidTotal, COALESCE(SUM(discount),0) AS discounts FROM orders WHERE status=2 ${admin ? '' : 'AND sellerId=?'}`).get(...(admin ? [] : [account.id]));
  return { orders, coupons, totals, applications: admin ? db().prepare('SELECT * FROM applications ORDER BY createdAt DESC LIMIT 100').all() : [], notifications: admin ? db().prepare('SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 100').all() : [] };
}
export function consumeAttempt(key: string, limit: number, windowMs: number) {
  return transaction(() => {
    const now = Date.now();
    db().prepare('DELETE FROM attempts WHERE resetAt < ?').run(now);
    const row = db().prepare('SELECT * FROM attempts WHERE key=?').get(key) as any;
    if (row && row.count >= limit) return false;
    db().prepare('INSERT INTO attempts(key,count,resetAt) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+windowMs);
    return true;
  });
}
export function submitApplication(details: Record<string, string>) {
  const id = crypto.randomUUID();
  transaction(() => {
    db().prepare('INSERT INTO applications(id,createdAt,details) VALUES(?,?,?)').run(id,Date.now(),JSON.stringify(details));
    db().prepare('INSERT INTO notifications(id,type,createdAt,payload) VALUES(?,?,?,?)').run(`application:${id}`,'partner_application',Date.now(),JSON.stringify({ applicationId:id }));
  });
  return id;
}
