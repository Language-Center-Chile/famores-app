import { randomBytes, scryptSync } from 'node:crypto';
// Read from stdin to avoid passwords in shell history or command arguments.
let password = '';
for await (const chunk of process.stdin) password += chunk.toString();
password = password.replace(/\r?\n$/, '');
if (password.length < 12 || password.length > 256) { console.error('Usa una contraseña de 12 a 256 caracteres.'); process.exit(1); }
const salt = randomBytes(16).toString('hex');
console.log(`scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`);
