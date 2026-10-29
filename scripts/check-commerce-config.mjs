import { isAbsolute, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Configuration only: never opens the database, contacts a provider or prints values.
export function checkCommerceConfig(env, nodeVersion = process.versions.node) {
  const checks = [];
  const add = (name, ok, instruction) => checks.push({ name, ok: Boolean(ok), instruction });
  const value = name => (env[name] || '').trim();
  const configured = name => Boolean(value(name)) && !/^(replace_me|your-public-domain\.example)$/i.test(value(name));
  const https = (name, originOnly = false) => {
    try {
      const url = new URL(value(name));
      return url.protocol === 'https:' && !url.username && !url.password &&
        !url.hostname.endsWith('.example') && !url.hostname.endsWith('.test') &&
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
        (!originOnly || (url.pathname === '/' && !url.search && !url.hash));
    } catch { return false; }
  };
  const [major, minor] = nodeVersion.split('.').map(Number);
  add('Node', major > 22 || (major === 22 && minor >= 13), 'Usar Node >=22.13.0.');
  add('PUBLIC_SITE_URL', https('PUBLIC_SITE_URL', true), 'Definir el origen HTTPS público del sitio, sin rutas ni credenciales.');
  const path = value('FAMORES_DB_PATH');
  const publicRoot = resolve('public');
  const publicRelative = relative(publicRoot, resolve(path || '.'));
  const insidePublic = publicRelative === '' || (!publicRelative.startsWith('..' + sep) && publicRelative !== '..' && !isAbsolute(publicRelative));
  add('FAMORES_DB_PATH', isAbsolute(path) && !insidePublic, 'Definir una ruta absoluta fuera de public en un volumen persistente.');
  let accountsValid = false;
  try {
    const accounts = JSON.parse(value('FAMORES_ACCOUNTS_JSON') || '[]');
    const ids = new Set(), emails = new Set();
    accountsValid = Array.isArray(accounts) && accounts.length > 0 && accounts.every(account => {
      if (!account || typeof account.id !== 'string' || !account.id.trim() || typeof account.name !== 'string' || !account.name.trim() || typeof account.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email) || !['admin', 'seller'].includes(account.role) || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(account.passwordHash) || ids.has(account.id) || emails.has(account.email.toLowerCase())) return false;
      ids.add(account.id); emails.add(account.email.toLowerCase()); return true;
    }) && accounts.some(account => account.role === 'admin');
  } catch {}
  add('FAMORES_ACCOUNTS_JSON', accountsValid, 'Configurar cuentas válidas y únicas, incluyendo administración; generar hashes con hash-password.mjs.');
  for (const name of ['FLOW_API_KEY', 'FLOW_SECRET_KEY']) add(name, configured(name), 'Configurar el secreto del entorno de pago elegido.');
  add('FLOW_API_URL', ['https://sandbox.flow.cl/api', 'https://www.flow.cl/api'].includes(value('FLOW_API_URL')), 'Elegir explícitamente Flow Sandbox o producción.');
  for (const name of ['FAMORES_DATA_CONTROLLER', 'FAMORES_CONTROLLER_ADDRESS', 'FAMORES_RETENTION_POLICY']) add(name, configured(name), 'Completar y validar la información real de privacidad.');
  add('FAMORES_PRIVACY_EMAIL', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('FAMORES_PRIVACY_EMAIL')), 'Definir un correo atendido para solicitudes de privacidad.');
  for (const name of ['FAMORES_ACCOUNT_MAIL_WEBHOOK', 'FAMORES_NOTIFICATION_WEBHOOK']) add(name, https(name), 'Configurar el workflow HTTPS autenticado.');
  for (const name of ['FAMORES_ACCOUNT_MAIL_TOKEN', 'FAMORES_NOTIFICATION_TOKEN']) add(name, configured(name), 'Configurar el secreto del workflow sin guardarlo en Git.');
  add('FAMORES_MAIL_ENCRYPTION_KEY', /^[a-f0-9]{64}$/.test(value('FAMORES_MAIL_ENCRYPTION_KEY')), 'Configurar una clave aleatoria de 32 bytes en hexadecimal.');
  return checks;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const checks = checkCommerceConfig(process.env);
  for (const check of checks) console.log(`${check.ok ? 'OK' : 'FALTA'} ${check.name}${check.ok ? '' : ': ' + check.instruction}`);
  const missing = checks.filter(check => !check.ok).length;
  console.log(`\n${missing ? `${missing} requisitos de configuración pendientes.` : 'Configuración con formato válido.'}`);
  console.log('Revisión manual pendiente: persistencia tras reinicio, restauración de backup, entrega de correo, Flow Sandbox y aprobación de la política. Este chequeo no certifica esos resultados.');
  process.exitCode = missing ? 1 : 0;
}
