import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const port = Number(process.env.FAMORES_REVIEW_PORT || 3017);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid review port.');
const base = `http://127.0.0.1:${port}`;
const directory = resolve(root, 'data/local-review');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const secretFile = resolve(directory, 'credentials.json');
if (!existsSync(secretFile)) writeFileSync(secretFile, JSON.stringify({ password: randomBytes(16).toString('hex'), key: randomBytes(32).toString('hex'), salt: randomBytes(16).toString('hex') }), { mode: 0o600, flag: 'wx' });
const credentials = JSON.parse(readFileSync(secretFile, 'utf8'));
const passwordHash = `scrypt:${credentials.salt}:${scryptSync(credentials.password, credentials.salt, 64).toString('hex')}`;
const accounts = ['admin', 'seller', 'other'].map(id => ({ id, role: id === 'admin' ? 'admin' : 'seller', name: `Demo ${id}`, email: `${id}@example.test`, passwordHash }));
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(FAMORES_|FLOW_|PUBLIC_SITE_URL$|NODE_OPTIONS$)/.test(key)) delete env[key];
Object.assign(env, {
  HOST: '127.0.0.1', PORT: String(port), PUBLIC_SITE_URL: base,
  FAMORES_LOCAL_REVIEW: 'yes', FAMORES_REVIEW_MAILBOX: resolve(directory, 'mailbox.jsonl'),
  FAMORES_DB_PATH: resolve(directory, 'commerce.sqlite'), FAMORES_ACCOUNTS_JSON: JSON.stringify(accounts),
  FAMORES_DATA_CONTROLLER: 'DEMO LOCAL — entidad ficticia', FAMORES_CONTROLLER_ADDRESS: 'DEMO LOCAL — dirección ficticia',
  FAMORES_PRIVACY_EMAIL: 'privacy@example.test', FAMORES_RETENTION_POLICY: 'DEMO LOCAL — datos ficticios de revisión, sin política operativa aprobada.',
  FAMORES_ACCOUNT_MAIL_WEBHOOK: 'https://mail.famores-review.test/accounts', FAMORES_ACCOUNT_MAIL_TOKEN: 'local-only',
  FAMORES_NOTIFICATION_WEBHOOK: 'https://mail.famores-review.test/notifications', FAMORES_NOTIFICATION_TOKEN: 'local-only',
  FAMORES_MAIL_ENCRYPTION_KEY: credentials.key,
  FLOW_API_URL: 'https://sandbox.flow.cl/api', FLOW_API_KEY: '', FLOW_SECRET_KEY: '',
});
const build = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], { cwd: root, env, stdio: 'inherit' });
const built = await new Promise((done, reject) => { build.once('error', reject); build.once('exit', done); });
if (built !== 0) throw new Error('Build failed.');
const server = spawn(process.execPath, ['--import', './scripts/local-review-network.mjs', 'dist/server/entry.mjs'], { cwd: root, env, stdio: 'inherit' });
server.once('error', error => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
const request = (path, data, cookie = '') => fetch(base + path, { method: 'POST', redirect: 'manual', headers: { Origin: base, Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data), signal: AbortSignal.timeout(3000) });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Server stopped before startup.');
    try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(done => setTimeout(done, 100));
  }
  if (!ready) throw new Error('Server did not start.');
  const login = await request('/api/account/login', { email: 'admin@example.test', password: credentials.password });
  if (login.status !== 303) throw new Error('Demo administrator login failed.');
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const database = new DatabaseSync(env.FAMORES_DB_PATH);
  if (!database.prepare('SELECT code FROM coupons WHERE code=?').get('DEMO10')) {
    const created = await request('/api/account/coupons', { code: 'DEMO10', sellerId: 'seller', kind: 'percent', value: '10', maxUses: '100', expiry: '2099-01-01' }, cookie);
    if (created.status !== 303) throw new Error('Demo coupon creation failed.');
  }
  database.prepare('INSERT OR IGNORE INTO customers(id,email,name,passwordHash,createdAt,verifiedAt) VALUES(?,?,?,?,?,?)').run('demo-buyer', 'buyer@example.test', 'Demo buyer', passwordHash, Date.now(), Date.now());
  database.close();
  console.log(`\nDEMO LOCAL: ${base}\nUsuarios: admin@example.test, seller@example.test, other@example.test, buyer@example.test\nContraseña: consultar el campo password de ${secretFile}\nCupón: DEMO10 (10%). Buzón simulado: ${env.FAMORES_REVIEW_MAILBOX}\nSolo datos ficticios. Pagos y llamadas externas bloqueados.\n`);
} catch (error) { server.kill(); throw error; }
await new Promise(done => server.once('exit', code => { process.exitCode = code || 0; done(); }));
