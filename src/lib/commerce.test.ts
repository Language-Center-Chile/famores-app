import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { db, quote, reserveOrder, saveCoupon, confirmOrder, dashboard, accounts, consumeAttempt, submitApplication, chileExpiry } from './commerce';
import { passwordHash, authenticate, createSession, sessionAccount, deleteSession, sameOrigin } from './account';
import { dispatchNotifications } from './notifications';
const cart = { items:[{product:'Set Sin Pintar',quantity:1}],courier:'retiro' };
const coupon = (code='TEST10',extras={}) => saveCoupon({code,sellerId:'seller1',kind:'percent',value:10,expiresAt:Date.now()+86400000,maxUses:2,...extras});
const paid = (id='one',amount=22500,status=2) => ({commerceOrder:id,flowOrder:123,status,amount,currency:'CLP'});
beforeEach(async()=>{
  process.env.FAMORES_DB_PATH=':memory:';
  const hash = await passwordHash('test-only-password');
  process.env.FAMORES_ACCOUNTS_JSON=JSON.stringify([{id:'admin',name:'Admin',email:'admin@example.test',role:'admin',passwordHash:hash},{id:'seller1',name:'Seller 1',email:'one@example.test',role:'seller',passwordHash:hash},{id:'seller2',name:'Seller 2',email:'two@example.test',role:'seller',passwordHash:hash}]);
  const database=db(); for (const table of ['coupons','orders','sessions','attempts','applications','notifications']) database.exec(`DELETE FROM ${table}`);
  delete process.env.FAMORES_NOTIFICATION_WEBHOOK; delete process.env.FAMORES_NOTIFICATION_TOKEN;
});
afterEach(()=>vi.unstubAllGlobals());
describe('server coupons and payment persistence',()=>{
  it('never trusts client prices and excludes delivery and box from discounts',()=>{
    coupon();
    const result=quote({...cart,courier:'blue',region:'Metropolitana de Santiago',commune:'Peñalolén'},' test10 ');
    expect(result.discount).toBe(2500); expect(result.total).toBe(27490); expect(result.shippingPrice).toBe(3490); expect(result.boxPrice).toBe(1500);
    expect(()=>quote({items:[{product:'toString',quantity:1}],courier:'retiro'},'TEST10')).toThrow('Producto');
  });
  it('caps fixed discounts while keeping a payable total',()=>{
    coupon('FIXED',{kind:'fixed',value:999999}); expect(quote(cart,'FIXED').total).toBe(1);
  });
  it('rejects invalid, expired, disabled and exhausted codes',()=>{
    expect(()=>quote(cart,'UNKNOWN')).toThrow('Cupón'); coupon();
    db().prepare('UPDATE coupons SET expiresAt=?').run(Date.now()-1); expect(()=>quote(cart,'TEST10')).toThrow('vencido');
    db().prepare('UPDATE coupons SET expiresAt=?,active=0').run(Date.now()+86400000); expect(()=>quote(cart,'TEST10')).toThrow();
    db().prepare('UPDATE coupons SET active=1').run();
    reserveOrder('one',cart,'TEST10',{}); reserveOrder('two',cart,'TEST10',{});
    expect(()=>reserveOrder('three',cart,'TEST10',{})).toThrow('agotado');
    expect(db().prepare('SELECT COUNT(*) AS n FROM orders').get()?.n).toBe(2);
  });
  it('releases capacity only after verified rejection and counts paid sales once',()=>{
    coupon('SINGLE',{maxUses:1}); reserveOrder('one',cart,'SINGLE',{});
    confirmOrder(paid('one',22500,3)); reserveOrder('two',cart,'SINGLE',{});
    expect(confirmOrder(paid('two'))).toBe(true); expect(confirmOrder(paid('two'))).toBe(false);
    confirmOrder(paid('two',22500,1));
    expect(dashboard(accounts()[0]).totals?.paidOrders).toBe(1);
    expect(db().prepare('SELECT COUNT(*) AS n FROM notifications').get()?.n).toBe(1);
  });
  it('rejects amount, currency and Flow reference mismatches without marking paid',()=>{
    coupon(); reserveOrder('one',cart,'TEST10',{});
    expect(()=>confirmOrder(paid('one',1))).toThrow(); expect(()=>confirmOrder({...paid(),currency:'USD'})).toThrow();
    db().prepare('UPDATE orders SET flowOrder=? WHERE id=?').run('999','one'); expect(()=>confirmOrder(paid())).toThrow();
    expect(dashboard(accounts()[0]).totals?.paidOrders).toBe(0);
  });
  it('filters by authenticated seller and omits buyer details',()=>{
    coupon(); reserveOrder('one',cart,'TEST10',{email:'private@example.test',customerId:'private'}); confirmOrder(paid());
    const mine=dashboard(accounts()[1]); expect(mine.orders).toHaveLength(1); expect(mine.coupons).toHaveLength(1);
    expect(JSON.stringify(mine)).not.toContain('private'); expect(mine.applications).toEqual([]); expect(mine.notifications).toEqual([]);
    expect(dashboard(accounts()[2]).orders).toHaveLength(0); expect(dashboard(accounts()[2]).coupons).toHaveLength(0);
  });
  it('shows reserved and available coupon uses to both the administrator and its seller',()=>{
    coupon('CAPACITY',{maxUses:2});
    reserveOrder('one',cart,'CAPACITY',{});
    reserveOrder('two',cart,'CAPACITY',{});
    const counts = () => {
      for (const account of [accounts()[0],accounts()[1]]) {
        expect(dashboard(account).coupons[0]).toMatchObject({paidUses:1,pendingUses:1,remainingUses:0});
      }
    };
    confirmOrder(paid('one'));
    counts();
    confirmOrder(paid('two',22500,3));
    expect(dashboard(accounts()[1]).coupons[0]).toMatchObject({paidUses:1,pendingUses:0,remainingUses:1});
    expect(dashboard(accounts()[2]).coupons).toEqual([]);
  });
  it('keeps code attribution immutable and validates seller identity',()=>{
    coupon(); expect(()=>coupon()).toThrow(); expect(()=>coupon('INVALID',{sellerId:'admin'})).toThrow();
    expect(()=>coupon('ALLFREE',{value:100})).toThrow();
  });
  it('uses Chile summer and winter offsets for end-of-day expiry',()=>{
    expect(new Date(chileExpiry('2026-10-06')).toISOString()).toBe('2026-10-07T02:59:59.999Z');
    expect(new Date(chileExpiry('2027-06-15')).toISOString()).toBe('2027-06-16T03:59:59.999Z');
    expect(()=>chileExpiry('2026-02-30')).toThrow();
  });
});
it('preserves sales after closing and reopening the database',()=>{
  const directory=mkdtempSync(join(tmpdir(),'famores-persistence-'));
  const path=join(directory,'commerce.sqlite');
  try {
    process.env.FAMORES_DB_PATH=path; coupon(); reserveOrder('durable',cart,'TEST10',{}); confirmOrder(paid('durable'));
    process.env.FAMORES_DB_PATH=':memory:';db();
    process.env.FAMORES_DB_PATH=path;
    expect(dashboard(accounts()[0]).totals?.paidOrders).toBe(1);
    expect(db().prepare('SELECT COUNT(*) AS n FROM notifications').get()?.n).toBe(1);
  } finally { process.env.FAMORES_DB_PATH=':memory:';db();rmSync(directory,{recursive:true,force:true}); }
});
describe('account boundaries',()=>{
  it('checks passwords and stores only hashed session tokens',async()=>{
    const account=await authenticate('ONE@example.test','test-only-password'); expect(account?.id).toBe('seller1');
    expect(await authenticate('one@example.test','incorrect')).toBeNull(); expect(await authenticate('missing@example.test','test-only-password')).toBeNull();
    const token=createSession(account!); expect(sessionAccount(token)?.id).toBe('seller1');
    expect(JSON.stringify(db().prepare('SELECT * FROM sessions').all())).not.toContain(token);
    deleteSession(token); expect(sessionAccount(token)).toBeNull();
  });
  it('revokes expired sessions and sessions after password rotation',()=>{
    const account=accounts()[1]; const token=createSession(account);
    db().prepare('UPDATE sessions SET expiresAt=0').run(); expect(sessionAccount(token)).toBeNull();
    const newToken=createSession(account); process.env.FAMORES_ACCOUNTS_JSON=JSON.stringify(accounts().map(a=>a.id===account.id?{...a,passwordHash:`scrypt:${'1'.repeat(32)}:${'1'.repeat(128)}`}:a));
    expect(sessionAccount(newToken)).toBeNull();
  });
  it('rejects foreign and missing origins and enforces persistent login limits',()=>{
    delete process.env.PUBLIC_SITE_URL;
    expect(sameOrigin(new Request('https://famores.com/api',{headers:{Origin:'https://evil.example'}}))).toBe(false);
    expect(sameOrigin(new Request('https://famores.com/api'))).toBe(false);
    expect(sameOrigin(new Request('https://famores.com/api',{headers:{Origin:'https://famores.com'}}))).toBe(true);
    expect(consumeAttempt('login:test',2,60000)).toBe(true);expect(consumeAttempt('login:test',2,60000)).toBe(true);expect(consumeAttempt('login:test',2,60000)).toBe(false);
  });
});
describe('durable notifications',()=>{
  it('reports queued notifications remaining beyond the delivery batch',async()=>{
    for(let i=0;i<21;i++) submitApplication({name:'Applicant',email:'applicant@example.test'});
    process.env.FAMORES_NOTIFICATION_WEBHOOK='https://notifications.example.test/webhook';process.env.FAMORES_NOTIFICATION_TOKEN='test-token';
    const fetchMock=vi.fn().mockImplementation(async()=>new Response('',{status:200}));vi.stubGlobal('fetch',fetchMock);
    expect(await dispatchNotifications()).toEqual({sent:20,pending:true});
    expect(await dispatchNotifications()).toEqual({sent:1,pending:false});
    expect(fetchMock).toHaveBeenCalledTimes(21);
    const eventIds=fetchMock.mock.calls.map(call=>JSON.parse(call[1].body).eventId);
    expect(new Set(eventIds).size).toBe(21);
  });
  it('keeps unconfigured and failed deliveries pending, then marks successful delivery',async()=>{
    coupon(); reserveOrder('one',cart,'TEST10',{}); confirmOrder(paid());
    expect(await dispatchNotifications()).toEqual({sent:0,pending:true});
    process.env.FAMORES_NOTIFICATION_WEBHOOK='https://notifications.example.test/webhook';process.env.FAMORES_NOTIFICATION_TOKEN='test-token';
    const fetchMock=vi.fn().mockResolvedValue(new Response('',{status:500})); vi.stubGlobal('fetch',fetchMock);
    await expect(dispatchNotifications()).rejects.toThrow(); expect(db().prepare('SELECT deliveredAt FROM notifications').get()?.deliveredAt).toBeNull();
    fetchMock.mockResolvedValue(new Response('',{status:200})); await dispatchNotifications();
    expect(db().prepare('SELECT deliveredAt FROM notifications').get()?.deliveredAt).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).eventId).toBe('paid:one');
  });
  it('persists partner applications and a notification without creating accounts',()=>{
    const id=submitApplication({name:'Applicant',email:'applicant@example.test'});
    expect(db().prepare('SELECT id FROM applications WHERE id=?').get(id)?.id).toBe(id);
    expect(accounts()).toHaveLength(3); expect(dashboard(accounts()[1]).applications).toEqual([]);
    expect(db().prepare('SELECT type FROM notifications').get()?.type).toBe('partner_application');
  });
});
