import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3018';
const child = spawn(process.execPath, ['scripts/local-commerce-review.mjs'], { env: { ...process.env, FAMORES_REVIEW_PORT: '3018' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', chunk => { log += chunk; });
child.stderr.on('data', chunk => { log += chunk; });
try {
  for (let n = 0; n < 600 && !log.includes('Solo datos ficticios.'); n++) {
    if (child.exitCode !== null) throw new Error(log);
    await new Promise(done => setTimeout(done, 100));
  }
  assert(log.includes('Solo datos ficticios.'), log);
  const { password } = JSON.parse(readFileSync('data/local-review/credentials.json', 'utf8'));
  const post = (path, data, cookie = '') => fetch(base + path, { method: 'POST', redirect: 'manual', headers: { Origin: base, Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data), signal: AbortSignal.timeout(3000) });
  const login = async email => { const response = await post('/api/account/login', { email, password }); assert.equal(response.status, 303); return response.headers.get('set-cookie').split(';')[0]; };
  const seller = await login('seller@example.test'), other = await login('other@example.test');
  await login('buyer@example.test');
  assert((await (await fetch(base + '/panel', { headers: { Cookie: seller } })).text()).includes('DEMO10'));
  assert(!(await (await fetch(base + '/panel', { headers: { Cookie: other } })).text()).includes('DEMO10'));
  const quote = await fetch(base + '/api/cart/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ product: 'Set Sin Pintar', quantity: 1 }], courier: 'retiro', couponCode: 'DEMO10' }) });
  assert.equal((await quote.json()).total, 22500);
  const email = `registration-${Date.now()}@example.test`;
  assert.equal((await post('/api/account/register', { name: 'Demo new buyer', email, consent: 'yes' })).status, 303);
  const messages = () => readFileSync('data/local-review/mailbox.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
  const verification = messages().find(event => event.recipient === email && event.type === 'verify_customer_email');
  assert(verification);
  const token = new URL(verification.url).hash.slice(1);
  assert.equal((await post('/api/account/verify', { token, password })).status, 303);
  assert.equal((await post('/api/account/verify', { token, password })).status, 400);
  await login(email);
  assert.equal((await post('/api/account/recover', { email })).status, 303);
  assert(messages().some(event => event.recipient === email && event.type === 'reset_customer_password'));
  console.log('PASS: demo users, seller isolation, 10% coupon, registration, captured verification, single-use token and recovery email.');
} finally {
  if (child.exitCode === null) { const stopped = new Promise(done => child.once('exit', done)); child.kill('SIGTERM'); await stopped; }
}
