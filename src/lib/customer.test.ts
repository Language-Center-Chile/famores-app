import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { db, reserveOrder, loginAccounts, dashboard } from './commerce';
import { authenticate, createSession, sessionAccount, passwordHash } from './account';
import { registerCustomer, verifyCustomer, decryptMail, requestPasswordReset, resetCustomerPassword, customerData, saveCustomerProfile, closeCustomerAccount, dispatchAccountMail, customerRegistrationEnabled } from './customer';
import { PRIVACY_VERSION } from './privacy';
const cart={items:[{product:'Set Sin Pintar',quantity:1}],courier:'retiro'};
const registration=(email='buyer@example.test',consent=true)=>registerCustomer({name:'Buyer',email,consent});
const latestToken=()=>new URL(decryptMail(String(db().prepare('SELECT payload FROM accountMail ORDER BY createdAt DESC LIMIT 1').get()!.payload)).url).hash.slice(1);
const buyer=async(email='buyer@example.test')=>{await registration(email);expect(await verifyCustomer(latestToken(),'test-only-password')).toBe(true);return loginAccounts().find(a=>a.email===email)!;};
beforeEach(async()=>{
  process.env.FAMORES_DB_PATH=':memory:';process.env.FAMORES_ACCOUNTS_JSON='[]';
  process.env.PUBLIC_SITE_URL='https://famores.com';process.env.FAMORES_DATA_CONTROLLER='Fixture operator';process.env.FAMORES_CONTROLLER_ADDRESS='Fixture address';process.env.FAMORES_PRIVACY_EMAIL='privacy@example.test';process.env.FAMORES_RETENTION_POLICY='Fixture policy, test only';
  process.env.FAMORES_MAIL_ENCRYPTION_KEY='ab'.repeat(32);process.env.FAMORES_ACCOUNT_MAIL_WEBHOOK='https://mail.example.test/workflow';process.env.FAMORES_ACCOUNT_MAIL_TOKEN='local-only-test';
  for(const table of ['customers','emailTokens','accountMail','consents','orders','sessions','coupons','notifications','attempts','privacyRequests'])db().exec(`DELETE FROM ${table}`);
});
afterEach(()=>vi.unstubAllGlobals());
it('requires a separate affirmative account choice and complete privacy/mail configuration',async()=>{
  await expect(registration(undefined,false)).rejects.toThrow();expect(db().prepare('SELECT COUNT(*) AS n FROM customers').get()?.n).toBe(0);
  delete process.env.FAMORES_DATA_CONTROLLER;expect(customerRegistrationEnabled()).toBe(false);await expect(registration()).rejects.toThrow();
});
it('creates only buyer roles and requires proof of email possession before login',async()=>{
  await registration();expect(await authenticate('buyer@example.test','test-only-password')).toBeNull();
  const token=latestToken();expect(JSON.stringify(db().prepare('SELECT * FROM emailTokens').all())).not.toContain(token);
  expect(String(db().prepare('SELECT payload FROM accountMail').get()?.payload)).not.toContain('buyer@example.test');
  expect(await verifyCustomer(token,'test-only-password')).toBe(true);expect(await verifyCustomer(token,'test-only-password')).toBe(false);
  const account=await authenticate('buyer@example.test','test-only-password');expect(account?.role).toBe('customer');
  expect(()=>dashboard(account!)).toThrow();expect(customerData(account!).account.profile).toEqual({});
  expect(customerData(account!).consents[0]).toMatchObject({purpose:'customer_account',granted:1,version:PRIVACY_VERSION});
});
it('rejects expired verification tokens and does not overwrite an existing account',async()=>{
  await registration();const token=latestToken();db().prepare('UPDATE emailTokens SET expiresAt=0').run();expect(await verifyCustomer(token,'test-only-password')).toBe(false);
  await registerCustomer({name:'Attacker',email:'buyer@example.test',consent:true});
  expect(db().prepare('SELECT name FROM customers').get()?.name).toBe('Buyer');expect(db().prepare('SELECT COUNT(*) AS n FROM customers').get()?.n).toBe(1);
});
it('shows only orders bound to the authenticated buyer ID and never adopts guest history by email',async()=>{
  const one=await buyer();const two=await buyer('other@example.test');
  reserveOrder('guest',cart,null,{email:one.email});reserveOrder('owned',cart,null,{email:one.email},one.id);reserveOrder('other',cart,null,{email:two.email},two.id);
  expect(customerData(one).orders.map(o=>o.id)).toEqual(['owned']);expect(customerData(two).orders.map(o=>o.id)).toEqual(['other']);
});
it('saves only explicitly allowed profile fields and records withdrawal without deleting operational orders',async()=>{
  const account=await buyer();reserveOrder('owned',cart,null,{customerId:'test-identifier'},account.id);
  saveCustomerProfile(account,{name:'Buyer',phone:'test-phone',deliveryAddress:'test-address',customerId:'never-save',card:'never-save',email:'fake@example.test'},true);
  expect(customerData(account).account.profile).toMatchObject({phone:'test-phone'});expect(JSON.stringify(customerData(account).account.profile)).not.toContain('never-save');
  saveCustomerProfile(account,{},false);expect(customerData(account).account.profile).toEqual({});expect(customerData(account).orders).toHaveLength(1);
  expect(customerData(account).consents.some(c=>c.purpose==='saved_checkout_details'&&c.granted===0)).toBe(true);
});
it('resets passwords with expiring single-use tokens and revokes old sessions',async()=>{
  const account=await buyer();const session=createSession(account);requestPasswordReset(account.email);const token=latestToken();
  expect(await resetCustomerPassword(token,'new-test-only-password')).toBe(true);expect(await resetCustomerPassword(token,'new-test-only-password')).toBe(false);
  expect(sessionAccount(session)).toBeNull();expect(await authenticate(account.email,'test-only-password')).toBeNull();expect((await authenticate(account.email,'new-test-only-password'))?.id).toBe(account.id);
});
it('does not reveal whether a recovery address has an account and blocks expired reset tokens',async()=>{
  requestPasswordReset('absent@example.test');expect(db().prepare('SELECT COUNT(*) AS n FROM accountMail').get()?.n).toBe(0);
  const account=await buyer();requestPasswordReset(account.email);const token=latestToken();db().prepare('UPDATE emailTokens SET expiresAt=0 WHERE purpose=?').run('reset');expect(await resetCustomerPassword(token,'new-test-only-password')).toBe(false);
});
it('closes only the buyer account and its queued mail while preserving other buyers and restricted orders',async()=>{
  const one=await buyer();const two=await buyer('other@example.test');const session=createSession(one);reserveOrder('owned',cart,null,{email:one.email},one.id);
  requestPasswordReset(one.email);requestPasswordReset(two.email);closeCustomerAccount(one);
  expect(sessionAccount(session)).toBeNull();expect(await authenticate(one.email,'test-only-password')).toBeNull();expect(customerData(two).account.id).toBe(two.id);
  expect(db().prepare('SELECT buyerId FROM orders WHERE id=?').get('owned')?.buyerId).toBeNull();expect(db().prepare('SELECT COUNT(*) AS n FROM accountMail WHERE customerId=?').get(two.id)?.n).toBe(1);
});
it('keeps account email encrypted pending failed delivery and removes secrets after successful delivery',async()=>{
  await registration();const token=latestToken();const mock=vi.fn().mockResolvedValue(new Response('',{status:503}));vi.stubGlobal('fetch',mock);
  await expect(dispatchAccountMail()).rejects.toThrow();expect(db().prepare('SELECT COUNT(*) AS n FROM accountMail').get()?.n).toBe(1);
  mock.mockResolvedValue(new Response('',{status:200}));await dispatchAccountMail();expect(db().prepare('SELECT COUNT(*) AS n FROM accountMail').get()?.n).toBe(0);
  const message=JSON.parse(mock.mock.calls[1][1].body);expect(message.recipient).toBe('buyer@example.test');expect(new URL(message.url).hash).toBe('#'+token);
});
it('cannot register over a privileged administrator identity',async()=>{
  process.env.FAMORES_ACCOUNTS_JSON=JSON.stringify([{id:'admin',name:'Admin',email:'buyer@example.test',role:'admin',passwordHash:await passwordHash('test-only-password')}]);
  await registration();expect(db().prepare('SELECT COUNT(*) AS n FROM customers').get()?.n).toBe(0);
});
