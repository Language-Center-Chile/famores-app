import { beforeEach, expect, it, vi } from 'vitest';
import { db, saveCoupon, dashboard, accounts } from './commerce';
import { passwordHash } from './account';
import { POST as createPayment } from '../pages/api/flow/create-cart-payment';
import { POST as confirmation } from '../pages/api/flow/confirmation';
const mocks = vi.hoisted(()=>({ create:vi.fn(), status:vi.fn() }));
vi.mock('./flow',()=>({ flowPost:mocks.create, getFlowPaymentStatus:mocks.status }));
let orderId='';
const selection={items:[{product:'Set Sin Pintar',quantity:1}],courier:'retiro',name:'Local',lastName:'Test',customerId:'test-only',email:'test@example.test',couponCode:'SALE10',total:1,discount:25000};
const create=()=>createPayment({request:new Request('https://famores.com/api/flow/create-cart-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(selection)})} as any);
const confirm=()=>confirmation({request:new Request('https://famores.com/api/flow/confirmation',{method:'POST',body:new URLSearchParams({token:'local-test-token'})})} as any);
beforeEach(async()=>{
  process.env.FAMORES_DB_PATH=':memory:';
  process.env.FAMORES_ACCOUNTS_JSON=JSON.stringify([{id:'admin',name:'Admin',email:'admin@example.test',role:'admin',passwordHash:await passwordHash('test-only-password')}]);
  for(const table of ['coupons','orders','sessions','attempts','applications','notifications']) db().exec(`DELETE FROM ${table}`);
  delete process.env.FAMORES_NOTIFICATION_WEBHOOK; delete process.env.FAMORES_NOTIFICATION_TOKEN;
  saveCoupon({code:'SALE10',kind:'percent',value:10,maxUses:1,expiresAt:Date.now()+86400000});
  mocks.create.mockReset(); mocks.status.mockReset();
  mocks.create.mockImplementation(async(_path,params)=>{ orderId=params.commerceOrder; return {url:'https://sandbox.flow.cl/checkout',token:'local-only',flowOrder:123}; });
});
it('persists the authoritative discounted amount before creating Flow payment and confirms exactly once',async()=>{
  const response=await create(); expect(response.status).toBe(200);
  expect(mocks.create.mock.calls[0][1].amount).toBe(22500);
  expect(db().prepare('SELECT status,total FROM orders WHERE id=?').get(orderId)).toMatchObject({status:1,total:22500});
  mocks.status.mockResolvedValue({commerceOrder:orderId,flowOrder:123,status:2,amount:22500,currency:'CLP'});
  expect((await confirm()).status).toBe(200);expect((await confirm()).status).toBe(200);
  expect(dashboard(accounts()[0]).totals?.paidOrders).toBe(1);
  expect(db().prepare('SELECT COUNT(*) AS n FROM notifications').get()?.n).toBe(1);
});
it('does not create a Flow payment when coupon capacity is reserved',async()=>{
  expect((await create()).status).toBe(200);expect((await create()).status).toBe(400);expect(mocks.create).toHaveBeenCalledTimes(1);
});
it('keeps an ambiguous Flow failure pending for reconciliation instead of freeing capacity',async()=>{
  mocks.create.mockRejectedValue(new Error('Network timeout'));expect((await create()).status).toBe(502);
  expect(db().prepare('SELECT status FROM orders').get()?.status).toBe(1);expect((await create()).status).toBe(400);
});
it('returns retryable failure when the verified Flow amount does not match',async()=>{
  await create();mocks.status.mockResolvedValue({commerceOrder:orderId,flowOrder:123,status:2,amount:1,currency:'CLP'});
  expect((await confirm()).status).toBe(500);expect(dashboard(accounts()[0]).totals?.paidOrders).toBe(0);
});
it('accepts verified legacy callbacks without manufacturing dashboard sales',async()=>{
  mocks.status.mockResolvedValue({commerceOrder:'legacy',flowOrder:123,status:2,amount:1,currency:'CLP'});
  expect((await confirm()).status).toBe(200);expect(dashboard(accounts()[0]).orders).toHaveLength(0);
});
